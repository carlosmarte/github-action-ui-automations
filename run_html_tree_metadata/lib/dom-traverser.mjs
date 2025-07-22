/**
 * CSP-Safe DOM Traverser
 * Robust DOM tree traversal with error handling and performance optimizations
 */
export class CSPSafeDOMTraverser {
  constructor(elementDetector, options = {}) {
    this.elementDetector = elementDetector;
    this.options = {
      maxDepth: 15,
      maxChildren: 50,
      maxElements: 5000, // Prevent memory issues
      skipHiddenElements: false,
      verboseLogging: false,
      ...options
    };
    
    this.stats = {
      totalElements: 0,
      processedElements: 0,
      skippedElements: 0,
      errorElements: 0,
      maxDepthReached: 0
    };
  }

  resetStats() {
    this.stats = {
      totalElements: 0,
      processedElements: 0,
      skippedElements: 0,
      errorElements: 0,
      maxDepthReached: 0
    };
  }

  /**
   * Extract comprehensive element metadata using CSP-safe methods
   */
  async extractElementMetadata(element, index = 0, depth = 0, viewport = 'unknown') {
    this.stats.totalElements++;
    
    // Update max depth reached
    this.stats.maxDepthReached = Math.max(this.stats.maxDepthReached, depth);

    try {
      // Use element detector for comprehensive analysis
      const analysis = await this.elementDetector.analyzeElement(element, index);
      
      // Get bounding box (position and dimensions)
      let boundingBox = { x: 0, y: 0, width: 0, height: 0 };
      try {
        boundingBox = await element.boundingBox() || boundingBox;
      } catch (error) {
        console.warn(`⚠️ Could not get boundingBox for element ${index}: ${error.message}`);
      }

      // Get element visibility and enabled state
      let isVisible = false;
      let isEnabled = false;
      try {
        isVisible = await element.isVisible();
        isEnabled = await element.isEnabled();
      } catch (error) {
        // These methods might not be available for all elements
      }

      // Skip hidden elements if configured
      if (this.options.skipHiddenElements && !isVisible) {
        this.stats.skippedElements++;
        if (this.options.verboseLogging) {
          console.log(`⏭️ Skipping hidden element at depth ${depth}`);
        }
        return null;
      }

      // Create comprehensive element metadata
      const elementMetadata = {
        // Core identification
        index,
        depth,
        tagName: analysis.tagName,
        
        // Attributes and content  
        id: analysis.attributes.id || null,
        classes: analysis.attributes.class ? 
          analysis.attributes.class.split(' ').filter(c => c.trim()) : [],
        attributes: analysis.attributes,
        textContent: analysis.textContent,
        
        // Position and dimensions
        boundingBox,
        position: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
          centerX: boundingBox.x + (boundingBox.width / 2),
          centerY: boundingBox.y + (boundingBox.height / 2),
          area: boundingBox.width * boundingBox.height
        },
        
        // State information
        isVisible,
        isEnabled,
        isInteractive: analysis.semanticData.isInteractive || false,
        
        // Semantic data
        semanticData: analysis.semanticData,
        
        // Testing locators
        locatorStrategies: analysis.locatorStrategies,
        
        // Quality indicators
        detectionConfidence: analysis.detectionConfidence || 0.5,
        
        // Viewport context
        viewport,
        
        // CSS extraction status
        styles: {
          note: "CSS extraction skipped for CSP safety",
          boundingBoxAvailable: !!boundingBox,
          positionCalculated: true
        },
        
        // Tree structure (will be populated during traversal)
        hasChildren: false,
        childrenCount: 0,
        children: []
      };

      this.stats.processedElements++;
      return elementMetadata;
    } catch (error) {
      this.stats.errorElements++;
      console.error(`❌ Error extracting metadata for element ${index} at depth ${depth}: ${error.message}`);
      return null;
    }
  }

  /**
   * Traverse DOM tree using CSP-safe methods with robust error handling
   */
  async traverseDOMTree(element, index = 0, depth = 0, viewport = 'unknown') {
    // Safety checks
    if (depth > this.options.maxDepth) {
      if (this.options.verboseLogging) {
        console.log(`⏹️ Max depth ${this.options.maxDepth} reached, stopping traversal`);
      }
      return null;
    }

    if (this.stats.totalElements > this.options.maxElements) {
      console.warn(`⚠️ Max elements limit ${this.options.maxElements} reached, stopping traversal`);
      return null;
    }

    // Extract metadata for current element
    const elementData = await this.extractElementMetadata(element, index, depth, viewport);
    if (!elementData) {
      return null;
    }

    // Get child elements using CSP-safe selector
    try {
      const childElements = await element.$$(':scope > *');
      
      if (childElements.length > 0) {
        elementData.hasChildren = true;
        elementData.childrenCount = childElements.length;
        
        // Limit children processing for performance
        const childrenToProcess = childElements.slice(0, this.options.maxChildren);
        
        if (this.options.verboseLogging && childElements.length > 5) {
          console.log(`🔍 Processing ${childrenToProcess.length}/${childElements.length} children at depth ${depth} for ${elementData.tagName}`);
        }
        
        // Process each child with individual error handling
        for (let i = 0; i < childrenToProcess.length; i++) {
          try {
            const childData = await this.traverseDOMTree(
              childrenToProcess[i], 
              i, 
              depth + 1, 
              viewport
            );
            if (childData) {
              elementData.children.push(childData);
            }
          } catch (childError) {
            console.warn(`⚠️ Error processing child ${i} at depth ${depth}: ${childError.message}`);
            // Continue with other children instead of failing completely
            elementData.children.push({
              error: `Failed to process child ${i}`,
              message: childError.message,
              index: i,
              depth: depth + 1
            });
          }
        }
        
        // Note if children were truncated
        if (childElements.length > this.options.maxChildren) {
          elementData.children.push({
            type: 'truncation-note',
            note: `... and ${childElements.length - this.options.maxChildren} more children (truncated for performance)`,
            truncatedCount: childElements.length - this.options.maxChildren,
            totalChildren: childElements.length,
            processedChildren: childrenToProcess.length
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error processing children for element at depth ${depth}: ${error.message}`);
      elementData.childrenStats = {
        error: error.message,
        attempted: true,
        successful: false
      };
    }

    return elementData;
  }

  /**
   * Find and traverse from body element
   */
  async traverseFromBody(page, viewport = 'unknown') {
    console.log(`🌳 Starting DOM traversal for ${viewport} viewport...`);
    this.resetStats();
    
    try {
      // Find body element to start traversal
      const bodyElement = await page.$('body');
      if (!bodyElement) {
        console.error(`❌ Could not find body element for ${viewport}`);
        return null;
      }

      // Start traversal from body
      const startTime = Date.now();
      const domTree = await this.traverseDOMTree(bodyElement, 0, 0, viewport);
      const traversalTime = Date.now() - startTime;

      // Log traversal statistics
      console.log(`✅ DOM traversal completed for ${viewport} in ${traversalTime}ms`);
      console.log(`📊 Elements: ${this.stats.processedElements} processed, ${this.stats.skippedElements} skipped, ${this.stats.errorElements} errors`);
      console.log(`📏 Max depth reached: ${this.stats.maxDepthReached}`);

      return {
        domTree,
        stats: { ...this.stats },
        traversalTime,
        viewport
      };
    } catch (error) {
      console.error(`❌ Fatal error during DOM traversal for ${viewport}: ${error.message}`);
      return {
        domTree: null,
        stats: { ...this.stats },
        error: error.message,
        viewport
      };
    }
  }

  /**
   * Calculate tree statistics
   */
  calculateTreeStatistics(treeData) {
    if (!treeData || !treeData.domTree) {
      return { 
        totalElements: 0, 
        interactive: 0, 
        withText: 0, 
        visible: 0,
        error: 'No tree data available'
      };
    }
    
    const stats = {
      totalElements: 0,
      interactive: 0,
      withText: 0,
      visible: 0,
      withId: 0,
      withClass: 0,
      withTestId: 0,
      withRole: 0,
      highConfidence: 0, // Elements with high detection confidence
      tagDistribution: {},
      depthDistribution: {},
      positionDistribution: {
        topLeft: 0,     // x < 100, y < 100
        topRight: 0,    // x > viewport.width - 100, y < 100
        bottomLeft: 0,  // x < 100, y > viewport.height - 100
        bottomRight: 0, // x > viewport.width - 100, y > viewport.height - 100
        center: 0       // middle area
      },
      maxDepth: 0,
      avgConfidence: 0
    };
    
    let totalConfidence = 0;

    const traverse = (node) => {
      if (!node || node.type === 'truncation-note' || node.error) return;
      
      stats.totalElements++;
      
      // Count various element types
      if (node.isInteractive) stats.interactive++;
      if (node.textContent && node.textContent.trim()) stats.withText++;
      if (node.isVisible) stats.visible++;
      if (node.semanticData?.hasId) stats.withId++;
      if (node.semanticData?.hasClass) stats.withClass++;
      if (node.semanticData?.hasTestId) stats.withTestId++;
      if (node.semanticData?.hasRole) stats.withRole++;
      if (node.detectionConfidence > 0.8) stats.highConfidence++;
      
      // Accumulate confidence for average
      totalConfidence += (node.detectionConfidence || 0);
      
      // Track distributions
      if (node.tagName) {
        stats.tagDistribution[node.tagName] = (stats.tagDistribution[node.tagName] || 0) + 1;
      }
      
      if (node.depth !== undefined) {
        stats.depthDistribution[node.depth] = (stats.depthDistribution[node.depth] || 0) + 1;
        stats.maxDepth = Math.max(stats.maxDepth, node.depth);
      }
      
      // Position distribution (assuming 1920x1080 desktop, adjust for actual viewport)
      if (node.position && node.position.x !== undefined) {
        const { x, y } = node.position;
        if (x < 100 && y < 100) stats.positionDistribution.topLeft++;
        else if (x > 1820 && y < 100) stats.positionDistribution.topRight++;
        else if (x < 100 && y > 980) stats.positionDistribution.bottomLeft++;
        else if (x > 1820 && y > 980) stats.positionDistribution.bottomRight++;
        else stats.positionDistribution.center++;
      }
      
      // Process children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => traverse(child));
      }
    };
    
    traverse(treeData.domTree);
    
    // Calculate average confidence
    stats.avgConfidence = stats.totalElements > 0 ? 
      (totalConfidence / stats.totalElements).toFixed(2) : 0;
    
    return stats;
  }

  /**
   * Extract interactive elements for testing purposes
   */
  extractInteractiveElements(treeData) {
    if (!treeData || !treeData.domTree) return [];
    
    const interactiveElements = [];

    const traverse = (node) => {
      if (!node || node.type === 'truncation-note' || node.error) return;
      
      // Check if element is interactive and has useful locator data
      if (node.isInteractive || 
          node.locatorStrategies?.byRole || 
          node.locatorStrategies?.byTestId ||
          node.semanticData?.hasTestId) {
        
        const interactiveElement = {
          tagName: node.tagName,
          id: node.id,
          classes: node.classes,
          textContent: node.textContent,
          boundingBox: node.boundingBox,
          position: node.position,
          locatorStrategies: node.locatorStrategies,
          semanticData: node.semanticData,
          depth: node.depth,
          detectionConfidence: node.detectionConfidence,
          attributes: {
            // Include key attributes for test automation
            role: node.attributes.role,
            'aria-label': node.attributes['aria-label'],
            'data-testid': node.attributes['data-testid'],
            'data-test': node.attributes['data-test'],
            'data-cy': node.attributes['data-cy'],
            href: node.attributes.href,
            type: node.attributes.type,
            name: node.attributes.name
          }
        };
        
        // Clean up null attributes
        Object.keys(interactiveElement.attributes).forEach(key => {
          if (!interactiveElement.attributes[key]) {
            delete interactiveElement.attributes[key];
          }
        });
        
        interactiveElements.push(interactiveElement);
      }
      
      // Process children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => traverse(child));
      }
    };

    traverse(treeData.domTree);
    return interactiveElements;
  }
}