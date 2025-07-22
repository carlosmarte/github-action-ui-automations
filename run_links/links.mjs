import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

class LinkCollector {
  constructor() {
    this.browser = null;
    this.page = null;
    this.state = {
      analysisData: {
        links: [],
      },
    };
  }

  async init(useBrowser = false) {
    console.log("🚀 Initializing Playwright browser");
    console.log(`   📱 Headless mode: ${!useBrowser}`);

    this.browser = await chromium.launch({
      headless: !useBrowser,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    });
    console.log("   ✅ Browser process launched");

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      ignoreHTTPSErrors: true,
    });
    console.log("   ✅ Browser context created");

    this.page = await context.newPage();

    // Enable request/response logging
    this.page.on("request", (request) => {
      console.log(`   🌐 Request: ${request.method()} ${request.url()}`);
    });

    this.page.on("response", (response) => {
      console.log(`   📥 Response: ${response.status()} ${response.url()}`);
    });

    this.page.on("console", (msg) => {
      console.log(`   🖥️  Console: ${msg.text()}`);
    });

    this.page.on("pageerror", (error) => {
      console.log(`   ⚠️  Page Error: ${error.message}`);
    });

    console.log("✅ Browser initialized with logging enabled");
  }

  async collectLinks() {
    try {
      console.log("🔗 Collecting links from the page");

      // First check if page has loaded content
      const pageReady = await this.page.evaluate(() => {
        return {
          readyState: document.readyState,
          hasBody: !!document.body,
          bodyChildren: document.body?.children?.length || 0,
          totalElements: document.querySelectorAll("*").length,
          hasAnchors: document.querySelectorAll("a").length > 0,
        };
      });

      console.log("   📊 Page analysis:");
      console.log(`      Ready state: ${pageReady.readyState}`);
      console.log(`      Has body: ${pageReady.hasBody}`);
      console.log(`      Body children: ${pageReady.bodyChildren}`);
      console.log(`      Total elements: ${pageReady.totalElements}`);
      console.log(`      Has anchor tags: ${pageReady.hasAnchors}`);

      if (!pageReady.hasBody) {
        console.log("   ⚠️  Warning: No body element found");
        this.state.analysisData.links = [];
        return [];
      }

      const links = await this.page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        console.log(`Found ${anchors.length} anchor elements`);

        return anchors
          .map((link, index) => {
            try {
              const linkData = {
                href: link.href,
                text: link.textContent.trim(),
                title: link.title || null,
                target: link.target || null,
                rel: link.rel || null,
                isExternal: link.hostname !== window.location.hostname,
                hasImage: link.querySelector("img") !== null,
                attributes: Object.fromEntries(
                  Array.from(link.attributes)
                    .filter(
                      (attr) =>
                        !["href", "text", "title", "target", "rel"].includes(
                          attr.name
                        )
                    )
                    .map((attr) => [attr.name, attr.value])
                ),
              };

              // Log first few links for debugging
              if (index < 5) {
                console.log(
                  `Link ${index + 1}: ${
                    linkData.href
                  } | "${linkData.text.substring(0, 50)}${
                    linkData.text.length > 50 ? "..." : ""
                  }"`
                );
              }

              return linkData;
            } catch (linkError) {
              console.error(
                `Error processing link ${index + 1}:`,
                linkError.message
              );
              return null;
            }
          })
          .filter(Boolean);
      });

      console.log(`✅ Collected ${links.length} links`);

      if (links.length > 0) {
        const external = links.filter((link) => link.isExternal).length;
        const internal = links.filter((link) => !link.isExternal).length;
        const withImages = links.filter((link) => link.hasImage).length;
        const withTargetBlank = links.filter(
          (link) => link.target === "_blank"
        ).length;

        console.log("   📈 Link breakdown:");
        console.log(`      External links: ${external}`);
        console.log(`      Internal links: ${internal}`);
        console.log(`      Links with images: ${withImages}`);
        console.log(`      Links opening in new tab: ${withTargetBlank}`);

        // Show sample of collected links
        console.log("   🔍 Sample links:");
        links.slice(0, 3).forEach((link, i) => {
          console.log(`      ${i + 1}. ${link.href}`);
          console.log(
            `         Text: "${link.text.substring(0, 60)}${
              link.text.length > 60 ? "..." : ""
            }"`
          );
          console.log(
            `         External: ${link.isExternal}, Target: ${
              link.target || "none"
            }`
          );
        });
      }

      // Store links in analysis data
      this.state.analysisData.links = links;

      return links;
    } catch (error) {
      console.error(`❌ Error collecting links: ${error.message}`);
      console.error(`   🔍 Error details: ${error.stack}`);
      this.state.analysisData.links = [];
      return [];
    }
  }

  async navigateToUrl(url) {
    try {
      console.log(`🌐 Navigating to: ${url}`);
      console.log("   ⏱️  Starting navigation with 60s timeout");
      console.log(
        "   🔄 Wait strategy: networkidle (no network activity for 500ms)"
      );

      const startTime = Date.now();

      // Try multiple wait strategies in sequence
      try {
        await this.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        console.log(`   ✅ DOM content loaded (${Date.now() - startTime}ms)`);

        // Wait a bit more for potential dynamic content
        console.log("   ⏳ Waiting for additional content to load...");
        await this.page.waitForLoadState("networkidle", { timeout: 40000 });
        console.log(
          `   ✅ Network idle achieved (${Date.now() - startTime}ms)`
        );
      } catch (networkIdleError) {
        console.log(`   ⚠️  Network idle timeout: ${networkIdleError.message}`);
        console.log("   🔄 Attempting fallback with load event...");

        try {
          await this.page.waitForLoadState("load", { timeout: 10000 });
          console.log(
            `   ✅ Load event completed (${Date.now() - startTime}ms)`
          );
        } catch (loadError) {
          console.log(`   ⚠️  Load event timeout: ${loadError.message}`);
          console.log("   ➡️  Continuing with current page state...");
        }
      }

      // Check page status
      const finalUrl = this.page.url();
      const title = await this.page.title();
      console.log(`   📄 Final URL: ${finalUrl}`);
      console.log(`   📝 Page title: ${title}`);
      console.log(`   ⏱️  Total navigation time: ${Date.now() - startTime}ms`);

      // Check if we have content
      const bodyContent = await this.page.evaluate(
        () => document.body?.innerText?.length || 0
      );
      console.log(`   📏 Page content length: ${bodyContent} characters`);

      if (bodyContent === 0) {
        console.log("   ⚠️  Warning: Page appears to have no content");
      }

      console.log("✅ Page navigation completed");
    } catch (error) {
      console.error(`❌ Error navigating to URL: ${error.message}`);
      console.error(`   🔍 Error type: ${error.constructor.name}`);
      console.error(`   📍 Stack trace: ${error.stack}`);

      // Try to get current page state for debugging
      try {
        const currentUrl = this.page.url();
        const readyState = await this.page.evaluate(() => document.readyState);
        console.log(`   🔍 Current URL: ${currentUrl}`);
        console.log(`   🔍 Ready state: ${readyState}`);
      } catch (debugError) {
        console.log(
          `   🔍 Could not retrieve page debug info: ${debugError.message}`
        );
      }

      throw error;
    }
  }

  async saveResults() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const url = new URL(process.env.WEBSITE_URL);
      const domain = url.hostname.replace(/\./g, "-");

      // Ensure dataset directory exists
      const datasetDir = path.join(__dirname, "..", "dataset");
      if (!fs.existsSync(datasetDir)) {
        fs.mkdirSync(datasetDir, { recursive: true });
      }

      // Save detailed links data
      const linksFile = path.join(
        datasetDir,
        `links-${domain}-${timestamp}.json`
      );
      const linksData = {
        url: process.env.WEBSITE_URL,
        timestamp: new Date().toISOString(),
        totalLinks: this.state.analysisData.links.length,
        links: this.state.analysisData.links,
        summary: {
          totalLinks: this.state.analysisData.links.length,
          externalLinks: this.state.analysisData.links.filter(
            (link) => link.isExternal
          ).length,
          internalLinks: this.state.analysisData.links.filter(
            (link) => !link.isExternal
          ).length,
          linksWithImages: this.state.analysisData.links.filter(
            (link) => link.hasImage
          ).length,
          linksWithTargetBlank: this.state.analysisData.links.filter(
            (link) => link.target === "_blank"
          ).length,
          uniqueDomains: [
            ...new Set(
              this.state.analysisData.links.map((link) => {
                try {
                  return new URL(link.href).hostname;
                } catch {
                  return "invalid-url";
                }
              })
            ),
          ].length,
        },
      };

      fs.writeFileSync(linksFile, JSON.stringify(linksData, null, 2));
      console.log(`💾 Detailed links data saved to: ${linksFile}`);

      // Save summary data
      const summaryFile = path.join(datasetDir, `links-summary-${domain}.json`);
      const summaryData = {
        url: process.env.WEBSITE_URL,
        timestamp: new Date().toISOString(),
        ...linksData.summary,
      };

      fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
      console.log(`📊 Summary data saved to: ${summaryFile}`);

      return { linksFile, summaryFile };
    } catch (error) {
      console.error(`❌ Error saving results: ${error.message}`);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("🔒 Browser closed");
    }
  }
}

