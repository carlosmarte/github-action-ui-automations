import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { config } from "dotenv";

// Load environment variables
config();

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CSP-Safe Locator Object Builder
 *
 * Builds locator objects using only Playwright's native browser automation APIs.
 * No JavaScript is executed in the page context to ensure compatibility with
 * the strictest Content Security Policy sites.
 */
class CSPSafeLocatorBuilder {
  constructor() {
    this.browser = null;
    this.page = null;
    this.outputDir = join(__dirname, "../dataset");

    // Role configurations - can be overridden by environment variables
    this.roles = process.env.PARENT_ROLES
      ? process.env.PARENT_ROLES.split(",").map((r) => r.trim())
      : [
          "dialog",
          "list",
          "form",
          "menu",
          "navigation",
          "main",
          "banner",
          "complementary",
        ];

    this.leafRoles = process.env.LEAF_ROLES
      ? process.env.LEAF_ROLES.split(",").map((r) => r.trim())
      : [
          "button",
          "link",
          "checkbox",
          "textbox",
          "radio",
          "switch",
          "slider",
          "tab",
          "menuitem",
        ];

    // Configuration
    this.maxElementsPerRole =
      parseInt(process.env.MAX_ELEMENTS_PER_ROLE) || 100;
    this.includeNestedRoles = process.env.INCLUDE_NESTED_ROLES !== "false";
    this.verboseLogging = process.env.VERBOSE_LOGGING === "true";

    // Statistics
    this.stats = {
      totalParents: 0,
      totalLeaves: 0,
      totalLocators: 0,
      roleDistribution: {},
      processingTime: 0,
    };

    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.outputDir}`);
    }
  }

  log(message, level = "info") {
    const timestamp = new Date().toISOString();
    const prefix =
      level === "error"
        ? "❌"
        : level === "warn"
        ? "⚠️"
        : level === "success"
        ? "✅"
        : "ℹ️";
    console.log(`${prefix} [${timestamp}] ${message}`);

    if (this.verboseLogging && level !== "error") {
      console.log(`   ${message}`);
    }
  }

  // CSP-safe string escaping utility
  esc(s) {
    if (!s) return "";
    return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
  }

  async launchBrowser() {
    this.log("Launching Chromium browser with CSP-safe configuration...");
    const startTime = Date.now();

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== "false",
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security", // Only for testing - remove in production
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const launchTime = Date.now() - startTime;
    this.log(`Browser launched successfully in ${launchTime}ms`, "success");
  }

  async navigateToPage(url) {
    this.log(`Navigating to: ${url}`);

    this.page = await this.browser.newPage();

    // Set reasonable timeouts
    const timeout = parseInt(process.env.TIMEOUT) || 30000;
    this.page.setDefaultTimeout(timeout);
    this.page.setDefaultNavigationTimeout(timeout);

    const startTime = Date.now();

    try {
      // Try networkidle first (best for complete content)
      await this.page.goto(url, {
        waitUntil: "networkidle",
        timeout: 10000,
      });

      const navigationTime = Date.now() - startTime;
      this.log(
        `Navigation completed with networkidle in ${navigationTime}ms`,
        "success"
      );
    } catch (error) {
      if (
        error.message.includes("Timeout") ||
        error.message.includes("timeout")
      ) {
        this.log(
          "Networkidle timeout, falling back to domcontentloaded...",
          "warn"
        );

        await this.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        const navigationTime = Date.now() - startTime;
        this.log(
          `Navigation completed with domcontentloaded in ${navigationTime}ms`
        );
      } else {
        throw error;
      }
    }

    // Wait for additional dynamic content
    await this.page.waitForTimeout(2000);

    const pageTitle = await this.page.title();
    this.log(`Page loaded: "${pageTitle}"`);

    return { pageTitle, pageUrl: this.page.url() };
  }

  /**
   * CSP-Safe locator object builder using only Playwright APIs
   * Replaces the original buildLocatorObject function that used evaluate()
   */
  async buildLocatorObject(parent, parentRole, leaf, leafRole) {
    try {
      // Get parent name using CSP-safe methods
      const parentName = await this.getElementName(parent);

      // Get leaf name using CSP-safe methods
      const leafName = await this.getElementName(leaf);

      // Build CSS and XPath selectors using CSP-safe methods
      const { css, xpath } = await this.buildSelectorsCSPSafe(leaf);

      // Get bounding box for positioning data
      const boundingBox = await leaf.boundingBox();

      // Get additional metadata
      const [isVisible, isEnabled] = await Promise.all([
        leaf.isVisible().catch(() => false),
        leaf.isEnabled().catch(() => false),
      ]);

      return {
        parentRole,
        parentName: parentName.trim(),
        leafRole,
        leafName: leafName.trim(),
        css,
        xpath,
        boundingBox: boundingBox || { x: 0, y: 0, width: 0, height: 0 },
        isVisible,
        isEnabled,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.log(`Error building locator object: ${error.message}`, "warn");
      return null;
    }
  }

  /**
   * CSP-safe element name extraction
   */
  async getElementName(element) {
    try {
      // Try aria-label first (most reliable)
      let name = await element.getAttribute("aria-label");
      if (name) return name;

      // Try aria-labelledby
      const labelledBy = await element.getAttribute("aria-labelledby");
      if (labelledBy) {
        try {
          // Find the labelling element
          const labelElement = await this.page
            .locator(`#${labelledBy}`)
            .first();
          name = await labelElement.textContent();
          if (name) return name;
        } catch (e) {
          // Continue to next method
        }
      }

      // Try title attribute
      name = await element.getAttribute("title");
      if (name) return name;

      // Try alt attribute for images
      name = await element.getAttribute("alt");
      if (name) return name;

      // Try value attribute for inputs
      name = await element.getAttribute("value");
      if (name) return name;

      // Try placeholder for inputs
      name = await element.getAttribute("placeholder");
      if (name) return name;

      // Finally try text content
      name = await element.textContent();
      if (name && name.trim()) {
        // Truncate long text
        return name.length > 50 ? name.substring(0, 50) + "..." : name;
      }

      return "";
    } catch (error) {
      this.log(`Could not get element name: ${error.message}`, "warn");
      return "";
    }
  }

  /**
   * Build CSS and XPath selectors using CSP-safe methods
   * Replaces the evaluate() approach with direct API calls
   */
  async buildSelectorsCSPSafe(element) {
    try {
      // Try to get ID first (most reliable)
      const id = await element.getAttribute("id");
      if (id) {
        return {
          css: `#${id}`,
          xpath: `//*[@id="${id}"]`,
        };
      }

      // Build selectors based on available attributes
      const tagName = await this.inferTagName(element);
      const className = await element.getAttribute("class");
      const role = await element.getAttribute("role");
      const testId =
        (await element.getAttribute("data-testid")) ||
        (await element.getAttribute("data-test")) ||
        (await element.getAttribute("data-cy"));

      // Build CSS selector
      let css = tagName;
      if (className) {
        const classes = className
          .split(" ")
          .filter((c) => c.trim())
          .slice(0, 2);
        if (classes.length > 0) {
          css += "." + classes.join(".");
        }
      }
      if (role) {
        css += `[role="${role}"]`;
      }

      // Build XPath selector
      let xpath = `//${tagName}`;
      if (testId) {
        const attrName = (await element.getAttribute("data-testid"))
          ? "data-testid"
          : (await element.getAttribute("data-test"))
          ? "data-test"
          : "data-cy";
        xpath = `//${tagName}[@${attrName}="${testId}"]`;
      } else if (role) {
        xpath = `//${tagName}[@role="${role}"]`;
      }

      return { css, xpath };
    } catch (error) {
      this.log(`Error building selectors: ${error.message}`, "warn");
      return { css: "div", xpath: "//div" };
    }
  }

  /**
   * Infer tag name using CSP-safe attribute analysis
   */
  async inferTagName(element) {
    try {
      const href = await element.getAttribute("href");
      if (href) return "a";

      const src = await element.getAttribute("src");
      if (src) return "img";

      const type = await element.getAttribute("type");
      const role = await element.getAttribute("role");

      if (type || role) {
        if (role === "button" || type === "submit" || type === "button")
          return "button";
        if (role === "textbox" || type === "text" || type === "email")
          return "input";
        if (role === "checkbox" || type === "checkbox") return "input";
        if (role === "radio" || type === "radio") return "input";
        if (role === "link") return "a";
      }

      // Default fallback
      return "div";
    } catch (error) {
      return "div";
    }
  }

  // Generator utilities (unchanged from original)
  generateChainLocator(o) {
    const p = `page.getByRole('${o.parentRole}'${
      o.parentName ? `, { name: \`${this.esc(o.parentName)}\` }` : ""
    })`;
    const l = `.getByRole('${o.leafRole}'${
      o.leafName ? `, { name: \`${this.esc(o.leafName)}\` }` : ""
    })`;
    return p + l;
  }

  generateCSSLocator(o) {
    return `css=${o.css}`;
  }

  generateXPathLocator(o) {
    return `xpath=${o.xpath}`;
  }

  // Enhanced metadata chain generator
  generateMetaDataChain(o) {
    const meta = [];
    meta.push(["page"]);
    meta.push([
      "getByRole",
      o.parentRole,
      ...(o.parentName ? [{ name: o.parentName }] : []),
    ]);
    meta.push([
      "getByRole",
      o.leafRole,
      ...(o.leafName ? [{ name: o.leafName }] : []),
    ]);

    return {
      meta,
      boundingBox: o.boundingBox,
      isVisible: o.isVisible,
      isEnabled: o.isEnabled,
      confidence: this.calculateLocatorConfidence(o),
    };
  }

  calculateLocatorConfidence(o) {
    let confidence = 0.5; // Base confidence

    // Higher confidence for elements with names
    if (o.parentName) confidence += 0.2;
    if (o.leafName) confidence += 0.2;

    // Higher confidence for visible/enabled elements
    if (o.isVisible) confidence += 0.1;
    if (o.isEnabled) confidence += 0.1;

    // Higher confidence for elements with good selectors
    if (o.css.includes("#")) confidence += 0.3; // ID selector
    else if (o.css.includes("[data-testid")) confidence += 0.2; // Test ID
    else if (o.css.includes("[role")) confidence += 0.1; // Role selector

    return Math.min(confidence, 1.0);
  }

  /**
   * Main logic: build raw locator objects using CSP-safe methods
   */
  async buildRawLocatorObjects() {
    this.log("Building locator objects using CSP-safe role discovery...");
    const startTime = Date.now();

    const raws = [];
    let totalProcessed = 0;

    // Process each parent role
    for (const parentRole of this.roles) {
      try {
        this.log(`Processing parent role: ${parentRole}`);
        const parents = await this.page.getByRole(parentRole).all();

        if (parents.length === 0) {
          this.log(`No elements found for parent role: ${parentRole}`, "warn");
          continue;
        }

        this.log(`Found ${parents.length} elements with role: ${parentRole}`);
        this.stats.totalParents += parents.length;
        this.stats.roleDistribution[parentRole] = parents.length;

        // Limit number of parents to process for performance
        const parentsToProcess = parents.slice(0, this.maxElementsPerRole);

        for (const parent of parentsToProcess) {
          // Process each leaf role within this parent
          for (const leafRole of this.leafRoles) {
            try {
              const leaves = await parent.getByRole(leafRole).all();

              if (leaves.length > 0) {
                this.log(
                  `  Found ${leaves.length} ${leafRole} elements in ${parentRole}`
                );
                this.stats.totalLeaves += leaves.length;

                // Limit leaves to process for performance
                const leavesToProcess = leaves.slice(
                  0,
                  this.maxElementsPerRole
                );

                for (const leaf of leavesToProcess) {
                  const locatorObj = await this.buildLocatorObject(
                    parent,
                    parentRole,
                    leaf,
                    leafRole
                  );
                  if (locatorObj) {
                    raws.push(locatorObj);
                    totalProcessed++;

                    if (this.verboseLogging) {
                      this.log(
                        `  Built locator: ${parentRole} > ${leafRole} (${
                          locatorObj.leafName || "unnamed"
                        })`
                      );
                    }
                  }
                }
              }
            } catch (leafError) {
              this.log(
                `Error processing leaf role ${leafRole} in ${parentRole}: ${leafError.message}`,
                "warn"
              );
              // Continue with next leaf role
            }
          }
        }
      } catch (parentError) {
        this.log(
          `Error processing parent role ${parentRole}: ${parentError.message}`,
          "error"
        );
        // Continue with next parent role
      }
    }

    // Also discover standalone leaf elements (not within specific parent roles)
    if (this.includeNestedRoles) {
      this.log("Discovering standalone interactive elements...");
      for (const leafRole of this.leafRoles) {
        try {
          const standaloneLeaves = await this.page.getByRole(leafRole).all();

          if (standaloneLeaves.length > 0) {
            this.log(
              `Found ${standaloneLeaves.length} standalone ${leafRole} elements`
            );

            const leavesToProcess = standaloneLeaves.slice(
              0,
              this.maxElementsPerRole
            );
            for (const leaf of leavesToProcess) {
              const locatorObj = await this.buildLocatorObject(
                this.page,
                "page",
                leaf,
                leafRole
              );
              if (locatorObj) {
                raws.push(locatorObj);
                totalProcessed++;
              }
            }
          }
        } catch (leafError) {
          this.log(
            `Error processing standalone leaf role ${leafRole}: ${leafError.message}`,
            "warn"
          );
        }
      }
    }

    const processingTime = Date.now() - startTime;
    this.stats.processingTime = processingTime;
    this.stats.totalLocators = totalProcessed;

    this.log(
      `Locator object building completed in ${processingTime}ms`,
      "success"
    );
    this.log(`Total locator objects built: ${totalProcessed}`);

    return raws;
  }

  /**
   * Generate all locator formats from raw objects
   */
  generateAllLocatorFormats(raws) {
    this.log("Generating locator formats...");

    const chains = raws.map((r) => this.generateChainLocator(r));
    const csses = raws.map((r) => this.generateCSSLocator(r));
    const xpaths = raws.map((r) => this.generateXPathLocator(r));
    const metas = raws.map((r) => this.generateMetaDataChain(r));

    return { chains, csses, xpaths, metas };
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(raws, formats, pageInfo) {
    this.log("Generating comprehensive locator report...");

    const timestamp = new Date().toISOString();

    // Calculate additional statistics
    const visibleElements = raws.filter((r) => r.isVisible).length;
    const enabledElements = raws.filter((r) => r.isEnabled).length;
    const namedElements = raws.filter(
      (r) => r.leafName.trim().length > 0
    ).length;
    const avgConfidence =
      formats.metas.reduce((sum, m) => sum + m.confidence, 0) /
      formats.metas.length;

    const report = {
      metadata: {
        extractionTime: timestamp,
        websiteUrl: process.env.WEBSITE_URL,
        pageTitle: pageInfo.pageTitle,
        pageUrl: pageInfo.pageUrl,
        extractor: "CSP-Safe Locator Object Builder",
        version: "1.0.0",
        cspSafe: true,
        extractionMethod:
          "Playwright Native APIs Only - No JavaScript Execution",
        configuration: {
          parentRoles: this.roles,
          leafRoles: this.leafRoles,
          maxElementsPerRole: this.maxElementsPerRole,
          includeNestedRoles: this.includeNestedRoles,
        },
      },

      statistics: {
        ...this.stats,
        visibleElements,
        enabledElements,
        namedElements,
        averageConfidence: parseFloat(avgConfidence.toFixed(3)),
        roleDistribution: this.stats.roleDistribution,
      },

      rawObjects: raws,

      locators: {
        chains: formats.chains,
        cssSelectors: formats.csses,
        xpathSelectors: formats.xpaths,
        metadataChains: formats.metas,
      },

      summary: {
        totalLocatorObjects: raws.length,
        uniqueParentRoles: Object.keys(this.stats.roleDistribution).length,
        uniqueLeafRoles: [...new Set(raws.map((r) => r.leafRole))].length,
        processingTimeMs: this.stats.processingTime,
        averageProcessingTimePerElement:
          this.stats.processingTime / raws.length,
      },
    };

    return report;
  }

  /**
   * Save results to dataset directory
   */
  async saveResults(report) {
    this.log("Saving locator results to dataset...");

    const files = {
      main: join(this.outputDir, "build_locator_object_locator-objects.json"),
      summary: join(
        this.outputDir,
        "build_locator_object_locator-summary.json"
      ),
      chains: join(this.outputDir, "build_locator_object_locator-chains.json"),
      css: join(this.outputDir, "build_locator_object_css-selectors.json"),
      xpath: join(this.outputDir, "build_locator_object_xpath-selectors.json"),
      metadata: join(
        this.outputDir,
        "build_locator_object_metadata-chains.json"
      ),
    };

    // Save main comprehensive report
    fs.writeFileSync(files.main, JSON.stringify(report, null, 2));
    this.log(`Main report saved: ${files.main}`, "success");

    // Save summary for GitHub Actions
    const summary = {
      metadata: report.metadata,
      statistics: report.statistics,
      summary: report.summary,
      generatedFiles: Object.values(files).map((path) => path.split("/").pop()),
    };
    fs.writeFileSync(files.summary, JSON.stringify(summary, null, 2));
    this.log(`Summary saved: ${files.summary}`, "success");

    // Save individual locator format files
    fs.writeFileSync(
      files.chains,
      JSON.stringify(report.locators.chains, null, 2)
    );
    fs.writeFileSync(
      files.css,
      JSON.stringify(report.locators.cssSelectors, null, 2)
    );
    fs.writeFileSync(
      files.xpath,
      JSON.stringify(report.locators.xpathSelectors, null, 2)
    );
    fs.writeFileSync(
      files.metadata,
      JSON.stringify(report.locators.metadataChains, null, 2)
    );

    this.log(`Individual locator files saved to: ${this.outputDir}`, "success");

    return files;
  }

  async cleanup() {
    this.log("Cleaning up browser resources...");
    if (this.browser) {
      await this.browser.close();
      this.log("Browser closed successfully", "success");
    }
  }
}

// Main execution function
async function runLocatorObjectBuilder() {
  const builder = new CSPSafeLocatorBuilder();

  try {
    console.log("\n🏗️ CSP-SAFE LOCATOR OBJECT BUILDER");
    console.log("==================================");
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`🖥️ Platform: ${process.platform}`);
    console.log(`🏗️ Node.js: ${process.version}`);

    const websiteUrl = process.env.WEBSITE_URL;
    console.log(`\n🔧 Configuration:`);
    console.log(`   🌐 Website URL: ${websiteUrl}`);
    console.log(`   👥 Parent Roles: ${builder.roles.join(", ")}`);
    console.log(`   🍃 Leaf Roles: ${builder.leafRoles.join(", ")}`);
    console.log(`   📊 Max Elements/Role: ${builder.maxElementsPerRole}`);
    console.log(`   🔄 Include Nested: ${builder.includeNestedRoles}`);

    if (!websiteUrl) {
      throw new Error("WEBSITE_URL environment variable is required");
    }

    // Launch browser and navigate
    console.log("\n🚀 BROWSER SETUP");
    console.log("================");
    await builder.launchBrowser();

    console.log("\n🌐 PAGE NAVIGATION");
    console.log("==================");
    const pageInfo = await builder.navigateToPage(websiteUrl);

    // Build locator objects
    console.log("\n🔍 LOCATOR DISCOVERY");
    console.log("===================");
    const rawObjects = await builder.buildRawLocatorObjects();

    if (rawObjects.length === 0) {
      console.log(
        "⚠️ No locator objects were built. Check if the page has accessible elements."
      );
      return;
    }

    // Generate all locator formats
    console.log("\n📝 FORMAT GENERATION");
    console.log("===================");
    const formats = builder.generateAllLocatorFormats(rawObjects);

    // Generate comprehensive report
    console.log("\n📊 REPORT GENERATION");
    console.log("===================");
    const report = await builder.generateReport(rawObjects, formats, pageInfo);

    // Save all results
    console.log("\n💾 SAVING RESULTS");
    console.log("=================");
    const savedFiles = await builder.saveResults(report);

    // Final summary
    console.log("\n🎉 LOCATOR OBJECT BUILDER COMPLETED!");
    console.log("====================================");
    console.log(
      `📊 Total Locator Objects: ${report.summary.totalLocatorObjects}`
    );
    console.log(`👥 Unique Parent Roles: ${report.summary.uniqueParentRoles}`);
    console.log(`🍃 Unique Leaf Roles: ${report.summary.uniqueLeafRoles}`);
    console.log(`👁️ Visible Elements: ${report.statistics.visibleElements}`);
    console.log(`✅ Enabled Elements: ${report.statistics.enabledElements}`);
    console.log(`🏷️ Named Elements: ${report.statistics.namedElements}`);
    console.log(
      `⭐ Average Confidence: ${report.statistics.averageConfidence}`
    );
    console.log(`⏱️ Processing Time: ${report.summary.processingTimeMs}ms`);

    console.log(`\n📁 Generated Files:`);
    Object.entries(savedFiles).forEach(([type, path]) => {
      console.log(`   ${type}: ${path.split("/").pop()}`);
    });

    console.log(`\n🔝 Top Role Combinations:`);
    const roleCombos = {};
    rawObjects.forEach((obj) => {
      const combo = `${obj.parentRole} → ${obj.leafRole}`;
      roleCombos[combo] = (roleCombos[combo] || 0) + 1;
    });

    Object.entries(roleCombos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([combo, count]) => {
        console.log(`   ${combo}: ${count} elements`);
      });
  } catch (error) {
    console.log("\n❌ LOCATOR OBJECT BUILDER FAILED");
    console.log("=================================");
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    await builder.cleanup();
  }
}

// Export for testing and run if called directly
export { CSPSafeLocatorBuilder };

if (import.meta.url === `file://${process.argv[1]}`) {
  runLocatorObjectBuilder();
}
