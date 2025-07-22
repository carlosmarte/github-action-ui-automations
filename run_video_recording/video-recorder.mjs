import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ============================================================================
// INTERACTION CONFIGURATION CONSTANTS
// ============================================================================

// Input selectors with their corresponding mock data mappings
const INPUT_CONFIGURATIONS = {
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
    mockValues: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"],
  },
  'input[placeholder*="zip" i]:visible, input[placeholder*="postal" i]:visible':
    {
      name: "postal-code",
      mockValues: ["12345", "90210", "10001", "60601"],
    },
};

// Clickable elements with risk assessment and priority
const CLICKABLE_CONFIGURATIONS = {
  // Safe navigation elements (high priority)
  // 'nav a:visible': {
  //   name: 'navigation-links',
  //   riskLevel: 'safe',
  //   priority: 'high',
  //   description: 'Main navigation menu links'
  // },
  'button[role="tab"]:visible': {
    name: "tab-buttons",
    riskLevel: "safe",
    priority: "high",
    description: "Tab navigation buttons for switching content",
  },
  // '[role="button"][aria-label*="menu" i]:visible': {
  //   name: "menu-toggles",
  //   riskLevel: "safe",
  //   priority: "high",
  //   description: "Menu toggle buttons",
  // },

  // Interactive UI elements (medium priority)
  // 'button[type="button"]:not([onclick]):visible': {
  //   name: 'ui-buttons',
  //   riskLevel: 'medium',
  //   priority: 'medium',
  //   description: 'General UI interaction buttons without onclick handlers'
  // },
  'button[aria-label*="carousel" i]:visible, button[aria-label*="next" i]:visible, button[aria-label*="prev" i]:visible':
    {
      name: "carousel-controls",
      riskLevel: "safe",
      priority: "medium",
      description: "Carousel navigation buttons (next/previous)",
    },
  // '[role="button"]:not([type="submit"]):visible': {
  //   name: "aria-buttons",
  //   riskLevel: "medium",
  //   priority: "medium",
  //   description: "Elements with button role (excluding submit buttons)",
  // },
  "button[aria-expanded]:visible": {
    name: "expandable-buttons",
    riskLevel: "safe",
    priority: "medium",
    description: "Dropdown or expandable content buttons",
  },

  // Content links (medium priority)
  // 'a:not([href*="mailto:"]):not([href*="tel:"]):not([href^="#"]):visible': {
  //   name: "content-links",
  //   riskLevel: "medium",
  //   priority: "medium",
  //   description: "Content links (excluding email, tel, and anchor links)",
  // },

  // Form elements (low priority - more risky)
  // 'input[type="button"]:visible': {
  //   name: "input-buttons",
  //   riskLevel: "medium",
  //   priority: "low",
  //   description: "Form input buttons",
  // },
  // 'button[type="submit"]:visible': {
  //   name: "submit-buttons",
  //   riskLevel: "high",
  //   priority: "low",
  //   description: "Form submit buttons - handled carefully",
  // },
};

