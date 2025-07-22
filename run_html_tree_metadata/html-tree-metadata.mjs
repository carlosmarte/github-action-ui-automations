import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import { config } from "dotenv";
import { CSPSafeBrowserManager } from "./lib/browser-manager.mjs";
import { CSPSafeElementDetector } from "./lib/element-detector.mjs";
import { CSPSafeDOMTraverser } from "./lib/dom-traverser.mjs";

// Load environment variables
config();

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CSP-Safe HTML Tree Metadata Extractor
 *
 * This extractor works with the strictest Content Security Policy sites
 * by using ONLY Playwright's native browser automation APIs.
 * No JavaScript is executed in the page context.
 */
class CSPSafeHTMLTreeExtractor {
  constructor() {
    // Initialize modular components
    this.browserManager = new CSPSafeBrowserManager();
    this.elementDetector = new CSPSafeElementDetector();
    this.domTraverser = new CSPSafeDOMTraverser(this.elementDetector, {
      maxDepth: parseInt(process.env.MAX_DEPTH) || 15,
      maxChildren: parseInt(process.env.MAX_CHILDREN_PER_ELEMENT) || 50,
      verboseLogging: process.env.VERBOSE_LOGGING === "true",
    });

    // Output configuration
    this.outputDir = join(__dirname, "../dataset");

    // Responsive viewport configurations
    this.viewports = {
      phone: {
        width: parseInt(process.env.PHONE_WIDTH) || 375,
        height: parseInt(process.env.PHONE_HEIGHT) || 667,
        name: "phone",
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      tablet: {
        width: parseInt(process.env.TABLET_WIDTH) || 768,
        height: parseInt(process.env.TABLET_HEIGHT) || 1024,
        name: "tablet",
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      desktop: {
        width: parseInt(process.env.DESKTOP_WIDTH) || 1920,
        height: parseInt(process.env.DESKTOP_HEIGHT) || 1080,
        name: "desktop",
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    };

    // Extraction limits for performance
    this.maxDepth = parseInt(process.env.MAX_DEPTH) || 15;
    this.maxChildren = parseInt(process.env.MAX_CHILDREN_PER_ELEMENT) || 50;
    this.extractScreenshots = process.env.EXTRACT_SCREENSHOTS !== "false";
    this.verboseLogging = process.env.VERBOSE_LOGGING === "true";

    // Comprehensive CSS properties to attempt extraction
    this.cssProperties = [
      // Layout & Positioning
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "zIndex",
      "display",
      "visibility",
      "overflow",
      "overflowX",
      "overflowY",
      "float",
      "clear",

      // Dimensions
      "width",
      "height",
      "minWidth",
      "minHeight",
      "maxWidth",
      "maxHeight",

      // Spacing
      "margin",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
      "padding",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",

      // Border
      "border",
      "borderWidth",
      "borderStyle",
      "borderColor",
      "borderTop",
      "borderTopWidth",
      "borderTopStyle",
      "borderTopColor",
      "borderRight",
      "borderRightWidth",
      "borderRightStyle",
      "borderRightColor",
      "borderBottom",
      "borderBottomWidth",
      "borderBottomStyle",
      "borderBottomColor",
      "borderLeft",
      "borderLeftWidth",
      "borderLeftStyle",
      "borderLeftColor",
      "borderRadius",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomLeftRadius",
      "borderBottomRightRadius",

      // Background
      "backgroundColor",
      "backgroundImage",
      "backgroundSize",
      "backgroundPosition",
      "backgroundRepeat",
      "backgroundAttachment",
      "backgroundClip",
      "backgroundOrigin",

      // Typography
      "color",
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "fontVariant",
      "lineHeight",
      "textAlign",
      "textDecoration",
      "textTransform",
      "textIndent",
      "textShadow",
      "letterSpacing",
      "wordSpacing",
      "whiteSpace",
      "wordWrap",
      "wordBreak",

      // Flexbox
      "flexDirection",
      "flexWrap",
      "justifyContent",
      "alignItems",
      "alignContent",
      "alignSelf",
      "flex",
      "flexGrow",
      "flexShrink",
      "flexBasis",

      // Grid
      "gridTemplate",
      "gridTemplateColumns",
      "gridTemplateRows",
      "gridTemplateAreas",
      "gridGap",
      "gridRowGap",
      "gridColumnGap",
      "gridArea",
      "gridRow",
      "gridColumn",
      "gridAutoRows",
      "gridAutoColumns",
      "gridAutoFlow",
      "justifyItems",
      "alignContent",

      // Transform & Animation
      "transform",
      "transformOrigin",
      "transition",
      "animation",
      "opacity",
      "cursor",

      // Other useful properties
      "boxSizing",
      "resize",
      "userSelect",
      "pointerEvents",
      "outline",
    ];

    // HTML attributes to extract for comprehensive metadata
    this.htmlAttributes = [
      // Core attributes
      "id",
      "class",
      "style",
      "title",
      "lang",
      "dir",
      "hidden",

      // Form attributes
      "type",
      "name",
      "value",
      "placeholder",
      "required",
      "disabled",
      "readonly",
      "checked",
      "selected",
      "multiple",
      "accept",
      "autocomplete",
      "autofocus",
      "min",
      "max",
      "step",
      "pattern",
      "maxlength",
      "minlength",
      "size",
      "rows",
      "cols",

      // Link & media attributes
      "href",
      "src",
      "alt",
      "target",
      "rel",
      "download",
      "srcset",
      "sizes",
      "loading",
      "decoding",

      // Semantic attributes
      "role",
      "tabindex",
      "contenteditable",
      "draggable",
      "dropzone",

      // ARIA attributes
      "aria-label",
      "aria-labelledby",
      "aria-describedby",
      "aria-expanded",
      "aria-hidden",
      "aria-live",
      "aria-atomic",
      "aria-relevant",
      "aria-busy",
      "aria-checked",
      "aria-disabled",
      "aria-selected",
      "aria-pressed",
      "aria-invalid",
      "aria-required",
      "aria-readonly",

      // Data attributes (common ones)
      "data-testid",
      "data-test",
      "data-cy",
      "data-automation",
      "data-track",
      "data-analytics",
      "data-component",
      "data-module",

      // Custom attributes
      "for",
      "action",
      "method",
      "enctype",
      "novalidate",
    ];

    // Create output directory
    this.ensureOutputDirectory();
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      this.log(`Created output directory: ${this.outputDir}`);
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

    if (this.verboseLogging || level === "error") {
      console.log(`   ${message}`);
    }
  }

  async launchBrowser() {
    this.log("Launching browser with modular CSP-safe manager...");
    await this.browserManager.launchBrowser();
    this.log("Browser launched successfully", "success");
  }

  async createPageAndNavigate(viewport, url) {
    this.log(`Creating page and navigating for ${viewport.name} viewport...`);

    // Create page using browser manager
    const { page, pageId } = await this.browserManager.createPage(viewport);

    // Navigate using browser manager
    const pageInfo = await this.browserManager.navigateToURL(page, url);

    return { page, pageId, pageInfo };
  }

  /**
   * CSP-Safe element detection using comprehensive attribute analysis
   */
  async detectElementType(element, index = 0) {
    try {
      const attributeMap = {};

      // Collect all available attributes using direct API calls
      for (const attr of this.htmlAttributes) {
        try {
          const value = await element.getAttribute(attr);
          if (value !== null) {
            attributeMap[attr] = value;
          }
        } catch (e) {
          // Continue with other attributes
        }
      }

      // Infer tag name from attributes (CSP-safe heuristic detection)
      let tagName = "div"; // Default fallback

      // Link detection
      if (attributeMap.href) {
        tagName = "a";
      }
      // Image detection
      else if (
        attributeMap.src &&
        (attributeMap.alt !== undefined ||
          attributeMap.srcset ||
          attributeMap.loading)
      ) {
        tagName = "img";
      }
      // Form field detection
      else if (
        attributeMap.type ||
        attributeMap.name ||
        attributeMap.placeholder ||
        attributeMap.value !== undefined
      ) {
        if (attributeMap.type === "submit" || attributeMap.type === "button") {
          tagName = "button";
        } else if (attributeMap.rows || attributeMap.cols) {
          tagName = "textarea";
        } else if (attributeMap.multiple !== undefined || attributeMap.size) {
          tagName = "select";
        } else {
          tagName = "input";
        }
      }
      // Form detection
      else if (
        attributeMap.action ||
        attributeMap.method ||
        attributeMap.enctype
      ) {
        tagName = "form";
      }
      // Label detection
      else if (attributeMap.for) {
        tagName = "label";
      }
      // Role-based detection
      else if (attributeMap.role) {
        switch (attributeMap.role) {
          case "button":
            tagName = "button";
            break;
          case "link":
            tagName = "a";
            break;
          case "textbox":
            tagName = "input";
            break;
          case "checkbox":
          case "radio":
            tagName = "input";
            break;
          case "listbox":
          case "combobox":
            tagName = "select";
            break;
          case "option":
            tagName = "option";
            break;
          case "heading":
            tagName = "h1";
            break;
          case "list":
            tagName = "ul";
            break;
          case "listitem":
            tagName = "li";
            break;
          case "table":
            tagName = "table";
            break;
          case "row":
            tagName = "tr";
            break;
          case "cell":
          case "gridcell":
            tagName = "td";
            break;
          case "columnheader":
          case "rowheader":
            tagName = "th";
            break;
          case "navigation":
            tagName = "nav";
            break;
          case "main":
            tagName = "main";
            break;
          case "banner":
            tagName = "header";
            break;
          case "complementary":
            tagName = "aside";
            break;
          case "contentinfo":
            tagName = "footer";
            break;
          default:
            tagName = "div";
        }
      }

      return { tagName, attributes: attributeMap };
    } catch (error) {
      this.log(
        `Error detecting element type for element ${index}: ${error.message}`,
        "warn"
      );
      return { tagName: "div", attributes: {} };
    }
  }

  /**
   * Extract comprehensive element metadata using only CSP-safe methods
   */
  async extractElementMetadata(
    element,
    index = 0,
    depth = 0,
    viewport = "unknown"
  ) {
    try {
      // Get element type and attributes
      const { tagName, attributes } = await this.detectElementType(
        element,
        index
      );

      // Get text content using direct API
      let textContent = "";
      try {
        textContent = (await element.textContent()) || "";
        // Truncate long text for performance
        if (textContent.length > 500) {
          textContent = textContent.substring(0, 500) + "...";
        }
      } catch (e) {
        this.log(
          `Cannot get textContent for element ${index}: ${e.message}`,
          "warn"
        );
      }

      // Get bounding box (x, y, width, height)
      const boundingBox = (await element.boundingBox()) || {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };

      // Get element visibility state
      let isVisible = false;
      let isEnabled = false;
      try {
        isVisible = await element.isVisible();
        isEnabled = await element.isEnabled();
      } catch (e) {
        // These might not be available for all elements
      }

      // Determine interactivity
      const isInteractive =
        ["a", "button", "input", "select", "textarea", "label"].includes(
          tagName
        ) ||
        (attributes.role &&
          [
            "button",
            "link",
            "textbox",
            "checkbox",
            "radio",
            "tab",
            "menuitem",
          ].includes(attributes.role)) ||
        attributes.tabindex !== undefined ||
        attributes.onclick !== undefined;

      // Calculate element statistics
      const hasText = textContent.trim().length > 0;
      const hasId = !!attributes.id;
      const hasClass = !!attributes.class;
      const hasTestId = !!(
        attributes["data-testid"] ||
        attributes["data-test"] ||
        attributes["data-cy"]
      );
      const hasAriaLabel = !!(
        attributes["aria-label"] || attributes["aria-labelledby"]
      );
      const hasRole = !!attributes.role;

      // Generate locator strategies for testing
      const locatorStrategies = {
        byId: hasId ? `#${attributes.id}` : null,
        byTestId: hasTestId
          ? `[data-testid="${
              attributes["data-testid"] ||
              attributes["data-test"] ||
              attributes["data-cy"]
            }"]`
          : null,
        byRole: hasRole ? attributes.role : null,
        byText: hasText ? textContent.trim().substring(0, 30) : null,
        byLabel: hasAriaLabel
          ? attributes["aria-label"] || attributes["aria-labelledby"]
          : null,
        css: this.generateCSSSelector(tagName, attributes),
        xpath: this.generateXPathSelector(tagName, attributes),
      };

      // Create comprehensive element metadata
      const elementMetadata = {
        // Core identification
        index,
        depth,
        tagName,

        // Attributes and content
        id: attributes.id || null,
        classes: attributes.class
          ? attributes.class.split(" ").filter((c) => c.trim())
          : [],
        attributes,
        textContent: textContent.trim(),

        // Position and dimensions
        boundingBox,
        position: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
          centerX: boundingBox.x + boundingBox.width / 2,
          centerY: boundingBox.y + boundingBox.height / 2,
        },

        // State information
        isVisible,
        isEnabled,
        isInteractive,

        // Semantic data
        semanticData: {
          hasText,
          hasId,
          hasClass,
          hasTestId,
          hasAriaLabel,
          hasRole,
          isAccessible: hasRole || hasAriaLabel || hasTestId,
          isFormField: ["input", "select", "textarea"].includes(tagName),
        },

        // Testing locators
        locatorStrategies,

        // Viewport context
        viewport,

        // CSS styles placeholder (will be populated if extraction is possible)
        styles: {
          note: "CSS extraction attempted through CSP-safe methods",
          extracted: false,
          properties: {},
        },

        // Tree structure
        hasChildren: false,
        childrenCount: 0,
        children: [],
      };

      return elementMetadata;
    } catch (error) {
      this.log(
        `Error extracting metadata for element ${index} at depth ${depth}: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  generateCSSSelector(tagName, attributes) {
    if (attributes.id) {
      return `#${attributes.id}`;
    }

    let selector = tagName;
    if (attributes.class) {
      const classes = attributes.class
        .split(" ")
        .filter((c) => c.trim())
        .slice(0, 2);
      if (classes.length > 0) {
        selector += "." + classes.join(".");
      }
    }

    if (attributes.role) {
      selector += `[role="${attributes.role}"]`;
    }

    return selector;
  }

  generateXPathSelector(tagName, attributes) {
    if (attributes.id) {
      return `//*[@id="${attributes.id}"]`;
    }

    if (attributes.role) {
      return `//${tagName}[@role="${attributes.role}"]`;
    }

    if (attributes["data-testid"]) {
      return `//${tagName}[@data-testid="${attributes["data-testid"]}"]`;
    }

    return `//${tagName}`;
  }

  /**
   * Traverse DOM tree using CSP-safe methods
   */
  async traverseDOMTree(element, index = 0, depth = 0, viewport = "unknown") {
    // Limit depth to prevent infinite recursion and huge files
    if (depth > this.maxDepth) {
      return null;
    }

    // Extract metadata for current element
    const elementData = await this.extractElementMetadata(
      element,
      index,
      depth,
      viewport
    );
    if (!elementData) {
      return null;
    }

    // Get child elements using CSP-safe selector
    try {
      const childElements = await element.$$(":scope > *");

      if (childElements.length > 0) {
        elementData.hasChildren = true;
        elementData.childrenCount = childElements.length;

        // Limit children processing for performance
        const childrenToProcess = childElements.slice(0, this.maxChildren);

        if (this.verboseLogging) {
          this.log(
            `Processing ${childrenToProcess.length} children at depth ${depth} for ${elementData.tagName}`
          );
        }

        // Process each child
        for (let i = 0; i < childrenToProcess.length; i++) {
          try {
            const childData = await this.traverseDOMTree(
              childrenToProcess[i],
              i,
              depth + 1,
              viewport
            );
            if (childData) {
              elementData.children.push(childData);
            }
          } catch (childError) {
            this.log(
              `Error processing child ${i} at depth ${depth}: ${childError.message}`,
              "warn"
            );
            // Continue with other children
          }
        }

        // Note if children were truncated
        if (childElements.length > this.maxChildren) {
          elementData.children.push({
            note: `... and ${
              childElements.length - this.maxChildren
            } more children (truncated for performance)`,
            truncatedCount: childElements.length - this.maxChildren,
            totalChildren: childElements.length,
          });
        }
      }
    } catch (error) {
      this.log(
        `Error processing children for element at depth ${depth}: ${error.message}`,
        "warn"
      );
    }

    return elementData;
  }

  async takeScreenshot(page, viewport) {
    this.log(`Taking screenshot for ${viewport.name} viewport...`);
    const screenshotPath = join(
      this.outputDir,
      `html-tree-screenshot-${viewport.name}.png`
    );

    try {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      this.log(`Screenshot saved: ${screenshotPath}`, "success");
      return screenshotPath;
    } catch (error) {
      this.log(`Error taking screenshot: ${error.message}`, "error");
      return null;
    }
  }

  async processViewport(viewport, url) {
    this.log(`\n📱 PROCESSING ${viewport.name.toUpperCase()} VIEWPORT`);
    this.log("=".repeat(60));

    let page = null;
    let pageId = null;

    try {
      // Create page and navigate using browser manager
      const result = await this.createPageAndNavigate(viewport, url);
      page = result.page;
      pageId = result.pageId;
      const pageInfo = result.pageInfo;

      // Extract DOM tree using modular traverser
      this.log(`Extracting DOM tree for ${viewport.name}...`);
      const treeResult = await this.domTraverser.traverseFromBody(
        page,
        viewport.name
      );

      // Take screenshot
      let screenshotPath = null;
      if (this.extractScreenshots) {
        try {
          screenshotPath = await this.takeScreenshot(page, viewport);
        } catch (screenshotError) {
          this.log(
            `Screenshot failed for ${viewport.name}: ${screenshotError.message}`,
            "warn"
          );
        }
      }

      return {
        viewport: viewport.name,
        dimensions: { width: viewport.width, height: viewport.height },
        pageInfo,
        domTree: treeResult?.domTree || null,
        stats: treeResult?.stats || {},
        traversalTime: treeResult?.traversalTime || 0,
        screenshotPath,
        error: treeResult?.error || null,
      };
    } catch (error) {
      this.log(
        `Error processing ${viewport.name} viewport: ${error.message}`,
        "error"
      );
      return {
        viewport: viewport.name,
        dimensions: { width: viewport.width, height: viewport.height },
        error: error.message,
        domTree: null,
        stats: {},
      };
    } finally {
      // Always clean up the page
      if (pageId) {
        try {
          await this.browserManager.closePage(pageId);
        } catch (cleanupError) {
          this.log(
            `Cleanup error for ${viewport.name}: ${cleanupError.message}`,
            "warn"
          );
        }
      }
    }
  }

  calculateTreeStatistics(treeData) {
    if (!treeData || !treeData.domTree) {
      return { totalElements: 0, interactive: 0, withText: 0, visible: 0 };
    }

    const stats = {
      totalElements: 0,
      interactive: 0,
      withText: 0,
      visible: 0,
      withId: 0,
      withClass: 0,
      withTestId: 0,
      withRole: 0,
      tagDistribution: {},
      depthDistribution: {},
      maxDepth: 0,
    };

    const traverse = (node) => {
      if (!node || node.note) return; // Skip truncation notes

      stats.totalElements++;

      if (node.isInteractive) stats.interactive++;
      if (node.textContent && node.textContent.trim()) stats.withText++;
      if (node.isVisible) stats.visible++;
      if (node.semanticData?.hasId) stats.withId++;
      if (node.semanticData?.hasClass) stats.withClass++;
      if (node.semanticData?.hasTestId) stats.withTestId++;
      if (node.semanticData?.hasRole) stats.withRole++;

      // Track distributions
      stats.tagDistribution[node.tagName] =
        (stats.tagDistribution[node.tagName] || 0) + 1;
      stats.depthDistribution[node.depth] =
        (stats.depthDistribution[node.depth] || 0) + 1;
      stats.maxDepth = Math.max(stats.maxDepth, node.depth);

      // Process children
      if (node.children) {
        node.children.forEach((child) => traverse(child));
      }
    };

    traverse(treeData.domTree);
    return stats;
  }

  async generateComprehensiveReport(allViewportData) {
    this.log("Generating comprehensive HTML tree metadata report...");

    const timestamp = new Date().toISOString();
    const websiteUrl = process.env.WEBSITE_URL;

    // Calculate statistics for each viewport
    const viewportStats = {};
    const viewportTrees = {};

    for (const viewportData of allViewportData) {
      if (viewportData && viewportData.domTree) {
        viewportStats[viewportData.viewport] =
          this.calculateTreeStatistics(viewportData);
        viewportTrees[viewportData.viewport] = viewportData.domTree;
      }
    }

    // Create comprehensive report structure
    const comprehensiveReport = {
      metadata: {
        extractionTime: timestamp,
        websiteUrl: websiteUrl,
        pageTitle: allViewportData[0]?.pageInfo?.pageTitle || "Unknown",
        extractor: "CSP-Safe HTML Tree Metadata Extractor",
        version: "2.0.0",
        cspSafe: true,
        extractionMethod: "Playwright Native APIs Only",
        viewportsProcessed: allViewportData
          .map((v) => v?.viewport)
          .filter(Boolean),
        configuration: {
          maxDepth: this.maxDepth,
          maxChildren: this.maxChildren,
          screenshotsEnabled: this.extractScreenshots,
          viewports: this.viewports,
        },
      },

      // Three root JSON objects as requested
      phone: viewportTrees.phone || null,
      tablet: viewportTrees.tablet || null,
      desktop: viewportTrees.desktop || null,

      // Additional metadata and statistics
      statistics: viewportStats,

      summary: {
        totalElements: Object.values(viewportStats).reduce(
          (sum, stat) => sum + stat.totalElements,
          0
        ),
        interactiveElements: Object.values(viewportStats).reduce(
          (sum, stat) => sum + stat.interactive,
          0
        ),
        visibleElements: Object.values(viewportStats).reduce(
          (sum, stat) => sum + stat.visible,
          0
        ),
        elementsWithText: Object.values(viewportStats).reduce(
          (sum, stat) => sum + stat.withText,
          0
        ),
      },
    };

    return comprehensiveReport;
  }

  async saveResults(report) {
    this.log("Saving HTML tree metadata results...");

    const files = {
      main: join(this.outputDir, "html-tree-metadata.json"),
      summary: join(this.outputDir, "html-tree-summary.json"),
      phone: join(this.outputDir, "html-tree-phone.json"),
      tablet: join(this.outputDir, "html-tree-tablet.json"),
      desktop: join(this.outputDir, "html-tree-desktop.json"),
    };

    // Save main comprehensive report
    fs.writeFileSync(files.main, JSON.stringify(report, null, 2));
    this.log(`Main report saved: ${files.main}`, "success");

    // Save individual viewport trees
    if (report.phone) {
      fs.writeFileSync(
        files.phone,
        JSON.stringify(
          {
            metadata: report.metadata,
            viewport: "phone",
            tree: report.phone,
          },
          null,
          2
        )
      );
      this.log(`Phone viewport saved: ${files.phone}`, "success");
    }

    if (report.tablet) {
      fs.writeFileSync(
        files.tablet,
        JSON.stringify(
          {
            metadata: report.metadata,
            viewport: "tablet",
            tree: report.tablet,
          },
          null,
          2
        )
      );
      this.log(`Tablet viewport saved: ${files.tablet}`, "success");
    }

    if (report.desktop) {
      fs.writeFileSync(
        files.desktop,
        JSON.stringify(
          {
            metadata: report.metadata,
            viewport: "desktop",
            tree: report.desktop,
          },
          null,
          2
        )
      );
      this.log(`Desktop viewport saved: ${files.desktop}`, "success");
    }

    // Save summary for GitHub Actions
    const summary = {
      metadata: report.metadata,
      stats: {
        viewports: report.metadata.viewportsProcessed,
        totalElements: report.statistics,
        summary: report.summary,
        generatedFiles: Object.values(files).map((path) =>
          path.split("/").pop()
        ),
      },
    };

    fs.writeFileSync(files.summary, JSON.stringify(summary, null, 2));
    this.log(`Summary saved: ${files.summary}`, "success");

    return files;
  }

  async cleanup() {
    this.log("Cleaning up browser resources...");
    await this.browserManager.cleanup();
    this.log("Browser cleanup completed", "success");
  }
}

// Main execution function
async function runHTMLTreeExtraction() {
  const extractor = new CSPSafeHTMLTreeExtractor();

  try {
    console.log("\n🌳 CSP-SAFE HTML TREE METADATA EXTRACTION");
    console.log("==========================================");
    console.log(`📅 Started: ${new Date().toISOString()}`);
    console.log(`🖥️ Platform: ${process.platform}`);
    console.log(`🏗️ Node.js: ${process.version}`);
    console.log(`📁 Working Directory: ${process.cwd()}`);

    const websiteUrl = process.env.WEBSITE_URL;
    console.log(`\n🔧 Configuration:`);
    console.log(`   🌐 Website URL: ${websiteUrl}`);
    console.log(
      `   📱 Viewports: ${Object.keys(extractor.viewports).join(", ")}`
    );
    console.log(`   🎯 Max Depth: ${extractor.maxDepth}`);
    console.log(`   👶 Max Children: ${extractor.maxChildren}`);
    console.log(
      `   📸 Screenshots: ${
        extractor.extractScreenshots ? "Enabled" : "Disabled"
      }`
    );

    if (!websiteUrl) {
      throw new Error("WEBSITE_URL environment variable is required");
    }

    // Launch browser
    console.log("\n🚀 BROWSER SETUP");
    console.log("================");
    await extractor.launchBrowser();

    // Process all viewports
    console.log("\n📱 VIEWPORT PROCESSING");
    console.log("=====================");
    const allViewportData = [];

    for (const [name, viewport] of Object.entries(extractor.viewports)) {
      try {
        const viewportData = await extractor.processViewport(
          viewport,
          websiteUrl
        );
        allViewportData.push(viewportData);
        extractor.log(`${name} viewport processing completed`, "success");
      } catch (error) {
        extractor.log(
          `Failed to process ${name} viewport: ${error.message}`,
          "error"
        );
        allViewportData.push({ viewport: name, error: error.message });
      }
    }

    // Generate comprehensive report
    console.log("\n📊 REPORT GENERATION");
    console.log("====================");
    const report = await extractor.generateComprehensiveReport(allViewportData);

    // Save all results
    console.log("\n💾 SAVING RESULTS");
    console.log("=================");
    const savedFiles = await extractor.saveResults(report);

    // Final summary
    console.log("\n🎉 HTML TREE METADATA EXTRACTION COMPLETED!");
    console.log("===========================================");
    console.log(`📊 Total Elements: ${report.summary.totalElements}`);
    console.log(
      `🖱️ Interactive Elements: ${report.summary.interactiveElements}`
    );
    console.log(`👁️ Visible Elements: ${report.summary.visibleElements}`);
    console.log(`📝 Elements with Text: ${report.summary.elementsWithText}`);

    console.log(`\n📁 Generated Files:`);
    Object.entries(savedFiles).forEach(([type, path]) => {
      console.log(`   ${type}: ${path.split("/").pop()}`);
    });

    // Display viewport-specific stats
    console.log(`\n📱 Viewport Statistics:`);
    Object.entries(report.statistics).forEach(([viewport, stats]) => {
      console.log(
        `   ${viewport.charAt(0).toUpperCase() + viewport.slice(1)}: ${
          stats.totalElements
        } elements`
      );
    });
  } catch (error) {
    console.log("\n❌ HTML TREE METADATA EXTRACTION FAILED");
    console.log("========================================");
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    await extractor.cleanup();
  }
}

// Export for testing and run if called directly
export { CSPSafeHTMLTreeExtractor };

if (import.meta.url === `file://${process.argv[1]}`) {
  runHTMLTreeExtraction();
}
