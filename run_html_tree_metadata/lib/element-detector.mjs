/**
 * CSP-Safe Element Detection Library
 * Advanced element type detection using comprehensive attribute analysis
 */
export class CSPSafeElementDetector {
  constructor() {
    // Comprehensive HTML attributes to extract for element detection
    this.coreAttributes = [
      'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden'
    ];

    this.formAttributes = [
      'type', 'name', 'value', 'placeholder', 'required', 'disabled',
      'readonly', 'checked', 'selected', 'multiple', 'accept',
      'autocomplete', 'autofocus', 'min', 'max', 'step', 'pattern',
      'maxlength', 'minlength', 'size', 'rows', 'cols'
    ];

    this.linkMediaAttributes = [
      'href', 'src', 'alt', 'target', 'rel', 'download',
      'srcset', 'sizes', 'loading', 'decoding'
    ];

    this.semanticAttributes = [
      'role', 'tabindex', 'contenteditable', 'draggable', 'dropzone'
    ];

    this.ariaAttributes = [
      'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-expanded',
      'aria-hidden', 'aria-live', 'aria-atomic', 'aria-relevant',
      'aria-busy', 'aria-checked', 'aria-disabled', 'aria-selected',
      'aria-pressed', 'aria-invalid', 'aria-required', 'aria-readonly'
    ];

    this.testAttributes = [
      'data-testid', 'data-test', 'data-cy', 'data-automation',
      'data-track', 'data-analytics', 'data-component', 'data-module'
    ];

    this.customAttributes = [
      'for', 'action', 'method', 'enctype', 'novalidate'
    ];

    // Combined attribute list for extraction
    this.allAttributes = [
      ...this.coreAttributes,
      ...this.formAttributes,
      ...this.linkMediaAttributes,
      ...this.semanticAttributes,
      ...this.ariaAttributes,
      ...this.testAttributes,
      ...this.customAttributes
    ];

    // Tag detection rules (priority order matters)
    this.tagDetectionRules = [
      // High confidence detections
      { condition: attrs => attrs.href, tag: 'a' },
      { condition: attrs => attrs.src && attrs.alt !== undefined, tag: 'img' },
      { condition: attrs => attrs.src && (attrs.srcset || attrs.loading), tag: 'img' },
      { condition: attrs => attrs.action || attrs.method || attrs.enctype, tag: 'form' },
      { condition: attrs => attrs.for, tag: 'label' },
      
      // Form field detections
      { condition: attrs => attrs.type === 'submit' || attrs.type === 'button', tag: 'button' },
      { condition: attrs => attrs.rows || attrs.cols, tag: 'textarea' },
      { condition: attrs => attrs.multiple !== undefined && attrs.size, tag: 'select' },
      { condition: attrs => attrs.selected !== undefined, tag: 'option' },
      { condition: attrs => attrs.type || attrs.placeholder || attrs.value !== undefined, tag: 'input' },
      
      // Role-based detections
      { condition: attrs => attrs.role === 'button', tag: 'button' },
      { condition: attrs => attrs.role === 'link', tag: 'a' },
      { condition: attrs => attrs.role === 'textbox', tag: 'input' },
      { condition: attrs => attrs.role === 'checkbox' || attrs.role === 'radio', tag: 'input' },
      { condition: attrs => attrs.role === 'listbox' || attrs.role === 'combobox', tag: 'select' },
      { condition: attrs => attrs.role === 'option', tag: 'option' },
      { condition: attrs => attrs.role === 'heading', tag: 'h1' },
      { condition: attrs => attrs.role === 'list', tag: 'ul' },
      { condition: attrs => attrs.role === 'listitem', tag: 'li' },
      { condition: attrs => attrs.role === 'table', tag: 'table' },
      { condition: attrs => attrs.role === 'row', tag: 'tr' },
      { condition: attrs => attrs.role === 'cell' || attrs.role === 'gridcell', tag: 'td' },
      { condition: attrs => attrs.role === 'columnheader' || attrs.role === 'rowheader', tag: 'th' },
      { condition: attrs => attrs.role === 'navigation', tag: 'nav' },
      { condition: attrs => attrs.role === 'main', tag: 'main' },
      { condition: attrs => attrs.role === 'banner', tag: 'header' },
      { condition: attrs => attrs.role === 'complementary', tag: 'aside' },
      { condition: attrs => attrs.role === 'contentinfo', tag: 'footer' },
      
      // Media detections
      { condition: attrs => attrs.src && (attrs.type === 'video' || (attrs.accept && attrs.accept.includes('video'))), tag: 'video' },
      { condition: attrs => attrs.src && (attrs.type === 'audio' || (attrs.accept && attrs.accept.includes('audio'))), tag: 'audio' },
      { condition: attrs => attrs.src, tag: 'img' }, // Generic src fallback
      
      // Default fallback
      { condition: () => true, tag: 'div' }
    ];
  }

