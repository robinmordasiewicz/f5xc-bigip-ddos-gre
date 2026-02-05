"""
MkDocs hook to sanitize placeholder spans from Mermaid diagrams.
Runs after the placeholder plugin processes the HTML.

The mkdocs-placeholder-plugin injects HTML spans into ALL content,
including Mermaid code blocks. Mermaid.js expects plain text and fails
to parse the HTML spans. This hook:
1. Finds all <pre class="mermaid"> blocks
2. Strips the <span> elements, keeping only the text values
3. Stores placeholder mappings in a data-placeholder-mappings attribute
   for JavaScript to use when updating diagrams dynamically
4. Injects diagram data as inline script for early access
"""

import json
import html
import re
from typing import Dict, List, Tuple


# Match <pre class="mermaid">...<code>...</code></pre> blocks
# Handles both with and without <code> wrapper
MERMAID_BLOCK_PATTERN = re.compile(
    r'(<pre\s+class="mermaid"[^>]*>)\s*(?:(<code>)(.*?)(</code>)|(.*?))\s*(</pre>)',
    re.DOTALL | re.IGNORECASE
)

# Match placeholder spans - handles both attribute orderings
# Pattern: <span class="placeholder-value..." data-placeholder="NAME">VALUE</span>
PLACEHOLDER_SPAN_PATTERN = re.compile(
    r'<span\s+class="placeholder-value[^"]*"\s+data-placeholder="([^"]+)"[^>]*>([^<]*)</span>',
    re.IGNORECASE
)

# Alternative pattern: <span data-placeholder="NAME" class="placeholder-value...">VALUE</span>
PLACEHOLDER_SPAN_ALT_PATTERN = re.compile(
    r'<span\s+data-placeholder="([^"]+)"\s+class="placeholder-value[^"]*"[^>]*>([^<]*)</span>',
    re.IGNORECASE
)


def _sanitize_mermaid_content(content: str) -> Tuple[str, Dict[str, str]]:
    """
    Remove placeholder spans from mermaid content.

    Args:
        content: The raw content inside a mermaid block (may contain HTML spans)

    Returns:
        Tuple of (cleaned_content, mappings_dict)
        - cleaned_content: Content with spans replaced by their text values
        - mappings_dict: Dict mapping placeholder names to their current values
    """
    mappings: Dict[str, str] = {}

    def replace_span(match: re.Match) -> str:
        placeholder_name = match.group(1)
        value = match.group(2)
        mappings[placeholder_name] = value
        return value

    # Apply both patterns to catch all span variations
    cleaned = PLACEHOLDER_SPAN_PATTERN.sub(replace_span, content)
    cleaned = PLACEHOLDER_SPAN_ALT_PATTERN.sub(replace_span, cleaned)

    return cleaned, mappings


def on_page_content(html_content: str, page, config, files) -> str:
    """
    MkDocs hook that processes HTML after the placeholder plugin has run.

    This hook finds all mermaid blocks and:
    1. Removes placeholder <span> elements (keeping their text values)
    2. Stores the placeholder-to-value mappings in a data attribute
    3. Injects diagram data as inline script for JavaScript access

    Args:
        html_content: The page HTML content
        page: The MkDocs page object
        config: The MkDocs config
        files: The MkDocs files collection

    Returns:
        Modified HTML with sanitized mermaid blocks and inline script
    """
    # Collect all mermaid diagram data for inline script injection
    mermaid_diagrams: List[Dict] = []
    diagram_index = [0]  # Use list to allow modification in nested function

    def process_mermaid_block(match: re.Match) -> str:
        pre_open = match.group(1)
        # Group 2-4 for <code>...</code> wrapped content
        # Group 5 for direct content without <code>
        code_open = match.group(2) or ''
        content = match.group(3) if match.group(3) is not None else (match.group(5) or '')
        code_close = match.group(4) or ''
        pre_close = match.group(6)

        # Sanitize the mermaid content
        cleaned_content, mappings = _sanitize_mermaid_content(content)

        # Store diagram data for inline script
        if mappings:
            mermaid_diagrams.append({
                'index': diagram_index[0],
                'mappings': mappings,
                'originalSource': cleaned_content
            })

        # Add mappings and source code as data attributes
        if mappings:
            mappings_json = html.escape(json.dumps(mappings), quote=True)
            # Also store the cleaned source code for re-rendering
            source_escaped = html.escape(cleaned_content, quote=True)
            # Insert data attributes into the pre tag
            if 'data-placeholder-mappings' not in pre_open:
                pre_open = pre_open.replace(
                    'class="mermaid"',
                    f'class="mermaid" data-placeholder-mappings="{mappings_json}" data-mermaid-source="{source_escaped}"'
                )

        diagram_index[0] += 1
        return f"{pre_open}{code_open}{cleaned_content}{code_close}{pre_close}"

    # Process all mermaid blocks
    result = MERMAID_BLOCK_PATTERN.sub(process_mermaid_block, html_content)

    # Inject inline script with mermaid diagram data at the beginning
    if mermaid_diagrams:
        inline_script = f'''<script>
window.__MERMAID_DIAGRAMS__ = {json.dumps(mermaid_diagrams)};
</script>
'''
        result = inline_script + result

    return result
