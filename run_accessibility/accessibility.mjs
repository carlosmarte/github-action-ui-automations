import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file (for local development)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Function to run axe-core on extracted HTML
async function runAxeOnHTML(htmlContent, url) {
  try {
    // Use JSDOM to create a virtual DOM for axe-core analysis
    const { JSDOM } = await import('jsdom');
    const axeCore = await import('axe-core');
    
    console.log('   → Creating virtual DOM from extracted HTML...');
    const dom = new JSDOM(htmlContent, { 
      url: url,
      pretendToBeVisual: true,
      resources: "usable"
    });
    
    // Set up the global environment for axe
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    
    console.log('   → Configuring axe-core for offline analysis...');
    
    // Configure axe with the same rules as the browser version
    const axeConfig = {
      rules: {},
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
    };
    
    console.log('   → Running axe-core analysis on virtual DOM...');
    
    return new Promise((resolve) => {
      axeCore.run(dom.window.document, axeConfig, (err, results) => {
        // Clean up globals
        delete global.window;
        delete global.document;
        delete global.navigator;
        
        if (err) {
          console.log(`   ⚠️  Axe-core analysis error: ${err.message}`);
          resolve(null);
          return;
        }
        
        // Format results to match axe-playwright structure
        const formattedResults = {
          testEngine: {
            name: 'axe-core-offline',
            version: results.testEngine?.version || '4.7.0'
          },
          testRunner: {
            name: 'jsdom-axe-runner'
          },
          url: url,
          timestamp: new Date().toISOString(),
          violations: results.violations || [],
          passes: results.passes || [],
          incomplete: results.incomplete || [],
          inapplicable: results.inapplicable || []
        };
        
        resolve(formattedResults);
      });
    });
    
  } catch (importError) {
    console.log(`   ⚠️  Failed to load JSDOM or axe-core: ${importError.message}`);
    console.log('   → Install missing dependencies: npm install jsdom axe-core');
    return null;
  }
}

