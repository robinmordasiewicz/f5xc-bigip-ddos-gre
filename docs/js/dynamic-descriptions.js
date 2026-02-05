/**
 * Dynamic Placeholder Descriptions
 * Updates placeholder descriptions, document content, and Mermaid diagrams when selections change
 */
(function() {
  'use strict';

  // Patterns to match for each center in document text
  var CENTER_1_PATTERNS = ['Center 1', 'center 1'];
  var CENTER_2_PATTERNS = ['Center 2', 'center 2'];

  // Data center pattern - will be set based on initial value
  var DC_NAME_PATTERN = null;

  // Store original text content
  var originalTableDescriptions = {};
  var originalTextNodes = [];

  // Store Mermaid diagram data (captured before Mermaid transforms them)
  var mermaidDiagrams = [];

  // Track current placeholder values
  var currentValues = {};

  // CIDR prefix length to dotted-decimal netmask mapping
  var CIDR_TO_NETMASK = {
    '/24': '255.255.255.0',
    '/23': '255.255.254.0',
    '/22': '255.255.252.0',
    '/21': '255.255.248.0'
  };

  // Flag to track if Mermaid is ready for re-rendering
  var mermaidReady = false;

  // Unique ID counter for mermaid diagrams
  var mermaidIdCounter = 0;

  // Debounce timer for Mermaid updates
  var mermaidUpdateTimer = null;

  // Flag to prevent overlapping update cycles
  var isUpdatingMermaid = false;

  // Debounce function to prevent rapid-fire re-renders
  function debounce(func, wait) {
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(mermaidUpdateTimer);
      mermaidUpdateTimer = setTimeout(function() {
        func.apply(context, args);
      }, wait);
    };
  }

  // Load Mermaid diagram data from the injected global variable
  // This data was injected by the Python hook before any JavaScript runs
  function captureMermaidData() {
    if (window.__MERMAID_DIAGRAMS__ && Array.isArray(window.__MERMAID_DIAGRAMS__)) {
      window.__MERMAID_DIAGRAMS__.forEach(function(diagram, idx) {
        var diagramId = 'dynamic-mermaid-' + idx;
        mermaidDiagrams.push({
          id: diagramId,
          index: diagram.index,
          mappings: diagram.mappings || {},
          originalSource: diagram.originalSource
        });
      });
    }
  }

  // Assign stable IDs to all mermaid containers for tracking
  function assignMermaidIds() {
    var containers = document.querySelectorAll('.mermaid');
    mermaidDiagrams.forEach(function(diagram) {
      var container = containers[diagram.index];
      if (container && !container.hasAttribute('data-diagram-id')) {
        container.setAttribute('data-diagram-id', diagram.id);
      }
    });
  }

  // Get all table rows with inputs
  function getTableRows() {
    var table = document.querySelector('table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr'));
  }

  // Get the inputs from the placeholder table
  function getInputs() {
    var table = document.querySelector('table');
    if (!table) return { center1: null, center2: null, dcName: null, cidrSelect: null, allInputs: [], allSelects: [] };

    var selects = table.querySelectorAll('select');
    var textInputs = table.querySelectorAll('input[type="text"], input:not([type])');

    // DC_NAME is the first text input with "data center name" in description
    var dcNameInput = null;
    for (var i = 0; i < textInputs.length; i++) {
      var row = textInputs[i].closest('tr');
      if (row) {
        var descCell = row.querySelector('td:first-child');
        if (descCell && descCell.textContent.toLowerCase().indexOf('data center name') !== -1) {
          dcNameInput = textInputs[i];
          break;
        }
      }
    }

    // Find CIDR select by looking for "prefix length" in description
    var cidrSelect = null;
    for (var j = 0; j < selects.length; j++) {
      var row = selects[j].closest('tr');
      if (row) {
        var descCell = row.querySelector('td:first-child');
        if (descCell && descCell.textContent.toLowerCase().indexOf('prefix length') !== -1) {
          cidrSelect = selects[j];
          break;
        }
      }
    }

    return {
      center1: selects[0] || null,
      center2: selects[1] || null,
      dcName: dcNameInput,
      cidrSelect: cidrSelect,
      allInputs: Array.from(textInputs),
      allSelects: Array.from(selects)
    };
  }

  // Get selected display text from a select element
  function getSelectedText(selectEl) {
    if (!selectEl) return null;
    var option = selectEl.options[selectEl.selectedIndex];
    return option ? option.text : null;
  }

  // Get selected value from a select element
  function getSelectedValue(selectEl) {
    if (!selectEl) return null;
    return selectEl.value || null;
  }

  // Get value from text input
  function getInputValue(inputEl) {
    if (!inputEl) return null;
    return inputEl.value || null;
  }

  // Store original description for a table row
  function storeOriginalTableDesc(rowIndex, text) {
    if (originalTableDescriptions[rowIndex] === undefined) {
      originalTableDescriptions[rowIndex] = text;
    }
  }

  // Find all text nodes in document containing our patterns
  function findTextNodes(inputs) {
    if (originalTextNodes.length > 0) return;

    var article = document.querySelector('article.md-content__inner');
    if (!article) return;

    var initialDcName = getInputValue(inputs.dcName);
    if (initialDcName) {
      DC_NAME_PATTERN = initialDcName + ' Data Center';
    }

    var walker = document.createTreeWalker(
      article,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          var parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          var tagName = parent.tagName.toUpperCase();
          if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'OPTION' ||
              tagName === 'SELECT' || tagName === 'INPUT') {
            return NodeFilter.FILTER_REJECT;
          }

          if (parent.closest('table')) {
            return NodeFilter.FILTER_REJECT;
          }

          var text = node.textContent;
          var hasPattern =
            CENTER_1_PATTERNS.some(function(p) { return text.indexOf(p) !== -1; }) ||
            CENTER_2_PATTERNS.some(function(p) { return text.indexOf(p) !== -1; }) ||
            (DC_NAME_PATTERN && text.indexOf(DC_NAME_PATTERN) !== -1);

          return hasPattern ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    var node;
    while (node = walker.nextNode()) {
      originalTextNodes.push({
        node: node,
        originalText: node.textContent
      });
    }
  }

  // Update table descriptions that match patterns
  function updateTableDescriptions(patterns, newValue) {
    if (!newValue || !patterns) return;

    var rows = getTableRows();
    rows.forEach(function(row, index) {
      var descCell = row.querySelector('td:first-child');
      if (!descCell) return;

      var currentText = descCell.textContent;
      storeOriginalTableDesc(index, currentText);

      var originalText = originalTableDescriptions[index];
      var patternsArray = Array.isArray(patterns) ? patterns : [patterns];

      patternsArray.forEach(function(pattern) {
        if (originalText.indexOf(pattern) !== -1) {
          var newText = originalText.split(pattern).join(newValue);
          descCell.textContent = newText;
        }
      });
    });
  }

  // Update text nodes in document content
  function updateDocumentContent(center1Name, center2Name, dcName) {
    originalTextNodes.forEach(function(item) {
      var newText = item.originalText;

      if (center1Name) {
        CENTER_1_PATTERNS.forEach(function(pattern) {
          newText = newText.split(pattern).join(center1Name);
        });
      }

      if (center2Name) {
        CENTER_2_PATTERNS.forEach(function(pattern) {
          newText = newText.split(pattern).join(center2Name);
        });
      }

      if (dcName && DC_NAME_PATTERN) {
        var newDcPattern = dcName + ' Data Center';
        newText = newText.split(DC_NAME_PATTERN).join(newDcPattern);
      }

      if (newText !== item.node.textContent) {
        item.node.textContent = newText;
      }
    });
  }

  // Reset all content to original
  function resetToOriginal() {
    var rows = getTableRows();
    rows.forEach(function(row, index) {
      var descCell = row.querySelector('td:first-child');
      if (descCell && originalTableDescriptions[index]) {
        descCell.textContent = originalTableDescriptions[index];
      }
    });

    originalTextNodes.forEach(function(item) {
      item.node.textContent = item.originalText;
    });
  }

  // Update all content with current values
  function updateAll(inputs) {
    resetToOriginal();

    var center1Name = getSelectedText(inputs.center1);
    var center2Name = getSelectedText(inputs.center2);
    var dcName = getInputValue(inputs.dcName);

    if (center1Name) {
      updateTableDescriptions(CENTER_1_PATTERNS, center1Name);
    }
    if (center2Name) {
      updateTableDescriptions(CENTER_2_PATTERNS, center2Name);
    }

    updateDocumentContent(center1Name, center2Name, dcName);
  }

  // Collect current values from all form inputs
  function collectCurrentValues(inputs) {
    var values = {};

    // Get center codes
    values.CENTER_1 = getSelectedValue(inputs.center1);
    values.CENTER_2 = getSelectedValue(inputs.center2);
    values.DC_NAME = getInputValue(inputs.dcName);

    // Get CIDR selection and compute netmask
    var cidrValue = getSelectedValue(inputs.cidrSelect);
    if (cidrValue) {
      values.PROTECTED_CIDR_V4 = cidrValue;
      values.PROTECTED_MASK_V4 = CIDR_TO_NETMASK[cidrValue] || '255.255.255.0';
    }

    // Track position for XC fields (first = C1, second = C2)
    var xcOuterV4Count = 0;
    var xcOuterV6Count = 0;

    // Get all text input values and map them to placeholder names
    inputs.allInputs.forEach(function(input) {
      var row = input.closest('tr');
      if (!row) return;

      var descCell = row.querySelector('td:first-child');
      if (!descCell) return;

      var desc = descCell.textContent.trim().toLowerCase();
      var value = input.value;

      // Map descriptions to placeholder names (matching the data-placeholder-mappings keys)
      // Use position-based matching for XC fields since center names are dynamic
      if (desc.indexOf('xc') !== -1 && desc.indexOf('scrubbing') !== -1 && desc.indexOf('outer') !== -1 && desc.indexOf('ipv4') !== -1) {
        xcOuterV4Count++;
        if (xcOuterV4Count === 1) {
          values.XC_C1_OUTER_V4 = value;
        } else if (xcOuterV4Count === 2) {
          values.XC_C2_OUTER_V4 = value;
        }
      } else if (desc.indexOf('xc') !== -1 && desc.indexOf('scrubbing') !== -1 && desc.indexOf('outer') !== -1 && desc.indexOf('ipv6') !== -1) {
        xcOuterV6Count++;
        if (xcOuterV6Count === 1) {
          values.XC_C1_OUTER_V6 = value;
        } else if (xcOuterV6Count === 2) {
          values.XC_C2_OUTER_V6 = value;
        }
      } else if (desc.indexOf('big-ip-a') !== -1 && desc.indexOf('outer') !== -1 && desc.indexOf('ipv4') !== -1) {
        values.BIGIP_A_OUTER_V4 = value;
      } else if (desc.indexOf('big-ip-b') !== -1 && desc.indexOf('outer') !== -1 && desc.indexOf('ipv4') !== -1) {
        values.BIGIP_B_OUTER_V4 = value;
      } else if (desc.indexOf('big-ip-a') !== -1 && desc.indexOf('outer') !== -1 && desc.indexOf('ipv6') !== -1) {
        values.BIGIP_A_OUTER_V6 = value;
      } else if (desc.indexOf('big-ip-b') !== -1 && desc.indexOf('outer') !== -1 && desc.indexOf('ipv6') !== -1) {
        values.BIGIP_B_OUTER_V6 = value;
      } else if (desc.indexOf('protected') !== -1 && desc.indexOf('ipv4') !== -1 && desc.indexOf('network address') !== -1) {
        values.PROTECTED_NET_V4 = value;
      } else if (desc.indexOf('protected') !== -1 && desc.indexOf('ipv6') !== -1 && desc.indexOf('cidr') !== -1) {
        values.PROTECTED_PREFIX_V6 = value;
      } else if (desc.indexOf('data center name') !== -1) {
        values.DC_NAME = value;
      }
    });

    // Build PROTECTED_PREFIX_V4 from network address and CIDR if both exist
    if (values.PROTECTED_NET_V4 && values.PROTECTED_CIDR_V4) {
      values.PROTECTED_PREFIX_V4 = values.PROTECTED_NET_V4 + values.PROTECTED_CIDR_V4;
    }

    return values;
  }

  // Decode HTML entities in a string
  function decodeHtmlEntities(str) {
    var textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }

  // Substitute placeholder values in mermaid source code
  function substitutePlaceholders(source, mappings, newValues) {
    var result = source;

    // For each placeholder in the mappings, replace the original value with the new value
    Object.keys(mappings).forEach(function(placeholderName) {
      var originalValue = mappings[placeholderName];
      var newValue = newValues[placeholderName];

      if (newValue && originalValue !== newValue) {
        // Use global replace
        result = result.split(originalValue).join(newValue);
      }
    });

    return result;
  }

  // Re-render a Mermaid diagram with updated values using mermaid.run()
  function rerenderMermaidDiagram(diagramData, newValues, callback) {
    if (typeof mermaid === 'undefined' || !mermaid.run) {
      if (callback) callback();
      return;
    }

    // Find the container by its stable ID attribute (not by index)
    var container = document.querySelector('[data-diagram-id="' + diagramData.id + '"]');
    if (!container) {
      // Fallback to index-based lookup if ID not found (first render)
      var containers = document.querySelectorAll('.mermaid');
      container = containers[diagramData.index];
      if (!container) {
        if (callback) callback();
        return;
      }
    }

    // Decode HTML entities from the stored source (e.g., &gt; to >)
    var decodedSource = decodeHtmlEntities(diagramData.originalSource);

    // Substitute placeholder values in the decoded source
    var newSource = substitutePlaceholders(
      decodedSource,
      diagramData.mappings,
      newValues
    );

    // Create a new pre element with the updated mermaid source
    var newPre = document.createElement('pre');
    newPre.className = 'mermaid';
    newPre.textContent = newSource;
    // Preserve the stable ID for future lookups
    newPre.setAttribute('data-diagram-id', diagramData.id);

    // Replace the current container with the new pre element
    var parent = container.parentNode;
    if (!parent) {
      if (callback) callback();
      return;
    }
    parent.replaceChild(newPre, container);

    // Helper function to run mermaid with retry if needed
    function runMermaidWithRetry(element, retryCount) {
      mermaid.run({
        nodes: [element],
        suppressErrors: false
      }).then(function() {
        // Check if SVG was actually created
        var hasSvg = element.querySelector('svg') || element.tagName === 'SVG' ||
                     (element.parentNode && element.parentNode.querySelector('svg'));

        if (!hasSvg && retryCount > 0) {
          // SVG not created, retry after a short delay
          setTimeout(function() {
            // Re-find the element in case mermaid changed it
            var currentEl = document.querySelector('[data-diagram-id="' + diagramData.id + '"]');
            if (currentEl) {
              runMermaidWithRetry(currentEl, retryCount - 1);
            } else if (callback) {
              callback();
            }
          }, 100);
        } else {
          // Ensure the ID is preserved after mermaid transforms the element
          var rendered = parent.querySelector('.mermaid');
          if (rendered && !rendered.hasAttribute('data-diagram-id')) {
            rendered.setAttribute('data-diagram-id', diagramData.id);
          }
          if (callback) callback();
        }
      }).catch(function(err) {
        console.warn('Mermaid re-render error for ' + diagramData.id + ':', err);
        if (callback) callback();
      });
    }

    // Use requestAnimationFrame to ensure the element is painted before mermaid processes it
    // This prevents "getBoundingClientRect" errors from mermaid trying to measure unpainted elements
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        // Try up to 3 times to render the diagram
        runMermaidWithRetry(newPre, 3);
      });
    });
  }

  // Update all Mermaid diagrams with new values (sequentially)
  function updateMermaidDiagrams(inputs) {
    if (!mermaidReady || mermaidDiagrams.length === 0) return;

    // Prevent overlapping update cycles
    if (isUpdatingMermaid) {
      return;
    }
    isUpdatingMermaid = true;

    var newValues = collectCurrentValues(inputs);

    // Process diagrams sequentially to avoid race conditions
    function processNext(index) {
      if (index >= mermaidDiagrams.length) {
        currentValues = newValues;
        isUpdatingMermaid = false;
        return;
      }

      var diagramData = mermaidDiagrams[index];
      rerenderMermaidDiagram(diagramData, newValues, function() {
        // Add a small delay between diagrams to ensure DOM stability
        setTimeout(function() {
          processNext(index + 1);
        }, 100);
      });
    }

    processNext(0);
  }

  // Wait for Mermaid to be available
  function waitForMermaid(callback, maxAttempts) {
    maxAttempts = maxAttempts || 50;
    var attempts = 0;

    function check() {
      attempts++;
      if (typeof mermaid !== 'undefined' && mermaid.run) {
        mermaidReady = true;
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 100);
      } else {
        // Mermaid not available, continue without it
        callback();
      }
    }

    check();
  }

  // Initialize
  function init() {
    // IMPORTANT: Capture mermaid data FIRST, before Mermaid transforms the elements
    captureMermaidData();

    var inputs = getInputs();

    if (!inputs.center1 && !inputs.center2 && !inputs.dcName) {
      setTimeout(init, 100);
      return;
    }

    // Store initial values
    currentValues = collectCurrentValues(inputs);

    // Collect text nodes that need updating
    findTextNodes(inputs);

    // Initial update for document content
    updateAll(inputs);

    // Create debounced version of updateMermaidDiagrams (500ms delay)
    var debouncedUpdateMermaid = debounce(function() {
      updateMermaidDiagrams(inputs);
    }, 500);

    // Add change listeners for selects
    if (inputs.center1) {
      inputs.center1.addEventListener('change', function() {
        updateAll(inputs);
        debouncedUpdateMermaid();
      });
    }

    if (inputs.center2) {
      inputs.center2.addEventListener('change', function() {
        updateAll(inputs);
        debouncedUpdateMermaid();
      });
    }

    // Add input listener for DC name
    if (inputs.dcName) {
      inputs.dcName.addEventListener('input', function() {
        updateAll(inputs);
        debouncedUpdateMermaid();
      });
    }

    // Add input listeners for ALL text inputs (for IP addresses, etc.)
    inputs.allInputs.forEach(function(input) {
      if (input === inputs.dcName) return;

      input.addEventListener('input', function() {
        debouncedUpdateMermaid();
      });
    });

    // Add change listener for CIDR dropdown to auto-update netmask field
    if (inputs.cidrSelect) {
      inputs.cidrSelect.addEventListener('change', function() {
        var cidrValue = getSelectedValue(inputs.cidrSelect);
        var newMask = CIDR_TO_NETMASK[cidrValue] || '255.255.255.0';

        // Find and update the PROTECTED_MASK_V4 input field
        inputs.allInputs.forEach(function(input) {
          var row = input.closest('tr');
          if (!row) return;
          var descCell = row.querySelector('td:first-child');
          if (!descCell) return;
          var desc = descCell.textContent.trim().toLowerCase();
          if (desc.indexOf('protected') !== -1 && desc.indexOf('ipv4') !== -1 && desc.indexOf('subnet mask') !== -1) {
            input.value = newMask;
            // Trigger input event to ensure any other listeners are notified
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });

        debouncedUpdateMermaid();
      });
    }

    // Wait for Mermaid to be ready, then assign stable IDs to diagrams
    waitForMermaid(function() {
      // Wait a bit for Mermaid to finish rendering, then assign IDs
      setTimeout(function() {
        assignMermaidIds();
      }, 500);
    });
  }

  // Start IMMEDIATELY to capture pre.mermaid data before Mermaid runs
  // Don't wait for DOMContentLoaded as Mermaid might run before that
  if (document.readyState === 'loading') {
    // If still loading, add listener but also try to capture now
    captureMermaidData();
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * TOC Collapsible Sections with Auto-Expand on Scroll
 * - All sections collapsed by default on page load
 * - Auto-expands TOC section when user scrolls to corresponding content
 * - Auto-collapses when user scrolls away
 * - Preserves manual click-to-toggle with 3s override window
 * - WCAG compliant with aria-expanded attributes
 */
(function() {
  'use strict';

  // Configuration
  var CONFIG = {
    rootMargin: '-80px 0px -60% 0px', // Account for fixed header
    threshold: 0,
    debounceDelay: 100,
    manualOverrideTimeout: 3000 // 3 seconds
  };

  // State
  var headingToTocMap = new Map();
  var activeHeadings = new Set();
  var observer = null;
  var manualOverrides = new Map(); // Track manual toggle timestamps

  /**
   * Collapse a TOC item
   */
  function collapseItem(item) {
    if (!item || item.classList.contains('toc-collapsed')) return;

    var nestedNav = item.querySelector(':scope > .md-nav');
    var link = item.querySelector(':scope > .md-nav__link');

    item.classList.add('toc-collapsed');
    if (nestedNav) {
      nestedNav.style.maxHeight = '0';
    }
    if (link) {
      link.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Expand a TOC item
   */
  function expandItem(item) {
    if (!item || !item.classList.contains('toc-collapsed')) return;

    var nestedNav = item.querySelector(':scope > .md-nav');
    var link = item.querySelector(':scope > .md-nav__link');

    item.classList.remove('toc-collapsed');
    if (nestedNav) {
      nestedNav.style.maxHeight = nestedNav.scrollHeight + 'px';
    }
    if (link) {
      link.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Expand parent chain for nested sections
   */
  function expandParentChain(item) {
    var parent = item.parentElement;
    while (parent) {
      if (parent.classList.contains('md-nav__item')) {
        expandItem(parent);
      }
      parent = parent.parentElement;
    }
  }

  /**
   * Check if item has manual override active
   */
  function hasManualOverride(item) {
    var timestamp = manualOverrides.get(item);
    if (!timestamp) return false;

    var elapsed = Date.now() - timestamp;
    if (elapsed > CONFIG.manualOverrideTimeout) {
      manualOverrides.delete(item);
      return false;
    }
    return true;
  }

  /**
   * Build mapping from heading IDs to TOC items
   */
  function buildHeadingTocMap() {
    headingToTocMap.clear();

    var tocNav = document.querySelector('.md-nav--secondary');
    if (!tocNav) return;

    var tocLinks = tocNav.querySelectorAll('.md-nav__link');

    tocLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      var headingId = href.slice(1);
      var tocItem = link.closest('.md-nav__item');

      // Find the parent item with nested nav (the collapsible section)
      var parentWithNav = tocItem;
      while (parentWithNav) {
        var nestedNav = parentWithNav.querySelector(':scope > .md-nav');
        if (nestedNav) {
          headingToTocMap.set(headingId, parentWithNav);
          break;
        }
        // Check if this item itself is inside a collapsible section
        var parentItem = parentWithNav.parentElement?.closest('.md-nav__item');
        if (parentItem) {
          var parentNestedNav = parentItem.querySelector(':scope > .md-nav');
          if (parentNestedNav) {
            headingToTocMap.set(headingId, parentItem);
            break;
          }
        }
        parentWithNav = parentItem;
      }
    });
  }

  /**
   * Debounced intersection handler
   */
  var debounceTimer = null;
  function handleIntersection(entries) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      processIntersections(entries);
    }, CONFIG.debounceDelay);
  }

  /**
   * Process intersection entries
   */
  function processIntersections(entries) {
    entries.forEach(function(entry) {
      var headingId = entry.target.id;
      var tocItem = headingToTocMap.get(headingId);

      if (!tocItem) return;

      // Skip if manual override is active
      if (hasManualOverride(tocItem)) return;

      if (entry.isIntersecting) {
        activeHeadings.add(headingId);
        expandItem(tocItem);
        expandParentChain(tocItem);
      } else {
        activeHeadings.delete(headingId);

        // Only collapse if no other headings in this section are visible
        var shouldCollapse = true;
        headingToTocMap.forEach(function(item, id) {
          if (item === tocItem && activeHeadings.has(id)) {
            shouldCollapse = false;
          }
        });

        if (shouldCollapse) {
          collapseItem(tocItem);
        }
      }
    });
  }

  /**
   * Set up Intersection Observer for content headings
   */
  function setupIntersectionObserver() {
    if (observer) {
      observer.disconnect();
    }

    var headings = document.querySelectorAll('article h2[id], article h3[id], article h4[id]');
    if (headings.length === 0) return;

    observer = new IntersectionObserver(handleIntersection, {
      rootMargin: CONFIG.rootMargin,
      threshold: CONFIG.threshold
    });

    headings.forEach(function(heading) {
      observer.observe(heading);
    });
  }

  /**
   * Handle manual click toggle
   */
  function handleClickToggle(item, link, nestedNav) {
    link.addEventListener('click', function(e) {
      // Record manual override timestamp
      manualOverrides.set(item, Date.now());

      // Toggle state
      if (item.classList.contains('toc-collapsed')) {
        expandItem(item);
      } else {
        collapseItem(item);
      }
    });
  }

  /**
   * Initialize TOC collapse functionality
   */
  function initTocCollapse() {
    var tocNav = document.querySelector('.md-nav--secondary');
    if (!tocNav) return;

    // Build heading to TOC mapping
    buildHeadingTocMap();

    // Find all TOC items with nested children
    var parentItems = tocNav.querySelectorAll('.md-nav__item');

    parentItems.forEach(function(item) {
      var nestedNav = item.querySelector(':scope > .md-nav');
      if (!nestedNav) return;

      var link = item.querySelector(':scope > .md-nav__link');
      if (!link) return;

      // Set max-height for animation
      nestedNav.style.maxHeight = nestedNav.scrollHeight + 'px';

      // Collapse all sections by default
      collapseItem(item);

      // Add click handler for manual toggle
      handleClickToggle(item, link, nestedNav);
    });

    // Set up Intersection Observer for auto-expand
    setupIntersectionObserver();
  }

  /**
   * Cleanup function for MkDocs instant navigation
   */
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    headingToTocMap.clear();
    activeHeadings.clear();
    manualOverrides.clear();
    clearTimeout(debounceTimer);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initTocCollapse, 100);
    });
  } else {
    setTimeout(initTocCollapse, 100);
  }

  // Support MkDocs instant navigation
  if (typeof document$ !== 'undefined') {
    document$.subscribe(function() {
      cleanup();
      setTimeout(initTocCollapse, 100);
    });
  }
})();
