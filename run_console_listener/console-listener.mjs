import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

class ConsoleListener {
  constructor(page) {
    this.page = page;
    this.state = {
      browser: {
        errors: [],
        messages: [],
        warnings: [],
        info: [],
        debug: [],
        logs: [],
        traces: [],
      },
      statistics: {
        totalMessages: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        logCount: 0,
        traceCount: 0,
        blockedMessages: 0,
      },
    };
  }

  async setupConsoleListener() {
    console.log("🔍 Setting up console listener...");

    this.page.on("console", async (msg) => {
      try {
        const text = msg.text();
        const msgType = msg.type();
        this.state.statistics.totalMessages++;

        console.log(`📝 Console message detected: [${msgType}]`);

        // Skip known security errors about sandboxing
        if (
          text.includes("Blocked script execution") &&
          text.includes("sandboxed")
        ) {
          console.log(`   ⏭️  Skipping blocked script execution message`);
          this.state.statistics.blockedMessages++;
          return;
        }

        // Record errors specially
        if (msgType === "error") {
          this.state.browser.errors.push([msgType, text]);
          this.state.statistics.errorCount++;
          console.log(`   🔴 [BrowserConsole][${msgType}]:`, text);
          return;
        }

        // Try to get the actual arguments
        console.log(`   🔄 Processing console arguments...`);
        const args = await Promise.all(
          msg.args().map(async (arg) => {
            try {
              return await arg.jsonValue();
            } catch (e) {
              console.log(`     ⚠️  Argument processing failed: ${e.message}`);
              return "[Frame Detached]";
            }
          })
        );

        // Log and store console messages based on type
        console.log(`   ✅ [BrowserConsole][${msgType}]:`, ...args);

        switch (msgType) {
          case "warning":
            this.state.browser.warnings.push([msgType, args]);
            this.state.statistics.warningCount++;
            break;
          case "info":
            this.state.browser.info.push([msgType, args]);
            this.state.statistics.infoCount++;
            break;
          case "debug":
            this.state.browser.debug.push([msgType, args]);
            this.state.statistics.debugCount++;
            break;
          case "log":
            this.state.browser.logs.push([msgType, args]);
            this.state.statistics.logCount++;
            break;
          case "trace":
            this.state.browser.traces.push([msgType, args]);
            this.state.statistics.traceCount++;
            break;
          default:
            this.state.browser.messages.push([msgType, args]);
            break;
        }
      } catch (err) {
        console.warn("   ❌ Error processing console message:", err.message);
      }
    });

    console.log("✅ Console listener setup completed");
  }

  getResults() {
    return {
      timestamp: new Date().toISOString(),
      statistics: this.state.statistics,
      consoleData: this.state.browser,
    };
  }

  logSummary() {
    const stats = this.state.statistics;
    console.log("\n📊 CONSOLE LISTENER SUMMARY");
    console.log("============================");
    console.log(`📝 Total messages captured: ${stats.totalMessages}`);
    console.log(`🔴 Errors: ${stats.errorCount}`);
    console.log(`🟡 Warnings: ${stats.warningCount}`);
    console.log(`🔵 Info messages: ${stats.infoCount}`);
    console.log(`⚪ Log messages: ${stats.logCount}`);
    console.log(`🔍 Debug messages: ${stats.debugCount}`);
    console.log(`🔎 Trace messages: ${stats.traceCount}`);
    console.log(`⏭️  Blocked messages: ${stats.blockedMessages}`);
    console.log(
      `📈 Other messages: ${
        stats.totalMessages -
        stats.errorCount -
        stats.warningCount -
        stats.infoCount -
        stats.logCount -
        stats.debugCount -
        stats.traceCount -
        stats.blockedMessages
      }`
    );
  }
}