// Manual accessibility checks for CSP-restricted sites
async function performManualAccessibilityChecks(page, url) {
  console.log('   🔍 Performing manual accessibility checks...');
  
  try {
    // Method 1: Extract HTML and run axe-core on it
    console.log('   → Extracting page HTML for offline axe-core analysis...');
    const htmlContent = await page.content();
    console.log(`   → Extracted HTML (${(htmlContent.length / 1024).toFixed(2)} KB)`);
    
    // Import axe-core for direct HTML analysis
    console.log('   → Running axe-core on extracted HTML...');
    const axeResults = await runAxeOnHTML(htmlContent, url);
    
    if (axeResults) {
      console.log(`   ✅ Offline axe-core analysis completed: ${axeResults.violations.length} violations found`);
      return axeResults;
    } else {
      console.log('   ⚠️  Offline axe-core analysis failed, falling back to manual checks...');
    }
  } catch (extractError) {
    console.log(`   ⚠️  HTML extraction failed: ${extractError.message}, falling back to manual checks...`);
  }

  // Fallback to original manual checks
  const violations = [];
  const passes = [];
  const incomplete = [];
  
  try {
    // Check 1: Images without alt attributes
    console.log('   → Checking images without alt attributes...');
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.filter(img => !img.hasAttribute('alt') || img.alt.trim() === '').length;
    });
    
    if (imagesWithoutAlt > 0) {
      violations.push({
        id: 'image-alt',
        impact: 'serious',
        description: 'Images must have alternate text',
        help: 'Images should have alt attributes that describe their content',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/image-alt',
        tags: ['wcag2a', 'wcag111'],
        nodes: Array.from({ length: imagesWithoutAlt }, (_, i) => ({
          target: [`img:nth-child(${i + 1})`],
          html: '<img>',
          failureSummary: 'Element does not have an alt attribute'
        }))
      });
    } else {
      passes.push({ id: 'image-alt', description: 'All images have alt attributes' });
    }

    // Check 2: Form inputs without labels
    console.log('   → Checking form inputs without labels...');
    const inputsWithoutLabels = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea, select'));
      return inputs.filter(input => {
        const hasLabel = document.querySelector(`label[for="${input.id}"]`) || 
                        input.closest('label') ||
                        input.hasAttribute('aria-label') ||
                        input.hasAttribute('aria-labelledby');
        return !hasLabel;
      }).length;
    });
    
    if (inputsWithoutLabels > 0) {
      violations.push({
        id: 'label',
        impact: 'serious',
        description: 'Form elements must have labels',
        help: 'Form elements should have associated labels',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/label',
        tags: ['wcag2a', 'wcag412'],
        nodes: Array.from({ length: inputsWithoutLabels }, (_, i) => ({
          target: [`input:nth-child(${i + 1})`],
          html: '<input>',
          failureSummary: 'Element does not have an associated label'
        }))
      });
    } else {
      passes.push({ id: 'label', description: 'All form elements have labels' });
    }

    // Check 3: Headings hierarchy
    console.log('   → Checking heading hierarchy...');
    const headingIssues = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const levels = headings.map(h => parseInt(h.tagName.charAt(1)));
      
      let issues = 0;
      let previousLevel = 0;
      
      for (const level of levels) {
        if (previousLevel !== 0 && level > previousLevel + 1) {
          issues++;
        }
        previousLevel = level;
      }
      
      return issues;
    });
    
    if (headingIssues > 0) {
      violations.push({
        id: 'heading-order',
        impact: 'moderate',
        description: 'Heading levels should only increase by one',
        help: 'Headings should not skip levels',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/heading-order',
        tags: ['best-practice'],
        nodes: Array.from({ length: headingIssues }, (_, i) => ({
          target: [`h${i + 1}`],
          html: '<h>',
          failureSummary: 'Heading level skipped'
        }))
      });
    } else {
      passes.push({ id: 'heading-order', description: 'Heading hierarchy is correct' });
    }

    // Check 4: Color contrast (basic check)
    console.log('   → Performing basic color contrast checks...');
    const contrastIssues = await page.evaluate(() => {
      // This is a simplified check - real contrast checking requires more complex calculations
      const textElements = Array.from(document.querySelectorAll('p, span, div, a, h1, h2, h3, h4, h5, h6'));
      let lowContrastCount = 0;
      
      textElements.slice(0, 50).forEach(el => { // Check first 50 elements to avoid performance issues
        const style = window.getComputedStyle(el);
        const color = style.color;
        const backgroundColor = style.backgroundColor;
        
        // Simple heuristic: if both color and background are very light or very dark
        if ((color.includes('rgb(255') || color.includes('rgb(240')) && 
            (backgroundColor.includes('rgb(255') || backgroundColor.includes('rgb(240'))) {
          lowContrastCount++;
        }
      });
      
      return lowContrastCount;
    });
    
    if (contrastIssues > 0) {
      violations.push({
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must have sufficient color contrast',
        help: 'Text should have sufficient contrast against background',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/color-contrast',
        tags: ['wcag2aa', 'wcag143'],
        nodes: Array.from({ length: Math.min(contrastIssues, 5) }, (_, i) => ({
          target: [`element:nth-child(${i + 1})`],
          html: '<element>',
          failureSummary: 'Element has insufficient color contrast'
        }))
      });
    } else {
      passes.push({ id: 'color-contrast', description: 'Basic color contrast check passed' });
    }

    // Check 5: Links without descriptive text
    console.log('   → Checking link accessibility...');
    const emptyLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.filter(link => {
        const text = link.textContent.trim();
        const ariaLabel = link.getAttribute('aria-label');
        const title = link.getAttribute('title');
        return !text && !ariaLabel && !title;
      }).length;
    });
    
    if (emptyLinks > 0) {
      violations.push({
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        help: 'Links should have descriptive text or labels',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/link-name',
        tags: ['wcag2a', 'wcag244'],
        nodes: Array.from({ length: emptyLinks }, (_, i) => ({
          target: [`a:nth-child(${i + 1})`],
          html: '<a>',
          failureSummary: 'Element does not have accessible text'
        }))
      });
    } else {
      passes.push({ id: 'link-name', description: 'All links have descriptive text' });
    }

    console.log(`   ✅ Manual checks completed: ${violations.length} violations, ${passes.length} passes`);

  } catch (evalError) {
    console.log(`   ⚠️  Some manual checks failed due to page restrictions: ${evalError.message}`);
    console.log('   → Falling back to DOM-based checks without JavaScript evaluation...');
    
    // Fallback: DOM-based checks without page.evaluate
    try {
      // Check for images without alt using locator
      const images = await page.locator('img').all();
      let imagesWithoutAlt = 0;
      
      for (const img of images.slice(0, 20)) { // Limit to first 20 images for performance
        try {
          const altText = await img.getAttribute('alt');
          if (!altText || altText.trim() === '') {
            imagesWithoutAlt++;
          }
        } catch (e) {
          // Skip if can't access attribute
        }
      }
      
      if (imagesWithoutAlt > 0) {
        violations.push({
          id: 'image-alt-fallback',
          impact: 'serious',
          description: 'Images found without alt attributes (fallback check)',
          help: 'Images should have alt attributes',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/image-alt',
          tags: ['wcag2a'],
          nodes: Array.from({ length: imagesWithoutAlt }, (_, i) => ({
            target: [`img:nth-child(${i + 1})`],
            html: '<img>',
            failureSummary: 'Image missing alt attribute (fallback detection)'
          }))
        });
      }
      
      // Check for form inputs without labels using locators
      const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], textarea').all();
      let inputsWithoutLabels = 0;
      
      for (const input of inputs.slice(0, 10)) { // Limit to first 10 inputs
        try {
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledBy = await input.getAttribute('aria-labelledby');
          
          let hasLabel = false;
          if (id) {
            const labelCount = await page.locator(`label[for="${id}"]`).count();
            hasLabel = labelCount > 0;
          }
          
          if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
            inputsWithoutLabels++;
          }
        } catch (e) {
          // Skip if can't access attributes
        }
      }
      
      if (inputsWithoutLabels > 0) {
        violations.push({
          id: 'label-fallback',
          impact: 'serious',
          description: 'Form inputs found without labels (fallback check)',
          help: 'Form elements should have labels',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.7/label',
          tags: ['wcag2a'],
          nodes: Array.from({ length: inputsWithoutLabels }, (_, i) => ({
            target: [`input:nth-child(${i + 1})`],
            html: '<input>',
            failureSummary: 'Input missing label (fallback detection)'
          }))
        });
      }
      
      console.log(`   ✅ Fallback DOM checks completed: ${violations.length} total violations found`);
      
    } catch (domError) {
      console.log(`   ⚠️  All accessibility checks failed: ${domError.message}`);
      incomplete.push({
        id: 'all-checks-failed',
        description: 'All accessibility checks failed due to strict CSP restrictions',
        nodes: []
      });
    }
  }

  // Return axe-compatible result structure
  return {
    testEngine: {
      name: 'manual-accessibility-checker',
      version: '1.0.0'
    },
    testRunner: {
      name: 'playwright-manual'
    },
    url: url,
    timestamp: new Date().toISOString(),
    violations: violations,
    passes: passes,
    incomplete: incomplete,
    inapplicable: []
  };
}

