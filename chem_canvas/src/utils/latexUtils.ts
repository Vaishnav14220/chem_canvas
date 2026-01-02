/**
 * Extracts and sanitizes LaTeX code from a string that might contain:
 * - Markdown code blocks (```latex ... ``` or just ``` ... ```)
 * - ReAct methodology markers (THOUGHT:, ACTION:, OBSERVATION:)
 * - Other non-LaTeX commentary
 * 
 * Optimized for large documents (4000+ lines) generated via streaming.
 */

/**
 * Find the longest match from an array of strings
 */
const findLongestMatch = (matches: string[]): string => {
    if (!matches.length) return '';
    return matches.reduce((longest, current) => (current.length > longest.length ? current : longest), '');
};

/**
 * Check if a line is a ReAct methodology marker or non-LaTeX commentary
 */
const isNonLatexLine = (line: string): boolean => {
    const trimmed = line.trim();

    // ReAct methodology markers
    if (/^(THOUGHT|ACTION|OBSERVATION|REASONING|ANALYSIS|NOTE|OUTPUT|ANSWER)\s*:/i.test(trimmed)) {
        return true;
    }

    // Markdown headers (unless it's a LaTeX comment)
    if (/^#{1,6}\s+/.test(trimmed) && !trimmed.startsWith('%')) {
        return true;
    }

    // Common conversational prefixes that aren't LaTeX
    if (/^(Here is|Below is|The following|I've generated|Let me|Now I will|This section)/i.test(trimmed)) {
        return true;
    }

    return false;
};

/**
 * Main extraction function - extracts pure LaTeX from mixed content
 */
export const extractLatexCode = (text: string): string => {
    if (!text) return '';

    const fileContent = text.trim();

    // Strategy 1: If the content contains markdown code blocks, extract from them
    // This regex handles multiple code blocks and concatenates their content
    const codeBlockRegex = /```(?:latex|tex)?\s*([\s\S]*?)\s*```/gi;
    const codeBlockMatches = Array.from(fileContent.matchAll(codeBlockRegex))
        .map(match => match[1]?.trim())
        .filter((match): match is string => Boolean(match && match.length > 0));

    if (codeBlockMatches.length > 0) {
        // If there are multiple code blocks, check if we should concatenate or use longest
        // For LaTeX, we typically want the one with \documentclass...\end{document}
        const fullDocMatch = codeBlockMatches.find(m =>
            m.includes('\\documentclass') && m.includes('\\end{document}')
        );
        if (fullDocMatch) {
            return fullDocMatch;
        }
        // Otherwise return the longest
        return findLongestMatch(codeBlockMatches);
    }

    // Strategy 2: Look for complete LaTeX document structure
    // Uses a more robust approach for very large documents
    const docClassIndex = fileContent.indexOf('\\documentclass');
    const endDocIndex = fileContent.lastIndexOf('\\end{document}');

    if (docClassIndex !== -1 && endDocIndex !== -1 && endDocIndex > docClassIndex) {
        // Extract from \documentclass to the end of \end{document}
        const endDocComplete = endDocIndex + '\\end{document}'.length;
        return fileContent.substring(docClassIndex, endDocComplete);
    }

    // Strategy 3: If starts with \documentclass, assume it's all LaTeX (might be missing \end{document})
    if (fileContent.includes('\\documentclass')) {
        const docClassIdx = fileContent.indexOf('\\documentclass');
        return fileContent.substring(docClassIdx);
    }

    // Fallback: return as-is (might be a partial LaTeX section)
    return fileContent;
};

/**
 * Sanitize LaTeX output by removing non-LaTeX content
 * Handles large documents efficiently by processing line-by-line only when needed
 */
export const sanitizeLatexOutput = (text: string): string => {
    if (!text) return '';

    // First, extract the LaTeX portion
    let extracted = extractLatexCode(text);
    if (!extracted) return '';

    // Quick cleanup: remove any remaining markdown code block markers
    extracted = extracted
        .replace(/```(?:latex|tex)?/gi, '')
        .replace(/```/g, '');

    // Check if the content has ReAct markers that need line-by-line cleaning
    const hasReactMarkers = /(THOUGHT|ACTION|OBSERVATION|REASONING|ANALYSIS):/i.test(extracted);

    if (hasReactMarkers) {
        // Process line-by-line to remove non-LaTeX lines
        const lines = extracted.split('\n');
        const cleanedLines: string[] = [];
        let inLatexEnvironment = false;

        for (const line of lines) {
            // Track if we're inside a LaTeX environment
            if (/\\begin\{/.test(line)) {
                inLatexEnvironment = true;
            }
            if (/\\end\{/.test(line)) {
                inLatexEnvironment = false;
            }

            // Keep the line if:
            // 1. It's a LaTeX command (starts with \)
            // 2. It's a LaTeX comment (starts with %)
            // 3. It's inside a LaTeX environment
            // 4. It's not identified as a non-LaTeX line
            // 5. It's an empty line (preserves formatting)
            const trimmed = line.trim();
            const isLatexCommand = trimmed.startsWith('\\') || trimmed.startsWith('%');
            const isEmpty = trimmed === '';
            const isNonLatex = isNonLatexLine(line);

            if (inLatexEnvironment || isLatexCommand || isEmpty || !isNonLatex) {
                cleanedLines.push(line);
            }
        }

        extracted = cleanedLines.join('\n');
    }

    // Final cleanup: normalize multiple newlines but preserve structure
    return extracted
        .replace(/\n{4,}/g, '\n\n\n')  // Allow up to 3 consecutive newlines for section breaks
        .trim();
};

/**
 * Validate that the LaTeX content has a proper document structure
 */
export const isCompleteLatexDocument = (text: string): boolean => {
    if (!text) return false;
    return text.includes('\\documentclass') && text.includes('\\end{document}');
};

/**
 * Count the number of lines in the LaTeX content
 */
export const countLatexLines = (text: string): number => {
    if (!text) return 0;
    return text.split('\n').length;
};
