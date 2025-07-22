import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

class LoadedResourcesCollector {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.cdpSession = null;
    this.state = {
      outputDir: path.join(__dirname, "..", "dataset"),
      metadata: {
        collectionTime: null,
        pageUrl: null,
        pageTitle: null,
        userAgent: null,
        viewportSize: { width: 1280, height: 720 },
        collectionDuration: 10000, // 10 seconds default
      },
      resources: {
        scripts: [],
        stylesheets: [],
        images: [],
        fonts: [],
        other: [],
        xhr: [],
        fetch: [],
        documents: [],
        media: [],
      },
      networkEvents: [],
      performanceMetrics: {},
    };
  }

  /**
   * Collect loaded resources on the page
   * @returns {Promise<Object>} The resource data
   */
  async collectLoadedResources() {
    try {
      console.log("🔍 Setting up resource collection...");

      const resources = {
        scripts: [],
        stylesheets: [],
        images: [],
        fonts: [],
        other: [],
        xhr: [],
        fetch: [],
        documents: [],
        media: [],
      };

      // Set up CDP session for detailed network monitoring
      console.log("🌐 Enabling network monitoring via CDP...");
      this.cdpSession = await this.page.context().newCDPSession(this.page);
      await this.cdpSession.send("Network.enable");
      await this.cdpSession.send("Runtime.enable");

      // Also enable Page domain for additional events
      await this.cdpSession.send("Page.enable");

      const collectionDuration = this.state.metadata.collectionDuration;
      console.log(`⏱️ Collecting resources for ${collectionDuration}ms...`);

      const collectedRequests = new Map();
      const collectedResponses = new Map();
      const networkTimings = new Map();

      // CDP Network event listeners
      this.cdpSession.on("Network.requestWillBeSent", (event) => {
        try {
          const { requestId, request, timestamp, type, redirectResponse } =
            event;

          collectedRequests.set(requestId, {
            requestId,
            url: request.url,
            method: request.method,
            headers: request.headers,
            postData: request.postData,
            timestamp,
            type: type || "Unknown",
            redirectResponse,
            initiator: event.initiator,
            isBlocking: this.isBlockingResource(request, type),
            loadingBehavior: this.determineLoadingBehavior(
              request,
              type,
              event.initiator
            ),
          });

          networkTimings.set(requestId, {
            requestStart: timestamp,
            ...(networkTimings.get(requestId) || {}),
          });

          this.state.networkEvents.push({
            type: "request",
            requestId,
            url: request.url,
            method: request.method,
            resourceType: type,
            timestamp,
            initiator: event.initiator,
          });
        } catch (err) {
          console.log(`⚠️ Error processing request event: ${err.message}`);
        }
      });

      this.cdpSession.on("Network.responseReceived", (event) => {
        try {
          const { requestId, response, timestamp, type } = event;

          collectedResponses.set(requestId, {
            requestId,
            url: response.url,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            mimeType: response.mimeType,
            remoteIPAddress: response.remoteIPAddress,
            remotePort: response.remotePort,
            fromDiskCache: response.fromDiskCache,
            fromServiceWorker: response.fromServiceWorker,
            encodedDataLength: response.encodedDataLength,
            timestamp,
            type: type || "Unknown",
            timing: response.timing,
          });

          networkTimings.set(requestId, {
            ...(networkTimings.get(requestId) || {}),
            responseStart: timestamp,
            timing: response.timing,
          });

          this.state.networkEvents.push({
            type: "response",
            requestId,
            url: response.url,
            status: response.status,
            mimeType: response.mimeType,
            resourceType: type,
            size: response.encodedDataLength,
            fromCache: response.fromDiskCache,
            timestamp,
          });
        } catch (err) {
          console.log(`⚠️ Error processing response event: ${err.message}`);
        }
      });

      this.cdpSession.on("Network.loadingFinished", (event) => {
        try {
          const { requestId, timestamp, encodedDataLength } = event;

          networkTimings.set(requestId, {
            ...(networkTimings.get(requestId) || {}),
            loadingFinished: timestamp,
            finalSize: encodedDataLength,
          });

          this.state.networkEvents.push({
            type: "loadingFinished",
            requestId,
            timestamp,
            encodedDataLength,
          });
        } catch (err) {
          console.log(
            `⚠️ Error processing loading finished event: ${err.message}`
          );
        }
      });

      this.cdpSession.on("Network.loadingFailed", (event) => {
        try {
          const { requestId, timestamp, errorText, canceled } = event;

          this.state.networkEvents.push({
            type: "loadingFailed",
            requestId,
            timestamp,
            errorText,
            canceled,
          });
        } catch (err) {
          console.log(
            `⚠️ Error processing loading failed event: ${err.message}`
          );
        }
      });

      // Also listen to Playwright's built-in events for redundancy
      const requestHandler = (request) => {
        try {
          // Store for correlation but CDP has more detailed info
          console.log(`📥 Request: ${request.method()} ${request.url()}`);
        } catch (err) {
          // Ignore handler errors
        }
      };

      const responseHandler = (response) => {
        try {
          console.log(`📤 Response: ${response.status()} ${response.url()}`);
        } catch (err) {
          // Ignore handler errors
        }
      };

      this.page.on("request", requestHandler);
      this.page.on("response", responseHandler);

      // Wait for the specified collection duration
      const collectionStart = Date.now();
      const collectionInterval = setInterval(() => {
        const elapsed = Date.now() - collectionStart;
        const remaining = Math.max(0, collectionDuration - elapsed);
        process.stdout.write(
          `\r🔄 Collecting... ${Math.round(remaining / 1000)}s remaining`
        );
      }, 1000);

      await new Promise((resolve) => setTimeout(resolve, collectionDuration));
      clearInterval(collectionInterval);
      console.log("\n✅ Collection period completed");

      // Remove event listeners
      this.page.off("request", requestHandler);
      this.page.off("response", responseHandler);

      // Process collected data
      console.log("📊 Processing collected network data...");

      // Combine request and response data
      for (const [requestId, request] of collectedRequests) {
        const response = collectedResponses.get(requestId);
        const timing = networkTimings.get(requestId);

        if (response) {
          const resourceObj = {
            requestId,
            url: request.url,
            method: request.method,
            status: response.status,
            statusText: response.statusText,
            mimeType: response.mimeType,
            size: response.encodedDataLength || 0,
            fromCache: response.fromDiskCache || false,
            fromServiceWorker: response.fromServiceWorker || false,
            remoteIP: response.remoteIPAddress,
            remotePort: response.remotePort,
            requestHeaders: request.headers,
            responseHeaders: response.headers,
            initiator: request.initiator,
            isBlocking: request.isBlocking,
            loadingBehavior: request.loadingBehavior,
            timing: {
              requestStart: timing?.requestStart || 0,
              responseStart: timing?.responseStart || 0,
              loadingFinished: timing?.loadingFinished || 0,
              duration:
                timing?.loadingFinished && timing?.requestStart
                  ? (timing.loadingFinished - timing.requestStart) * 1000
                  : 0,
              ...response.timing,
            },
            resourceType: request.type || "Unknown",
          };

          // Categorize resources by type
          switch (request.type) {
            case "Script":
              resources.scripts.push(resourceObj);
              break;
            case "Stylesheet":
              resources.stylesheets.push(resourceObj);
              break;
            case "Image":
              resources.images.push(resourceObj);
              break;
            case "Font":
              resources.fonts.push(resourceObj);
              break;
            case "Document":
              resources.documents.push(resourceObj);
              break;
            case "XHR":
              resources.xhr.push(resourceObj);
              break;
            case "Fetch":
              resources.fetch.push(resourceObj);
              break;
            case "Media":
              resources.media.push(resourceObj);
              break;
            default:
              resources.other.push(resourceObj);
          }
        } else {
          // Request without response (failed or still loading)
          const failedResourceObj = {
            requestId,
            url: request.url,
            method: request.method,
            status: 0,
            statusText: "No Response",
            mimeType: "unknown",
            size: 0,
            fromCache: false,
            requestHeaders: request.headers,
            initiator: request.initiator,
            resourceType: request.type || "Unknown",
            failed: true,
          };

          resources.other.push(failedResourceObj);
        }
      }

      // Store in state for later use
      this.state.resources = resources;

      console.log("✅ Resource collection completed successfully");
      console.log(
        `   📊 Total resources: ${this.getTotalResourceCount(resources)}`
      );
      console.log(`   📜 Scripts: ${resources.scripts.length}`);
      console.log(`   🎨 Stylesheets: ${resources.stylesheets.length}`);
      console.log(`   🖼️ Images: ${resources.images.length}`);
      console.log(`   📝 Fonts: ${resources.fonts.length}`);
      console.log(
        `   📡 XHR/Fetch: ${resources.xhr.length + resources.fetch.length}`
      );
      console.log(`   📄 Documents: ${resources.documents.length}`);
      console.log(`   🎵 Media: ${resources.media.length}`);
      console.log(`   📦 Other: ${resources.other.length}`);

      return resources;
    } catch (error) {
      console.log(`⚠️ Error collecting loaded resources: ${error.message}`);
      return {
        scripts: [],
        stylesheets: [],
        images: [],
        fonts: [],
        other: [],
        xhr: [],
        fetch: [],
        documents: [],
        media: [],
        error: error.message,
      };
    }
  }

  /**
   * Determine if a resource is blocking the page render
   * @param {Object} request - The request object
   * @param {string} type - The resource type
   * @returns {boolean} Whether the resource is blocking
   */
  isBlockingResource(request, type) {
    // Scripts are blocking by default unless they have async/defer attributes
    if (type === "Script") {
      // Check if URL suggests async loading patterns
      const url = request.url.toLowerCase();
      if (
        url.includes("async") ||
        url.includes("defer") ||
        url.includes("module")
      ) {
        return false;
      }
      // Scripts in head are generally blocking
      return true;
    }

    // Stylesheets are typically blocking
    if (type === "Stylesheet") {
      // Check for media queries or conditional loading
      const url = request.url.toLowerCase();
      if (
        url.includes("media=") ||
        url.includes("print") ||
        url.includes("screen and (")
      ) {
        return false;
      }
      return true;
    }

    // Main document is always blocking
    if (type === "Document") {
      return true;
    }

    // Fonts can be blocking if they are critical
    if (type === "Font") {
      // Web fonts are generally render-blocking
      return true;
    }

    // Images, media, XHR, Fetch are typically non-blocking
    return false;
  }

  /**
   * Determine the loading behavior of a resource
   * @param {Object} request - The request object
   * @param {string} type - The resource type
   * @param {Object} initiator - The initiator object
   * @returns {string} The loading behavior (sync, async, defer, lazy, eager)
   */
  determineLoadingBehavior(request, type, initiator) {
    const url = request.url.toLowerCase();
    const headers = request.headers || {};

    // Analyze based on resource type
    switch (type) {
      case "Script":
        // Check for async/defer indicators
        if (url.includes("async") || headers["x-async"]) {
          return "async";
        }
        if (url.includes("defer") || headers["x-defer"]) {
          return "defer";
        }
        if (url.includes("module") || headers["type"] === "module") {
          return "module";
        }
        // Check initiator for script loading behavior
        if (initiator && initiator.type === "script") {
          return "dynamic"; // Dynamically loaded script
        }
        return "sync";

      case "Stylesheet":
        // Check for conditional or async CSS loading
        if (url.includes("media=print") || headers["media"] === "print") {
          return "conditional";
        }
        if (url.includes("preload") || headers["rel"] === "preload") {
          return "preload";
        }
        return "sync";

      case "Image":
        // Check for lazy loading indicators
        if (url.includes("lazy") || headers["loading"] === "lazy") {
          return "lazy";
        }
        if (url.includes("eager") || headers["loading"] === "eager") {
          return "eager";
        }
        // Check if loaded via JavaScript (intersection observer, etc.)
        if (initiator && initiator.type === "script") {
          return "lazy";
        }
        return "eager";

      case "Font":
        // Check for font loading strategies
        if (url.includes("preload") || headers["rel"] === "preload") {
          return "preload";
        }
        if (headers["font-display"]) {
          return headers["font-display"]; // swap, fallback, optional, etc.
        }
        return "auto";

      case "XHR":
      case "Fetch":
        // All XHR/Fetch are async by nature
        return "async";

      case "Media":
        // Check for lazy loading
        if (url.includes("lazy") || headers["loading"] === "lazy") {
          return "lazy";
        }
        return "auto";

      default:
        // Check for preload/prefetch
        if (url.includes("preload") || headers["rel"] === "preload") {
          return "preload";
        }
        if (url.includes("prefetch") || headers["rel"] === "prefetch") {
          return "prefetch";
        }
        return "auto";
    }
  }

  /**
   * Analyze resource performance and generate insights
   */
  async analyzeResourcePerformance() {
    try {
      console.log("📈 Analyzing resource performance...");

      const analysis = {
        totalResources: this.getTotalResourceCount(this.state.resources),
        totalSize: 0,
        averageLoadTime: 0,
        cacheEfficiency: 0,
        largestResources: [],
        slowestResources: [],
        domainBreakdown: {},
        sizeByType: {},
        blockingResources: 0,
        nonBlockingResources: 0,
        loadingBehaviorBreakdown: {},
        criticalPathResources: [],
        performanceIssues: [],
        recommendations: [],
      };

      const allResources = this.getAllResourcesList();

      if (allResources.length === 0) {
        console.log("⚠️ No resources to analyze");
        return analysis;
      }

      // Pre-calculate commonly used metrics
      const syncScripts = allResources.filter(
        (r) => r.resourceType === "Script" && r.loadingBehavior === "sync"
      ).length;
      const eagerImages = allResources.filter(
        (r) => r.resourceType === "Image" && r.loadingBehavior === "eager"
      ).length;

      // Calculate total size and average load time
      let totalLoadTime = 0;
      let resourcesWithTiming = 0;
      let cachedResources = 0;

      allResources.forEach((resource) => {
        analysis.totalSize += resource.size || 0;

        if (resource.timing && resource.timing.duration > 0) {
          totalLoadTime += resource.timing.duration;
          resourcesWithTiming++;
        }

        if (resource.fromCache) {
          cachedResources++;
        }

        // Domain breakdown
        try {
          const domain = new URL(resource.url).hostname;
          analysis.domainBreakdown[domain] =
            (analysis.domainBreakdown[domain] || 0) + 1;
        } catch (e) {
          analysis.domainBreakdown["invalid-url"] =
            (analysis.domainBreakdown["invalid-url"] || 0) + 1;
        }

        // Size by type
        const type = resource.resourceType || "Unknown";
        analysis.sizeByType[type] =
          (analysis.sizeByType[type] || 0) + (resource.size || 0);

        // Count blocking vs non-blocking resources
        if (resource.isBlocking) {
          analysis.blockingResources++;
          // Add to critical path if it's large or slow
          if (
            resource.size > 100000 ||
            (resource.timing && resource.timing.duration > 1000)
          ) {
            analysis.criticalPathResources.push({
              url: resource.url,
              size: resource.size,
              duration: resource.timing?.duration || 0,
              type: resource.resourceType,
              loadingBehavior: resource.loadingBehavior,
              sizeFormatted: this.formatBytes(resource.size),
              durationFormatted: `${Math.round(
                resource.timing?.duration || 0
              )}ms`,
            });
          }
        } else {
          analysis.nonBlockingResources++;
        }

        // Loading behavior breakdown
        const behavior = resource.loadingBehavior || "unknown";
        analysis.loadingBehaviorBreakdown[behavior] =
          (analysis.loadingBehaviorBreakdown[behavior] || 0) + 1;
      });

      analysis.averageLoadTime =
        resourcesWithTiming > 0 ? totalLoadTime / resourcesWithTiming : 0;
      analysis.cacheEfficiency =
        allResources.length > 0
          ? (cachedResources / allResources.length) * 100
          : 0;

      // Sort critical path resources by impact (size + duration)
      analysis.criticalPathResources.sort((a, b) => {
        const aImpact = a.size / 1000 + a.duration;
        const bImpact = b.size / 1000 + b.duration;
        return bImpact - aImpact;
      });

      // Find largest resources (top 10)
      analysis.largestResources = allResources
        .filter((r) => r.size > 0)
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map((r) => ({
          url: r.url,
          size: r.size,
          type: r.resourceType,
          sizeFormatted: this.formatBytes(r.size),
        }));

      // Find slowest resources (top 10)
      analysis.slowestResources = allResources
        .filter((r) => r.timing && r.timing.duration > 0)
        .sort((a, b) => b.timing.duration - a.timing.duration)
        .slice(0, 10)
        .map((r) => ({
          url: r.url,
          duration: r.timing.duration,
          type: r.resourceType,
          durationFormatted: `${Math.round(r.timing.duration)}ms`,
        }));

      // Performance issues detection
      const issues = [];

      // Large total size
      if (analysis.totalSize > 5 * 1024 * 1024) {
        // > 5MB
        issues.push({
          type: "Large Total Size",
          severity: "high",
          description: `Total resource size is ${this.formatBytes(
            analysis.totalSize
          )}, which is quite large`,
          impact: "Slow page loads, especially on mobile networks",
        });
      }

      // Low cache efficiency
      if (analysis.cacheEfficiency < 50) {
        issues.push({
          type: "Poor Cache Efficiency",
          severity: "medium",
          description: `Only ${Math.round(
            analysis.cacheEfficiency
          )}% of resources are cached`,
          impact: "Increased load times on repeat visits",
        });
      }

      // Too many resources
      if (analysis.totalResources > 100) {
        issues.push({
          type: "Too Many Resources",
          severity: "medium",
          description: `Page loads ${analysis.totalResources} resources`,
          impact: "Increased connection overhead and load times",
        });
      }

      // Very slow resources
      const verySlowResources = allResources.filter(
        (r) => r.timing && r.timing.duration > 5000
      );
      if (verySlowResources.length > 0) {
        issues.push({
          type: "Very Slow Resources",
          severity: "high",
          description: `${verySlowResources.length} resources took over 5 seconds to load`,
          impact: "Significantly delayed page rendering",
        });
      }

      // Too many blocking resources
      const blockingPercentage =
        allResources.length > 0
          ? (analysis.blockingResources / allResources.length) * 100
          : 0;
      if (blockingPercentage > 50) {
        issues.push({
          type: "Too Many Blocking Resources",
          severity: "high",
          description: `${Math.round(blockingPercentage)}% of resources (${
            analysis.blockingResources
          }) are blocking page render`,
          impact: "Delayed first paint and user interaction",
        });
      }

      // Critical path resources
      if (analysis.criticalPathResources.length > 5) {
        issues.push({
          type: "Heavy Critical Path",
          severity: "medium",
          description: `${analysis.criticalPathResources.length} large or slow blocking resources in critical path`,
          impact: "Slower time to interactive and first contentful paint",
        });
      }

      // Synchronous scripts
      if (syncScripts > 10) {
        issues.push({
          type: "Too Many Synchronous Scripts",
          severity: "medium",
          description: `${syncScripts} scripts are loading synchronously`,
          impact: "Blocks HTML parsing and delays page rendering",
        });
      }

      analysis.performanceIssues = issues;

      // Generate recommendations
      const recommendations = [];

      if (analysis.totalSize > 3 * 1024 * 1024) {
        recommendations.push(
          "Consider optimizing images and using modern formats like WebP"
        );
        recommendations.push(
          "Enable compression (gzip/brotli) for text-based resources"
        );
      }

      if (analysis.cacheEfficiency < 70) {
        recommendations.push(
          "Implement proper caching headers for static resources"
        );
        recommendations.push("Consider using a CDN for better caching");
      }

      if (this.state.resources.scripts.length > 20) {
        recommendations.push(
          "Consider bundling and minifying JavaScript files"
        );
      }

      if (this.state.resources.stylesheets.length > 10) {
        recommendations.push(
          "Consider combining CSS files to reduce HTTP requests"
        );
      }

      if (analysis.blockingResources > analysis.nonBlockingResources) {
        recommendations.push(
          "Consider making more resources non-blocking with async/defer attributes"
        );
      }

      if (analysis.criticalPathResources.length > 3) {
        recommendations.push(
          "Optimize critical path resources by reducing their size or using preload hints"
        );
      }

      if (syncScripts > 5) {
        recommendations.push(
          "Add async or defer attributes to non-critical JavaScript files"
        );
      }

      if (eagerImages > 20) {
        recommendations.push(
          "Implement lazy loading for images below the fold"
        );
      }

      analysis.recommendations = recommendations;

      console.log("✅ Resource performance analysis completed");
      console.log(`   📊 Total Size: ${this.formatBytes(analysis.totalSize)}`);
      console.log(
        `   ⏱️ Average Load Time: ${Math.round(analysis.averageLoadTime)}ms`
      );
      console.log(
        `   💾 Cache Efficiency: ${Math.round(analysis.cacheEfficiency)}%`
      );
      console.log(`   🚫 Blocking Resources: ${analysis.blockingResources}`);
      console.log(
        `   ✅ Non-Blocking Resources: ${analysis.nonBlockingResources}`
      );
      console.log(
        `   🎯 Critical Path Resources: ${analysis.criticalPathResources.length}`
      );
      console.log(
        `   ⚠️ Performance Issues: ${analysis.performanceIssues.length}`
      );

      return analysis;
    } catch (error) {
      console.log(`⚠️ Error analyzing resource performance: ${error.message}`);
      return {
        totalResources: 0,
        totalSize: 0,
        averageLoadTime: 0,
        cacheEfficiency: 0,
        largestResources: [],
        slowestResources: [],
        domainBreakdown: {},
        sizeByType: {},
        performanceIssues: [],
        recommendations: [],
        error: error.message,
      };
    }
  }

  getTotalResourceCount(resources) {
    return Object.values(resources).reduce((total, arr) => {
      return total + (Array.isArray(arr) ? arr.length : 0);
    }, 0);
  }

  getAllResourcesList() {
    const allResources = [];
    Object.values(this.state.resources).forEach((resourceArray) => {
      if (Array.isArray(resourceArray)) {
        allResources.push(...resourceArray);
      }
    });
    return allResources;
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async generateMetadata() {
    console.log("\n📊 GENERATING RESOURCE COLLECTION METADATA");
    console.log("===========================================");

    const analysis = await this.analyzeResourcePerformance();

    const metadata = {
      collection: {
        timestamp: this.state.metadata.collectionTime,
        pageUrl: this.state.metadata.pageUrl,
        pageTitle: this.state.metadata.pageTitle,
        userAgent: this.state.metadata.userAgent,
        viewport: this.state.metadata.viewportSize,
        collectionDuration: this.state.metadata.collectionDuration,
      },
      resources: {
        total: analysis.totalResources,
        scripts: this.state.resources.scripts.length,
        stylesheets: this.state.resources.stylesheets.length,
        images: this.state.resources.images.length,
        fonts: this.state.resources.fonts.length,
        xhr: this.state.resources.xhr.length,
        fetch: this.state.resources.fetch.length,
        documents: this.state.resources.documents.length,
        media: this.state.resources.media.length,
        other: this.state.resources.other.length,
      },
      performance: {
        totalSize: analysis.totalSize,
        totalSizeFormatted: this.formatBytes(analysis.totalSize),
        averageLoadTime: Math.round(analysis.averageLoadTime),
        cacheEfficiency: Math.round(analysis.cacheEfficiency),
        issueCount: analysis.performanceIssues.length,
        recommendationCount: analysis.recommendations.length,
      },
      analysis: analysis,
    };

    console.log("📈 Resource Collection Statistics:");
    console.log(`   Total Resources: ${metadata.resources.total}`);
    console.log(`   Total Size: ${metadata.performance.totalSizeFormatted}`);
    console.log(
      `   Average Load Time: ${metadata.performance.averageLoadTime}ms`
    );
    console.log(
      `   Cache Efficiency: ${metadata.performance.cacheEfficiency}%`
    );
    console.log(`   Performance Issues: ${metadata.performance.issueCount}`);

    return metadata;
  }

  async cleanup() {
    console.log("\n🧹 CLEANUP PHASE");
    console.log("=================");

    try {
      if (this.cdpSession) {
        console.log("🌐 Closing CDP session...");
        await this.cdpSession.detach();
        console.log("✅ CDP session closed");
      }

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
      console.error(`⚠️ Error during cleanup: ${error.message}`);
    }
  }
}

