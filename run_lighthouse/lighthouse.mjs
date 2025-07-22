import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function runLighthouse() {
  // Check for --use-browser flag
  const useBrowser = process.argv.includes("--use-browser");

  // Get device type from environment variable or command line argument (default: desktop)
  let device = "desktop";
  const deviceArg = process.argv.find((arg) => arg.startsWith("--device="));
  if (deviceArg) {
    device = deviceArg.split("=")[1];
  } else if (process.env.DEVICE) {
    device = process.env.DEVICE;
  }

  // Validate device type
  const validDevices = ["desktop", "tablet", "mobile"];
  if (!validDevices.includes(device)) {
    console.error(
      `❌ Invalid device type: ${device}. Valid options: ${validDevices.join(
        ", "
      )}`
    );
    process.exit(1);
  }

  // Get website URL from environment variable
  const websiteUrl = process.env.WEBSITE_URL;

  if (!websiteUrl) {
    console.error("❌ WEBSITE_URL environment variable is required");
    console.error("Set it in .env file or as environment variable");
    process.exit(1);
  }

  console.log(`🚀 Starting Lighthouse audit for: ${websiteUrl}`);
  console.log(`📱 Device type: ${device}`);
  console.log(`📅 Audit started at: ${new Date().toISOString()}`);

  let chrome;
  try {
    // Launch Chrome
    console.log("🔧 Launching Chrome browser...");
    const chromeFlags = useBrowser
      ? ["--disable-dev-shm-usage"]
      : [
          "--headless",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-dev-shm-usage",
        ];

    chrome = await chromeLauncher.launch({
      chromeFlags,
    });

    // Device-specific configurations
    const deviceConfigs = {
      desktop: {
        formFactor: "desktop",
        screenEmulation: { disabled: true },
      },
      tablet: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 768,
          height: 1024,
          deviceScaleFactor: 2,
          disabled: false,
        },
      },
      mobile: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        },
      },
    };

    // Lighthouse configuration for full audit
    const options = {
      logLevel: "info",
      output: "json",
      onlyCategories: [
        "performance",
        "accessibility",
        "best-practices",
        "seo",
        "pwa",
      ],
      port: chrome.port,
      ...deviceConfigs[device],
    };

    // Run Lighthouse audit
    console.log("📊 Running comprehensive Lighthouse audit...");
    const runnerResult = await lighthouse(websiteUrl, options);

    if (!runnerResult) {
      throw new Error("Lighthouse audit failed - no results returned");
    }

    // Create dataset directory if it doesn't exist
    const datasetDir = path.join(__dirname, "..", "dataset");
    if (!fs.existsSync(datasetDir)) {
      fs.mkdirSync(datasetDir, { recursive: true });
    }

    // Extract key metrics
    const lhr = runnerResult.lhr;

    // Save full report as JSON with device suffix
    const reportPath = path.join(
      datasetDir,
      `lighthouse-report-${device}.json`
    );
    fs.writeFileSync(reportPath, runnerResult.report);
    console.log(`💾 Full report saved to: ${reportPath}`);

    // Save screenshots if available
    if (
      lhr.audits["screenshot-thumbnails"] &&
      lhr.audits["screenshot-thumbnails"].details &&
      lhr.audits["screenshot-thumbnails"].details.items
    ) {
      const screenshots = lhr.audits["screenshot-thumbnails"].details.items;
      screenshots.forEach((screenshot, index) => {
        if (screenshot.data) {
          const screenshotFilename = `lighthouse-screenshot-${device}-${index}.png`;
          const screenshotPath = path.join(datasetDir, screenshotFilename);
          const base64Data = screenshot.data.replace(
            /^data:image\/png;base64,/,
            ""
          );
          fs.writeFileSync(screenshotPath, base64Data, "base64");
          console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        }
      });
    }

    // Save final screenshot if available
    if (
      lhr.audits["final-screenshot"] &&
      lhr.audits["final-screenshot"].details &&
      lhr.audits["final-screenshot"].details.data
    ) {
      const finalScreenshotFilename = `lighthouse-${device}.png`;
      const finalScreenshotPath = path.join(
        datasetDir,
        finalScreenshotFilename
      );
      const base64Data = lhr.audits["final-screenshot"].details.data.replace(
        /^data:image\/png;base64,/,
        ""
      );
      fs.writeFileSync(finalScreenshotPath, base64Data, "base64");
      console.log(`📸 Final screenshot saved to: ${finalScreenshotPath}`);
    }
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
      pwa: lhr.categories.pwa
        ? Math.round(lhr.categories.pwa.score * 100)
        : "N/A",
    };

    // Key performance metrics
    const metrics = {
      firstContentfulPaint:
        lhr.audits["first-contentful-paint"]?.displayValue || "N/A",
      largestContentfulPaint:
        lhr.audits["largest-contentful-paint"]?.displayValue || "N/A",
      cumulativeLayoutShift:
        lhr.audits["cumulative-layout-shift"]?.displayValue || "N/A",
      totalBlockingTime:
        lhr.audits["total-blocking-time"]?.displayValue || "N/A",
      speedIndex: lhr.audits["speed-index"]?.displayValue || "N/A",
    };

    // Save summary report
    const summary = {
      url: websiteUrl,
      device: device,
      timestamp: new Date().toISOString(),
      scores,
      metrics,
      opportunities: lhr.audits["opportunities"] || [],
      diagnostics: lhr.audits["diagnostics"] || [],
    };

    const summaryPath = path.join(
      datasetDir,
      `lighthouse-summary-${device}.json`
    );
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📋 Summary report saved to: ${summaryPath}`);

    // Display results
    console.log("\n🎯 LIGHTHOUSE AUDIT RESULTS");
    console.log("================================");
    console.log(`🌐 URL: ${websiteUrl}`);
    console.log(`⚡ Performance: ${scores.performance}/100`);
    console.log(`♿ Accessibility: ${scores.accessibility}/100`);
    console.log(`✅ Best Practices: ${scores.bestPractices}/100`);
    console.log(`🔍 SEO: ${scores.seo}/100`);
    console.log(`📱 PWA: ${scores.pwa}/100`);
    console.log("\n📊 KEY METRICS");
    console.log("===============");
    console.log(`🎨 First Contentful Paint: ${metrics.firstContentfulPaint}`);
    console.log(
      `🖼️  Largest Contentful Paint: ${metrics.largestContentfulPaint}`
    );
    console.log(`📐 Cumulative Layout Shift: ${metrics.cumulativeLayoutShift}`);
    console.log(`⏳ Total Blocking Time: ${metrics.totalBlockingTime}`);
    console.log(`⚡ Speed Index: ${metrics.speedIndex}`);

    console.log("\n✅ Lighthouse audit completed successfully!");
  } catch (error) {
    console.error("❌ Lighthouse audit failed:", error.message);
    process.exit(1);
  } finally {
    if (chrome) {
      console.log("🔧 Closing Chrome browser...");
      await chrome.kill();
    }
  }
}

// Run the audit
runLighthouse().catch(console.error);