// Hoverable elements for interaction simulation
const HOVERABLE_CONFIGURATIONS = {
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

// Helper function to get random mock value for input type
function getRandomMockValue(inputConfig) {
  const values = inputConfig.mockValues;
  return values[Math.floor(Math.random() * values.length)];
}

// Helper function to get input configuration by selector matching
function getInputConfiguration(element, allConfigs) {
  for (const [selector, config] of Object.entries(allConfigs)) {
    // This is a simplified check - in reality you'd want more sophisticated matching
    if (selector.includes("email") && element.type === "email") return config;
    if (selector.includes("search") && element.type === "search") return config;
    if (selector.includes("tel") && element.type === "tel") return config;
    if (selector.includes("url") && element.type === "url") return config;
    if (selector.includes("textarea") && element.tagName === "TEXTAREA")
      return config;
    if (selector.includes("text") && element.type === "text") return config;
  }
  return INPUT_CONFIGURATIONS['input[type="text"]:visible']; // fallback
}

// Helper function to analyze URL changes for navigation detection
function analyzeUrlChange(previousUrl, newUrl) {
  try {
    const prevUrl = new URL(previousUrl);
    const newUrlObj = new URL(newUrl);
    
    const analysis = {
      type: 'unknown',
      pathChange: null,
      domainChange: false,
      fromDomain: prevUrl.hostname,
      toDomain: newUrlObj.hostname,
      hashChange: null,
      queryChange: null,
      isExternal: false
    };

    // Check for domain change
    if (prevUrl.hostname !== newUrlObj.hostname) {
      analysis.domainChange = true;
      analysis.isExternal = true;
      analysis.type = 'External Navigation';
    }

    // Check for path change
    if (prevUrl.pathname !== newUrlObj.pathname) {
      analysis.pathChange = `${prevUrl.pathname} → ${newUrlObj.pathname}`;
      if (!analysis.domainChange) {
        analysis.type = 'Internal Page Navigation';
      }
    }

    // Check for hash change (SPA navigation)
    if (prevUrl.hash !== newUrlObj.hash) {
      analysis.hashChange = `${prevUrl.hash || '(none)'} → ${newUrlObj.hash || '(none)'}`;
      if (!analysis.pathChange && !analysis.domainChange) {
        analysis.type = 'Hash/SPA Navigation';
      }
    }

    // Check for query parameter change
    if (prevUrl.search !== newUrlObj.search) {
      analysis.queryChange = `${prevUrl.search || '(none)'} → ${newUrlObj.search || '(none)'}`;
      if (!analysis.pathChange && !analysis.domainChange && !analysis.hashChange) {
        analysis.type = 'Query Parameter Change';
      }
    }

    // If no specific change detected but URLs are different
    if (analysis.type === 'unknown' && previousUrl !== newUrl) {
      analysis.type = 'URL Modification';
    }

    return analysis;
  } catch (error) {
    return {
      type: 'URL Parse Error',
      pathChange: `${previousUrl} → ${newUrl}`,
      domainChange: false,
      fromDomain: 'unknown',
      toDomain: 'unknown',
      hashChange: null,
      queryChange: null,
      isExternal: false,
      error: error.message
    };
  }
}

class VideoRecorder {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.state = {
      outputDir: path.join(__dirname, "..", "dataset"),
      videoRecording: {
        enabled: false,
        options: null,
        context: null,
        startTime: null,
        endTime: null,
      },
      interactions: [],
      metadata: {
        totalDuration: 0,
        recordingQuality: "medium",
        viewportSize: { width: 1280, height: 720 },
        userAgent: null,
        finalVideoPath: null,
        fileSize: 0,
      },
    };
  }

  async enableVideoRecording(options = {}) {
    try {
      console.log("📹 ENABLING VIDEO RECORDING");
      console.log("===========================");

      // Get current viewport for default dimensions if needed
      const viewportSize = this.page?.viewportSize() || {
        width: options.width || 1280,
        height: options.height || 720,
      };

      // Set up video recording options with defaults
      const videoOptions = {
        dir: options.dir || path.join(this.state.outputDir, "videos"),
        size: {
          width: options.width || viewportSize.width,
          height: options.height || viewportSize.height,
        },
        mode: options.mode || "retain-on-failure", // 'record-on-failure' | 'retain-on-failure' | 'off'
      };

      // Create video directory if it doesn't exist
      console.log(`📁 Creating video directory: ${videoOptions.dir}`);
      fs.mkdirSync(videoOptions.dir, { recursive: true });
      console.log("✅ Video directory created successfully");

      console.log(`📹 Video recording configuration:`);
      console.log(`   Directory: ${videoOptions.dir}`);
      console.log(
        `   Dimensions: ${videoOptions.size.width}x${videoOptions.size.height}`
      );
      console.log(`   Mode: ${videoOptions.mode}`);

      // Store current page info if available
      let currentUrl = null;
      let currentUserAgent = null;

      if (this.page) {
        currentUrl = this.page.url();
        try {
          currentUserAgent = await this.page.evaluate(
            () => navigator.userAgent
          );
        } catch (e) {
          console.log("   ⚠️  Could not retrieve user agent from current page");
        }
      }

      // Close existing context if we have one
      if (this.context) {
        console.log("🔄 Closing existing context to enable video recording...");
        await this.context.close();
      }

      // Create a new browser context with video recording enabled
      console.log("🌐 Creating new context with video recording enabled...");
      const contextStart = Date.now();

      this.context = await this.browser.newContext({
        recordVideo: videoOptions,
        viewport: viewportSize,
        userAgent:
          currentUserAgent ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        locale: "en-US",
      });

      console.log(`✅ Context created in ${Date.now() - contextStart}ms`);

      // Create a new page in the recording-enabled context
      console.log("📄 Creating new page in recording context...");
      const pageStart = Date.now();
      this.page = await this.context.newPage();
      console.log(`✅ Page created in ${Date.now() - pageStart}ms`);

      // Navigate to the current URL if we're on a real page
      if (
        currentUrl &&
        !currentUrl.startsWith("about:") &&
        currentUrl !== "about:blank"
      ) {
        console.log(`🔄 Navigating to previous URL: ${currentUrl}`);
        const navStart = Date.now();
        await this.page.goto(currentUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        console.log(`✅ Navigation completed in ${Date.now() - navStart}ms`);
      }

      // Update state to track video recording
      this.state.videoRecording = {
        enabled: true,
        options: videoOptions,
        context: this.context,
        startTime: new Date().toISOString(),
      };

      this.state.metadata.viewportSize = viewportSize;
      this.state.metadata.userAgent = currentUserAgent;

      console.log("✅ Video recording enabled successfully");
      return videoOptions;
    } catch (error) {
      console.error(`❌ Error enabling video recording: ${error.message}`);
      console.error(`   Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async simulateUserInteractions(interactionConfig = {}) {
    console.log("\n🎭 SIMULATING USER INTERACTIONS");
    console.log("===============================");

    const config = {
      scrolling: interactionConfig.scrolling !== false, // default true
      clicking: interactionConfig.clicking !== false, // default true
      hovering: interactionConfig.hovering !== false, // default true
      typing: interactionConfig.typing !== false, // default true
      waitTime: interactionConfig.waitTime || 2000, // wait between actions
      ...interactionConfig,
    };

    console.log("🎯 Interaction configuration:");
    console.log(`   Scrolling: ${config.scrolling}`);
    console.log(`   Clicking: ${config.clicking}`);
    console.log(`   Hovering: ${config.hovering}`);
    console.log(`   Typing: ${config.typing}`);
    console.log(`   Wait time between actions: ${config.waitTime}ms`);

    try {
      // 1. Scroll through the page
      if (config.scrolling) {
        console.log("\n📜 Performing scroll interactions...");
        await this.simulateScrolling(config.waitTime);
      }

      // 2. Click on interactive elements
      if (config.clicking) {
        console.log("\n🖱️  Performing click interactions...");
        await this.simulateClicking(config.waitTime);
      }

      // 3. Hover over elements
      if (config.hovering) {
        console.log("\n🎯 Performing hover interactions...");
        await this.simulateHovering(config.waitTime);
      }

      // 4. Type in input fields
      if (config.typing) {
        console.log("\n⌨️  Performing typing interactions...");
        await this.simulateTyping(config.waitTime);
      }

      console.log("✅ User interaction simulation completed");
    } catch (error) {
      console.error(`❌ Error during interaction simulation: ${error.message}`);
      throw error;
    }
  }

  async simulateScrolling(waitTime) {
    try {
      console.log("   → Attempting to get page dimensions...");
      let viewportHeight, documentHeight;

      try {
        // Try to get dimensions using page.evaluate
        viewportHeight = await this.page.evaluate(() => window.innerHeight);
        documentHeight = await this.page.evaluate(
          () => document.documentElement.scrollHeight
        );
      } catch (evalError) {
        console.log(`   ⚠️  page.evaluate blocked: ${evalError.message}`);
        console.log("   → Using alternative scrolling method...");

        // Fallback: Use viewport size and estimate document height
        const viewport = this.page.viewportSize();
        viewportHeight = viewport ? viewport.height : 720;

        // Use a reasonable estimate for document height
        documentHeight = viewportHeight * 3; // Assume 3x viewport height
        console.log(
          `   → Using estimated dimensions: viewport=${viewportHeight}px, document=${documentHeight}px`
        );
      }

      console.log(`   Viewport height: ${viewportHeight}px`);
      console.log(`   Document height: ${documentHeight}px`);

      if (documentHeight <= viewportHeight) {
        console.log("   ⏭️  Page fits in viewport, skipping scroll");
        return;
      }

      const scrollSteps = Math.min(
        5,
        Math.ceil(documentHeight / viewportHeight)
      );
      console.log(
        `   Performing ${scrollSteps} scroll steps using native Playwright methods...`
      );

      for (let i = 0; i < scrollSteps; i++) {
        const scrollTo = (documentHeight / scrollSteps) * (i + 1);
        console.log(
          `   → Scrolling to position ${Math.round(scrollTo)}px (step ${
            i + 1
          }/${scrollSteps})`
        );

        try {
          // Method 1: Try page.evaluate with fallback
          try {
            await this.page.evaluate((y) => {
              window.scrollTo({ top: y, behavior: "smooth" });
            }, scrollTo);
          } catch (evalScrollError) {
            console.log(
              `   → page.evaluate scroll failed, using keyboard method...`
            );

            // Method 2: Use keyboard-based scrolling
            await this.page.keyboard.press("End"); // Scroll to bottom first
            await this.page.waitForTimeout(500);

            // Then use Page Down to scroll incrementally
            for (let j = 0; j < i + 1; j++) {
              await this.page.keyboard.press("PageDown");
              await this.page.waitForTimeout(300);
            }
          }
        } catch (scrollMethodError) {
          console.log(
            `   → Keyboard scroll also failed: ${scrollMethodError.message}`
          );

          // Method 3: Use mouse wheel scrolling
          try {
            console.log(`   → Trying mouse wheel scrolling...`);
            const scrollAmount = scrollTo / scrollSteps;
            for (let k = 0; k < i + 1; k++) {
              await this.page.mouse.wheel(0, scrollAmount);
              await this.page.waitForTimeout(200);
            }
          } catch (mouseError) {
            console.log(
              `   → Mouse wheel scroll failed: ${mouseError.message}`
            );

            // Method 4: Element-based scrolling
            try {
              console.log(`   → Trying element-based scrolling...`);
              // Find a large element and scroll to it
              const elements = await this.page
                .locator("div, section, article, main")
                .all();
              if (elements.length > i) {
                await elements[
                  Math.min(i, elements.length - 1)
                ].scrollIntoViewIfNeeded();
              }
            } catch (elementError) {
              console.log(
                `   → Element scroll failed: ${elementError.message}`
              );
            }
          }
        }

        this.state.interactions.push({
          type: "scroll",
          position: scrollTo,
          timestamp: new Date().toISOString(),
        });

        await this.page.waitForTimeout(waitTime);
      }

      // Scroll back to top using multiple methods
      console.log("   → Scrolling back to top");
      try {
        await this.page.evaluate(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      } catch (evalTopError) {
        console.log("   → Using keyboard Home to scroll to top...");
        try {
          await this.page.keyboard.press("Home");
        } catch (homeError) {
          console.log("   → Using mouse wheel to scroll to top...");
          await this.page.mouse.wheel(0, -documentHeight);
        }
      }

      await this.page.waitForTimeout(waitTime);
    } catch (error) {
      console.log(`   ⚠️  All scrolling methods failed: ${error.message}`);
      console.log(
        "   → Recording will continue without scrolling interactions"
      );
    }
  }

  async simulateClicking(waitTime) {
    try {
      // Sort clickable configurations by priority
      const sortedConfigs = Object.entries(CLICKABLE_CONFIGURATIONS).sort(
        (a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b[1].priority] - priorityOrder[a[1].priority];
        }
      );

      console.log(
        `   Processing ${sortedConfigs.length} clickable element types by priority...`
      );

      for (const [selector, config] of sortedConfigs) {
        try {
          console.log(
            `   → Checking ${config.name} (${config.priority} priority, ${config.riskLevel} risk)`
          );
          const elements = await this.page.locator(selector).all();
          const visibleElements = [];

          // Filter for actually visible and clickable elements
          const maxElements =
            config.priority === "high"
              ? 3
              : config.priority === "medium"
              ? 2
              : 1;
          for (const element of elements.slice(0, maxElements)) {
            try {
              if (await element.isVisible()) {
                visibleElements.push(element);
              }
            } catch (e) {
              // Skip if element is not accessible
            }
          }

          console.log(
            `     Found ${visibleElements.length} ${config.name} elements`
          );

          for (const element of visibleElements) {
            try {
              const text =
                (await element.textContent()) ||
                (await element.getAttribute("aria-label")) ||
                (await element.getAttribute("title")) ||
                "Unknown";
              const elementType =
                (await element.getAttribute("type")) || "button";
              const role = (await element.getAttribute("role")) || "";

              console.log(
                `   → Clicking ${config.name}: "${text.substring(
                  0,
                  50
                )}..." (${elementType}${role ? ", role=" + role : ""})`
              );

              // Special handling for high-risk elements
              if (config.riskLevel === "high") {
                console.log(
                  `   ⚠️  High-risk element detected - handling carefully`
                );
                if (
                  text.toLowerCase().includes("submit") ||
                  text.toLowerCase().includes("send")
                ) {
                  console.log(
                    `   ⏭️  Skipping submit-like element to avoid form submission`
                  );
                  continue;
                }
              }

              // Record pre-click state
              const preClickUrl = this.page.url();
              const preClickTitle = await this.page.title().catch(() => 'Unknown');
              
              // Get element position for precise tracking
              const boundingBox = await element.boundingBox().catch(() => null);
              
              // Additional element attributes for better tracking
              const elementId = await element.getAttribute('id') || '';
              const elementClass = await element.getAttribute('class') || '';
              const elementHref = await element.getAttribute('href') || '';
              const elementDataAttributes = {};
              
              // Collect data-* attributes
              const allAttributes = await element.evaluate(el => {
                const attrs = {};
                for (let attr of el.attributes) {
                  if (attr.name.startsWith('data-')) {
                    attrs[attr.name] = attr.value;
                  }
                }
                return attrs;
              }).catch(() => ({}));

              console.log(`   🎯 CLICK TRACE - PRE-CLICK STATE:`);
              console.log(`      Element: ${config.name}`);
              console.log(`      Text: "${text.substring(0, 100)}"`);
              console.log(`      ID: ${elementId || 'N/A'}`);
              console.log(`      Class: ${elementClass || 'N/A'}`);
              console.log(`      Href: ${elementHref || 'N/A'}`);
              console.log(`      Position: ${boundingBox ? `${boundingBox.x}, ${boundingBox.y}` : 'N/A'}`);
              console.log(`      Current URL: ${preClickUrl}`);
              console.log(`      Current Title: ${preClickTitle}`);

              // Scroll element into view and click
              await element.scrollIntoViewIfNeeded();
              
              const clickStart = Date.now();
              await element.click({ timeout: 5000 });
              const clickDuration = Date.now() - clickStart;

              // Wait a moment for any navigation or changes to occur
              await this.page.waitForTimeout(1000);

              // Check for changes after click
              const postClickUrl = this.page.url();
              const postClickTitle = await this.page.title().catch(() => 'Unknown');
              const urlChanged = preClickUrl !== postClickUrl;
              const titleChanged = preClickTitle !== postClickTitle;

              console.log(`   📊 CLICK TRACE - POST-CLICK STATE:`);
              console.log(`      Click Duration: ${clickDuration}ms`);
              console.log(`      URL Changed: ${urlChanged ? '✅ YES' : '❌ NO'}`);
              
              if (urlChanged) {
                console.log(`   🌐 NAVIGATION DETECTED - URL CHANGE:`);
                console.log(`      ← PREVIOUS: ${preClickUrl}`);
                console.log(`      → NEW:      ${postClickUrl}`);
                
                // Analyze the type of navigation
                const urlAnalysis = analyzeUrlChange(preClickUrl, postClickUrl);
                console.log(`      📋 Navigation Type: ${urlAnalysis.type}`);
                console.log(`      🔍 Path Change: ${urlAnalysis.pathChange}`);
                if (urlAnalysis.domainChange) {
                  console.log(`      ⚠️  DOMAIN CHANGE: ${urlAnalysis.fromDomain} → ${urlAnalysis.toDomain}`);
                }
                if (urlAnalysis.hashChange) {
                  console.log(`      # Hash Change: ${urlAnalysis.hashChange}`);
                }
                if (urlAnalysis.queryChange) {
                  console.log(`      ? Query Change: ${urlAnalysis.queryChange}`);
                }
              }
              
              console.log(`      Title Changed: ${titleChanged ? '✅ YES' : '❌ NO'}`);
              if (titleChanged) {
                console.log(`   📄 TITLE CHANGE:`);
                console.log(`      ← PREVIOUS: "${preClickTitle}"`);
                console.log(`      → NEW:      "${postClickTitle}"`);
              }

              // Check for any JavaScript errors that occurred during click
              const jsErrorsAfterClick = [];
              this.page.on('pageerror', error => {
                jsErrorsAfterClick.push({
                  message: error.message,
                  timestamp: new Date().toISOString()
                });
              });

              // Check for any network activity triggered by the click
              const networkActivity = [];
              this.page.on('response', response => {
                if (response.request().isNavigationRequest()) {
                  networkActivity.push({
                    url: response.url(),
                    status: response.status(),
                    timestamp: new Date().toISOString()
                  });
                }
              });

              // Enhanced interaction record with detailed tracing
              const interactionRecord = {
                type: "click",
                elementType: config.name,
                selector: selector,
                text: text.substring(0, 100),
                riskLevel: config.riskLevel,
                priority: config.priority,
                timestamp: new Date().toISOString(),
                
                // Enhanced tracking data
                elementDetails: {
                  id: elementId,
                  class: elementClass,
                  href: elementHref,
                  type: elementType,
                  role: role,
                  position: boundingBox,
                  dataAttributes: allAttributes
                },
                clickMetrics: {
                  duration: clickDuration,
                  successful: true
                },
                pageState: {
                  preClick: {
                    url: preClickUrl,
                    title: preClickTitle
                  },
                  postClick: {
                    url: postClickUrl,
                    title: postClickTitle
                  },
                  changes: {
                    urlChanged: urlChanged,
                    titleChanged: titleChanged,
                    navigationOccurred: urlChanged,
                    jsErrors: jsErrorsAfterClick.length,
                    networkRequests: networkActivity.length
                  },
                  navigation: urlChanged ? analyzeUrlChange(preClickUrl, postClickUrl) : null
                }
              };

              this.state.interactions.push(interactionRecord);

              // Log summary of this click interaction
              console.log(`   ✅ CLICK COMPLETED - SUMMARY:`);
              console.log(`      Target: ${config.name} "${text.substring(0, 30)}..."`);
              console.log(`      Success: ✅ Clicked in ${clickDuration}ms`);
              console.log(`      Impact: ${urlChanged ? '🔄 Navigation' : '🔧 UI Change'}`);
              console.log(`      Risk Level: ${config.riskLevel.toUpperCase()}`);
              console.log(`   ────────────────────────────────────────`);

              await this.page.waitForTimeout(waitTime);
            } catch (clickError) {
              console.log(
                `   ⚠️  Could not click ${config.name}: ${clickError.message}`
              );
            }
          }
        } catch (selectorError) {
          console.log(
            `   ⚠️  Could not find ${config.name}: ${selectorError.message}`
          );
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Clicking simulation failed: ${error.message}`);
    }
  }

  async simulateHovering(waitTime) {
    try {
      console.log(
        `   Processing ${
          Object.keys(HOVERABLE_CONFIGURATIONS).length
        } hoverable element types...`
      );

      for (const [selector, config] of Object.entries(
        HOVERABLE_CONFIGURATIONS
      )) {
        try {
          console.log(`   → Checking ${config.name}: ${config.description}`);
          const elements = await this.page.locator(selector).all();

          for (const element of elements.slice(0, 2)) {
            // Limit to first 2 elements per type
            try {
              if (await element.isVisible()) {
                const text =
                  (await element.textContent()) ||
                  (await element.getAttribute("aria-label")) ||
                  (await element.getAttribute("title")) ||
                  "Unknown";
                console.log(
                  `   → Hovering over ${config.name}: "${text.substring(
                    0,
                    50
                  )}..."`
                );

                await element.scrollIntoViewIfNeeded();
                await element.hover({ timeout: 5000 });

                this.state.interactions.push({
                  type: "hover",
                  elementType: config.name,
                  selector: selector,
                  text: text.substring(0, 100),
                  description: config.description,
                  timestamp: new Date().toISOString(),
                });

                await this.page.waitForTimeout(waitTime / 2); // Shorter wait for hover
              }
            } catch (hoverError) {
              console.log(
                `   ⚠️  Could not hover over ${config.name}: ${hoverError.message}`
              );
            }
          }
        } catch (selectorError) {
          console.log(
            `   ⚠️  Could not find ${config.name}: ${selectorError.message}`
          );
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Hovering simulation failed: ${error.message}`);
    }
  }

  async simulateTyping(waitTime) {
    try {
      console.log(
        `   Processing ${
          Object.keys(INPUT_CONFIGURATIONS).length
        } input field types with contextual mock data...`
      );

      for (const [selector, config] of Object.entries(INPUT_CONFIGURATIONS)) {
        try {
          console.log(`   → Checking ${config.name} fields...`);
          const elements = await this.page.locator(selector).all();

          for (const element of elements.slice(0, 2)) {
            // Limit to first 2 elements per type
            try {
              if ((await element.isVisible()) && (await element.isEditable())) {
                const placeholder =
                  (await element.getAttribute("placeholder")) || "";
                const id = (await element.getAttribute("id")) || "";
                const name = (await element.getAttribute("name")) || "";
                const type = (await element.getAttribute("type")) || "text";

                // Get contextually appropriate mock value
                const mockValue = getRandomMockValue(config);

                // Enhanced field detection for better mock data selection
                let contextualValue = mockValue;
                if (
                  placeholder.toLowerCase().includes("name") ||
                  id.toLowerCase().includes("name") ||
                  name.toLowerCase().includes("name")
                ) {
                  contextualValue = getRandomMockValue(
                    INPUT_CONFIGURATIONS['input[placeholder*="name" i]:visible']
                  );
                } else if (
                  placeholder.toLowerCase().includes("address") ||
                  id.toLowerCase().includes("address")
                ) {
                  contextualValue = getRandomMockValue(
                    INPUT_CONFIGURATIONS[
                      'input[placeholder*="address" i]:visible'
                    ]
                  );
                } else if (
                  placeholder.toLowerCase().includes("city") ||
                  id.toLowerCase().includes("city")
                ) {
                  contextualValue = getRandomMockValue(
                    INPUT_CONFIGURATIONS['input[placeholder*="city" i]:visible']
                  );
                } else if (
                  placeholder.toLowerCase().includes("zip") ||
                  placeholder.toLowerCase().includes("postal")
                ) {
                  contextualValue = getRandomMockValue(
                    INPUT_CONFIGURATIONS[
                      'input[placeholder*="zip" i]:visible, input[placeholder*="postal" i]:visible'
                    ]
                  );
                }

                const fieldDescription =
                  placeholder || id || name || `${config.name} field`;
                console.log(
                  `   → Typing in ${config.name} (${fieldDescription}): "${contextualValue}"`
                );

                await element.scrollIntoViewIfNeeded();
                await element.click();
                await element.fill(""); // Clear existing text
                await element.type(contextualValue, { delay: 100 }); // Type with delay for visual effect

                this.state.interactions.push({
                  type: "type",
                  elementType: config.name,
                  selector: selector,
                  text: contextualValue,
                  placeholder: placeholder,
                  fieldId: id,
                  fieldName: name,
                  inputType: type,
                  mockDataCategory: config.name,
                  timestamp: new Date().toISOString(),
                });

                await this.page.waitForTimeout(waitTime);
              }
            } catch (typeError) {
              console.log(
                `   ⚠️  Could not type in ${config.name}: ${typeError.message}`
              );
            }
          }
        } catch (selectorError) {
          console.log(
            `   ⚠️  Could not find ${config.name}: ${selectorError.message}`
          );
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Typing simulation failed: ${error.message}`);
    }
  }

  async startRecording() {
    console.log("\n🚀 STARTING VIDEO RECORDING PROCESS");
    console.log("====================================");

    try {
      this.state.videoRecording.startTime = new Date().toISOString();
      console.log(
        `⏱️  Recording started at: ${this.state.videoRecording.startTime}`
      );

      return true;
    } catch (error) {
      console.error(`❌ Error starting recording: ${error.message}`);
      throw error;
    }
  }

  async stopRecording() {
    console.log("\n🛑 STOPPING VIDEO RECORDING");
    console.log("============================");

    try {
      this.state.videoRecording.endTime = new Date().toISOString();
      console.log(
        `⏱️  Recording ended at: ${this.state.videoRecording.endTime}`
      );

      // Calculate duration
      const startTime = new Date(this.state.videoRecording.startTime);
      const endTime = new Date(this.state.videoRecording.endTime);
      this.state.metadata.totalDuration = (endTime - startTime) / 1000; // seconds

      console.log(
        `⏱️  Total recording duration: ${this.state.metadata.totalDuration.toFixed(
          2
        )} seconds`
      );

      if (this.context) {
        console.log("🔄 Closing recording context...");
        await this.context.close();

        // Get the video file path
        const videoDir = this.state.videoRecording.options.dir;
        console.log(`📹 Looking for video files in: ${videoDir}`);

        try {
          const files = fs.readdirSync(videoDir);
          const videoFiles = files.filter((file) => file.endsWith(".webm"));

          if (videoFiles.length > 0) {
            const videoFile = videoFiles[0]; // Get the first video file
            this.state.metadata.finalVideoPath = path.join(videoDir, videoFile);

            // Get file size
            const stats = fs.statSync(this.state.metadata.finalVideoPath);
            this.state.metadata.fileSize = stats.size;

            console.log(
              `✅ Video saved: ${this.state.metadata.finalVideoPath}`
            );
            console.log(
              `📊 Video file size: ${(
                this.state.metadata.fileSize /
                1024 /
                1024
              ).toFixed(2)} MB`
            );

            // Move video to dataset directory with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const finalVideoName = `website-recording-${timestamp}.webm`;
            const finalVideoPath = path.join(
              this.state.outputDir,
              finalVideoName
            );

            fs.copyFileSync(this.state.metadata.finalVideoPath, finalVideoPath);
            this.state.metadata.finalVideoPath = finalVideoPath;

            console.log(`📁 Video copied to: ${finalVideoPath}`);
          } else {
            console.log("⚠️  No video files found in recording directory");
          }
        } catch (fileError) {
          console.log(`⚠️  Could not access video files: ${fileError.message}`);
        }
      }

      return this.state.metadata.finalVideoPath;
    } catch (error) {
      console.error(`❌ Error stopping recording: ${error.message}`);
      throw error;
    }
  }

  async generateMetadata() {
    console.log("\n📊 GENERATING RECORDING METADATA");
    console.log("=================================");

    const metadata = {
      recording: {
        startTime: this.state.videoRecording.startTime,
        endTime: this.state.videoRecording.endTime,
        duration: this.state.metadata.totalDuration,
        videoPath: this.state.metadata.finalVideoPath,
        fileSize: this.state.metadata.fileSize,
        fileSizeMB: (this.state.metadata.fileSize / 1024 / 1024).toFixed(2),
      },
      configuration: {
        viewport: this.state.metadata.viewportSize,
        userAgent: this.state.metadata.userAgent,
        recordingOptions: this.state.videoRecording.options,
      },
      interactions: {
        total: this.state.interactions.length,
        byType: {},
        details: this.state.interactions,
      },
      performance: {
        recordingQuality: this.state.metadata.recordingQuality,
        totalInteractions: this.state.interactions.length,
      },
      timestamp: new Date().toISOString(),
    };

    // Count interactions by type
    this.state.interactions.forEach((interaction) => {
      metadata.interactions.byType[interaction.type] =
        (metadata.interactions.byType[interaction.type] || 0) + 1;
    });

    console.log("📈 Recording Statistics:");
    console.log(`   Duration: ${metadata.recording.duration} seconds`);
    console.log(`   File Size: ${metadata.recording.fileSizeMB} MB`);
    console.log(`   Total Interactions: ${metadata.interactions.total}`);
    Object.entries(metadata.interactions.byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    return metadata;
  }

  async cleanup() {
    console.log("\n🧹 CLEANUP PHASE");
    console.log("=================");

    try {
      if (this.page) {
        console.log("📄 Closing page...");
        await this.page.close();
        console.log("✅ Page closed");
      }

      if (this.context) {
        console.log("🌐 Closing context...");
        await this.context.close();
        console.log("✅ Context closed");
      }

      if (this.browser) {
        console.log("🔧 Closing browser...");
        await this.browser.close();
        console.log("✅ Browser closed");
      }

      console.log("🏁 Cleanup completed");
    } catch (error) {
      console.error(`⚠️  Error during cleanup: ${error.message}`);
    }
  }
}