async function runAccessibilityTest() {
  // Get website URL from environment variable
  const websiteUrl = process.env.WEBSITE_URL;
  
  console.log('🔍 Checking environment variables...');
  console.log(`   WEBSITE_URL: ${websiteUrl || 'NOT SET'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
  console.log(`   Current working directory: ${process.cwd()}`);
  console.log(`   Script location: ${__dirname}`);
  
  if (!websiteUrl) {
    console.error('❌ WEBSITE_URL environment variable is required');
    console.error('Set it in .env file or as environment variable');
    console.error('Available environment variables:');
    Object.keys(process.env).filter(key => key.includes('WEBSITE') || key.includes('URL')).forEach(key => {
      console.error(`   ${key}: ${process.env[key]}`);
    });
    process.exit(1);
  }

  console.log(`♿ Starting accessibility audit for: ${websiteUrl}`);
  console.log(`📅 Audit started at: ${new Date().toISOString()}`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`🏗️  Node.js version: ${process.version}`);

  let browser;
  let context;
  let page;
  
  try {
    // Launch browser
    console.log('🔧 Launching Chrome browser...');
    console.log(`   Headless mode: ${!process.argv.includes('--use-browser')}`);
    console.log(`   Command line args: ${process.argv.slice(2).join(' ')}`);
    console.log(`   Browser args: --disable-dev-shm-usage, --no-sandbox`);
    
    const launchStart = Date.now();
    browser = await chromium.launch({
      headless: !process.argv.includes('--use-browser'),
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
    console.log(`✅ Browser launched in ${Date.now() - launchStart}ms`);
    
    console.log('🌐 Creating browser context...');
    const contextStart = Date.now();
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    console.log(`✅ Context created in ${Date.now() - contextStart}ms`);
    console.log('🖼️  Viewport set to 1920x1080');
    console.log('🤖 User agent set');
    
    console.log('📄 Creating new page...');
    const pageStart = Date.now();
    page = await context.newPage();
    console.log(`✅ Page created in ${Date.now() - pageStart}ms`);
    
    // Navigate to the website
    console.log(`🌐 Navigating to: ${websiteUrl}`);
    console.log('⏳ Waiting for page to load (may take up to 60 seconds)...');
    
    const navigationStart = Date.now();
    try {
      console.log('🔄 Attempting navigation with domcontentloaded...');
      await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log(`✅ DOM content loaded successfully in ${Date.now() - navigationStart}ms`);
      
      // Wait for network to be mostly idle (fallback if networkidle fails)
      console.log('🌐 Waiting for network activity to settle...');
      const networkStart = Date.now();
      try {
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        console.log(`✅ Network activity settled in ${Date.now() - networkStart}ms`);
      } catch (networkIdleError) {
        console.log(`⚠️  Network didn't settle within 30s (${Date.now() - networkStart}ms), continuing anyway...`);
        console.log(`   Network error: ${networkIdleError.message}`);
      }
      
    } catch (error) {
      console.log(`⚠️  Page load timeout after ${Date.now() - navigationStart}ms, trying with basic load state...`);
      console.log(`   Navigation error: ${error.message}`);
      const fallbackStart = Date.now();
      try {
        await page.goto(websiteUrl, { waitUntil: 'load', timeout: 30000 });
        console.log(`✅ Basic page load completed in ${Date.now() - fallbackStart}ms`);
      } catch (fallbackError) {
        console.error(`❌ Fallback navigation also failed: ${fallbackError.message}`);
        throw fallbackError;
      }
    }
    
    // Check page status
    console.log('📊 Checking page status...');
    const url = page.url();
    const title = await page.title();
    console.log(`   Final URL: ${url}`);
    console.log(`   Page title: "${title}"`);
    console.log(`   URL matches target: ${url === websiteUrl || url.startsWith(websiteUrl)}`);
    
    // Check if page has content
    const bodyContent = await page.locator('body').textContent();
    const hasContent = bodyContent && bodyContent.trim().length > 0;
    console.log(`   Page has content: ${hasContent}`);
    console.log(`   Content length: ${bodyContent ? bodyContent.length : 0} characters`);
    
    if (!hasContent) {
      console.warn('⚠️  Page appears to have no content - accessibility scan may be limited');
    }
    
    // Wait a bit for any dynamic content to load
    console.log('⏳ Waiting 3 seconds for dynamic content...');
    const waitStart = Date.now();
    await page.waitForTimeout(3000);
    console.log(`✅ Wait completed in ${Date.now() - waitStart}ms`);
    
    // Check for JavaScript errors on the page
    console.log('🔍 Checking for JavaScript errors...');
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
      console.log(`   ⚠️  JavaScript error: ${error.message}`);
    });
    
    page.on('requestfailed', request => {
      console.log(`   ⚠️  Failed request: ${request.url()} (${request.failure()?.errorText})`);
    });
    
    // Check DOM readiness
    const domElementsCount = await page.locator('*').count();
    console.log(`   DOM elements found: ${domElementsCount}`);
    
    // Create axe builder
    console.log('🔍 Setting up axe-core accessibility scanner...');
    const axeBuilder = new AxeBuilder({ page });
    
    // Configure axe rules (you can customize these)
    console.log('⚙️  Configuring accessibility rules...');
    const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];
    console.log(`   Using tags: ${tags.join(', ')}`);
    console.log('   Excluding: #commonly-reused-element-with-known-issue');
    
    axeBuilder
      .withTags(tags)
      .exclude('#commonly-reused-element-with-known-issue');
    
    // Run the accessibility scan
    console.log('🔎 Running accessibility scan...');
    console.log('   This may take 10-30 seconds depending on page complexity...');
    const scanStart = Date.now();
    
    try {
      // Try different approaches for CSP-restricted sites
      console.log('   Attempting accessibility scan with CSP workarounds...');
      let results;
      
      try {
        // First attempt: Standard axe scan
        console.log('   → Trying standard axe scan...');
        results = await axeBuilder.analyze();
        console.log('   ✅ Standard scan successful');
      } catch (cspError) {
        console.log(`   ⚠️  Standard scan failed: ${cspError.message}`);
        
        if (cspError.message.includes('eval is disabled') || cspError.message.includes('CSP')) {
          console.log('   → Detected CSP restrictions, trying alternative approaches...');
          
          // Method 1: Try with different axe source
          try {
            console.log('   → Trying with alternative axe configuration...');
            const alternativeAxeBuilder = new AxeBuilder({ page })
              .withTags(tags)
              .exclude('#commonly-reused-element-with-known-issue')
              .options({
                // Disable some features that might require eval
                performanceTimer: false,
                reporter: 'v1'
              });
            results = await alternativeAxeBuilder.analyze();
            console.log('   ✅ Alternative axe configuration successful');
          } catch (altError) {
            console.log(`   ⚠️  Alternative axe configuration failed: ${altError.message}`);
            
            // Method 2: Manual accessibility checks
            console.log('   → Falling back to manual accessibility checks...');
            results = await performManualAccessibilityChecks(page, websiteUrl);
            console.log('   ✅ Manual accessibility checks completed');
          }
        } else {
          throw cspError;
        }
      }
      const scanDuration = Date.now() - scanStart;
      console.log(`✅ Accessibility scan completed in ${scanDuration}ms`);
      console.log(`   Scan results: ${results.violations.length} violations, ${results.passes.length} passes, ${results.incomplete.length} incomplete`);
      
      if (jsErrors.length > 0) {
        console.log(`   ⚠️  Note: ${jsErrors.length} JavaScript errors detected during scan`);
      }
    
      // Create dataset directory if it doesn't exist
      console.log('📁 Setting up output directory...');
      const datasetDir = path.join(__dirname, '..', 'dataset');
      console.log(`   Dataset directory: ${datasetDir}`);
      
      if (!fs.existsSync(datasetDir)) {
        console.log('   Creating dataset directory...');
        fs.mkdirSync(datasetDir, { recursive: true });
        console.log('   ✅ Dataset directory created');
      } else {
        console.log('   ✅ Dataset directory already exists');
      }
      
      // Save full results as JSON
      console.log('💾 Saving full accessibility report...');
      const resultsPath = path.join(datasetDir, 'accessibility-report.json');
      const jsonSize = JSON.stringify(results, null, 2).length;
      console.log(`   Report size: ${(jsonSize / 1024).toFixed(2)} KB`);
      
      const saveStart = Date.now();
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`✅ Full accessibility report saved to: ${resultsPath} (${Date.now() - saveStart}ms)`);
      
      // Take a screenshot
      console.log('📸 Taking full page screenshot...');
      const screenshotPath = path.join(datasetDir, 'accessibility-screenshot.png');
      const screenshotStart = Date.now();
      
      try {
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        
        const screenshotStats = fs.statSync(screenshotPath);
        console.log(`✅ Screenshot saved to: ${screenshotPath} (${Date.now() - screenshotStart}ms)`);
        console.log(`   Screenshot size: ${(screenshotStats.size / 1024).toFixed(2)} KB`);
      } catch (screenshotError) {
        console.error(`⚠️  Screenshot failed: ${screenshotError.message}`);
      }
    
    // Create summary report
    const summary = {
      url: websiteUrl,
      timestamp: new Date().toISOString(),
      testEngine: {
        name: results.testEngine.name,
        version: results.testEngine.version
      },
      testRunner: {
        name: results.testRunner.name
      },
      violations: {
        count: results.violations.length,
        critical: results.violations.filter(v => v.impact === 'critical').length,
        serious: results.violations.filter(v => v.impact === 'serious').length,
        moderate: results.violations.filter(v => v.impact === 'moderate').length,
        minor: results.violations.filter(v => v.impact === 'minor').length
      },
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      violationDetails: results.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        tags: violation.tags,
        nodes: violation.nodes.length,
        nodeTargets: violation.nodes.map(node => node.target).slice(0, 3) // First 3 targets
      }))
    };
    
      console.log('📋 Creating summary report...');
      const summaryPath = path.join(datasetDir, 'accessibility-summary.json');
      const summaryStart = Date.now();
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      console.log(`✅ Summary report saved to: ${summaryPath} (${Date.now() - summaryStart}ms)`);
      
      // Create human-readable report
      console.log('📄 Generating human-readable report...');
      let readableReport = `# Accessibility Audit Report\n\n`;
    readableReport += `**Website:** ${websiteUrl}\n`;
    readableReport += `**Test Date:** ${new Date().toISOString()}\n`;
    readableReport += `**Test Engine:** ${results.testEngine.name} v${results.testEngine.version}\n\n`;
    
    readableReport += `## Summary\n\n`;
    readableReport += `- **Total Violations:** ${results.violations.length}\n`;
    readableReport += `- **Critical:** ${summary.violations.critical}\n`;
    readableReport += `- **Serious:** ${summary.violations.serious}\n`;
    readableReport += `- **Moderate:** ${summary.violations.moderate}\n`;
    readableReport += `- **Minor:** ${summary.violations.minor}\n`;
    readableReport += `- **Passed Tests:** ${results.passes.length}\n`;
    readableReport += `- **Incomplete Tests:** ${results.incomplete.length}\n\n`;
    
    if (results.violations.length > 0) {
      readableReport += `## Violations\n\n`;
      results.violations.forEach((violation, index) => {
        readableReport += `### ${index + 1}. ${violation.help}\n\n`;
        readableReport += `**Impact:** ${violation.impact}\n`;
        readableReport += `**Description:** ${violation.description}\n`;
        readableReport += `**Help URL:** [${violation.helpUrl}](${violation.helpUrl})\n`;
        readableReport += `**Tags:** ${violation.tags.join(', ')}\n`;
        readableReport += `**Affected Elements:** ${violation.nodes.length}\n\n`;
        
        // Show first few affected elements
        violation.nodes.slice(0, 3).forEach((node, nodeIndex) => {
          readableReport += `**Element ${nodeIndex + 1}:**\n`;
          readableReport += `- Target: \`${node.target.join(' ')}\`\n`;
          if (node.html) {
            readableReport += `- HTML: \`${node.html.substring(0, 100)}${node.html.length > 100 ? '...' : ''}\`\n`;
          }
          readableReport += `- Failure Summary: ${node.failureSummary}\n\n`;
        });
        
        if (violation.nodes.length > 3) {
          readableReport += `... and ${violation.nodes.length - 3} more elements\n\n`;
        }
        
        readableReport += `---\n\n`;
      });
    }
    
      const readableReportPath = path.join(datasetDir, 'accessibility-report.md');
      const readableReportStart = Date.now();
      fs.writeFileSync(readableReportPath, readableReport);
      console.log(`✅ Human-readable report saved to: ${readableReportPath} (${Date.now() - readableReportStart}ms)`);
      console.log(`   Report length: ${readableReport.length} characters`);
    
    // Display results
    console.log('\n♿ ACCESSIBILITY AUDIT RESULTS');
    console.log('==============================');
    console.log(`🌐 URL: ${websiteUrl}`);
    console.log(`🚨 Total Violations: ${results.violations.length}`);
    console.log(`🔴 Critical: ${summary.violations.critical}`);
    console.log(`🟠 Serious: ${summary.violations.serious}`);
    console.log(`🟡 Moderate: ${summary.violations.moderate}`);
    console.log(`🔵 Minor: ${summary.violations.minor}`);
    console.log(`✅ Passed Tests: ${results.passes.length}`);
    console.log(`⚠️  Incomplete Tests: ${results.incomplete.length}`);
    
    if (results.violations.length > 0) {
      console.log('\n🚨 TOP VIOLATIONS:');
      console.log('==================');
      results.violations.slice(0, 5).forEach((violation, index) => {
        console.log(`${index + 1}. [${violation.impact.toUpperCase()}] ${violation.help}`);
        console.log(`   📍 Affects ${violation.nodes.length} elements`);
        console.log(`   🔗 ${violation.helpUrl}`);
      });
    }
    
      console.log('\n✅ Accessibility audit completed successfully!');
      
      // Generate final summary statistics
      const totalTime = Date.now() - navigationStart;
      console.log(`\n📊 PERFORMANCE SUMMARY`);
      console.log('======================');
      console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)} seconds`);
      console.log(`📁 Files generated: 4 (JSON report, summary, markdown, screenshot)`);
      console.log(`💾 Total output size: ${((jsonSize + readableReport.length) / 1024).toFixed(2)} KB (excluding screenshot)`);
      
      // Set exit code based on critical/serious violations
      const criticalOrSeriousViolations = summary.violations.critical + summary.violations.serious;
      if (criticalOrSeriousViolations > 0) {
        console.log(`\n⚠️  Found ${criticalOrSeriousViolations} critical/serious accessibility issues`);
        console.log('   📝 Review the generated reports for detailed remediation steps');
        // Don't exit with error code to allow CI to continue and upload artifacts
        // process.exit(1);
      } else {
        console.log('\n🎉 No critical or serious accessibility violations found!');
      }
      
    } catch (analyzeError) {
      console.error(`❌ Accessibility scan failed: ${analyzeError.message}`);
      console.error(`   Scan duration before failure: ${Date.now() - scanStart}ms`);
      throw analyzeError;
    }

  } catch (error) {
    console.error('❌ Accessibility audit failed:', error.message);
    console.error(`   Error type: ${error.name}`);
    console.error(`   Stack trace: ${error.stack}`);
    
    // Log environment info for debugging
    console.error('\n🔍 DEBUG INFO FOR TROUBLESHOOTING:');
    console.error('=====================================');
    console.error(`   Node.js version: ${process.version}`);
    console.error(`   Platform: ${process.platform}`);
    console.error(`   Architecture: ${process.arch}`);
    console.error(`   Working directory: ${process.cwd()}`);
    console.error(`   Script location: ${__dirname}`);
    console.error(`   Available memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    process.exit(1);
  } finally {
    console.log('\n🧹 CLEANUP PHASE');
    console.log('=================');
    
    if (page) {
      console.log('📄 Closing page...');
      const pageCloseStart = Date.now();
      await page.close();
      console.log(`✅ Page closed (${Date.now() - pageCloseStart}ms)`);
    }
    
    if (context) {
      console.log('🌐 Closing browser context...');
      const contextCloseStart = Date.now();
      await context.close();
      console.log(`✅ Context closed (${Date.now() - contextCloseStart}ms)`);
    }
    
    if (browser) {
      console.log('🔧 Closing Chrome browser...');
      const browserCloseStart = Date.now();
      await browser.close();
      console.log(`✅ Browser closed (${Date.now() - browserCloseStart}ms)`);
    }
    
    console.log('🏁 Cleanup completed');
  }
}

// Run the audit
runAccessibilityTest().catch(console.error);