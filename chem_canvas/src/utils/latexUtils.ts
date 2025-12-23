/**
 * Extracts raw LaTeX code from a string that might contain markdown code blocks
 * or conversational text.
 * 
 * Strategies:
 * 1. Looks for markdown code blocks (```latex ... ``` or just ``` ... ```).
 * 2. Looks for standard LaTeX document structure (\documentclass ... \end{document}).
 * 3. Fallback: returns the original string if no specific pattern is found.
 */
export const extractLatexCode = (text: string): string => {
    if (!text) return '';

    // Strategy 1: Markdown code fences
    // Matches ```latex OR ``` followed by content, ending with ```
    // We use [\s\S] to match newlines
    const fileContent = text.trim();

    // Try to find the *last* code block if multiple exist, or just the first valid one?
    // Usually the main output is one big block.
    const codeBlockRegex = /```(?:latex)?\s*([\s\S]*?)\s*```/i;
    const codeBlockMatch = fileContent.match(codeBlockRegex);

    if (codeBlockMatch && codeBlockMatch[1]) {
        return codeBlockMatch[1].trim();
    }

    // Strategy 2: Explicit LaTeX document structure
    // Finds \documentclass up to \end{document}
    const latexRegex = /(\\documentclass[\s\S]*?\\end\{document\})/i;
    const latexMatch = fileContent.match(latexRegex);

    if (latexMatch && latexMatch[1]) {
        return latexMatch[1].trim();
    }

    // Fallback: If it looks like it starts with documentclass but missing fences
    if (fileContent.startsWith('\\documentclass')) {
        return fileContent;
    }

    return fileContent;
};