async function runVideoRecording() {
  // Get configuration from environment variables
  const websiteUrl = process.env.WEBSITE_URL;
  const recordingDuration = parseInt(process.env.RECORDING_DURATION) || 30; // seconds
  const videoQuality = process.env.VIDEO_QUALITY || "medium";
  const enableInteractions = process.env.ENABLE_INTERACTIONS !== "false";

  console.log("🎬 VIDEO RECORDING PROCESS STARTED");
  console.log("==================================");
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`🏗️  Node.js version: ${process.version}`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📍 Script location: ${__dirname}`);

  console.log("\n🔧 Configuration:");
  console.log(`   Website URL: ${websiteUrl || "NOT SET"}`);
  console.log(`   Recording Duration: ${recordingDuration} seconds`);
  console.log(`   Video Quality: ${videoQuality}`);
  console.log(`   Enable Interactions: ${enableInteractions}`);

  if (!websiteUrl) {
    console.error("❌ WEBSITE_URL environment variable is required");
    console.error("Set it in .env file or as environment variable");
    process.exit(1);
  }

  const recorder = new VideoRecorder();

  try {
    // Launch browser
    console.log("\n🚀 BROWSER SETUP");
    console.log("=================");
    console.log("🔧 Launching Chromium browser...");

    const launchStart = Date.now();
    recorder.browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    console.log(`✅ Browser launched in ${Date.now() - launchStart}ms`);

    // Enable video recording
    await recorder.enableVideoRecording({
      width: 1280,
      height: 720,
      mode: "retain-on-failure",
    });

    // Navigate to website
    console.log("\n🌐 WEBSITE NAVIGATION");
    console.log("======================");
    console.log(`🔄 Navigating to: ${websiteUrl}`);

    const navStart = Date.now();
    await recorder.page.goto(websiteUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`✅ Navigation completed in ${Date.now() - navStart}ms`);

    // Check page status
    const currentUrl = recorder.page.url();
    const pageTitle = await recorder.page.title();
    console.log(`   Final URL: ${currentUrl}`);
    console.log(`   Page title: "${pageTitle}"`);

    // Wait for page to fully load
    console.log("⏳ Waiting for network to settle...");
    try {
      await recorder.page.waitForLoadState("networkidle", { timeout: 10000 });
      console.log("✅ Network settled");
    } catch (networkError) {
      console.log("⚠️  Network did not settle, continuing...");
    }

    // Start recording
    await recorder.startRecording();

    // Take start screenshot
    console.log("\n📸 CAPTURING START SCREENSHOT");
    console.log("==============================");
    const startScreenshotPath = path.join(
      recorder.state.outputDir,
      "video-recording-screenshot_start.png"
    );
    await recorder.page.screenshot({
      path: startScreenshotPath,
      fullPage: true,
    });
    console.log(`✅ Start screenshot saved: ${startScreenshotPath}`);

    // Simulate user interactions if enabled
    if (enableInteractions) {
      await recorder.simulateUserInteractions({
        scrolling: true,
        clicking: true,
        hovering: true,
        typing: true,
        waitTime: 2000,
      });
    }

    // Wait for specified recording duration
    console.log(`\n⏱️  RECORDING FOR ${recordingDuration} SECONDS`);
    console.log("=".repeat(50));
    const recordingInterval = setInterval(() => {
      process.stdout.write("📹 ");
    }, 1000);

    await new Promise((resolve) =>
      setTimeout(resolve, recordingDuration * 1000)
    );
    clearInterval(recordingInterval);
    console.log("\n✅ Recording duration completed");

    // Take end screenshot
    console.log("\n📸 CAPTURING END SCREENSHOT");
    console.log("============================");
    const endScreenshotPath = path.join(
      recorder.state.outputDir,
      "video-recording-screenshot_end.png"
    );
    await recorder.page.screenshot({
      path: endScreenshotPath,
      fullPage: true,
    });
    console.log(`✅ End screenshot saved: ${endScreenshotPath}`);

    // Stop recording
    const videoPath = await recorder.stopRecording();

    // Generate metadata
    const metadata = await recorder.generateMetadata();

    // Save metadata to file
    console.log("\n💾 SAVING METADATA");
    console.log("===================");
    const metadataPath = path.join(
      recorder.state.outputDir,
      "video-recording-summary.json"
    );
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Metadata saved: ${metadataPath}`);

    // Create human-readable report
    console.log("📄 Creating readable report...");
    let report = `# Video Recording Report\n\n`;
    report += `**Website:** ${websiteUrl}\n`;
    report += `**Recording Date:** ${new Date().toISOString()}\n`;
    report += `**Duration:** ${metadata.recording.duration} seconds\n`;
    report += `**File Size:** ${metadata.recording.fileSizeMB} MB\n`;
    report += `**Video Path:** ${metadata.recording.videoPath}\n\n`;

    report += `## Configuration\n\n`;
    report += `- **Viewport:** ${metadata.configuration.viewport.width}x${metadata.configuration.viewport.height}\n`;
    report += `- **User Agent:** ${metadata.configuration.userAgent}\n`;
    report += `- **Recording Quality:** ${videoQuality}\n\n`;

    if (metadata.interactions.total > 0) {
      report += `## Interactions (${metadata.interactions.total} total)\n\n`;
      Object.entries(metadata.interactions.byType).forEach(([type, count]) => {
        report += `- **${type}:** ${count}\n`;
      });
      report += `\n`;
      
      // Add detailed click tracing section
      const clickInteractions = metadata.interactions.details.filter(i => i.type === 'click');
      if (clickInteractions.length > 0) {
        report += `## Click Interaction Details\n\n`;
        
        clickInteractions.forEach((click, index) => {
          report += `### Click ${index + 1}: ${click.elementType}\n\n`;
          report += `- **Target Text:** "${click.text}"\n`;
          report += `- **Element ID:** ${click.elementDetails?.id || 'N/A'}\n`;
          report += `- **Element Class:** ${click.elementDetails?.class || 'N/A'}\n`;
          report += `- **Selector:** \`${click.selector}\`\n`;
          report += `- **Risk Level:** ${click.riskLevel}\n`;
          report += `- **Click Duration:** ${click.clickMetrics?.duration || 'N/A'}ms\n`;
          
          if (click.pageState) {
            report += `- **URL Changed:** ${click.pageState.changes?.urlChanged ? '✅ Yes' : '❌ No'}\n`;
            if (click.pageState.changes?.urlChanged) {
              report += `  - **From:** ${click.pageState.preClick?.url}\n`;
              report += `  - **To:** ${click.pageState.postClick?.url}\n`;
            }
            report += `- **Title Changed:** ${click.pageState.changes?.titleChanged ? '✅ Yes' : '❌ No'}\n`;
          }
          
          if (click.elementDetails?.href) {
            report += `- **Link Target:** ${click.elementDetails.href}\n`;
          }
          
          if (click.elementDetails?.position) {
            const pos = click.elementDetails.position;
            report += `- **Screen Position:** ${Math.round(pos.x)}, ${Math.round(pos.y)}\n`;
          }
          
          report += `- **Timestamp:** ${click.timestamp}\n\n`;
          report += `---\n\n`;
        });
      }
    }

    report += `## Performance\n\n`;
    report += `- **Total Recording Duration:** ${metadata.recording.duration} seconds\n`;
    report += `- **File Size:** ${metadata.recording.fileSizeMB} MB\n`;
    report += `- **Average File Size per Second:** ${(
      parseFloat(metadata.recording.fileSizeMB) / metadata.recording.duration
    ).toFixed(2)} MB/s\n`;

    const reportPath = path.join(
      recorder.state.outputDir,
      "video-recording-report.md"
    );
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved: ${reportPath}`);

    // Final summary
    console.log("\n🎉 VIDEO RECORDING COMPLETED SUCCESSFULLY!");
    console.log("==========================================");
    console.log(`📹 Video File: ${videoPath}`);
    console.log(`📊 Metadata: ${metadataPath}`);
    console.log(`📄 Report: ${reportPath}`);
    console.log(`📸 Start Screenshot: ${startScreenshotPath}`);
    console.log(`📸 End Screenshot: ${endScreenshotPath}`);
    console.log(`⏱️  Total Duration: ${metadata.recording.duration} seconds`);
    console.log(`📁 File Size: ${metadata.recording.fileSizeMB} MB`);

    if (enableInteractions) {
      console.log(`🎭 Interactions Performed: ${metadata.interactions.total}`);
      
      // Show click interaction summary
      const clickInteractions = metadata.interactions.details.filter(i => i.type === 'click');
      if (clickInteractions.length > 0) {
        console.log('\n📋 CLICK INTERACTION SUMMARY');
        console.log('============================');
        
        clickInteractions.forEach((click, index) => {
          const urlChange = click.pageState?.changes?.urlChanged ? ' → URL CHANGED' : '';
          const riskIndicator = click.riskLevel === 'high' ? ' ⚠️' : click.riskLevel === 'medium' ? ' 🟡' : ' ✅';
          console.log(`${index + 1}. ${click.elementType}${riskIndicator}: "${click.text.substring(0, 40)}..."${urlChange}`);
          
          if (click.pageState?.changes?.urlChanged) {
            console.log(`   └─ ${click.pageState.preClick?.url}`);
            console.log(`   └─ ${click.pageState.postClick?.url}`);
          }
        });
        
        // Summary statistics
        const navigationClicks = clickInteractions.filter(c => c.pageState?.changes?.urlChanged).length;
        const highRiskClicks = clickInteractions.filter(c => c.riskLevel === 'high').length;
        
        console.log('\n📊 Click Statistics:');
        console.log(`   Total Clicks: ${clickInteractions.length}`);
        console.log(`   Navigation Clicks: ${navigationClicks}`);
        console.log(`   High Risk Clicks: ${highRiskClicks}`);
        console.log(`   Average Click Duration: ${(clickInteractions.reduce((sum, c) => sum + (c.clickMetrics?.duration || 0), 0) / clickInteractions.length).toFixed(2)}ms`);
      }
    }
  } catch (error) {
    console.error("\n❌ VIDEO RECORDING FAILED");
    console.error("==========================");
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);

    // Debug information
    console.error("\n🔍 DEBUG INFORMATION");
    console.error("====================");
    console.error(`Node.js version: ${process.version}`);
    console.error(`Platform: ${process.platform}`);
    console.error(`Working directory: ${process.cwd()}`);
    console.error(
      `Memory usage: ${Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      )}MB`
    );

    process.exit(1);
  } finally {
    await recorder.cleanup();
  }
}

// Run the video recording
runVideoRecording().catch(console.error);
