/**
 * Terminal Shell Interactive Functionality
 * Handles syntax highlighting and copy functionality
 */

(function() {
  'use strict';

  /**
   * Syntax highlighting patterns for shell commands
   */
  const SYNTAX_PATTERNS = {
    // Command keywords (create, delete, modify, list, show, net, tunnels, etc.)
    keyword: /\b(create|delete|modify|list|show|net|tunnels|tunnel|profile|local-address|remote-address|gre|vlan|self|route|virtual|pool|monitor|node|member|ltm)\b/g,

    // Flags and options
    flag: /(--?[\w-]+)/g,

    // Variable placeholders (xVARIABLEx pattern)
    variable: /x[A-Z_0-9]+x/g,

    // IP addresses and CIDR notation
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g,

    // IPv6 addresses
    ipv6Address: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,

    // Backslash continuation
    continuation: /\\\s*$/gm,

    // Comments
    comment: /#.*/g
  };

  /**
   * Apply syntax highlighting by creating DOM elements
   */
  function applySyntaxHighlighting(text, container) {
    // Split text into tokens and apply highlighting
    const tokens = [];
    let lastIndex = 0;

    // Helper to add token
    function addToken(start, end, className) {
      if (start < end) {
        tokens.push({
          text: text.substring(start, end),
          className: className
        });
      }
    }

    // Find all matches for each pattern
    const matches = [];

    // Collect all pattern matches with their positions
    Object.entries(SYNTAX_PATTERNS).forEach(([type, pattern]) => {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: type,
          text: match[0]
        });
      }
    });

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Build tokens, handling overlaps
    matches.forEach(match => {
      // Add any text before this match
      if (lastIndex < match.start) {
        addToken(lastIndex, match.start, null);
      }

      // Add the highlighted match (skip if overlapping)
      if (match.start >= lastIndex) {
        tokens.push({
          text: match.text,
          className: `terminal-${match.type}`
        });
        lastIndex = match.end;
      }
    });

    // Add any remaining text
    if (lastIndex < text.length) {
      addToken(lastIndex, text.length, null);
    }

    // Create DOM elements for each token
    tokens.forEach(token => {
      if (token.className) {
        const span = document.createElement('span');
        span.className = token.className;
        span.textContent = token.text;
        container.appendChild(span);
      } else {
        container.appendChild(document.createTextNode(token.text));
      }
    });
  }

  /**
   * Transform a code block into terminal structure
   */
  function transformCodeBlock(codeBlock) {
    const code = codeBlock.querySelector('code');
    if (!code) return;

    // Get the raw text content
    const rawText = code.textContent;

    // Split into lines
    const lines = rawText.split('\n').filter(line => line.trim());

    // Create terminal structure
    const terminal = document.createElement('div');
    terminal.className = 'terminal-shell';
    terminal.setAttribute('role', 'region');
    terminal.setAttribute('aria-label', 'Shell command terminal');

    // Create chrome (titlebar)
    const chrome = document.createElement('div');
    chrome.className = 'terminal-chrome';
    chrome.innerHTML = `
      <div class="terminal-controls">
        <div class="terminal-control close" role="button" aria-label="Close" tabindex="0"></div>
        <div class="terminal-control minimize" role="button" aria-label="Minimize" tabindex="0"></div>
        <div class="terminal-control maximize" role="button" aria-label="Maximize" tabindex="0"></div>
      </div>
      <div class="terminal-title">bash</div>
      <button class="terminal-copy" aria-label="Copy to clipboard">Copy</button>
    `;

    // Create content area
    const content = document.createElement('div');
    content.className = 'terminal-content';

    // Create lines with syntax highlighting
    lines.forEach((line, index) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'terminal-line';

      // Check if this is a continuation line (previous line ended with \)
      const isContinuation = index > 0 && lines[index - 1].trim().endsWith('\\');

      const prompt = document.createElement('span');
      if (isContinuation) {
        prompt.className = 'terminal-prompt terminal-prompt-continuation';
      } else {
        prompt.className = 'terminal-prompt';
      }
      prompt.setAttribute('aria-hidden', 'true');

      const command = document.createElement('span');
      command.className = 'terminal-command';

      // Use DOM-based highlighting instead of innerHTML
      applySyntaxHighlighting(line, command);

      lineDiv.appendChild(prompt);
      lineDiv.appendChild(command);
      content.appendChild(lineDiv);
    });

    // Assemble terminal
    terminal.appendChild(chrome);
    terminal.appendChild(content);

    // Replace original code block
    codeBlock.parentNode.replaceChild(terminal, codeBlock);

    // Add copy functionality
    const copyButton = chrome.querySelector('.terminal-copy');
    copyButton.addEventListener('click', () => copyToClipboard(rawText, copyButton));

    // Add keyboard support for control buttons
    const controls = chrome.querySelectorAll('.terminal-control');
    controls.forEach(control => {
      control.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          control.click();
        }
      });
    });
  }

  /**
   * Copy text to clipboard with visual feedback
   */
  async function copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);

      // Visual feedback
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      button.textContent = 'Failed';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 2000);
    }
  }

  /**
   * Check if code block contains shell commands
   */
  function isShellCodeBlock(codeElement) {
    const text = codeElement.textContent;
    // Check for common shell command patterns
    const shellPatterns = [
      /\bcreate\s+net\s+/,
      /\bmodify\s+net\s+/,
      /\bdelete\s+net\s+/,
      /\bshow\s+net\s+/,
      /\blist\s+ltm\s+/,
      /\bcreate\s+ltm\s+/,
      /^\s*tmsh\s*$/m,
      /\[root@.*\]#/
    ];
    return shellPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Initialize terminal styling on page load
   */
  function initializeTerminals() {
    console.log('[Terminal] Initializing terminal styling...');
    // Find all code blocks
    const allCodeBlocks = document.querySelectorAll('pre code');
    console.log(`[Terminal] Found ${allCodeBlocks.length} code blocks`);

    let transformedCount = 0;
    allCodeBlocks.forEach(codeBlock => {
      const pre = codeBlock.closest('pre');
      // Only transform if it's a shell command block and not already transformed
      if (pre && !pre.classList.contains('terminal-shell') && isShellCodeBlock(codeBlock)) {
        console.log('[Terminal] Transforming shell code block');
        transformCodeBlock(pre);
        transformedCount++;
      }
    });
    console.log(`[Terminal] Transformed ${transformedCount} shell code blocks`);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTerminals);
  } else {
    initializeTerminals();
  }

  // Re-initialize for dynamically added content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          const allCodeBlocks = node.querySelectorAll?.('pre code');
          allCodeBlocks?.forEach(codeBlock => {
            const pre = codeBlock.closest('pre');
            if (pre && !pre.classList.contains('terminal-shell') && isShellCodeBlock(codeBlock)) {
              transformCodeBlock(pre);
            }
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
