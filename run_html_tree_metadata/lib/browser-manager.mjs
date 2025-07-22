import { chromium } from "playwright";

/**
 * CSP-Safe Browser Manager
 * Handles browser lifecycle and page management with robust error handling
 */
export class CSPSafeBrowserManager {
  constructor(options = {}) {
    this.browser = null;
    this.pages = new Map(); // Track all pages for proper cleanup
    this.options = {
      headless: true,
      timeout: 30000,
      ...options
    };
  }

  async launchBrowser() {
    if (this.browser) {
      console.log("Browser already launched, reusing existing instance");
      return this.browser;
    }

    console.log("🔧 Launching Chromium with CSP-safe configuration...");
    const startTime = Date.now();

    try {
      this.browser = await chromium.launch({
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security', // Only for testing - remove in production
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions'
        ]
      });

      const launchTime = Date.now() - startTime;
      console.log(`✅ Browser launched successfully in ${launchTime}ms`);
      
      return this.browser;
    } catch (error) {
      console.error(`❌ Failed to launch browser: ${error.message}`);
      throw error;
    }
  }

  async createPage(viewport) {
    if (!this.browser) {
      await this.launchBrowser();
    }

    console.log(`🌐 Creating page for ${viewport.name} viewport (${viewport.width}x${viewport.height})`);

    try {
      const page = await this.browser.newPage({
        viewport: {
          width: viewport.width,
          height: viewport.height
        },
        deviceScaleFactor: viewport.deviceScaleFactor || 1,
        isMobile: viewport.isMobile || false,
        hasTouch: viewport.hasTouch || false
      });

      // Track page for cleanup
      const pageId = `${viewport.name}-${Date.now()}`;
      this.pages.set(pageId, page);

      // Set reasonable timeouts
      page.setDefaultTimeout(this.options.timeout);
      page.setDefaultNavigationTimeout(this.options.timeout);

      return { page, pageId };
    } catch (error) {
      console.error(`❌ Failed to create page for ${viewport.name}: ${error.message}`);
      throw error;
    }
  }

  async navigateToURL(page, url, options = {}) {
    console.log(`🌐 Navigating to: ${url}`);
    const startTime = Date.now();

    const navigationOptions = {
      waitUntil: 'networkidle',
      timeout: 10000,
      ...options
    };

    try {
      // Try networkidle first (best for complete content)
      await page.goto(url, navigationOptions);
      
      const navigationTime = Date.now() - startTime;
      console.log(`✅ Navigation completed with networkidle in ${navigationTime}ms`);
    } catch (error) {
      if (error.message.includes('Timeout') || error.message.includes('timeout')) {
        console.log('⏱️ Networkidle timeout, falling back to domcontentloaded...');
        
        try {
          await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          
          const navigationTime = Date.now() - startTime;
          console.log(`✅ Navigation completed with domcontentloaded in ${navigationTime}ms`);
        } catch (fallbackError) {
          console.error(`❌ Navigation failed even with fallback: ${fallbackError.message}`);
          throw fallbackError;
        }
      } else {
        console.error(`❌ Navigation failed: ${error.message}`);
        throw error;
      }
    }

    // Wait for additional dynamic content
    try {
      await page.waitForTimeout(2000);
    } catch (error) {
      console.warn(`⚠️ Wait timeout error (non-critical): ${error.message}`);
    }

    // Get basic page info
    try {
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`📄 Page loaded: "${pageTitle}"`);
      
      return { pageTitle, pageUrl };
    } catch (error) {
      console.warn(`⚠️ Could not get page info: ${error.message}`);
      return { pageTitle: 'Unknown', pageUrl: url };
    }
  }

  async closePage(pageId) {
    if (this.pages.has(pageId)) {
      try {
        const page = this.pages.get(pageId);
        if (!page.isClosed()) {
          await page.close();
          console.log(`✅ Page ${pageId} closed successfully`);
        }
        this.pages.delete(pageId);
      } catch (error) {
        console.warn(`⚠️ Error closing page ${pageId}: ${error.message}`);
        this.pages.delete(pageId); // Remove from tracking anyway
      }
    }
  }

  async closeAllPages() {
    console.log(`🧹 Closing ${this.pages.size} open pages...`);
    
    for (const [pageId, page] of this.pages.entries()) {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch (error) {
        console.warn(`⚠️ Error closing page ${pageId}: ${error.message}`);
      }
    }
    
    this.pages.clear();
    console.log(`✅ All pages closed`);
  }

  async closeBrowser() {
    try {
      // Close all pages first
      await this.closeAllPages();
      
      // Close browser
      if (this.browser) {
        console.log("🔧 Closing browser...");
        await this.browser.close();
        this.browser = null;
        console.log("✅ Browser closed successfully");
      }
    } catch (error) {
      console.error(`❌ Error during browser cleanup: ${error.message}`);
      // Force cleanup
      this.browser = null;
      this.pages.clear();
    }
  }

  async cleanup() {
    await this.closeBrowser();
  }

  // Health check methods
  isBrowserOpen() {
    return this.browser && this.browser.isConnected();
  }

  getOpenPagesCount() {
    return this.pages.size;
  }

  async getBrowserInfo() {
    if (!this.browser) return null;
    
    try {
      const version = await this.browser.version();
      return {
        version,
        isConnected: this.browser.isConnected(),
        openPages: this.pages.size
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}