import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function extractCookies() {
  // Get website URL from environment variable
  const websiteUrl = process.env.WEBSITE_URL;

  console.log("🍪 COOKIE EXTRACTION PROCESS STARTED");
  console.log("====================================");
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

  try {
    // Launch browser
    console.log("\n🔧 Browser Setup Phase");
    console.log("======================");
    console.log("🚀 Launching Chrome browser...");
    console.log(`   Headless mode: true`);
    console.log(`   Browser args: default Chromium configuration`);

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

    // Set up error monitoring
    console.log("🔍 Setting up error monitoring...");
    const jsErrors = [];
    const failedRequests = [];

    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
      console.log(`   ⚠️  JavaScript error: ${error.message}`);
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure();
      failedRequests.push({ url: request.url(), error: failure?.errorText });
      console.log(
        `   ⚠️  Failed request: ${request.url()} (${failure?.errorText})`
      );
    });

    // Navigate to the website from environment variable
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

    // Wait for the page to load completely
    console.log("🌐 Waiting for network to settle...");
    const networkStart = Date.now();
    try {
      await page.waitForLoadState("networkidle", { timeout: 30000 });
      console.log(`✅ Network idle achieved in ${Date.now() - networkStart}ms`);
    } catch (networkError) {
      console.log(`⚠️  Network didn't settle within 30s, continuing anyway...`);
      console.log(`   Network error: ${networkError.message}`);
    }

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
    console.log(`   JavaScript errors: ${jsErrors.length}`);
    console.log(`   Failed requests: ${failedRequests.length}`);

    if (!hasContent) {
      console.warn(
        "⚠️  Page appears to have no content - cookie extraction may be limited"
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
    const screenshotFilename = "cookies-page-screenshot.png";
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

    // Extract cookies
    console.log("\n🍪 Cookie Extraction");
    console.log("====================");
    console.log("   Extracting cookies from browser context...");
    const cookieStart = Date.now();

    try {
      const cookies = await context.cookies();
      console.log(`✅ Cookies extracted in ${Date.now() - cookieStart}ms`);
      console.log(`   Total cookies found: ${cookies.length}`);

      // Analyze cookies
      if (cookies.length > 0) {
        const cookiesByDomain = {};
        const cookiesByType = {
          session: 0,
          persistent: 0,
          secure: 0,
          httpOnly: 0,
          sameSite: { strict: 0, lax: 0, none: 0, unset: 0 },
        };

        cookies.forEach((cookie) => {
          // Group by domain
          const domain = cookie.domain || "unknown";
          if (!cookiesByDomain[domain]) {
            cookiesByDomain[domain] = 0;
          }
          cookiesByDomain[domain]++;

          // Analyze cookie properties
          if (cookie.expires && cookie.expires > 0) {
            cookiesByType.persistent++;
          } else {
            cookiesByType.session++;
          }

          if (cookie.secure) {
            cookiesByType.secure++;
          }

          if (cookie.httpOnly) {
            cookiesByType.httpOnly++;
          }

          const sameSite = cookie.sameSite || "unset";
          if (cookiesByType.sameSite[sameSite.toLowerCase()]) {
            cookiesByType.sameSite[sameSite.toLowerCase()]++;
          } else {
            cookiesByType.sameSite.unset++;
          }
        });

        console.log("\n📊 Cookie Analysis:");
        console.log(`   Session cookies: ${cookiesByType.session}`);
        console.log(`   Persistent cookies: ${cookiesByType.persistent}`);
        console.log(`   Secure cookies: ${cookiesByType.secure}`);
        console.log(`   HttpOnly cookies: ${cookiesByType.httpOnly}`);
        console.log(`   SameSite - Strict: ${cookiesByType.sameSite.strict}`);
        console.log(`   SameSite - Lax: ${cookiesByType.sameSite.lax}`);
        console.log(`   SameSite - None: ${cookiesByType.sameSite.none}`);
        console.log(`   SameSite - Unset: ${cookiesByType.sameSite.unset}`);

        console.log("\n🌐 Cookies by domain:");
        Object.entries(cookiesByDomain).forEach(([domain, count]) => {
          console.log(`   ${domain}: ${count} cookies`);
        });

        // Show sample cookie details (first 3)
        console.log("\n🔍 Sample cookies (first 3):");
        cookies.slice(0, 3).forEach((cookie, index) => {
          console.log(`   Cookie ${index + 1}:`);
          console.log(`     Name: ${cookie.name}`);
          console.log(`     Domain: ${cookie.domain || "N/A"}`);
          console.log(`     Path: ${cookie.path || "N/A"}`);
          console.log(`     Secure: ${cookie.secure || false}`);
          console.log(`     HttpOnly: ${cookie.httpOnly || false}`);
          console.log(`     SameSite: ${cookie.sameSite || "unset"}`);
          console.log(
            `     Value length: ${cookie.value ? cookie.value.length : 0} chars`
          );
        });
      }

      // Save cookies to JSON file
      console.log("\n💾 Saving Cookie Data");
      console.log("=====================");
      const cookieJsonPath = path.join(datasetDir, "cookies.json");
      console.log(`   Cookie file path: ${cookieJsonPath}`);

      const saveStart = Date.now();
      const cookieData = {
        extractionTimestamp: new Date().toISOString(),
        sourceUrl: websiteUrl,
        totalCookies: cookies.length,
        jsErrors: jsErrors.length,
        failedRequests: failedRequests.length,
        cookies: cookies,
      };

      fs.writeFileSync(cookieJsonPath, JSON.stringify(cookieData, null, 2));

      const cookieStats = fs.statSync(cookieJsonPath);
      console.log(`✅ Cookie data saved in ${Date.now() - saveStart}ms`);
      console.log(`   File size: ${(cookieStats.size / 1024).toFixed(2)} KB`);
      console.log(`   Full path: ${cookieJsonPath}`);

      console.log(
        `\n🎉 Successfully extracted ${cookies.length} cookies and saved to cookies.json`
      );
    } catch (cookieError) {
      console.error(`❌ Cookie extraction failed: ${cookieError.message}`);
      throw cookieError;
    }
  } catch (error) {
    console.error("\n❌ Cookie extraction process failed:", error.message);
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

    const totalTime = Date.now() - Date.now();
    console.log("\n📊 PROCESS SUMMARY");
    console.log("==================");
    console.log(`⏱️  Process completed at: ${new Date().toISOString()}`);
    console.log("🏁 Cookie extraction cleanup completed");
  }
}

extractCookies().catch(console.error);