  /**
   * Extract all available attributes from an element using CSP-safe methods
   */
  async extractAttributes(element, index = 0) {
    const attributeMap = {};
    let extractedCount = 0;
    let failedCount = 0;

    // Extract all known attributes
    for (const attr of this.allAttributes) {
      try {
        const value = await element.getAttribute(attr);
        if (value !== null) {
          attributeMap[attr] = value;
          extractedCount++;
        }
      } catch (error) {
        failedCount++;
        // Continue with other attributes - don't log every failure to avoid spam
      }
    }

    // Log summary if many attributes failed (might indicate CSP issues)
    if (failedCount > 10) {
      console.warn(`⚠️ Element ${index}: ${failedCount} attribute extractions failed, ${extractedCount} succeeded`);
    }

    return attributeMap;
  }

  /**
   * Detect element tag using rule-based approach
   */
  detectElementTag(attributes) {
    for (const rule of this.tagDetectionRules) {
      try {
        if (rule.condition(attributes)) {
          return rule.tag;
        }
      } catch (error) {
        // Continue to next rule if condition evaluation fails
        continue;
      }
    }
    
    // Fallback - should never reach here due to final catch-all rule
    return 'div';
  }

  /**
   * Determine if element is interactive based on attributes and tag
   */
  isInteractiveElement(tagName, attributes) {
    // Interactive tags
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
    if (interactiveTags.includes(tagName)) {
      return true;
    }

    // Interactive roles
    const interactiveRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio', 'tab', 
      'menuitem', 'option', 'slider', 'switch'
    ];
    if (attributes.role && interactiveRoles.includes(attributes.role)) {
      return true;
    }

    // Other interactive indicators
    if (attributes.tabindex !== undefined || 
        attributes.onclick !== undefined ||
        attributes.contenteditable === 'true') {
      return true;
    }

