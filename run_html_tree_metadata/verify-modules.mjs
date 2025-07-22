#!/usr/bin/env node

/**
 * Verify modular CSP-safe components
 */

async function verifyModules() {
  console.log('🔧 Verifying CSP-Safe Modules');
  console.log('=============================');

  try {
    // Test browser manager
    console.log('📦 Testing Browser Manager...');
    const { CSPSafeBrowserManager } = await import('./lib/browser-manager.mjs');
    const browserManager = new CSPSafeBrowserManager();
    console.log('✅ Browser Manager loaded');
    console.log(`   Open pages: ${browserManager.getOpenPagesCount()}`);
    console.log(`   Browser status: ${browserManager.isBrowserOpen() ? 'Open' : 'Closed'}`);

    // Test element detector
    console.log('\n🔍 Testing Element Detector...');
    const { CSPSafeElementDetector } = await import('./lib/element-detector.mjs');
    const elementDetector = new CSPSafeElementDetector();
    console.log('✅ Element Detector loaded');
    console.log(`   Attributes to extract: ${elementDetector.allAttributes.length}`);
    console.log(`   Detection rules: ${elementDetector.tagDetectionRules.length}`);

    // Test DOM traverser
    console.log('\n🌳 Testing DOM Traverser...');
    const { CSPSafeDOMTraverser } = await import('./lib/dom-traverser.mjs');
    const domTraverser = new CSPSafeDOMTraverser(elementDetector);
    console.log('✅ DOM Traverser loaded');
    console.log(`   Max depth: ${domTraverser.options.maxDepth}`);
    console.log(`   Max children: ${domTraverser.options.maxChildren}`);

    // Test main extractor
    console.log('\n🏗️ Testing Main Extractor...');
    const { CSPSafeHTMLTreeExtractor } = await import('./html-tree-metadata.mjs');
    const extractor = new CSPSafeHTMLTreeExtractor();
    console.log('✅ Main Extractor loaded');
    console.log(`   Viewports: ${Object.keys(extractor.viewports).join(', ')}`);
    console.log(`   Extract screenshots: ${extractor.extractScreenshots}`);
    console.log(`   Max depth: ${extractor.domTraverser.options.maxDepth}`);

    console.log('\n🎉 All modules verified successfully!');
    console.log('====================================');
    
    return true;
  } catch (error) {
    console.error(`❌ Module verification failed: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyModules().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { verifyModules };