async function runResourceCollection() {
  // Get configuration from environment variables
  const websiteUrl = process.env.WEBSITE_URL;
  const collectionDuration = parseInt(process.env.COLLECTION_DURATION) || 10000; // 10 seconds default

  console.log("📦 LOADED RESOURCES COLLECTION STARTED");
  console.log("======================================");
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🖥️ Platform: ${process.platform}`);
  console.log(`🏗️ Node.js version: ${process.version}`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📍 Script location: ${__dirname}`);

  console.log("\n🔧 Configuration:");
  console.log(`   Website URL: ${websiteUrl || "NOT SET"}`);
  console.log(`   Collection Duration: ${collectionDuration}ms`);

  if (!websiteUrl) {
    console.error("❌ WEBSITE_URL environment variable is required");
    console.error("Set it in .env file or as environment variable");
    process.exit(1);
  }

  const collector = new LoadedResourcesCollector();
  collector.state.metadata.collectionDuration = collectionDuration;

  try {
    // Launch browser
    console.log("\n🚀 BROWSER SETUP");
    console.log("=================");
    console.log("🔧 Launching Chromium browser...");

    const launchStart = Date.now();
    collector.browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    console.log(`✅ Browser launched in ${Date.now() - launchStart}ms`);

    // Create context and page
    collector.context = await collector.browser.newContext({
      viewport: collector.state.metadata.viewportSize,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      locale: "en-US",
    });

    collector.page = await collector.context.newPage();

    // Navigate to website
    console.log("\n🌐 WEBSITE NAVIGATION");
    console.log("======================");
    console.log(`🔄 Navigating to: ${websiteUrl}`);

    const navStart = Date.now();

    // Start resource collection BEFORE navigation
    const resourcePromise = collector.collectLoadedResources();

    // Navigate to the page
    await collector.page.goto(websiteUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`✅ Navigation completed in ${Date.now() - navStart}ms`);

    // Update metadata
    collector.state.metadata.collectionTime = new Date().toISOString();
    collector.state.metadata.pageUrl = collector.page.url();
    collector.state.metadata.pageTitle = await collector.page.title();

    // Try to get user agent with CSP fallback
    try {
      collector.state.metadata.userAgent = await collector.page.evaluate(
        () => navigator.userAgent
      );
    } catch (cspError) {
      console.log("⚠️ Cannot get user agent due to CSP, using default");
      collector.state.metadata.userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    // Check page status
    console.log(`   Final URL: ${collector.state.metadata.pageUrl}`);
    console.log(`   Page title: "${collector.state.metadata.pageTitle}"`);

    // Wait for resource collection to complete
    console.log("\n📦 RESOURCE COLLECTION");
    console.log("======================");
    const resources = await resourcePromise;

    // Take screenshot
    console.log("\n📸 CAPTURING SCREENSHOT");
    console.log("=======================");
    const screenshotPath = path.join(
      collector.state.outputDir,
      "loaded-resources-collector-screenshot.png"
    );
    await collector.page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    // Generate metadata and analysis
    const metadata = await collector.generateMetadata();

    // Save resource data
    console.log("\n💾 SAVING DATA FILES");
    console.log("====================");

    // Save detailed resource data
    const resourcesPath = path.join(
      collector.state.outputDir,
      "loaded-resources-collector-data.json"
    );
    fs.writeFileSync(resourcesPath, JSON.stringify(resources, null, 2));
    console.log(`✅ Resource data saved: ${resourcesPath}`);

    // Save network events
    const eventsPath = path.join(
      collector.state.outputDir,
      "network-events.json"
    );
    fs.writeFileSync(
      eventsPath,
      JSON.stringify(collector.state.networkEvents, null, 2)
    );
    console.log(`✅ Network events saved: ${eventsPath}`);

    // Save summary metadata
    const metadataPath = path.join(
      collector.state.outputDir,
      "loaded-resources-collector-summary.json"
    );
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Summary metadata saved: ${metadataPath}`);

    // Create human-readable report
    console.log("📄 Creating readable report...");
    let report = `# Loaded Resources Analysis Report\n\n`;
    report += `**Website:** ${websiteUrl}\n`;
    report += `**Collection Date:** ${metadata.collection.timestamp}\n`;
    report += `**Page Title:** ${metadata.collection.pageTitle}\n`;
    report += `**Collection Duration:** ${collectionDuration}ms\n\n`;

    // Resource overview
    report += `## Resource Overview\n\n`;
    report += `- **Total Resources:** ${metadata.resources.total}\n`;
    report += `- **Scripts:** ${metadata.resources.scripts}\n`;
    report += `- **Stylesheets:** ${metadata.resources.stylesheets}\n`;
    report += `- **Images:** ${metadata.resources.images}\n`;
    report += `- **Fonts:** ${metadata.resources.fonts}\n`;
    report += `- **XHR Requests:** ${metadata.resources.xhr}\n`;
    report += `- **Fetch Requests:** ${metadata.resources.fetch}\n`;
    report += `- **Documents:** ${metadata.resources.documents}\n`;
    report += `- **Media:** ${metadata.resources.media}\n`;
    report += `- **Other:** ${metadata.resources.other}\n\n`;

    // Performance analysis
    report += `## Performance Analysis\n\n`;
    report += `- **Total Size:** ${metadata.performance.totalSizeFormatted}\n`;
    report += `- **Average Load Time:** ${metadata.performance.averageLoadTime}ms\n`;
    report += `- **Cache Efficiency:** ${metadata.performance.cacheEfficiency}%\n`;
    report += `- **Blocking Resources:** ${metadata.analysis.blockingResources}\n`;
    report += `- **Non-Blocking Resources:** ${metadata.analysis.nonBlockingResources}\n`;
    report += `- **Critical Path Resources:** ${metadata.analysis.criticalPathResources.length}\n`;
    report += `- **Performance Issues:** ${metadata.performance.issueCount}\n\n`;

    // Loading behavior analysis
    if (Object.keys(metadata.analysis.loadingBehaviorBreakdown).length > 0) {
      report += `## Loading Behavior Breakdown\n\n`;
      report += `| Loading Behavior | Count | Description |\n`;
      report += `|------------------|-------|-------------|\n`;

      const behaviorDescriptions = {
        sync: "Synchronous - blocks HTML parsing",
        async: "Asynchronous - loads in parallel",
        defer: "Deferred - executes after HTML parsing",
        lazy: "Lazy loaded - loads when needed",
        eager: "Eager loaded - loads immediately",
        preload: "Preloaded - high priority hint",
        prefetch: "Prefetched - low priority hint",
        module: "ES6 Module - modern async loading",
        dynamic: "Dynamically loaded - via JavaScript",
        conditional: "Conditional - based on media queries",
        auto: "Browser default behavior",
      };

      Object.entries(metadata.analysis.loadingBehaviorBreakdown).forEach(
        ([behavior, count]) => {
          const description =
            behaviorDescriptions[behavior] || "Unknown behavior";
          report += `| ${behavior} | ${count} | ${description} |\n`;
        }
      );
      report += `\n`;
    }

    // Critical path resources
    if (metadata.analysis.criticalPathResources.length > 0) {
      report += `## Critical Path Resources\n\n`;
      report += `These blocking resources may impact page load performance:\n\n`;
      report += `| Resource | Size | Duration | Type | Loading |\n`;
      report += `|----------|------|----------|------|----------|\n`;
      metadata.analysis.criticalPathResources
        .slice(0, 10)
        .forEach((resource) => {
          const url =
            resource.url.length > 50
              ? resource.url.substring(0, 47) + "..."
              : resource.url;
          report += `| ${url} | ${resource.sizeFormatted} | ${resource.durationFormatted} | ${resource.type} | ${resource.loadingBehavior} |\n`;
        });
      if (metadata.analysis.criticalPathResources.length > 10) {
        report += `... and ${
          metadata.analysis.criticalPathResources.length - 10
        } more critical resources\n`;
      }
      report += `\n`;
    }

    // Performance issues
    if (metadata.analysis.performanceIssues.length > 0) {
      report += `## Performance Issues\n\n`;
      metadata.analysis.performanceIssues.forEach((issue, index) => {
        report += `### ${index + 1}. ${
          issue.type
        } (${issue.severity.toUpperCase()})\n\n`;
        report += `**Description:** ${issue.description}\n\n`;
        report += `**Impact:** ${issue.impact}\n\n`;
      });
    }

    // Recommendations
    if (metadata.analysis.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      metadata.analysis.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += `\n`;
    }

    // Largest resources
    if (metadata.analysis.largestResources.length > 0) {
      report += `## Largest Resources\n\n`;
      report += `| Resource | Size | Type |\n`;
      report += `|----------|------|------|\n`;
      metadata.analysis.largestResources.forEach((resource) => {
        const url =
          resource.url.length > 60
            ? resource.url.substring(0, 57) + "..."
            : resource.url;
        report += `| ${url} | ${resource.sizeFormatted} | ${resource.type} |\n`;
      });
      report += `\n`;
    }

    // Slowest resources
    if (metadata.analysis.slowestResources.length > 0) {
      report += `## Slowest Resources\n\n`;
      report += `| Resource | Duration | Type |\n`;
      report += `|----------|----------|------|\n`;
      metadata.analysis.slowestResources.forEach((resource) => {
        const url =
          resource.url.length > 60
            ? resource.url.substring(0, 57) + "..."
            : resource.url;
        report += `| ${url} | ${resource.durationFormatted} | ${resource.type} |\n`;
      });
      report += `\n`;
    }

    // Domain breakdown
    if (Object.keys(metadata.analysis.domainBreakdown).length > 0) {
      report += `## Domain Breakdown\n\n`;
      const sortedDomains = Object.entries(metadata.analysis.domainBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      report += `| Domain | Resources |\n`;
      report += `|--------|----------|\n`;
      sortedDomains.forEach(([domain, count]) => {
        report += `| ${domain} | ${count} |\n`;
      });
      report += `\n`;
    }

    const reportPath = path.join(
      collector.state.outputDir,
      "loaded-resources-collector-report.md"
    );
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved: ${reportPath}`);

    // Final summary
    console.log("\n🎉 RESOURCE COLLECTION COMPLETED!");
    console.log("=================================");
    console.log(`📦 Resource Data: ${resourcesPath}`);
    console.log(`🌐 Network Events: ${eventsPath}`);
    console.log(`📊 Summary: ${metadataPath}`);
    console.log(`📄 Report: ${reportPath}`);
    console.log(`📸 Screenshot: ${screenshotPath}`);
    console.log(`🔢 Total Resources: ${metadata.resources.total}`);
    console.log(`📏 Total Size: ${metadata.performance.totalSizeFormatted}`);
    console.log(
      `⏱️ Average Load Time: ${metadata.performance.averageLoadTime}ms`
    );
    console.log(
      `💾 Cache Efficiency: ${metadata.performance.cacheEfficiency}%`
    );
    console.log(`⚠️ Performance Issues: ${metadata.performance.issueCount}`);
  } catch (error) {
    console.error("\n❌ RESOURCE COLLECTION FAILED");
    console.error("==============================");
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
    await collector.cleanup();
  }
}

// Run the resource collection
runResourceCollection().catch(console.error);