    return false;
  }

  /**
   * Generate semantic classification for the element
   */
  generateSemanticData(tagName, attributes, textContent) {
    const hasText = textContent && textContent.trim().length > 0;
    const hasId = !!attributes.id;
    const hasClass = !!attributes.class;
    const hasTestId = !!(attributes['data-testid'] || attributes['data-test'] || attributes['data-cy']);
    const hasAriaLabel = !!(attributes['aria-label'] || attributes['aria-labelledby']);
    const hasRole = !!attributes.role;
    
    return {
      hasText,
      hasId,
      hasClass,
      hasTestId,
      hasAriaLabel,
      hasRole,
      isAccessible: hasRole || hasAriaLabel || hasTestId,
      isFormField: ['input', 'select', 'textarea'].includes(tagName),
      isInteractive: this.isInteractiveElement(tagName, attributes),
      isMedia: ['img', 'video', 'audio'].includes(tagName),
      isContainer: ['div', 'section', 'article', 'nav', 'header', 'footer', 'main', 'aside'].includes(tagName)
    };
  }

  /**
   * Generate multiple locator strategies for testing
   */
  generateLocatorStrategies(tagName, attributes, textContent) {
    const strategies = {};

    // ID-based locator (highest priority)
    if (attributes.id) {
      strategies.byId = `#${attributes.id}`;
    }

    // Test ID locators
    const testId = attributes['data-testid'] || attributes['data-test'] || attributes['data-cy'];
    if (testId) {
      strategies.byTestId = `[data-testid="${testId}"]`;
      if (!strategies.byTestId && attributes['data-test']) {
        strategies.byTestId = `[data-test="${attributes['data-test']}"]`;
      }
      if (!strategies.byTestId && attributes['data-cy']) {
        strategies.byTestId = `[data-cy="${attributes['data-cy']}"]`;
      }
    }

    // Role-based locator
    if (attributes.role) {
      strategies.byRole = attributes.role;
    }

    // Text-based locator
    if (textContent && textContent.trim()) {
      strategies.byText = textContent.trim().substring(0, 30);
    }

    // ARIA label locator
    if (attributes['aria-label'] || attributes['aria-labelledby']) {
      strategies.byLabel = attributes['aria-label'] || attributes['aria-labelledby'];
    }

    // CSS selector
    strategies.css = this.generateCSSSelector(tagName, attributes);

    // XPath selector
    strategies.xpath = this.generateXPathSelector(tagName, attributes);

    return strategies;
  }

  generateCSSSelector(tagName, attributes) {
    if (attributes.id) {
      return `#${attributes.id}`;
    }

    let selector = tagName;

    // Add classes (limit to first 2 for simplicity)
    if (attributes.class) {
      const classes = attributes.class.split(' ').filter(c => c.trim()).slice(0, 2);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    // Add role attribute
    if (attributes.role) {
      selector += `[role="${attributes.role}"]`;
    }

    // Add type for inputs
    if (attributes.type && tagName === 'input') {
      selector += `[type="${attributes.type}"]`;
    }

    return selector;
  }

  generateXPathSelector(tagName, attributes) {
    if (attributes.id) {
      return `//*[@id="${attributes.id}"]`;
    }

    if (attributes['data-testid']) {
      return `//${tagName}[@data-testid="${attributes['data-testid']}"]`;
    }

    if (attributes.role) {
      return `//${tagName}[@role="${attributes.role}"]`;
    }

    if (attributes.type && tagName === 'input') {
      return `//input[@type="${attributes.type}"]`;
    }

    return `//${tagName}`;
  }

  /**
   * Complete element analysis combining all detection methods
   */
  async analyzeElement(element, index = 0) {
    try {
      // Extract all attributes
      const attributes = await this.extractAttributes(element, index);
      
      // Detect element tag
      const tagName = this.detectElementTag(attributes);
      
      // Get text content safely
      let textContent = '';
      try {
        textContent = await element.textContent() || '';
        if (textContent.length > 500) {
          textContent = textContent.substring(0, 500) + '...';
        }
      } catch (error) {
        console.warn(`⚠️ Could not get textContent for element ${index}: ${error.message}`);
      }
      
      // Generate semantic data
      const semanticData = this.generateSemanticData(tagName, attributes, textContent);
      
      // Generate locator strategies
      const locatorStrategies = this.generateLocatorStrategies(tagName, attributes, textContent);
      
      return {
        tagName,
        attributes,
        textContent: textContent.trim(),
        semanticData,
        locatorStrategies,
        detectionConfidence: this.calculateDetectionConfidence(tagName, attributes)
      };
    } catch (error) {
      console.error(`❌ Error analyzing element ${index}: ${error.message}`);
      return {
        tagName: 'div',
        attributes: {},
        textContent: '',
        semanticData: {},
        locatorStrategies: {},
        detectionConfidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate confidence level of tag detection
   */
  calculateDetectionConfidence(tagName, attributes) {
    let confidence = 0.5; // Base confidence for fallback 'div'

    // High confidence indicators
    if (attributes.href && tagName === 'a') confidence = 0.95;
    if (attributes.src && tagName === 'img') confidence = 0.9;
    if (attributes.type && tagName === 'input') confidence = 0.85;
    if (attributes.action && tagName === 'form') confidence = 0.9;
    if (attributes.for && tagName === 'label') confidence = 0.85;
    
    // Role-based confidence
    if (attributes.role) {
      confidence = Math.max(confidence, 0.8);
    }
    
    // ID and classes increase confidence slightly
    if (attributes.id) confidence += 0.05;
    if (attributes.class) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }
}