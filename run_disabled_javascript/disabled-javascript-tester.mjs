import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

class DisabledJavaScriptTester {
  constructor() {
    this.browser = null;
    this.jsEnabledContext = null;
    this.jsDisabledContext = null;
    this.jsEnabledPage = null;
    this.jsDisabledPage = null;
    this.state = {
      outputDir: path.join(__dirname, "..", "dataset"),
      metadata: {
        testTime: null,
        pageUrl: null,
        pageTitle: null,
        userAgent: null,
        viewportSize: { width: 1280, height: 720 },
      },
      comparison: {
        jsEnabled: {},
        jsDisabled: {},
        differences: {},
        ssrQuality: {},
      },
    };
  }

  /**
   * Analyze page content and structure with JavaScript enabled
   */
  async analyzeWithJavaScriptEnabled() {
    try {
      console.log("🟢 Analyzing page with JavaScript ENABLED...");
      
      // Wait for page to fully load and execute JavaScript
      await this.jsEnabledPage.waitForLoadState("networkidle", { timeout: 60000 });
      
      // Additional wait for dynamic content
      await this.jsEnabledPage.waitForTimeout(3000);

      const analysis = {
        content: {},
        structure: {},
        interactivity: {},
        visual: {},
        performance: {}
      };

      // Content analysis
      analysis.content = {
        title: await this.jsEnabledPage.title(),
        headings: await this.extractHeadings(this.jsEnabledPage),
        paragraphs: await this.extractParagraphs(this.jsEnabledPage),
        links: await this.extractLinks(this.jsEnabledPage),
        images: await this.extractImages(this.jsEnabledPage),
        forms: await this.extractForms(this.jsEnabledPage),
        textContent: await this.extractTextContent(this.jsEnabledPage)
      };

      // Structure analysis
      analysis.structure = {
        totalElements: await this.jsEnabledPage.locator('*').count(),
        interactiveElements: await this.jsEnabledPage.locator('button, input, select, textarea, a[href]').count(),
        semanticElements: await this.extractSemanticElements(this.jsEnabledPage),
        dynamicElements: await this.identifyDynamicElements(this.jsEnabledPage)
      };

      // Interactivity analysis
      analysis.interactivity = {
        clickableElements: await this.jsEnabledPage.locator('[onclick], button, a[href], input[type="button"], input[type="submit"]').count(),
        jsEventListeners: await this.countJavaScriptEventListeners(this.jsEnabledPage),
        formValidation: await this.checkFormValidation(this.jsEnabledPage),
        dynamicContent: await this.identifyDynamicContent(this.jsEnabledPage)
      };

      // Visual analysis
      analysis.visual = {
        visibleElements: await this.jsEnabledPage.locator(':visible').count(),
        hiddenElements: await this.jsEnabledPage.locator('[style*="display: none"], [style*="visibility: hidden"], .hidden').count(),
        loadedImages: await this.jsEnabledPage.locator('img[src]').count(),
        videosAndMedia: await this.jsEnabledPage.locator('video, audio, iframe').count()
      };

      // Performance metrics
      try {
        const performanceMetrics = await this.jsEnabledPage.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
            loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart || 0,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
          };
        });
        analysis.performance = performanceMetrics;
      } catch (e) {
        analysis.performance = { error: 'Could not collect performance metrics' };
      }

      console.log("✅ JavaScript enabled analysis completed");
      console.log(`   📊 Total elements: ${analysis.structure.totalElements} (all DOM elements rendered with JavaScript)`);
      console.log(`   🔗 Interactive elements: ${analysis.structure.interactiveElements} (buttons, inputs, links with JS functionality)`);
      console.log(`   👁️ Visible elements: ${analysis.visual.visibleElements} (elements actually displayed on screen)`);

      return analysis;
    } catch (error) {
      console.log(`⚠️ Error analyzing with JavaScript enabled: ${error.message}`);
      return {
        content: {},
        structure: {},
        interactivity: {},
        visual: {},
        performance: {},
        error: error.message
      };
    }
  }

  /**
   * Analyze page content and structure with JavaScript disabled
   */
  async analyzeWithJavaScriptDisabled() {
    try {
      console.log("🔴 Analyzing page with JavaScript DISABLED...");
      
      // Wait for page to load (no JavaScript execution)
      await this.jsDisabledPage.waitForLoadState("domcontentloaded", { timeout: 60000 });
      
      // Additional wait for any server-side rendering
      await this.jsDisabledPage.waitForTimeout(2000);

      const analysis = {
        content: {},
        structure: {},
        interactivity: {},
        visual: {},
        performance: {}
      };

      // Content analysis (same methods but without JS)
      analysis.content = {
        title: await this.jsDisabledPage.title(),
        headings: await this.extractHeadings(this.jsDisabledPage),
        paragraphs: await this.extractParagraphs(this.jsDisabledPage),
        links: await this.extractLinks(this.jsDisabledPage),
        images: await this.extractImages(this.jsDisabledPage),
        forms: await this.extractForms(this.jsDisabledPage),
        textContent: await this.extractTextContent(this.jsDisabledPage)
      };

      // Structure analysis
      analysis.structure = {
        totalElements: await this.jsDisabledPage.locator('*').count(),
        interactiveElements: await this.jsDisabledPage.locator('button, input, select, textarea, a[href]').count(),
        semanticElements: await this.extractSemanticElements(this.jsDisabledPage),
        staticElements: await this.identifyStaticElements(this.jsDisabledPage)
      };

      // Interactivity analysis (limited without JS)
      analysis.interactivity = {
        nativeFormElements: await this.jsDisabledPage.locator('form, input, select, textarea').count(),
        staticLinks: await this.jsDisabledPage.locator('a[href]').count(),
        submitButtons: await this.jsDisabledPage.locator('input[type="submit"], button[type="submit"]').count(),
        accessibleElements: await this.checkAccessibilityFeatures(this.jsDisabledPage)
      };

      // Visual analysis
      analysis.visual = {
        visibleElements: await this.jsDisabledPage.locator(':visible').count(),
        preloadedImages: await this.jsDisabledPage.locator('img[src]').count(),
        staticMedia: await this.jsDisabledPage.locator('video, audio').count(),
        cssOnlyInteractivity: await this.identifyCSSOnlyFeatures(this.jsDisabledPage)
      };

      // Performance metrics (simplified without JS)
      try {
        const performanceMetrics = await this.jsDisabledPage.evaluate(() => {
          return {
            domContentLoaded: performance.timing?.domContentLoadedEventEnd - performance.timing?.domContentLoadedEventStart || 0,
            loadComplete: performance.timing?.loadEventEnd - performance.timing?.loadEventStart || 0,
            serverRenderTime: performance.timing?.responseEnd - performance.timing?.requestStart || 0
          };
        });
        analysis.performance = performanceMetrics;
      } catch (e) {
        analysis.performance = { note: 'Limited performance metrics without JavaScript' };
      }

      console.log("✅ JavaScript disabled analysis completed");
      console.log(`   📊 Total elements: ${analysis.structure.totalElements} (SSR elements - no client-side rendering)`);
      console.log(`   🔗 Native interactive elements: ${analysis.structure.interactiveElements} (HTML forms/inputs without JS)`);
      console.log(`   👁️ Visible elements: ${analysis.visual.visibleElements} (elements visible via CSS, no JS styling)`);

      return analysis;
    } catch (error) {
      console.log(`⚠️ Error analyzing with JavaScript disabled: ${error.message}`);
      return {
        content: {},
        structure: {},
        interactivity: {},
        visual: {},
        performance: {},
        error: error.message
      };
    }
  }

  /**
   * Compare the two states and generate SSR quality assessment
   */
  analyzeSSRQuality(jsEnabled, jsDisabled) {
    console.log("📊 Analyzing SSR quality and progressive enhancement...");

    const comparison = {
      contentPreservation: {},
      functionalityGracefulDegradation: {},
      visualConsistency: {},
      accessibilityMaintenance: {},
      performanceImpact: {},
      overallSSRScore: 0
    };

    // Content preservation analysis
    const contentScores = {
      titleMatch: jsEnabled.content.title === jsDisabled.content.title ? 100 : 0,
      headingPreservation: this.calculateContentPreservation(jsEnabled.content.headings, jsDisabled.content.headings),
      paragraphPreservation: this.calculateContentPreservation(jsEnabled.content.paragraphs, jsDisabled.content.paragraphs),
      linkPreservation: this.calculateLinkPreservation(jsEnabled.content.links, jsDisabled.content.links),
      imagePreservation: this.calculateImagePreservation(jsEnabled.content.images, jsDisabled.content.images)
    };

    // Ensure no NaN values in content scores
    const safeContentScores = Object.fromEntries(
      Object.entries(contentScores).map(([key, value]) => [key, isNaN(value) ? 0 : value])
    );
    
    comparison.contentPreservation = {
      ...safeContentScores,
      averageScore: Object.values(safeContentScores).reduce((sum, score) => sum + score, 0) / Object.keys(safeContentScores).length
    };

    // Functionality graceful degradation
    const functionalityScores = {
      formAccessibility: (jsDisabled.interactivity.nativeFormElements / Math.max(jsEnabled.content.forms?.length || 0, 1)) * 100,
      linkAccessibility: (jsDisabled.interactivity.staticLinks / Math.max(jsEnabled.content.links?.length || 0, 1)) * 100,
      navigationPreservation: this.assessNavigationFunctionality(jsEnabled, jsDisabled),
      interactivityFallback: this.assessInteractivityFallback(jsEnabled, jsDisabled)
    };

    // Ensure no NaN values in functionality scores
    const safeFunctionalityScores = Object.fromEntries(
      Object.entries(functionalityScores).map(([key, value]) => [key, isNaN(value) ? 0 : value])
    );
    
    comparison.functionalityGracefulDegradation = {
      ...safeFunctionalityScores,
      averageScore: Object.values(safeFunctionalityScores).reduce((sum, score) => sum + score, 0) / Object.keys(safeFunctionalityScores).length
    };

    // Visual consistency
    const visualScores = {
      elementVisibilityRatio: (jsDisabled.visual.visibleElements / Math.max(jsEnabled.visual.visibleElements, 1)) * 100,
      imageLoadingRatio: (jsDisabled.visual.preloadedImages / Math.max(jsEnabled.visual.loadedImages, 1)) * 100,
      layoutStability: this.assessLayoutStability(jsEnabled, jsDisabled),
      contentVisibility: this.assessContentVisibility(jsEnabled, jsDisabled)
    };

    // Ensure no NaN values in visual scores
    const safeVisualScores = Object.fromEntries(
      Object.entries(visualScores).map(([key, value]) => [key, isNaN(value) ? 0 : value])
    );
    
    comparison.visualConsistency = {
      ...safeVisualScores,
      averageScore: Object.values(safeVisualScores).reduce((sum, score) => sum + score, 0) / Object.keys(safeVisualScores).length
    };

    // Accessibility maintenance
    const accessibilityScore = this.assessAccessibilityMaintenance(jsEnabled, jsDisabled);
    comparison.accessibilityMaintenance = accessibilityScore;

    // Performance impact
    comparison.performanceImpact = {
      loadTimeImprovement: this.calculatePerformanceImprovement(jsEnabled.performance, jsDisabled.performance),
      renderingSpeed: jsDisabled.performance.serverRenderTime || 0,
      networkRequests: 'Fewer without JavaScript',
      cacheability: 'Better static content caching'
    };

    // Calculate overall SSR score
    const weights = {
      content: 0.3,
      functionality: 0.25,
      visual: 0.25,
      accessibility: 0.2
    };

    // Calculate overall SSR score with NaN protection
    const contentScore = isNaN(comparison.contentPreservation.averageScore) ? 0 : comparison.contentPreservation.averageScore;
    const functionalityScore = isNaN(comparison.functionalityGracefulDegradation.averageScore) ? 0 : comparison.functionalityGracefulDegradation.averageScore;
    const visualScore = isNaN(comparison.visualConsistency.averageScore) ? 0 : comparison.visualConsistency.averageScore;
    const accessScore = isNaN(comparison.accessibilityMaintenance.score) ? 0 : comparison.accessibilityMaintenance.score;
    
    const rawScore = (contentScore * weights.content) +
                     (functionalityScore * weights.functionality) +
                     (visualScore * weights.visual) +
                     (accessScore * weights.accessibility);
    
    comparison.overallSSRScore = isNaN(rawScore) ? 0 : Math.round(rawScore);

    // Generate quality assessment
    let qualityAssessment = 'Unknown';
    if (comparison.overallSSRScore >= 90) {
      qualityAssessment = 'Excellent SSR Implementation';
    } else if (comparison.overallSSRScore >= 75) {
      qualityAssessment = 'Good SSR with Minor Issues';
    } else if (comparison.overallSSRScore >= 60) {
      qualityAssessment = 'Adequate SSR with Room for Improvement';
    } else if (comparison.overallSSRScore >= 40) {
      qualityAssessment = 'Poor SSR - Significant JS Dependency';
    } else {
      qualityAssessment = 'Very Poor SSR - Heavy JS Dependency';
    }

    comparison.qualityAssessment = qualityAssessment;

    // Generate recommendations
    comparison.recommendations = this.generateSSRRecommendations(comparison, jsEnabled, jsDisabled);

    console.log("✅ SSR quality analysis completed");
    console.log(`   🎯 Overall SSR Score: ${comparison.overallSSRScore}/100 (weighted average of all metrics)`);
    console.log(`   📋 Assessment: ${qualityAssessment}`);
    console.log(`   💡 Recommendations: ${comparison.recommendations.length} (actionable improvements identified)`);

    return comparison;
  }

  // Helper methods for content analysis
  async extractHeadings(page) {
    const headings = {};
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    for (const tag of headingTags) {
      const elements = await page.locator(tag).all();
      headings[tag] = [];
      
      for (const element of elements) {
        try {
          const text = await element.textContent();
          if (text && text.trim()) {
            headings[tag].push(text.trim());
          }
        } catch (e) {
          // Skip inaccessible elements
        }
      }
    }
    
    return headings;
  }

  async extractParagraphs(page) {
    const paragraphs = [];
    const elements = await page.locator('p').all();
    
    for (const element of elements) {
      try {
        const text = await element.textContent();
        if (text && text.trim().length > 10) {
          paragraphs.push(text.trim().substring(0, 200));
        }
      } catch (e) {
        // Skip inaccessible elements
      }
    }
    
    return paragraphs;
  }

  async extractLinks(page) {
    const links = [];
    const elements = await page.locator('a[href]').all();
    
    for (const element of elements) {
      try {
        const href = await element.getAttribute('href');
        const text = await element.textContent();
        if (href) {
          links.push({
            href: href,
            text: text?.trim() || '',
            isExternal: href.startsWith('http') && !href.includes(await page.url().split('/')[2])
          });
        }
      } catch (e) {
        // Skip inaccessible elements
      }
    }
    
    return links;
  }

  async extractImages(page) {
    const images = [];
    const elements = await page.locator('img').all();
    
    for (const element of elements) {
      try {
        const src = await element.getAttribute('src');
        const alt = await element.getAttribute('alt');
        if (src) {
          images.push({
            src: src,
            alt: alt || '',
            hasAltText: Boolean(alt && alt.trim())
          });
        }
      } catch (e) {
        // Skip inaccessible elements
      }
    }
    
    return images;
  }

  async extractForms(page) {
    const forms = [];
    const elements = await page.locator('form').all();
    
    for (const element of elements) {
      try {
        const action = await element.getAttribute('action') || '';
        const method = await element.getAttribute('method') || 'get';
        const inputs = await element.locator('input, textarea, select').count();
        
        forms.push({
          action: action,
          method: method.toLowerCase(),
          inputCount: inputs
        });
      } catch (e) {
        // Skip inaccessible elements
      }
    }
    
    return forms;
  }

  async extractTextContent(page) {
    try {
      const text = await page.locator('body').textContent();
      return {
        fullText: text || '',
        wordCount: text ? text.trim().split(/\s+/).length : 0,
        characterCount: text ? text.length : 0
      };
    } catch (e) {
      return { fullText: '', wordCount: 0, characterCount: 0 };
    }
  }

  async extractSemanticElements(page) {
    const semantic = {};
    const tags = ['header', 'footer', 'nav', 'main', 'aside', 'section', 'article'];
    
    for (const tag of tags) {
      semantic[tag] = await page.locator(tag).count();
    }
    
    return semantic;
  }

  async identifyDynamicElements(page) {
    try {
      // Look for elements that are likely dynamic (with JS frameworks attributes)
      const dynamicSelectors = [
        '[data-react-component]',
        '[data-vue-component]',
        '[ng-app]',
        '[ng-controller]',
        '[data-component]',
        '.js-component',
        '[x-data]', // Alpine.js
        '[v-if]', // Vue.js
        '[ng-if]' // Angular
      ];
      
      let dynamicCount = 0;
      for (const selector of dynamicSelectors) {
        dynamicCount += await page.locator(selector).count();
      }
      
      return {
        dynamicComponents: dynamicCount,
        frameworkIndicators: dynamicSelectors.filter(async sel => await page.locator(sel).count() > 0)
      };
    } catch (e) {
      return { dynamicComponents: 0, frameworkIndicators: [] };
    }
  }

  async identifyStaticElements(page) {
    const staticCount = await page.locator('*').count();
    return { staticElements: staticCount };
  }

  async countJavaScriptEventListeners(page) {
    try {
      return await page.evaluate(() => {
        // This is a simplified count and may not be accurate in all cases
        const elements = document.querySelectorAll('*');
        let count = 0;
        
        elements.forEach(el => {
          // Check for common event attributes
          const events = ['onclick', 'onload', 'onchange', 'onsubmit', 'onmouseover'];
          events.forEach(event => {
            if (el.getAttribute(event)) count++;
          });
        });
        
        return count;
      });
    } catch (e) {
      return 0;
    }
  }

  async checkFormValidation(page) {
    try {
      const formsWithValidation = await page.locator('form[novalidate], input[required], input[pattern]').count();
      return { formsWithValidation };
    } catch (e) {
      return { formsWithValidation: 0 };
    }
  }

  async identifyDynamicContent(page) {
    try {
      // Look for loading indicators, placeholders, etc.
      const loadingIndicators = await page.locator('.loading, .spinner, .skeleton, [data-loading]').count();
      return { loadingIndicators };
    } catch (e) {
      return { loadingIndicators: 0 };
    }
  }

  async checkAccessibilityFeatures(page) {
    try {
      const ariaElements = await page.locator('[aria-label], [aria-describedby], [role]').count();
      const altTexts = await page.locator('img[alt]').count();
      const skipLinks = await page.locator('a[href^="#"], a[href*="skip"]').count();
      
      return {
        ariaElements,
        altTexts,
        skipLinks,
        total: ariaElements + altTexts + skipLinks
      };
    } catch (e) {
      return { ariaElements: 0, altTexts: 0, skipLinks: 0, total: 0 };
    }
  }

  async identifyCSSOnlyFeatures(page) {
    try {
      // Look for CSS-only interactive features
      const hoverEffects = await page.locator('[class*="hover"], [class*="focus"]').count();
      const cssTransitions = await page.locator('[style*="transition"], [class*="transition"]').count();
      
      return {
        hoverEffects,
        cssTransitions,
        total: hoverEffects + cssTransitions
      };
    } catch (e) {
      return { hoverEffects: 0, cssTransitions: 0, total: 0 };
    }
  }

  // Analysis helper methods
  calculateContentPreservation(jsEnabledContent, jsDisabledContent) {
    if (!jsEnabledContent || !jsDisabledContent) return 0;
    
    if (Array.isArray(jsEnabledContent) && Array.isArray(jsDisabledContent)) {
      const enabled = new Set(jsEnabledContent);
      const disabled = new Set(jsDisabledContent);
      const intersection = new Set([...enabled].filter(x => disabled.has(x)));
      return enabled.size > 0 ? (intersection.size / enabled.size) * 100 : 0;
    }
    
    if (typeof jsEnabledContent === 'object' && typeof jsDisabledContent === 'object') {
      const enabledKeys = Object.keys(jsEnabledContent);
      const disabledKeys = Object.keys(jsDisabledContent);
      const matchingKeys = enabledKeys.filter(key => disabledKeys.includes(key));
      return enabledKeys.length > 0 ? (matchingKeys.length / enabledKeys.length) * 100 : 0;
    }
    
    return 0;
  }

  calculateLinkPreservation(jsEnabledLinks, jsDisabledLinks) {
    if (!jsEnabledLinks?.length) return 100;
    
    const enabledHrefs = new Set(jsEnabledLinks.map(link => link.href));
    const disabledHrefs = new Set(jsDisabledLinks?.map(link => link.href) || []);
    const preserved = [...enabledHrefs].filter(href => disabledHrefs.has(href));
    
    return (preserved.length / enabledHrefs.size) * 100;
  }

  calculateImagePreservation(jsEnabledImages, jsDisabledImages) {
    if (!jsEnabledImages?.length) return 100;
    
    const enabledSrcs = new Set(jsEnabledImages.map(img => img.src));
    const disabledSrcs = new Set(jsDisabledImages?.map(img => img.src) || []);
    const preserved = [...enabledSrcs].filter(src => disabledSrcs.has(src));
    
    return (preserved.length / enabledSrcs.size) * 100;
  }

  assessNavigationFunctionality(jsEnabled, jsDisabled) {
    const enabledNavLinks = jsEnabled.content.links?.filter(link => 
      !link.isExternal && (link.href.startsWith('/') || link.href.startsWith('#'))
    ).length || 0;
    
    const disabledNavLinks = jsDisabled.content.links?.filter(link => 
      !link.isExternal && (link.href.startsWith('/') || link.href.startsWith('#'))
    ).length || 0;
    
    return enabledNavLinks > 0 ? (disabledNavLinks / enabledNavLinks) * 100 : 100;
  }

  assessInteractivityFallback(jsEnabled, jsDisabled) {
    const enabledInteractive = jsEnabled.structure.interactiveElements || 0;
    const disabledInteractive = jsDisabled.structure.interactiveElements || 0;
    
    return enabledInteractive > 0 ? (disabledInteractive / enabledInteractive) * 100 : 100;
  }

  assessLayoutStability(jsEnabled, jsDisabled) {
    // Simplified assessment based on element counts
    const enabledElements = jsEnabled.structure.totalElements || 0;
    const disabledElements = jsDisabled.structure.totalElements || 0;
    
    if (enabledElements === 0) return 100;
    
    const ratio = disabledElements / enabledElements;
    return Math.min(ratio * 100, 100);
  }

  assessContentVisibility(jsEnabled, jsDisabled) {
    const enabledVisible = jsEnabled.visual.visibleElements || 0;
    const disabledVisible = jsDisabled.visual.visibleElements || 0;
    
    return enabledVisible > 0 ? Math.min((disabledVisible / enabledVisible) * 100, 100) : 100;
  }

  assessAccessibilityMaintenance(jsEnabled, jsDisabled) {
    const enabledAccessible = jsEnabled.structure.interactiveElements || 0;
    const disabledAccessible = jsDisabled.interactivity.accessibleElements?.total || 0;
    
    const score = enabledAccessible > 0 ? (disabledAccessible / enabledAccessible) * 100 : 100;
    
    return {
      score: Math.min(score, 100),
      details: {
        interactiveElementsPreserved: disabledAccessible,
        totalInteractiveElements: enabledAccessible,
        preservationRatio: score
      }
    };
  }

  calculatePerformanceImprovement(jsEnabledPerf, jsDisabledPerf) {
    if (!jsEnabledPerf || !jsDisabledPerf) return 'Unable to calculate';
    
    const improvements = {};
    
    if (jsEnabledPerf.domContentLoaded && jsDisabledPerf.domContentLoaded) {
      const improvement = ((jsEnabledPerf.domContentLoaded - jsDisabledPerf.domContentLoaded) / jsEnabledPerf.domContentLoaded) * 100;
      improvements.domContentLoaded = `${Math.round(improvement)}% faster`;
    }
    
    if (jsEnabledPerf.loadComplete && jsDisabledPerf.loadComplete) {
      const improvement = ((jsEnabledPerf.loadComplete - jsDisabledPerf.loadComplete) / jsEnabledPerf.loadComplete) * 100;
      improvements.loadComplete = `${Math.round(improvement)}% faster`;
    }
    
    return improvements;
  }

  generateSSRRecommendations(comparison, jsEnabled, jsDisabled) {
    const recommendations = [];
    
    if (comparison.contentPreservation.averageScore < 80) {
      recommendations.push({
        category: 'Content Preservation',
        priority: 'high',
        suggestion: 'Ensure critical content is server-rendered and not dependent on JavaScript',
        impact: 'Improves SEO and accessibility'
      });
    }
    
    if (comparison.functionalityGracefulDegradation.averageScore < 70) {
      recommendations.push({
        category: 'Progressive Enhancement',
        priority: 'high',
        suggestion: 'Implement basic functionality using HTML forms and native elements before enhancing with JavaScript',
        impact: 'Ensures functionality works for all users'
      });
    }
    
    if (comparison.visualConsistency.averageScore < 60) {
      recommendations.push({
        category: 'Visual Consistency',
        priority: 'medium',
        suggestion: 'Use CSS for layout and styling instead of JavaScript manipulation',
        impact: 'Consistent visual experience across all environments'
      });
    }
    
    if (comparison.accessibilityMaintenance.score < 70) {
      recommendations.push({
        category: 'Accessibility',
        priority: 'high',
        suggestion: 'Ensure all interactive elements have proper ARIA attributes and semantic HTML',
        impact: 'Better accessibility for assistive technologies'
      });
    }
    
    if (jsEnabled.structure.interactiveElements > jsDisabled.structure.interactiveElements * 2) {
      recommendations.push({
        category: 'JavaScript Dependency',
        priority: 'medium',
        suggestion: 'Reduce reliance on JavaScript for core functionality',
        impact: 'Better performance and reliability'
      });
    }
    
    return recommendations;
  }

  async generateMetadata() {
    console.log("\n📊 GENERATING SSR TEST METADATA");
    console.log("================================");

    const comparison = this.state.comparison;
    
    const metadata = {
      test: {
        timestamp: this.state.metadata.testTime,
        pageUrl: this.state.metadata.pageUrl,
        pageTitle: this.state.metadata.pageTitle,
        userAgent: this.state.metadata.userAgent,
        viewport: this.state.metadata.viewportSize
      },
      results: {
        overallSSRScore: comparison.differences.overallSSRScore || 0,
        qualityAssessment: comparison.differences.qualityAssessment || 'Unknown',
        contentPreservation: Math.round(comparison.differences.contentPreservation?.averageScore || 0),
        functionalityPreservation: Math.round(comparison.differences.functionalityGracefulDegradation?.averageScore || 0),
        visualConsistency: Math.round(comparison.differences.visualConsistency?.averageScore || 0),
        accessibilityMaintenance: Math.round(comparison.differences.accessibilityMaintenance?.score || 0)
      },
      comparison: {
        jsEnabled: {
          totalElements: comparison.jsEnabled.structure?.totalElements || 0,
          interactiveElements: comparison.jsEnabled.structure?.interactiveElements || 0,
          visibleElements: comparison.jsEnabled.visual?.visibleElements || 0,
          contentWords: comparison.jsEnabled.content?.textContent?.wordCount || 0
        },
        jsDisabled: {
          totalElements: comparison.jsDisabled.structure?.totalElements || 0,
          interactiveElements: comparison.jsDisabled.structure?.interactiveElements || 0,
          visibleElements: comparison.jsDisabled.visual?.visibleElements || 0,
          contentWords: comparison.jsDisabled.content?.textContent?.wordCount || 0
        }
      },
      recommendations: comparison.differences.recommendations || [],
      issues: this.identifySSRIssues(comparison)
    };

    console.log("📈 SSR Test Statistics:");
    console.log(`   Overall SSR Score: ${metadata.results.overallSSRScore}/100 (composite quality score)`);
    console.log(`   Content Preservation: ${metadata.results.contentPreservation}% (titles, text, links maintained)`);
    console.log(`   Functionality Preservation: ${metadata.results.functionalityPreservation}% (forms, buttons work without JS)`);
    console.log(`   Visual Consistency: ${metadata.results.visualConsistency}% (layout stable, elements visible)`);
    console.log(`   Recommendations: ${metadata.recommendations.length} (specific improvement suggestions)`);

    return metadata;
  }

  identifySSRIssues(comparison) {
    const issues = [];
    
    if (!comparison.differences) return issues;
    
    if (comparison.differences.overallSSRScore < 50) {
      issues.push({
        severity: 'critical',
        type: 'Poor SSR Implementation',
        description: 'Website heavily depends on JavaScript for core functionality',
        impact: 'Poor SEO, accessibility, and performance for users without JavaScript'
      });
    }
    
    if (comparison.differences.contentPreservation?.averageScore < 60) {
      issues.push({
        severity: 'high',
        type: 'Content Not Server-Rendered',
        description: 'Significant content is missing when JavaScript is disabled',
        impact: 'Search engines and users with disabilities may not see important content'
      });
    }
    
    if (comparison.differences.functionalityGracefulDegradation?.averageScore < 50) {
      issues.push({
        severity: 'high',
        type: 'Poor Progressive Enhancement',
        description: 'Core functionality is not available without JavaScript',
        impact: 'Users without JavaScript cannot use essential features'
      });
    }
    
    if (comparison.differences.visualConsistency?.averageScore < 70) {
      issues.push({
        severity: 'medium',
        type: 'Layout Inconsistency',
        description: 'Page layout differs significantly without JavaScript',
        impact: 'Inconsistent user experience across different environments'
      });
    }
    
    return issues;
  }

  async cleanup() {
    console.log("\n🧹 CLEANUP PHASE");
    console.log("=================");

    try {
      if (this.jsEnabledPage) {
        console.log("📄 Closing JS enabled page...");
        await this.jsEnabledPage.close();
        console.log("✅ JS enabled page closed");
      }

      if (this.jsDisabledPage) {
        console.log("📄 Closing JS disabled page...");
        await this.jsDisabledPage.close();
        console.log("✅ JS disabled page closed");
      }

      if (this.jsEnabledContext) {
        console.log("🌐 Closing JS enabled context...");
        await this.jsEnabledContext.close();
        console.log("✅ JS enabled context closed");
      }

      if (this.jsDisabledContext) {
        console.log("🌐 Closing JS disabled context...");
        await this.jsDisabledContext.close();
        console.log("✅ JS disabled context closed");
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

async function runDisabledJavaScriptTest() {
  // Get configuration from environment variables
  const websiteUrl = process.env.WEBSITE_URL;

  console.log("🚫 DISABLED JAVASCRIPT TEST STARTED");
  console.log("===================================");
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🖥️ Platform: ${process.platform}`);
  console.log(`🏗️ Node.js version: ${process.version}`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📍 Script location: ${__dirname}`);

  console.log("\n🔧 Configuration:");
  console.log(`   Website URL: ${websiteUrl || "NOT SET"}`);

  if (!websiteUrl) {
    console.error("❌ WEBSITE_URL environment variable is required");
    console.error("Set it in .env file or as environment variable");
    process.exit(1);
  }

  const tester = new DisabledJavaScriptTester();

  try {
    // Launch browser
    console.log("\n🚀 BROWSER SETUP");
    console.log("=================");
    console.log("🔧 Launching Chromium browser...");

    const launchStart = Date.now();
    tester.browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    });
    console.log(`✅ Browser launched in ${Date.now() - launchStart}ms`);

    // Create two contexts: one with JS enabled, one with JS disabled
    console.log("🌐 Creating browser contexts...");
    
    // JavaScript ENABLED context
    tester.jsEnabledContext = await tester.browser.newContext({
      viewport: tester.state.metadata.viewportSize,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      locale: "en-US",
    });

    // JavaScript DISABLED context
    tester.jsDisabledContext = await tester.browser.newContext({
      viewport: tester.state.metadata.viewportSize,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      javaScriptEnabled: false,
      ignoreHTTPSErrors: true,
      locale: "en-US",
    });

    // Create pages
    tester.jsEnabledPage = await tester.jsEnabledContext.newPage();
    tester.jsDisabledPage = await tester.jsDisabledContext.newPage();

    console.log("✅ Browser contexts and pages created");

    // Update metadata
    tester.state.metadata.testTime = new Date().toISOString();
    tester.state.metadata.pageUrl = websiteUrl;

    // Navigate both pages to the same URL
    console.log("\n🌐 NAVIGATION PHASE");
    console.log("===================");
    
    console.log("🟢 Navigating with JavaScript ENABLED...");
    const jsEnabledNavStart = Date.now();
    await tester.jsEnabledPage.goto(websiteUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`✅ JS enabled navigation completed in ${Date.now() - jsEnabledNavStart}ms`);
    
    console.log("🔴 Navigating with JavaScript DISABLED...");
    const jsDisabledNavStart = Date.now();
    await tester.jsDisabledPage.goto(websiteUrl, {
      waitUntil: "domcontentloaded", 
      timeout: 60000,
    });
    console.log(`✅ JS disabled navigation completed in ${Date.now() - jsDisabledNavStart}ms`);

    // Update page title from one of the pages
    tester.state.metadata.pageTitle = await tester.jsEnabledPage.title();

    // Analyze both states
    console.log("\n🔍 ANALYSIS PHASE");
    console.log("=================");
    
    const jsEnabledAnalysis = await tester.analyzeWithJavaScriptEnabled();
    const jsDisabledAnalysis = await tester.analyzeWithJavaScriptDisabled();

    // Store analysis results
    tester.state.comparison.jsEnabled = jsEnabledAnalysis;
    tester.state.comparison.jsDisabled = jsDisabledAnalysis;

    // Compare and generate SSR quality assessment
    console.log("\n📊 COMPARISON PHASE");
    console.log("===================");
    
    const ssrQualityAnalysis = tester.analyzeSSRQuality(jsEnabledAnalysis, jsDisabledAnalysis);
    tester.state.comparison.differences = ssrQualityAnalysis;

    // Take screenshots for visual comparison
    console.log("\n📸 SCREENSHOT CAPTURE");
    console.log("=====================");
    
    const jsEnabledScreenshot = path.join(
      tester.state.outputDir,
      "disabled-js-test-with-javascript.png"
    );
    await tester.jsEnabledPage.screenshot({
      path: jsEnabledScreenshot,
      fullPage: true,
    });
    console.log(`✅ JavaScript enabled screenshot: ${jsEnabledScreenshot}`);

    const jsDisabledScreenshot = path.join(
      tester.state.outputDir,
      "disabled-js-test-without-javascript.png"
    );
    await tester.jsDisabledPage.screenshot({
      path: jsDisabledScreenshot,
      fullPage: true,
    });
    console.log(`✅ JavaScript disabled screenshot: ${jsDisabledScreenshot}`);

    // Generate metadata
    const metadata = await tester.generateMetadata();

    // Save all data
    console.log("\n💾 SAVING TEST RESULTS");
    console.log("======================");
    
    // Save detailed comparison data
    const comparisonPath = path.join(
      tester.state.outputDir,
      "disabled-js-comparison-data.json"
    );
    fs.writeFileSync(comparisonPath, JSON.stringify(tester.state.comparison, null, 2));
    console.log(`✅ Comparison data saved: ${comparisonPath}`);

    // Save summary metadata
    const metadataPath = path.join(
      tester.state.outputDir,
      "disabled-js-summary.json"
    );
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Summary metadata saved: ${metadataPath}`);

    // Create human-readable report
    console.log("📄 Creating readable report...");
    let report = `# Disabled JavaScript Test Report\n\n`;
    report += `**Website:** ${websiteUrl}\n`;
    report += `**Test Date:** ${metadata.test.timestamp}\n`;
    report += `**Page Title:** ${metadata.test.pageTitle}\n\n`;

    // Overall assessment
    report += `## Overall Assessment\n\n`;
    report += `**SSR Score:** ${metadata.results.overallSSRScore}/100\n`;
    report += `**Quality:** ${metadata.results.qualityAssessment}\n\n`;

    // Detailed scores
    report += `## Detailed Analysis\n\n`;
    report += `| Metric | Score | Status |\n`;
    report += `|--------|-------|--------|\n`;
    report += `| Content Preservation | ${metadata.results.contentPreservation}% | ${metadata.results.contentPreservation >= 80 ? '✅ Good' : metadata.results.contentPreservation >= 60 ? '⚠️ Fair' : '❌ Poor'} |\n`;
    report += `| Functionality Preservation | ${metadata.results.functionalityPreservation}% | ${metadata.results.functionalityPreservation >= 80 ? '✅ Good' : metadata.results.functionalityPreservation >= 60 ? '⚠️ Fair' : '❌ Poor'} |\n`;
    report += `| Visual Consistency | ${metadata.results.visualConsistency}% | ${metadata.results.visualConsistency >= 80 ? '✅ Good' : metadata.results.visualConsistency >= 60 ? '⚠️ Fair' : '❌ Poor'} |\n`;
    report += `| Accessibility Maintenance | ${metadata.results.accessibilityMaintenance}% | ${metadata.results.accessibilityMaintenance >= 80 ? '✅ Good' : metadata.results.accessibilityMaintenance >= 60 ? '⚠️ Fair' : '❌ Poor'} |\n\n`;

    // Comparison data
    report += `## Side-by-Side Comparison\n\n`;
    report += `| Metric | With JavaScript | Without JavaScript | Difference |\n`;
    report += `|--------|----------------|-------------------|------------|\n`;
    report += `| Total Elements | ${metadata.comparison.jsEnabled.totalElements} | ${metadata.comparison.jsDisabled.totalElements} | ${metadata.comparison.jsEnabled.totalElements - metadata.comparison.jsDisabled.totalElements} |\n`;
    report += `| Interactive Elements | ${metadata.comparison.jsEnabled.interactiveElements} | ${metadata.comparison.jsDisabled.interactiveElements} | ${metadata.comparison.jsEnabled.interactiveElements - metadata.comparison.jsDisabled.interactiveElements} |\n`;
    report += `| Visible Elements | ${metadata.comparison.jsEnabled.visibleElements} | ${metadata.comparison.jsDisabled.visibleElements} | ${metadata.comparison.jsEnabled.visibleElements - metadata.comparison.jsDisabled.visibleElements} |\n`;
    report += `| Content Words | ${metadata.comparison.jsEnabled.contentWords} | ${metadata.comparison.jsDisabled.contentWords} | ${metadata.comparison.jsEnabled.contentWords - metadata.comparison.jsDisabled.contentWords} |\n\n`;

    // Issues
    if (metadata.issues.length > 0) {
      report += `## Identified Issues\n\n`;
      metadata.issues.forEach((issue, index) => {
        report += `### ${index + 1}. ${issue.type} (${issue.severity.toUpperCase()})\n\n`;
        report += `**Description:** ${issue.description}\n\n`;
        report += `**Impact:** ${issue.impact}\n\n`;
      });
    }

    // Recommendations
    if (metadata.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      metadata.recommendations.forEach((rec, index) => {
        report += `### ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} priority)\n\n`;
        report += `**Suggestion:** ${rec.suggestion}\n\n`;
        report += `**Impact:** ${rec.impact}\n\n`;
      });
    }

    // Screenshots section
    report += `## Visual Comparison\n\n`;
    report += `- **With JavaScript:** disabled-js-test-with-javascript.png\n`;
    report += `- **Without JavaScript:** disabled-js-test-without-javascript.png\n\n`;
    report += `Compare these screenshots to see visual differences when JavaScript is disabled.\n\n`;

    const reportPath = path.join(
      tester.state.outputDir,
      "disabled-js-report.md"
    );
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved: ${reportPath}`);

    // Final summary
    console.log("\n🎉 DISABLED JAVASCRIPT TEST COMPLETED!");
    console.log("======================================");
    console.log(`📊 Comparison Data: ${comparisonPath}`);
    console.log(`📋 Summary: ${metadataPath}`);
    console.log(`📄 Report: ${reportPath}`);
    console.log(`📸 JS Enabled Screenshot: ${jsEnabledScreenshot}`);
    console.log(`📸 JS Disabled Screenshot: ${jsDisabledScreenshot}`);
    console.log(`🎯 SSR Score: ${metadata.results.overallSSRScore}/100`);
    console.log(`📋 Assessment: ${metadata.results.qualityAssessment}`);
    console.log(`⚠️ Issues Found: ${metadata.issues.length}`);
    console.log(`💡 Recommendations: ${metadata.recommendations.length}`);

  } catch (error) {
    console.error("\n❌ DISABLED JAVASCRIPT TEST FAILED");
    console.error("===================================");
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
    await tester.cleanup();
  }
}

// Run the disabled JavaScript test
runDisabledJavaScriptTest().catch(console.error);