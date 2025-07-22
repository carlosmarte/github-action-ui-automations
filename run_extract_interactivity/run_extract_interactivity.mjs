#!/usr/bin/env node

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
 * CSP-Safe Interactivity Extractor
 *
 * Extracts interactive elements and simulates user interactions using only
 * Playwright's native browser automation APIs. No JavaScript is executed
 * in the page context to ensure compatibility with strictest CSP policies.
 */
class CSPSafeInteractivityExtractor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.outputDir = join(__dirname, "../dataset");

    // Configuration from environment
    this.websiteUrl = process.env.WEBSITE_URL;
    this.headless = process.env.HEADLESS !== "false";
    this.timeout = parseInt(process.env.TIMEOUT) || 30000;
    this.verboseLogging = process.env.VERBOSE_LOGGING === "true";
    this.maxInteractionsPerType =
      parseInt(process.env.MAX_INTERACTIONS_PER_TYPE) || 20;
    this.enableScreenshots = process.env.ENABLE_SCREENSHOTS === "true";

    // Statistics tracking
    this.stats = {
      inputFields: { total: 0, successful: 0, failed: 0 },
      clickableElements: { total: 0, successful: 0, failed: 0 },
      hoverableElements: { total: 0, successful: 0, failed: 0 },
      screenshots: 0,
      processingTime: 0,
      interactions: [],
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

  // Input field configurations with mock data
  get INPUT_CONFIGURATIONS() {
    return {
      'input[type="text"]:visible': {
        name: "text-input",
        mockValues: [
          "John Doe",
          "Jane Smith",
          "Alex Johnson",
          "Sample User Name",
          "123 Main Street",
          "New York",
          "Company Inc.",
          "Department Name",
        ],
      },
      'input[type="email"]:visible': {
        name: "email-input",
        mockValues: [
          "test@example.com",
          "user@domain.org",
          "sample@company.com",
          "demo@testing.net",
          "john.doe@email.com",
          "contact@business.org",
        ],
      },
      'input[type="search"]:visible': {
        name: "search-input",
        mockValues: [
          "sample search query",
          "find products",
          "search results",
          "test search",
          "product name",
          "service lookup",
          "help topics",
        ],
      },
      'input[type="tel"]:visible': {
        name: "phone-input",
        mockValues: [
          "(555) 123-4567",
          "+1-800-555-0199",
          "555.987.6543",
          "1234567890",
        ],
      },
      'input[type="url"]:visible': {
        name: "url-input",
        mockValues: [
          "https://www.example.com",
          "https://demo.website.org",
          "http://sample.site.net",
        ],
      },
      "textarea:visible": {
        name: "textarea",
        mockValues: [
          "This is sample text for testing purposes",
          "Long form content example for demonstration",
          "Multi-line text input simulation",
          "Comments and feedback example text",
          "Description field sample content",
        ],
      },
      'input[placeholder*="name" i]:visible': {
        name: "name-field",
        mockValues: [
          "John Smith",
          "Maria Rodriguez",
          "David Chen",
          "Sarah Johnson",
        ],
      },
      'input[placeholder*="address" i]:visible': {
        name: "address-field",
        mockValues: [
          "123 Main Street",
          "456 Oak Avenue",
          "789 Pine Road",
          "321 Elm Boulevard",
        ],
      },
      'input[placeholder*="city" i]:visible': {
        name: "city-field",
        mockValues: [
          "New York",
          "Los Angeles",
          "Chicago",
          "Houston",
          "Phoenix",
        ],
      },
      'input[placeholder*="zip" i]:visible, input[placeholder*="postal" i]:visible':
        {
          name: "postal-code",
          mockValues: ["12345", "90210", "10001", "60601"],
        },
    };
  }

  // Clickable elements with risk assessment and priority
  get CLICKABLE_CONFIGURATIONS() {
    return {
      // Safe navigation elements (high priority)
      "nav a:visible": {
        name: "navigation-links",
        riskLevel: "safe",
        priority: "high",
        description: "Main navigation menu links",
      },
      'button[role="tab"]:visible': {
        name: "tab-buttons",
        riskLevel: "safe",
        priority: "high",
        description: "Tab navigation buttons for switching content",
      },
      '[role="button"][aria-label*="menu" i]:visible': {
        name: "menu-toggles",
        riskLevel: "safe",
        priority: "high",
        description: "Menu toggle buttons",
      },

      // Interactive UI elements (medium priority)
      'button[type="button"]:not([onclick]):visible': {
        name: "ui-buttons",
        riskLevel: "medium",
        priority: "medium",
        description: "General UI interaction buttons without onclick handlers",
      },
      'button[aria-label*="carousel" i]:visible, button[aria-label*="next" i]:visible, button[aria-label*="prev" i]:visible':
        {
          name: "carousel-controls",
          riskLevel: "safe",
          priority: "medium",
          description: "Carousel navigation buttons (next/previous)",
        },
      '[role="button"]:not([type="submit"]):visible': {
        name: "aria-buttons",
        riskLevel: "medium",
        priority: "medium",
        description: "Elements with button role (excluding submit buttons)",
      },
      "button[aria-expanded]:visible": {
        name: "expandable-buttons",
        riskLevel: "safe",
        priority: "medium",
        description: "Dropdown or expandable content buttons",
      },

      // Content links (medium priority)
      'a:not([href*="mailto:"]):not([href*="tel:"]):not([href^="#"]):visible': {
        name: "content-links",
        riskLevel: "medium",
        priority: "medium",
        description: "Content links (excluding email, tel, and anchor links)",
      },

      // Form elements (low priority - more risky)
      'input[type="button"]:visible': {
        name: "input-buttons",
        riskLevel: "medium",
        priority: "low",
        description: "Form input buttons",
      },
      'button[type="submit"]:visible': {
        name: "submit-buttons",
        riskLevel: "high",
        priority: "low",
        description: "Form submit buttons - handled carefully",
      },
    };
  }

  // Hoverable elements for interaction simulation
  get HOVERABLE_CONFIGURATIONS() {
    return {
      "nav a:visible": {
        name: "navigation-hovers",
        description: "Navigation menu items",
      },
      '.menu-item:visible, [role="menuitem"]:visible': {
        name: "menu-items",
        description: "Dropdown menu items",
      },
      'button:not([type="submit"]):visible': {
        name: "button-hovers",
        description: "Interactive buttons",
      },
      '[role="button"]:visible': {
        name: "aria-button-hovers",
        description: "ARIA button elements",
      },
      "a[title]:visible": {
        name: "titled-links",
        description: "Links with descriptive titles",
      },
    };
  }

  async launchBrowser() {
    this.log("Launching Chromium browser with CSP-safe configuration...");
    const startTime = Date.now();

    this.browser = await chromium.launch({
      headless: this.headless,
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
    this.page.setDefaultTimeout(this.timeout);
    this.page.setDefaultNavigationTimeout(this.timeout);

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
   * CSP-safe element information extraction
   */
  async extractElementInfo(element) {
    try {
      const [
        tagName,
        id,
        className,
        textContent,
        boundingBox,
        isVisible,
        isEnabled,
      ] = await Promise.all([
        this.inferTagName(element),
        element.getAttribute("id").catch(() => null),
        element.getAttribute("class").catch(() => null),
        element.textContent().catch(() => ""),
        element.boundingBox().catch(() => null),
        element.isVisible().catch(() => false),
        element.isEnabled().catch(() => false),
      ]);

      // Get additional attributes
      const attributes = {};
      const commonAttrs = [
        "type",
        "placeholder",
        "aria-label",
        "title",
        "href",
        "role",
        "data-testid",
        "name",
      ];

      for (const attr of commonAttrs) {
        try {
          const value = await element.getAttribute(attr);
          if (value) attributes[attr] = value;
        } catch (e) {
          // Ignore attribute access errors
        }
      }

      return {
        tagName,
        id,
        className,
        textContent: textContent
          ? textContent.substring(0, 100) +
            (textContent.length > 100 ? "..." : "")
          : "",
        attributes,
        boundingBox,
        isVisible,
        isEnabled,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.log(`Error extracting element info: ${error.message}`, "warn");
      return null;
    }
  }

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

  /**
   * Test input fields with mock data
   */
  async testInputFields() {
    this.log("Testing input fields with mock data...");
    const startTime = Date.now();
    const inputResults = [];

    for (const [selector, config] of Object.entries(
      this.INPUT_CONFIGURATIONS
    )) {
      try {
        this.log(`Processing input type: ${config.name}`);
        const elements = await this.page.locator(selector).all();

        if (elements.length === 0) {
          this.log(`No elements found for selector: ${selector}`, "warn");
          continue;
        }

        this.log(`Found ${elements.length} ${config.name} elements`);
        this.stats.inputFields.total += elements.length;

        // Limit interactions for performance
        const elementsToTest = elements.slice(0, this.maxInteractionsPerType);

        for (let i = 0; i < elementsToTest.length; i++) {
          const element = elementsToTest[i];
          const mockValue = config.mockValues[i % config.mockValues.length];

          try {
            // Extract element info before interaction
            const elementInfo = await this.extractElementInfo(element);

            // Clear any existing value and fill with mock data
            await element.clear();
            await element.fill(mockValue);

            // Verify the value was set (CSP-safe way)
            const currentValue = await element.inputValue();
            const success = currentValue === mockValue;

            if (success) {
              this.stats.inputFields.successful++;
            } else {
              this.stats.inputFields.failed++;
              this.log(
                `Failed to set value for ${config.name}: expected "${mockValue}", got "${currentValue}"`,
                "warn"
              );
            }

            // Record interaction
            const interaction = {
              type: "input",
              category: config.name,
              selector,
              mockValue,
              success,
              elementInfo,
              timestamp: new Date().toISOString(),
            };

            inputResults.push(interaction);
            this.stats.interactions.push(interaction);

            if (this.verboseLogging) {
              this.log(
                `  Input test ${success ? "successful" : "failed"}: ${
                  config.name
                } with "${mockValue}"`
              );
            }

            // Small delay between interactions
            await this.page.waitForTimeout(100);
          } catch (error) {
            this.stats.inputFields.failed++;
            this.log(`Error testing ${config.name}: ${error.message}`, "warn");

            const interaction = {
              type: "input",
              category: config.name,
              selector,
              mockValue,
              success: false,
              error: error.message,
              timestamp: new Date().toISOString(),
            };

            inputResults.push(interaction);
            this.stats.interactions.push(interaction);
          }
        }
      } catch (error) {
        this.log(
          `Error processing input selector ${selector}: ${error.message}`,
          "error"
        );
      }
    }

    const processingTime = Date.now() - startTime;
    this.log(`Input field testing completed in ${processingTime}ms`, "success");
    this.log(
      `Input results: ${this.stats.inputFields.successful} successful, ${this.stats.inputFields.failed} failed`
    );

    return inputResults;
  }

  /**
   * Test clickable elements with risk assessment
   */
  async testClickableElements() {
    this.log("Testing clickable elements...");
    const startTime = Date.now();
    const clickResults = [];

    // Sort by priority (high -> medium -> low)
    const sortedConfigs = Object.entries(this.CLICKABLE_CONFIGURATIONS).sort(
      (a, b) => {
        const priorities = { high: 3, medium: 2, low: 1 };
        return priorities[b[1].priority] - priorities[a[1].priority];
      }
    );

    for (const [selector, config] of sortedConfigs) {
      try {
        this.log(
          `Processing clickable type: ${config.name} (${config.priority} priority, ${config.riskLevel} risk)`
        );
        const elements = await this.page.locator(selector).all();

        if (elements.length === 0) {
          this.log(`No elements found for selector: ${selector}`, "warn");
          continue;
        }

        this.log(`Found ${elements.length} ${config.name} elements`);
        this.stats.clickableElements.total += elements.length;

        // Limit interactions based on risk level
        const maxInteractions =
          config.riskLevel === "high"
            ? 1
            : config.riskLevel === "medium"
            ? 5
            : this.maxInteractionsPerType;

        const elementsToTest = elements.slice(
          0,
          Math.min(elements.length, maxInteractions)
        );

        for (let i = 0; i < elementsToTest.length; i++) {
          const element = elementsToTest[i];

          try {
            // Extract element info before interaction
            const elementInfo = await this.extractElementInfo(element);

            // For high-risk elements, just record without clicking
            if (config.riskLevel === "high") {
              const interaction = {
                type: "click",
                category: config.name,
                selector,
                riskLevel: config.riskLevel,
                priority: config.priority,
                description: config.description,
                action: "analyzed_only",
                success: true,
                elementInfo,
                timestamp: new Date().toISOString(),
              };

              clickResults.push(interaction);
              this.stats.interactions.push(interaction);
              this.stats.clickableElements.successful++;

              this.log(
                `  High-risk element analyzed (not clicked): ${config.name}`,
                "warn"
              );
              continue;
            }

            // Attempt to click safe/medium risk elements
            const clickable = elementInfo.isVisible && elementInfo.isEnabled;

            if (!clickable) {
              this.log(`  Skipping non-clickable ${config.name}`, "warn");
              this.stats.clickableElements.failed++;
              continue;
            }

            // Perform click with timeout protection
            const clickPromise = element.click({ timeout: 5000 });
            await Promise.race([
              clickPromise,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Click timeout")), 5000)
              ),
            ]);

            this.stats.clickableElements.successful++;

            const interaction = {
              type: "click",
              category: config.name,
              selector,
              riskLevel: config.riskLevel,
              priority: config.priority,
              description: config.description,
              action: "clicked",
              success: true,
              elementInfo,
              timestamp: new Date().toISOString(),
            };

            clickResults.push(interaction);
            this.stats.interactions.push(interaction);

            if (this.verboseLogging) {
              this.log(`  Click successful: ${config.name}`);
            }

            // Wait for any page changes to settle
            await this.page.waitForTimeout(500);
          } catch (error) {
            this.stats.clickableElements.failed++;
            this.log(`Error clicking ${config.name}: ${error.message}`, "warn");

            const interaction = {
              type: "click",
              category: config.name,
              selector,
              riskLevel: config.riskLevel,
              priority: config.priority,
              description: config.description,
              action: "failed",
              success: false,
              error: error.message,
              timestamp: new Date().toISOString(),
            };

            clickResults.push(interaction);
            this.stats.interactions.push(interaction);
          }
        }
      } catch (error) {
        this.log(
          `Error processing clickable selector ${selector}: ${error.message}`,
          "error"
        );
      }
    }

    const processingTime = Date.now() - startTime;
    this.log(
      `Clickable element testing completed in ${processingTime}ms`,
      "success"
    );
    this.log(
      `Click results: ${this.stats.clickableElements.successful} successful, ${this.stats.clickableElements.failed} failed`
    );

    return clickResults;
  }

  /**
   * Test hoverable elements
   */
  async testHoverableElements() {
    this.log("Testing hoverable elements...");
    const startTime = Date.now();
    const hoverResults = [];

    for (const [selector, config] of Object.entries(
      this.HOVERABLE_CONFIGURATIONS
    )) {
      try {
        this.log(`Processing hoverable type: ${config.name}`);
        const elements = await this.page.locator(selector).all();

        if (elements.length === 0) {
          this.log(`No elements found for selector: ${selector}`, "warn");
          continue;
        }

        this.log(`Found ${elements.length} ${config.name} elements`);
        this.stats.hoverableElements.total += elements.length;

        // Limit interactions for performance
        const elementsToTest = elements.slice(
          0,
          Math.min(elements.length, this.maxInteractionsPerType)
        );

        for (let i = 0; i < elementsToTest.length; i++) {
          const element = elementsToTest[i];

          try {
            // Extract element info before interaction
            const elementInfo = await this.extractElementInfo(element);

            if (!elementInfo.isVisible) {
              this.log(`  Skipping non-visible ${config.name}`, "warn");
              this.stats.hoverableElements.failed++;
              continue;
            }

            // Perform hover with timeout protection
            await element.hover({ timeout: 3000 });

            this.stats.hoverableElements.successful++;

            const interaction = {
              type: "hover",
              category: config.name,
              selector,
              description: config.description,
              success: true,
              elementInfo,
              timestamp: new Date().toISOString(),
            };

            hoverResults.push(interaction);
            this.stats.interactions.push(interaction);

            if (this.verboseLogging) {
              this.log(`  Hover successful: ${config.name}`);
            }

            // Small delay between hovers
            await this.page.waitForTimeout(200);
          } catch (error) {
            this.stats.hoverableElements.failed++;
            this.log(`Error hovering ${config.name}: ${error.message}`, "warn");

            const interaction = {
              type: "hover",
              category: config.name,
              selector,
              description: config.description,
              success: false,
              error: error.message,
              timestamp: new Date().toISOString(),
            };

            hoverResults.push(interaction);
            this.stats.interactions.push(interaction);
          }
        }
      } catch (error) {
        this.log(
          `Error processing hoverable selector ${selector}: ${error.message}`,
          "error"
        );
      }
    }

    const processingTime = Date.now() - startTime;
    this.log(
      `Hoverable element testing completed in ${processingTime}ms`,
      "success"
    );
    this.log(
      `Hover results: ${this.stats.hoverableElements.successful} successful, ${this.stats.hoverableElements.failed} failed`
    );

    return hoverResults;
  }

  /**
   * Take screenshot if enabled
   */
  async takeScreenshot(name) {
    if (!this.enableScreenshots) return null;

    try {
      const screenshotPath = join(
        this.outputDir,
        `interactivity-${name}-${Date.now()}.png`
      );
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      this.stats.screenshots++;
      this.log(`Screenshot saved: ${screenshotPath}`, "success");
      return screenshotPath;
    } catch (error) {
      this.log(`Screenshot failed: ${error.message}`, "warn");
      return null;
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(inputResults, clickResults, hoverResults, pageInfo) {
    this.log("Generating comprehensive interactivity report...");

    const timestamp = new Date().toISOString();
    const totalInteractions = this.stats.interactions.length;
    const successfulInteractions = this.stats.interactions.filter(
      (i) => i.success
    ).length;
    const failedInteractions = totalInteractions - successfulInteractions;

    const report = {
      metadata: {
        extractionTime: timestamp,
        websiteUrl: this.websiteUrl,
        pageTitle: pageInfo.pageTitle,
        pageUrl: pageInfo.pageUrl,
        extractor: "CSP-Safe Interactivity Extractor",
        version: "1.0.0",
        cspSafe: true,
        extractionMethod:
          "Playwright Native APIs Only - No JavaScript Execution",
        configuration: {
          maxInteractionsPerType: this.maxInteractionsPerType,
          enableScreenshots: this.enableScreenshots,
          headless: this.headless,
          timeout: this.timeout,
        },
      },

      statistics: {
        ...this.stats,
        totalInteractions,
        successfulInteractions,
        failedInteractions,
        successRate:
          totalInteractions > 0
            ? ((successfulInteractions / totalInteractions) * 100).toFixed(2) +
              "%"
            : "0%",
      },

      results: {
        inputFieldTests: inputResults,
        clickableElementTests: clickResults,
        hoverableElementTests: hoverResults,
      },

      interactions: this.stats.interactions,

      summary: {
        totalInputFields: this.stats.inputFields.total,
        totalClickableElements: this.stats.clickableElements.total,
        totalHoverableElements: this.stats.hoverableElements.total,
        totalInteractions,
        successfulInteractions,
        failedInteractions,
        processingTimeMs: this.stats.processingTime,
        screenshotsTaken: this.stats.screenshots,
      },
    };

    return report;
  }

  /**
   * Save results to dataset directory
   */
  async saveResults(report) {
    this.log("Saving interactivity results to dataset...");

    const files = {
      main: join(this.outputDir, "extract_interactivity-report.json"),
      summary: join(this.outputDir, "extract_interactivity-summary.json"),
      inputs: join(
        this.outputDir,
        "extract_interactivity-input-field-results.json"
      ),
      clicks: join(
        this.outputDir,
        "extract_interactivity-clickable-element-results.json"
      ),
      hovers: join(
        this.outputDir,
        "extract_interactivity-hoverable-element-results.json"
      ),
      interactions: join(
        this.outputDir,
        "extract_interactivity-all-interactions.json"
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

    // Save individual result files
    fs.writeFileSync(
      files.inputs,
      JSON.stringify(report.results.inputFieldTests, null, 2)
    );
    fs.writeFileSync(
      files.clicks,
      JSON.stringify(report.results.clickableElementTests, null, 2)
    );
    fs.writeFileSync(
      files.hovers,
      JSON.stringify(report.results.hoverableElementTests, null, 2)
    );
    fs.writeFileSync(
      files.interactions,
      JSON.stringify(report.interactions, null, 2)
    );

    this.log(`Individual result files saved to: ${this.outputDir}`, "success");

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
async function runInteractivityExtraction() {
  const extractor = new CSPSafeInteractivityExtractor();

  try {
    console.log("\n🎯 CSP-SAFE INTERACTIVITY EXTRACTOR");
    console.log("===================================");
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`🖥️ Platform: ${process.platform}`);
    console.log(`🏗️ Node.js: ${process.version}`);

    const websiteUrl = extractor.websiteUrl;
    console.log(`\n🔧 Configuration:`);
    console.log(`   🌐 Website URL: ${websiteUrl}`);
    console.log(
      `   📊 Max Interactions/Type: ${extractor.maxInteractionsPerType}`
    );
    console.log(`   📸 Screenshots Enabled: ${extractor.enableScreenshots}`);
    console.log(`   🔍 Verbose Logging: ${extractor.verboseLogging}`);

    if (!websiteUrl) {
      throw new Error("WEBSITE_URL environment variable is required");
    }

    // Launch browser and navigate
    console.log("\n🚀 BROWSER SETUP");
    console.log("================");
    await extractor.launchBrowser();

    console.log("\n🌐 PAGE NAVIGATION");
    console.log("==================");
    const pageInfo = await extractor.navigateToPage(websiteUrl);

    // Take initial screenshot
    await extractor.takeScreenshot("initial");

    // Test input fields
    console.log("\n📝 INPUT FIELD TESTING");
    console.log("======================");
    const inputResults = await extractor.testInputFields();

    // Take screenshot after input testing
    await extractor.takeScreenshot("after-inputs");

    // Test clickable elements
    console.log("\n🖱️ CLICKABLE ELEMENT TESTING");
    console.log("============================");
    const clickResults = await extractor.testClickableElements();

    // Take screenshot after click testing
    await extractor.takeScreenshot("after-clicks");

    // Test hoverable elements
    console.log("\n🎯 HOVERABLE ELEMENT TESTING");
    console.log("============================");
    const hoverResults = await extractor.testHoverableElements();

    // Take final screenshot
    await extractor.takeScreenshot("final");

    // Generate comprehensive report
    console.log("\n📊 REPORT GENERATION");
    console.log("===================");
    extractor.stats.processingTime = Date.now();
    const report = await extractor.generateReport(
      inputResults,
      clickResults,
      hoverResults,
      pageInfo
    );

    // Save all results
    console.log("\n💾 SAVING RESULTS");
    console.log("=================");
    const savedFiles = await extractor.saveResults(report);

    // Final summary
    console.log("\n🎉 INTERACTIVITY EXTRACTION COMPLETED!");
    console.log("=====================================");
    console.log(`📊 Total Interactions: ${report.summary.totalInteractions}`);
    console.log(`✅ Successful: ${report.summary.successfulInteractions}`);
    console.log(`❌ Failed: ${report.summary.failedInteractions}`);
    console.log(`📈 Success Rate: ${report.statistics.successRate}`);
    console.log(`📝 Input Fields Tested: ${report.summary.totalInputFields}`);
    console.log(
      `🖱️ Clickable Elements Tested: ${report.summary.totalClickableElements}`
    );
    console.log(
      `🎯 Hoverable Elements Tested: ${report.summary.totalHoverableElements}`
    );
    console.log(`📸 Screenshots Taken: ${report.summary.screenshotsTaken}`);

    console.log(`\n📁 Generated Files:`);
    Object.entries(savedFiles).forEach(([type, path]) => {
      console.log(`   ${type}: ${path.split("/").pop()}`);
    });

    console.log(`\n🔝 Top Interaction Types:`);
    const interactionCounts = {};
    extractor.stats.interactions.forEach((interaction) => {
      const key = `${interaction.type} → ${interaction.category}`;
      interactionCounts[key] = (interactionCounts[key] || 0) + 1;
    });

    Object.entries(interactionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count} interactions`);
      });
  } catch (error) {
    console.log("\n❌ INTERACTIVITY EXTRACTION FAILED");
    console.log("==================================");
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    await extractor.cleanup();
  }
}

// Export for testing and run if called directly
export { CSPSafeInteractivityExtractor };

if (import.meta.url === `file://${process.argv[1]}`) {
  runInteractivityExtraction();
}