async function main() {
  const url = process.env.WEBSITE_URL;
  const useBrowser = process.argv.includes("--use-browser");

  console.log("🚀 Starting Link Collection Script");
  console.log("=====================================");
  console.log(`📍 Target URL: ${url || "NOT SET"}`);
  console.log(`🖥️  Browser Mode: ${useBrowser ? "Visible" : "Headless"}`);
  console.log(`⏰ Start Time: ${new Date().toISOString()}`);
  console.log("=====================================");

  if (!url) {
    console.error("❌ WEBSITE_URL environment variable is required");
    console.error("   💡 Set it in .env file or as environment variable");
    process.exit(1);
  }

  const collector = new LinkCollector();
  let success = false;

  try {
    console.log("\n📋 Step 1/4: Initializing browser...");
    await collector.init(useBrowser);

    console.log("\n📋 Step 2/4: Navigating to target URL...");
    await collector.navigateToUrl(url);

    console.log("\n📋 Step 3/4: Collecting links...");
    const links = await collector.collectLinks();

    console.log("\n📋 Step 4/4: Saving results...");
    const files = await collector.saveResults();

    console.log("\n✅ ========= SUCCESS =========");
    console.log(`🎉 Link collection completed successfully!`);
    console.log(`📊 Total links collected: ${links.length}`);
    console.log(`💾 Files saved:`);
    console.log(`   - Detailed: ${files.linksFile}`);
    console.log(`   - Summary: ${files.summaryFile}`);
    console.log(`⏱️  Total execution time: ${Date.now() - Date.now()}ms`);
    console.log("============================");

    success = true;
  } catch (error) {
    console.error("\n❌ ========= FAILURE =========");
    console.error(`❌ Script failed: ${error.message}`);
    console.error(`🔍 Error type: ${error.constructor.name}`);

    if (error.stack) {
      console.error("📍 Stack trace:");
      console.error(
        error.stack
          .split("\n")
          .map((line) => `   ${line}`)
          .join("\n")
      );
    }

    console.error("============================");
    process.exit(1);
  } finally {
    console.log("\n🧹 Cleanup: Closing browser...");
    await collector.close();

    if (success) {
      console.log("🏁 Script completed successfully");
    } else {
      console.log("🏁 Script completed with errors");
    }
  }
}

main();