async function runConsoleListener() {
  // Get website URL from environment variable
  const websiteUrl = process.env.WEBSITE_URL;

  console.log("🎧 CONSOLE LISTENER PROCESS STARTED");
  console.log("===================================");
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`🏗️  Node.js version: ${process.version}`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📍 Script location: ${__dirname}`);

  console.log("\n🔍 Environment variable check...");
  console.log(`   WEBSITE_URL: ${websiteUrl || "NOT SET"}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "NOT SET"}`);

  if (!websiteUrl) {
    console.error("❌ WEBSITE_URL environment variable is required");
    console.error("Set it in .env file or as environment variable");
    console.error("Available environment variables:");
    Object.keys(process.env)
      .filter((key) => key.includes("WEBSITE") || key.includes("URL"))
      .forEach((key) => {
        console.error(`   ${key}: ${process.env[key]}`);
      });
    process.exit(1);
  }

  let browser;
  let context;
  let page;
  let consoleListener;

  try {
    // Launch browser
    console.log("\n🔧 Browser Setup Phase");
    console.log("======================");
    console.log("🚀 Launching Chrome browser...");
    console.log(`   Headless mode: true`);
    console.log(`   Browser args: --disable-dev-shm-usage, --no-sandbox`);

    const launchStart = Date.now();
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    console.log(`✅ Browser launched in ${Date.now() - launchStart}ms`);

    console.log("🌐 Creating browser context...");
    const contextStart = Date.now();
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    console.log(`✅ Context created in ${Date.now() - contextStart}ms`);

    console.log("📄 Creating new page...");
    const pageStart = Date.now();
    page = await context.newPage();
    console.log(`✅ Page created in ${Date.now() - pageStart}ms`);

    // Set up console listener
    console.log("\n🎧 Console Listener Setup");
    console.log("=========================");
    consoleListener = new ConsoleListener(page);
    await consoleListener.setupConsoleListener();

    // Set up additional error monitoring
    console.log("🔍 Setting up additional error monitoring...");
    const networkErrors = [];
    const pageErrors = [];

    page.on("pageerror", (error) => {
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      console.log(`   ❌ Page error: ${error.message}`);
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure();
      networkErrors.push({
        url: request.url(),
        method: request.method(),
        errorText: failure?.errorText,
        timestamp: new Date().toISOString(),
      });
      console.log(
        `   🌐 Failed request: ${request.url()} (${failure?.errorText})`
      );
    });

    // Navigate to the website
    console.log("\n🌐 Navigation Phase");
    console.log("===================");
    console.log(`🔄 Navigating to: ${websiteUrl}`);
    console.log("⏳ Waiting for page to load (may take up to 60 seconds)...");

    const navigationStart = Date.now();
    try {
      await page.goto(websiteUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      console.log(
        `✅ Initial navigation completed in ${Date.now() - navigationStart}ms`
      );
    } catch (navigationError) {
      console.error(`❌ Navigation failed: ${navigationError.message}`);
      throw navigationError;
    }

    // Check page status
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`   Final URL: ${currentUrl}`);
    console.log(`   Page title: "${pageTitle}"`);
    console.log(
      `   URL matches target: ${
        currentUrl === websiteUrl || currentUrl.startsWith(websiteUrl)
      }`
    );

    // Wait for the page to load completely and collect console messages
    console.log("\n🌐 Console Message Collection Phase");
    console.log("===================================");
    console.log(
      "⏳ Waiting for network to settle and collecting console messages..."
    );
    const networkStart = Date.now();

    try {
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      console.log(`✅ Network idle achieved in ${Date.now() - networkStart}ms`);
    } catch (networkError) {
      console.log(`⚠️  Network didn't settle within 30s, continuing anyway...`);
      console.log(`   Network error: ${networkError.message}`);
    }

    // Wait additional time to capture more console messages
    console.log(
      "⏳ Waiting additional 5 seconds to capture more console messages..."
    );
    const additionalWaitStart = Date.now();
    await page.waitForTimeout(5000);
    console.log(
      `✅ Additional wait completed in ${Date.now() - additionalWaitStart}ms`
    );

    // Check page content
    console.log("\n📊 Page Analysis");
    console.log("================");
    const bodyContent = await page.locator("body").textContent();
    const hasContent = bodyContent && bodyContent.trim().length > 0;
    const domElementsCount = await page.locator("*").count();

    console.log(`   Page has content: ${hasContent}`);
    console.log(
      `   Content length: ${bodyContent ? bodyContent.length : 0} characters`
    );
    console.log(`   DOM elements found: ${domElementsCount}`);
    console.log(`   Network errors: ${networkErrors.length}`);
    console.log(`   Page errors: ${pageErrors.length}`);

    if (!hasContent) {
      console.warn(
        "⚠️  Page appears to have no content - console collection may be limited"
      );
    }

    // Create dataset directory if it doesn't exist
    console.log("\n📁 File System Setup");
    console.log("====================");
    const datasetDir = path.join(__dirname, "..", "dataset");
    console.log(`   Dataset directory: ${datasetDir}`);

    if (!fs.existsSync(datasetDir)) {
      console.log("   Creating dataset directory...");
      const dirStart = Date.now();
      fs.mkdirSync(datasetDir, { recursive: true });
      console.log(
        `   ✅ Dataset directory created in ${Date.now() - dirStart}ms`
      );
    } else {
      console.log("   ✅ Dataset directory already exists");
    }

    // Take screenshot
    console.log("\n📸 Screenshot Capture");
    console.log("====================");
    const screenshotFilename = "console-listener-listener-screenshot.png";
    const screenshotPath = path.join(datasetDir, screenshotFilename);
    console.log(`   Screenshot path: ${screenshotPath}`);
    console.log("   Taking full page screenshot...");

    const screenshotStart = Date.now();
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const screenshotStats = fs.statSync(screenshotPath);
      console.log(`✅ Screenshot saved in ${Date.now() - screenshotStart}ms`);
      console.log(
        `   Screenshot size: ${(screenshotStats.size / 1024).toFixed(2)} KB`
      );
      console.log(`   Full path: ${screenshotPath}`);
    } catch (screenshotError) {
      console.error(`⚠️  Screenshot failed: ${screenshotError.message}`);
    }

    // Get console listener results
    console.log("\n🎧 Console Data Collection");
    console.log("==========================");
    const consoleResults = consoleListener.getResults();
    consoleListener.logSummary();

    // Combine all data
    const completeData = {
      ...consoleResults,
      sourceUrl: websiteUrl,
      pageInfo: {
        finalUrl: currentUrl,
        title: pageTitle,
        hasContent: hasContent,
        contentLength: bodyContent ? bodyContent.length : 0,
        domElements: domElementsCount,
      },
      additionalErrors: {
        networkErrors: networkErrors,
        pageErrors: pageErrors,
      },
    };

    // Save console data to JSON file
    console.log("\n💾 Saving Console Data");
    console.log("======================");
    const consoleJsonPath = path.join(
      datasetDir,
      "console-listener-messages.json"
    );
    console.log(`   Console file path: ${consoleJsonPath}`);

    const saveStart = Date.now();
    fs.writeFileSync(consoleJsonPath, JSON.stringify(completeData, null, 2));

    const consoleStats = fs.statSync(consoleJsonPath);
    console.log(`✅ Console data saved in ${Date.now() - saveStart}ms`);
    console.log(`   File size: ${(consoleStats.size / 1024).toFixed(2)} KB`);
    console.log(`   Full path: ${consoleJsonPath}`);

    // Create summary file
    console.log("\n📋 Creating Summary Report");
    console.log("==========================");
    const summaryData = {
      url: websiteUrl,
      timestamp: new Date().toISOString(),
      statistics: consoleResults.statistics,
      pageInfo: completeData.pageInfo,
      errorSummary: {
        consoleErrors: consoleResults.statistics.errorCount,
        networkErrors: networkErrors.length,
        pageErrors: pageErrors.length,
        totalIssues:
          consoleResults.statistics.errorCount +
          networkErrors.length +
          pageErrors.length,
      },
    };

    const summaryPath = path.join(datasetDir, "console-listener-summary.json");
    const summaryStart = Date.now();
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
    console.log(
      `✅ Summary report saved to: ${summaryPath} (${
        Date.now() - summaryStart
      }ms)`
    );

    // Create human-readable report
    console.log("📄 Generating human-readable report...");
    let readableReport = `# Console Messages Report\n\n`;
    readableReport += `**Website:** ${websiteUrl}\n`;
    readableReport += `**Collection Date:** ${new Date().toISOString()}\n`;
    readableReport += `**Final URL:** ${currentUrl}\n`;
    readableReport += `**Page Title:** ${pageTitle}\n\n`;

    readableReport += `## Summary\n\n`;
    readableReport += `- **Total Console Messages:** ${consoleResults.statistics.totalMessages}\n`;
    readableReport += `- **Errors:** ${consoleResults.statistics.errorCount}\n`;
    readableReport += `- **Warnings:** ${consoleResults.statistics.warningCount}\n`;
    readableReport += `- **Info Messages:** ${consoleResults.statistics.infoCount}\n`;
    readableReport += `- **Log Messages:** ${consoleResults.statistics.logCount}\n`;
    readableReport += `- **Debug Messages:** ${consoleResults.statistics.debugCount}\n`;
    readableReport += `- **Network Errors:** ${networkErrors.length}\n`;
    readableReport += `- **Page Errors:** ${pageErrors.length}\n\n`;

    if (consoleResults.statistics.errorCount > 0) {
      readableReport += `## Console Errors\n\n`;
      consoleResults.consoleData.errors.forEach((error, index) => {
        readableReport += `### Error ${index + 1}\n\n`;
        readableReport += `**Type:** ${error[0]}\n`;
        readableReport += `**Message:** ${error[1]}\n\n`;
        readableReport += `---\n\n`;
      });
    }

    if (networkErrors.length > 0) {
      readableReport += `## Network Errors\n\n`;
      networkErrors.forEach((error, index) => {
        readableReport += `### Network Error ${index + 1}\n\n`;
        readableReport += `**URL:** ${error.url}\n`;
        readableReport += `**Method:** ${error.method}\n`;
        readableReport += `**Error:** ${error.errorText}\n`;
        readableReport += `**Timestamp:** ${error.timestamp}\n\n`;
        readableReport += `---\n\n`;
      });
    }

    if (pageErrors.length > 0) {
      readableReport += `## Page Errors\n\n`;
      pageErrors.forEach((error, index) => {
        readableReport += `### Page Error ${index + 1}\n\n`;
        readableReport += `**Message:** ${error.message}\n`;
        readableReport += `**Timestamp:** ${error.timestamp}\n\n`;
        if (error.stack) {
          readableReport += `**Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\`\n\n`;
        }
        readableReport += `---\n\n`;
      });
    }

    const readableReportPath = path.join(
      datasetDir,
      "console-listener-report.md"
    );
    const readableReportStart = Date.now();
    fs.writeFileSync(readableReportPath, readableReport);
    console.log(
      `✅ Human-readable report saved to: ${readableReportPath} (${
        Date.now() - readableReportStart
      }ms)`
    );
    console.log(`   Report length: ${readableReport.length} characters`);

    console.log("\n✅ Console listener process completed successfully!");

    // Generate final summary statistics
    const totalTime = Date.now() - navigationStart;
    console.log(`\n📊 PERFORMANCE SUMMARY`);
    console.log("======================");
    console.log(
      `⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)} seconds`
    );
    console.log(
      `📁 Files generated: 4 (JSON data, summary, markdown, screenshot)`
    );
    console.log(
      `💾 Total console messages captured: ${consoleResults.statistics.totalMessages}`
    );

    // Final assessment
    const totalIssues = summaryData.errorSummary.totalIssues;
    if (totalIssues === 0) {
      console.log("\n🎉 No console errors or issues detected!");
    } else {
      console.log(
        `\n⚠️  Found ${totalIssues} total issues (console errors, network errors, page errors)`
      );
      console.log(
        "   📝 Review the generated reports for detailed information"
      );
    }
  } catch (error) {
    console.error("\n❌ Console listener process failed:", error.message);
    console.error(`   Error type: ${error.name}`);
    console.error(`   Stack trace: ${error.stack}`);

    // Log environment info for debugging
    console.error("\n🔍 DEBUG INFO FOR TROUBLESHOOTING:");
    console.error("=====================================");
    console.error(`   Node.js version: ${process.version}`);
    console.error(`   Platform: ${process.platform}`);
    console.error(`   Architecture: ${process.arch}`);
    console.error(`   Working directory: ${process.cwd()}`);
    console.error(`   Script location: ${__dirname}`);
    console.error(
      `   Available memory: ${Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      )}MB`
    );

    process.exit(1);
  } finally {
    console.log("\n🧹 CLEANUP PHASE");
    console.log("=================");

    if (page) {
      console.log("📄 Closing page...");
      const pageCloseStart = Date.now();
      await page.close();
      console.log(`✅ Page closed in ${Date.now() - pageCloseStart}ms`);
    }

    if (context) {
      console.log("🌐 Closing browser context...");
      const contextCloseStart = Date.now();
      await context.close();
      console.log(`✅ Context closed in ${Date.now() - contextCloseStart}ms`);
    }

    if (browser) {
      console.log("🔧 Closing Chrome browser...");
      const browserCloseStart = Date.now();
      await browser.close();
      console.log(`✅ Browser closed in ${Date.now() - browserCloseStart}ms`);
    }

    console.log("\n📊 PROCESS SUMMARY");
    console.log("==================");
    console.log(`⏱️  Process completed at: ${new Date().toISOString()}`);
    console.log("🏁 Console listener cleanup completed");
  }
}

// Run the console listener
runConsoleListener().catch(console.error);
