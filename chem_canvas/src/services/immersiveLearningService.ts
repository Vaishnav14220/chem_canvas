import { generateTextContent, extractJsonBlock, generateEducationalImage, streamTextContent, generateMultiSpeakerAudio } from './geminiService';
import { AspectRatio, ImageSize } from '../types/studium';
import { fetchYouTubeVideos, YouTubeVideo } from './youtubeService';
import { fetchYouTubeTranscript, getVideoTranscriptWithTimestamps, VideoTranscript } from './youtubeTranscriptService';

// Default text model for Immersive Learning flows (document analysis, section generation, etc.)
const IMMERSIVE_TEXT_MODEL = 'gemini-3-flash-preview';

/**
 * Attempts to repair truncated or malformed JSON strings from AI responses.
 */
const repairJson = (jsonString: string): string => {
  let repaired = jsonString.trim();

  // Remove any trailing incomplete strings (unterminated quotes)
  // Find the last complete property value
  const lastCompleteIndex = Math.max(
    repaired.lastIndexOf('",'),
    repaired.lastIndexOf('"},'),
    repaired.lastIndexOf('"]'),
    repaired.lastIndexOf('"}'),
    repaired.lastIndexOf('" }'),
    repaired.lastIndexOf('"}]'),
    repaired.lastIndexOf('}]'),
    repaired.lastIndexOf('"}]}')
  );

  if (lastCompleteIndex > 0 && lastCompleteIndex < repaired.length - 10) {
    // Truncate to last complete value and try to close the JSON properly
    repaired = repaired.substring(0, lastCompleteIndex + 1);
  }

  // Count brackets and braces
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
  }

  // Close any unclosed strings first
  if (inString) {
    repaired += '"';
  }

  // Close any unclosed brackets/braces
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  return repaired;
};

/**
 * Safely parses JSON with automatic repair for truncated responses.
 */
const safeJsonParse = <T>(jsonString: string, fallback: T): T => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn('Initial JSON parse failed, attempting repair...', e);
    try {
      // Step 1: Fix bad escapes (escape backslashes that aren't valid JSON escapes to preserve LaTeX)
      // We diligently replace \x where x is NOT a valid escape char with \\x
      const cleaned = jsonString.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');

      // Step 2: Handle truncation via existing repairJson
      const repaired = repairJson(cleaned);
      return JSON.parse(repaired);
    } catch (e2) {
      // Step 3: Minimal repair for JSON structure only
      try {
        const repairedMinimal = repairJson(jsonString);
        return JSON.parse(repairedMinimal);
      } catch (e3) {
        console.error('All JSON repair attempts failed:', e2);
        return fallback;
      }
    }
  }
};

export interface RankedYouTubeVideo extends YouTubeVideo {
  relevanceScore: number;
  relevanceReason: string;
  transcriptSummary?: string;
}

export interface InteractiveWidget {
  type: 'reveal' | 'comparison' | 'quiz' | 'fill-blank' | 'matching' | 'ordering' | 'labeling' | 'true-false' | 'reflection' | 'code-playground' | 'code-explanation';
  data: {
    title?: string;
    content?: string; // For reveal
    beforeLabel?: string; // For comparison
    afterLabel?: string; // For comparison
    beforeImagePrompt?: string; // For comparison
    afterImagePrompt?: string; // For comparison
    question?: string; // For quiz
    options?: string[]; // For quiz
    correctIndex?: number; // For quiz
    explanation?: string; // For quiz
    // For fill-blank:
    sentence?: string; // Sentence with {{BLANK}} markers
    answers?: string[]; // Correct answers for each blank
    // For matching:
    leftItems?: string[];
    rightItems?: string[];
    correctPairs?: number[]; // Index mapping left to right
    // For ordering:
    items?: string[];
    correctOrder?: number[];
    orderingContext?: string;
    // For labeling:
    labels?: string[];
    descriptions?: string[];
    // For true-false:
    statements?: { text: string; isTrue: boolean; explanation: string }[];
    // For reflection:
    reflectionPrompt?: string;
    sampleResponse?: string;
    // For code-playground (interactive code editor):
    code?: string; // The code to display/edit
    language?: string; // Programming language (python, javascript, etc.)
    expectedOutput?: string; // Expected output when code runs correctly
    hints?: string[]; // Hints for solving the problem
    challenge?: string; // Challenge description for the user
    // For code-explanation (step-by-step code walkthrough):
    codeLines?: { line: string; explanation: string }[]; // Line-by-line explanation
    codeLanguage?: string; // Language for syntax highlighting
    overallExplanation?: string; // Summary of what the code does
  };
}

export interface ImmersiveSection {
  id: string;
  title: string;
  content: string;
  imagePrompt?: string | null;
  widget?: InteractiveWidget;
}

export interface ImmersiveContent {
  title: string;
  summary?: string;
  sections: ImmersiveSection[];
  keyTerms: { term: string; definition: string }[];
  contextNotes: { paragraphIndex: number; note: string }[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export const analyzeDocumentForImmersive = async (text: string): Promise<ImmersiveContent> => {
  const prompt = `
    CRITICAL: You MUST analyze ONLY the provided text below. Do NOT add any external information, examples, or content that is not present in the provided text. Base your analysis STRICTLY on what is written in the document.
    
    Analyze the following educational text and structure it for an immersive learning experience (Target Audience: High School/Undergraduate).
    
    MANDATORY REQUIREMENTS:
    1. Extract and use ONLY the information present in the provided text
    2. Do NOT invent or add examples that are not in the original document
    3. Do NOT add generic explanations - use only what the document says
    4. Preserve the exact terminology, concepts, and structure from the original document
    5. If the document is in German or another language, maintain that language in your analysis
    6. Focus ONLY on the specific topics, experiments, and concepts described in the provided text
    
    CRITICAL MARKDOWN FORMATTING REQUIREMENTS:
    - Use **double asterisks** around KEY TERMS and IMPORTANT WORDS that should be highlighted (e.g., **chemical kinetics**, **rate of reaction**)
    - Use *single asterisks* around EMPHASIS PHRASES or IMPORTANT SENTENCES that should be underlined (e.g., *This is a crucial concept to understand*)
    - Every paragraph MUST have at least 2-3 bold terms and 1-2 emphasized phrases
    - Bold terms should be scientific terms, key concepts, proper nouns, and important vocabulary
    - Emphasized text should be important explanations, key insights, or sentences the student should pay attention to
    
    MATHEMATICS CONTENT REQUIREMENTS:
    - If the content involves MATHEMATICS, FORMULAS, or EQUATIONS:
      - Use LaTeX notation for ALL mathematical expressions
      - Inline math: Use single dollar signs $...$ (e.g., "The quadratic formula is $x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$")
      - Block/display math: Use double dollar signs $$...$$ for important equations on their own line
      - CRITICAL: You MUST use DOUBLE BACKSLASHES for all LaTeX commands in the JSON string (e.g., \\\\alpha, \\\\int, \\\\frac).
      - Include step-by-step derivations where appropriate
      - Example: "$$\\int_a^b f(x)dx = F(b) - F(a)$$"
    
    🚨 PROGRAMMING CONTENT REQUIREMENTS (CRITICAL - MUST FOLLOW FOR ANY CODE/PROGRAMMING CONTENT):
    - If the content involves PROGRAMMING, CODING, FUNCTIONS, or ALGORITHMS:
      - ALWAYS use FENCED CODE BLOCKS with triple backticks and language specification
      - Format: Start with \`\`\`python (or javascript, java, etc.) on its own line, then code, then \`\`\` on its own line
      - NEVER show code inline like \`print()\` for examples - ALWAYS use full fenced code blocks
      - Every code example MUST be in a fenced code block, even simple one-liners
      - Include COMPLETE, RUNNABLE code with comments explaining each part
      - MANDATORY: Include at least ONE 'code-playground' widget for hands-on practice
      - MANDATORY: Include at least ONE 'code-explanation' widget for step-by-step walkthrough
      
      EXAMPLE of proper code block in content:
      "Here is how to use the print function:
      
      \`\`\`python
      # Basic print statement
      print('Hello, World!')
      
      # Print with multiple arguments
      print('My name is', 'Alice')
      
      # Print with custom separator
      print('apple', 'banana', 'cherry', sep=', ')
      \`\`\`
      
      The code above demonstrates..."
    
    Return a JSON object with the following structure:
    {
      "title": "Document Title",
      "summary": "A brief 2-3 sentence summary of the entire document.",
      "sections": [
        { 
          "id": "unique_id", 
          "title": "Section Title", 
          "content": "Full markdown text with **bold key terms** and *emphasized important phrases*. Include $inline math$ and $$block math$$ for mathematical content. REMEMBER TO DOUBLE ESCAPE BACKSLASHES (\\\\) FOR LATEX. For programming content, ALWAYS include full fenced code blocks like:\\n\\n\`\`\`python\\ncode here\\n\`\`\`\\n\\nAT LEAST 4 detailed paragraphs... Insert {{INTERACTIVE_WIDGET}} marker where the widget should appear.",
          "imagePrompt": null,
          "widget": {
            "type": "reveal" | "fill-blank" | "matching" | "ordering" | "labeling" | "true-false" | "quiz" | "reflection" | "code-playground" | "code-explanation",
            "data": {
              // For 'reveal':
              "title": "Did you know?",
              "content": "Surprising fact or hidden detail...",
              
              // For 'fill-blank' (fill in the blanks exercise):
              "title": "Complete the sentence",
              "sentence": "The process of {{BLANK}} converts {{BLANK}} into energy.",
              "answers": ["photosynthesis", "sunlight"],
              
              // For 'matching' (match items from two columns):
              "title": "Match the terms",
              "leftItems": ["Term 1", "Term 2", "Term 3"],
              "rightItems": ["Definition A", "Definition B", "Definition C"],
              "correctPairs": [0, 1, 2],
              
              // For 'ordering' (arrange items in correct sequence):
              "title": "Arrange in order",
              "orderingContext": "Steps of the process",
              "items": ["Step 1", "Step 2", "Step 3"],
              "correctOrder": [0, 1, 2],
              
              // For 'labeling' (match labels to descriptions):
              "title": "Label the parts",
              "labels": ["Part A", "Part B"],
              "descriptions": ["Description of A", "Description of B"],
              
              // For 'true-false' (evaluate statements):
              "title": "True or False?",
              "statements": [
                { "text": "Statement 1", "isTrue": true, "explanation": "Why..." },
                { "text": "Statement 2", "isTrue": false, "explanation": "Why..." }
              ],
              
              // For 'quiz' (multiple choice):
              "question": "Quick check: ...?",
              "options": ["A", "B", "C"],
              "correctIndex": 0,
              "explanation": "Why it's correct...",
              
              // For 'reflection' (open-ended thinking prompt):
              "title": "Reflect & Think",
              "reflectionPrompt": "How might this concept apply to...?",
              "sampleResponse": "A good response might consider...",
              
              // For 'code-playground' (interactive coding exercise - USE FOR PROGRAMMING CONTENT):
              "title": "Try It Yourself!",
              "code": "# Starter code here\\ndef example():\\n    pass",
              "language": "python",
              "challenge": "Modify the code to...",
              "expectedOutput": "Expected result...",
              "hints": ["Hint 1", "Hint 2"],
              
              // For 'code-explanation' (step-by-step code walkthrough - USE FOR EXPLAINING CODE):
              "title": "Code Walkthrough",
              "codeLanguage": "python",
              "overallExplanation": "This code demonstrates...",
              "codeLines": [
                { "line": "def factorial(n):", "explanation": "Define a function named factorial that takes n as parameter" },
                { "line": "    if n <= 1:", "explanation": "Base case: if n is 0 or 1, return 1" },
                { "line": "        return 1", "explanation": "Return 1 for the base case" },
                { "line": "    return n * factorial(n-1)", "explanation": "Recursive case: multiply n by factorial of (n-1)" }
              ]
            }
          }
        }
      ],
      "keyTerms": [
        { "term": "Term to underline", "definition": "Concise definition..." }
      ],
      "contextNotes": [
        { "paragraphIndex": 0, "note": "Interesting fact or context about this part..." }
      ]
    }

    Rules:
    1. Split text into AT LEAST 4 distinct logical sections (e.g., Introduction, Key Concepts, Application, Advanced Analysis, Conclusion).
    2. IMPORTANT: Each section's content MUST have AT LEAST 4 substantial paragraphs with detailed explanations.
    3. CRITICAL: Use markdown formatting throughout:
       - Wrap key terms in **double asterisks** for highlighting (minimum 3 per paragraph)
       - Wrap important phrases/sentences in *single asterisks* for underlining (minimum 1 per paragraph)
       - Example: "The **rate of reaction** depends on *several critical factors that we must understand*."
    4. MATHEMATICS: If the document contains math content:
       - Use $...$ for inline LaTeX math expressions
       - Use $$...$$ for block/display LaTeX equations
       - CRITICAL: ESCAPE ALL BACKSLASHES IN LATEX COMMANDS (e.g., \\\\frac, \\\\int)
       - Include ALL formulas, equations, and mathematical notation in proper LaTeX
       - Show step-by-step solutions where relevant
    5. PROGRAMMING: If the document contains programming/coding content:
       - Use \`\`\`language fenced code blocks for all code examples
       - Prefer 'code-playground' widget for practice exercises
       - Prefer 'code-explanation' widget for explaining how code works
       - Include complete, runnable code with comments
    6. For EACH section, include ONE interactive widget:
       - For MATH content: Use 'fill-blank', 'ordering' (for solving steps), or 'quiz'
       - For PROGRAMMING content: Use 'code-playground' or 'code-explanation'
       - For other content: Use appropriate widget type from the list
    7. Insert {{INTERACTIVE_WIDGET}} in the 'content' string where the widget should be rendered.
    8. DO NOT include imagePrompt for most sections - set to null. Only include imagePrompt for the FIRST section of the document.
    9. Focus on rich, detailed text content and engaging interactive activities instead of images.
    10. CRITICAL FOR imagePrompt: When providing an imagePrompt for the first section, it MUST be a detailed SCIENTIFIC and ACADEMIC description that would generate a textbook-quality illustration.

    CRITICAL INSTRUCTIONS FOR ANALYSIS:
    - Read the ENTIRE provided text carefully
    - Extract ONLY the concepts, facts, and information that are explicitly stated in the text
    - Do NOT add supplementary information, examples, or explanations that are not found in the text
    - Maintain the original language if the document is not in English (e.g., if it's German, keep it in German)
    - Preserve technical terms, formulas, and specific details exactly as they appear in the original document
    - Structure the content based on the logical flow and organization of the original document
    - If the document discusses specific experiments, sensors, or technical concepts, focus ONLY on what is described in the text
    - Do NOT invent examples or add generic educational content that is not in the original document
    
    Text to Analyze (EXTRACT AND USE ONLY THIS CONTENT - DO NOT ADD EXTERNAL INFORMATION):
    ${text.slice(0, 50000)}
    
    REMEMBER: Your response must be based STRICTLY on the text above. Do not add any information, examples, or explanations that are not present in the provided text. If the document is about a specific topic (like rotary encoders, sensors, etc.), focus ONLY on what is written about that topic in the provided text.
  `;

  const response = await generateTextContent(prompt, { model: IMMERSIVE_TEXT_MODEL });
  const json = extractJsonBlock(response);

  const fallbackContent: ImmersiveContent = {
    title: 'Immersive Learning Session',
    sections: [{
      id: 'fallback-1',
      title: 'Document Overview',
      content: text.slice(0, 500) + '...',
      imagePrompt: 'Scientific textbook-style diagram illustrating the main educational concept with accurate proportions, labeled components, professional academic quality, clean white background, publication-ready illustration'
    }],
    keyTerms: [],
    contextNotes: []
  };

  return safeJsonParse<ImmersiveContent>(json, fallbackContent);
};

/**
 * Streaming version of analyzeDocumentForImmersive.
 * Streams the response in real-time for a typewriter effect.
 */
export const streamAnalyzeDocumentForImmersive = async (
  text: string,
  onStreamUpdate: (streamedText: string, isComplete: boolean) => void
): Promise<ImmersiveContent> => {
  // Extract main topic from text to help guide the model
  const mainTopic = text.slice(0, 200).toLowerCase();
  const isGerman = /[äöüßÄÖÜ]/.test(text.slice(0, 500));
  const topicKeywords = [];
  if (mainTopic.includes('drehgeber') || mainTopic.includes('rotary encoder')) topicKeywords.push('rotary encoder/Drehgeber');
  if (mainTopic.includes('oszilloskop') || mainTopic.includes('oscilloscope')) topicKeywords.push('oscilloscope/Oszilloskop');
  if (mainTopic.includes('sensor')) topicKeywords.push('sensors');
  if (mainTopic.includes('funktionsgenerator') || mainTopic.includes('function generator')) topicKeywords.push('function generator');

  const prompt = `
    🚨🚨🚨 ABSOLUTE REQUIREMENT - READ THIS FIRST 🚨🚨🚨
    
    You are analyzing a SPECIFIC document. Your ONLY job is to extract and present information from the text provided below.
    
    CRITICAL RULES - VIOLATION WILL RESULT IN INCORRECT OUTPUT:
    1. Use ONLY information that appears in the provided text below
    2. Do NOT add ANY examples, explanations, or content that is not explicitly stated in the document
    3. Do NOT add generic educational content or common knowledge
    4. Do NOT invent scenarios, examples, or analogies
    5. ${topicKeywords.length > 0 ? `This document is about: ${topicKeywords.join(', ')}. Write ONLY about these topics as described in the text.` : 'Identify the main topic from the text and write ONLY about that topic.'}
    6. ${isGerman ? 'The document is in German. Keep your analysis in German.' : 'Maintain the original language of the document.'}
    7. Do NOT add information about topics NOT mentioned (e.g., if text is about electronics, do NOT add biology, chemistry, or unrelated content)
    8. Use the exact technical terms and terminology from the document
    9. If the document discusses specific experiments or equipment, discuss ONLY those specific items
    
    Analyze the following educational text and structure it for an immersive learning experience (Target Audience: High School/Undergraduate).
    
    MANDATORY REQUIREMENTS:
    1. Extract and use ONLY the information present in the provided text
    2. Do NOT invent or add examples that are not in the original document
    3. Do NOT add generic explanations - use only what the document says
    4. Preserve the exact terminology, concepts, and structure from the original document
    5. If the document is in German or another language, maintain that language in your analysis
    6. Focus ONLY on the specific topics mentioned in the document - do NOT add unrelated topics
    
    CRITICAL MARKDOWN FORMATTING REQUIREMENTS:
    - Use **double asterisks** around KEY TERMS and IMPORTANT WORDS that should be highlighted (e.g., **chemical kinetics**, **rate of reaction**)
    - Use *single asterisks* around EMPHASIS PHRASES or IMPORTANT SENTENCES that should be underlined (e.g., *This is a crucial concept to understand*)
    - Every paragraph MUST have at least 2-3 bold terms and 1-2 emphasized phrases
    - Bold terms should be scientific terms, key concepts, proper nouns, and important vocabulary
    - Emphasized text should be important explanations, key insights, or sentences the student should pay attention to
    
    MATHEMATICS CONTENT REQUIREMENTS (MANDATORY for math/science content):
    - If the content involves MATHEMATICS, PHYSICS FORMULAS, CHEMISTRY EQUATIONS, or any EQUATIONS:
      - Use LaTeX notation for ALL mathematical expressions - this is REQUIRED
      - Inline math: Use single dollar signs $...$ (e.g., "The quadratic formula is $x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$")
      - Block/display math: Use double dollar signs $$...$$ for important equations on their own line
      - CRITICAL: You MUST use DOUBLE BACKSLASHES for all LaTeX commands in the JSON string (e.g., \\\\alpha, \\\\int, \\\\frac).
      - ALWAYS show step-by-step derivations and solutions with LaTeX
      - Examples:
        - Inline: "The derivative $\\\\frac{dy}{dx}$ represents the rate of change"
        - Block: "$$\\\\int_a^b f(x)dx = F(b) - F(a)$$"
        - Chemistry: "$$\\text{2H}_2 + \\text{O}_2 \\\\rightarrow \\text{2H}_2\\text{O}$$"
        - Physics: "$$F = ma = m\\\\frac{d^2x}{dt^2}$$"
    
    🚨 PROGRAMMING CONTENT REQUIREMENTS (CRITICAL - MUST FOLLOW FOR ANY CODE/PROGRAMMING CONTENT):
    - If the content involves PROGRAMMING, CODING, FUNCTIONS, or ALGORITHMS:
      - ALWAYS use FENCED CODE BLOCKS with triple backticks and language specification
      - Format: Start with \`\`\`python (or javascript, java, etc.) on its own line, then code, then \`\`\` on its own line
      - NEVER show code inline like \`print()\` for examples - ALWAYS use full fenced code blocks
      - Every code example MUST be in a fenced code block, even simple one-liners
      - Include COMPLETE, RUNNABLE code with comments explaining each part
      - MANDATORY: Include at least ONE 'code-playground' widget for hands-on practice
      - MANDATORY: Include at least ONE 'code-explanation' widget for step-by-step walkthrough
      
      EXAMPLE of proper code block in content:
      "Here is how to use the print function:
      
      \`\`\`python
      # Basic print statement
      print('Hello, World!')
      
      # Print with multiple arguments
      print('My name is', 'Alice')
      
      # Print with custom separator
      print('apple', 'banana', 'cherry', sep=', ')
      \`\`\`
      
      The code above demonstrates..."
    
    Return a VALID JSON object.
    CRITICAL JSON FORMATTING RULES:
    1. Escape all double quotes inside content strings with backslashes (e.g., \\")
    2. Escape all backslashes in LaTeX with DOUBLE backslashes (e.g., \\\\frac, \\\\sqrt, \\\\alpha)
    3. Do not use unescaped newlines in strings; use \\n
    4. Do not use unescaped tabs; use \\t
    5. Ensure all strings are properly closed with quotes
    6. Ensure all brackets and braces are properly closed
    7. Test your JSON before returning - it must be valid JSON that can be parsed

    Return a JSON object with the following structure:
    {
      "sections": [
        { 
          "id": "unique_id", 
          "title": "Section Title", 
          "content": "Full markdown text. Escape quotes! **bold terms**. At least 4 detailed paragraphs per section. Insert {{INTERACTIVE_WIDGET}} marker.",
          "imagePrompt": null,
          "widget": {
            "type": "reveal" | "fill-blank" | "matching" | "ordering" | "labeling" | "true-false" | "quiz" | "reflection" | "code-playground" | "code-explanation",
            "data": {
              // For 'reveal':
              "title": "Did you know?",
              "content": "Surprising fact or hidden detail...",
              
              // For 'fill-blank' (fill in the blanks exercise):
              "title": "Complete the sentence",
              "sentence": "The process of {{BLANK}} converts {{BLANK}} into energy.",
              "answers": ["photosynthesis", "sunlight"],
              
              // For 'matching' (match items from two columns):
              "title": "Match the terms",
              "leftItems": ["Term 1", "Term 2", "Term 3"],
              "rightItems": ["Definition A", "Definition B", "Definition C"],
              "correctPairs": [0, 1, 2],
              
              // For 'ordering' (arrange items in correct sequence):
              "title": "Arrange in order",
              "orderingContext": "Steps of the process",
              "items": ["Step 1", "Step 2", "Step 3"],
              "correctOrder": [0, 1, 2],
              
              // For 'labeling' (match labels to descriptions):
              "title": "Label the parts",
              "labels": ["Part A", "Part B"],
              "descriptions": ["Description of A", "Description of B"],
              
              // For 'true-false' (evaluate statements):
              "title": "True or False?",
              "statements": [
                { "text": "Statement 1", "isTrue": true, "explanation": "Why..." },
                { "text": "Statement 2", "isTrue": false, "explanation": "Why..." }
              ],
              
              // For 'quiz' (multiple choice):
              "question": "Quick check: ...?",
              "options": ["A", "B", "C"],
              "correctIndex": 0,
              "explanation": "Why it's correct...",
              
              // For 'reflection' (open-ended thinking prompt):
              "title": "Reflect & Think",
              "reflectionPrompt": "How might this concept apply to...?",
              "sampleResponse": "A good response might consider...",
              
              // For 'code-playground' (REQUIRED for programming exercises):
              "title": "Try It Yourself!",
              "code": "# Starter code here\\ndef example():\\n    pass",
              "language": "python",
              "challenge": "Modify the code to achieve...",
              "expectedOutput": "Expected result when code runs correctly",
              "hints": ["Hint 1: Think about...", "Hint 2: Remember to..."],
              
              // For 'code-explanation' (REQUIRED for explaining code):
              "title": "Code Walkthrough",
              "codeLanguage": "python",
              "overallExplanation": "This code demonstrates the concept of...",
              "codeLines": [
                { "line": "def factorial(n):", "explanation": "Define a function named factorial that takes n as parameter" },
                { "line": "    if n <= 1:", "explanation": "Base case: check if n is 0 or 1" },
                { "line": "        return 1", "explanation": "Return 1 for the base case" },
                { "line": "    return n * factorial(n-1)", "explanation": "Recursive case: multiply n by factorial of (n-1)" }
              ]
            }
          }
        }
      ],
      "keyTerms": [
        { "term": "Term to underline", "definition": "Concise definition..." }
      ],
      "contextNotes": [
        { "paragraphIndex": 0, "note": "Interesting fact or context about this part..." }
      ]
    }

    Rules:
    1. Split text into AT LEAST 4 distinct logical sections (e.g., Introduction, Key Concepts, Application, Advanced Analysis, Conclusion).
    2. IMPORTANT: Each section's content MUST have AT LEAST 4 substantial paragraphs with detailed explanations. Do NOT reduce the number of paragraphs - ensure each section has a minimum of 4 well-developed paragraphs.
    3. CRITICAL: Use markdown formatting throughout:
       - Wrap key terms in **double asterisks** for highlighting (minimum 3 per paragraph)
       - Wrap important phrases/sentences in *single asterisks* for underlining (minimum 1 per paragraph)
       - Example: "The **rate of reaction** depends on *several critical factors that we must understand*."
    4. MATHEMATICS (REQUIRED): If the document contains ANY math, physics, chemistry, or equations:
       - Use $...$ for inline LaTeX math expressions (e.g., $E = mc^2$)
       - Use $$...$$ for block/display LaTeX equations
       - Include ALL formulas, equations, and mathematical notation in proper LaTeX
       - Show complete step-by-step solutions and derivations
       - For chemistry: Use \\\\text{} for element symbols in equations (ESCAPE BACKSLASH)
       - CRITICAL: ESCAPE ALL BACKSLASHES IN LATEX (e.g., \\\\frac, \\\\sqrt)
    5. PROGRAMMING (REQUIRED): If the document contains ANY programming, coding, or algorithms:
       - Use \`\`\`language fenced code blocks for ALL code examples
       - ALWAYS include 'code-playground' widget for practice exercises
       - ALWAYS include 'code-explanation' widget for explaining how code works
       - Include complete, runnable code with detailed comments
       - Provide example inputs/outputs
    6. For EACH section, include ONE interactive widget:
       - For MATH content: Use 'fill-blank' (for formulas), 'ordering' (for solving steps), or 'quiz'
       - For PROGRAMMING content: Use 'code-playground' or 'code-explanation' (MANDATORY)
       - For other content: Use appropriate widget type from the list
    7. Insert {{INTERACTIVE_WIDGET}} in the 'content' string where the widget should be rendered.
    8. DO NOT include imagePrompt for most sections - set to null. Only include imagePrompt for the FIRST section of the document.
    9. Focus on rich, detailed text content and engaging interactive activities instead of images.
    10. CRITICAL FOR imagePrompt: When providing an imagePrompt for the first section, it MUST be a detailed SCIENTIFIC and ACADEMIC description that would generate a textbook-quality illustration.

    🚨🚨🚨 FINAL VALIDATION CHECKPOINT 🚨🚨🚨
    
    BEFORE YOU START WRITING, ANSWER THESE QUESTIONS:
    1. What is the MAIN TOPIC of the text below? (Write it down - e.g., oscilloscope, rotary encoder, sensors, etc.)
    2. What language is the text in? (Keep that same language - German stays German, English stays English)
    3. What specific experiments or equipment are mentioned?
    
    NOW READ THE TEXT BELOW CAREFULLY:
    
    Text to Analyze (THIS IS YOUR ONLY SOURCE - USE NOTHING ELSE):
    ${text.slice(0, 50000)}
    
    ⚠️⚠️⚠️ CRITICAL VALIDATION - CHECK BEFORE RESPONDING ⚠️⚠️⚠️
    
    For EVERY sentence you write, ask yourself:
    - Can I find this exact information in the text above? YES/NO
    - Is this example mentioned in the text above? YES/NO
    - Is this topic discussed in the text above? YES/NO
    
    If ANY answer is NO, DO NOT WRITE IT.
    
    REMEMBER:
    - Identify the main topic from the text above and write ONLY about that topic
    - If the text is about oscilloscopes, write ONLY about oscilloscopes as described
    - If the text is about rotary encoders (Drehgeber), write ONLY about rotary encoders
    - If the text is in German, write in German
    - Do NOT add cell biology, chemistry reactions, or any topic NOT in the text
    - Do NOT add generic examples or explanations not in the text
    - Every concept must come from the text above
    
    Your response must be 100% based on the text above. Nothing else.
  `;

  const fallbackContent: ImmersiveContent = {
    title: 'Immersive Learning Session',
    sections: [{
      id: 'fallback-1',
      title: 'Document Overview',
      content: text.slice(0, 500) + '...',
      imagePrompt: 'Scientific textbook-style diagram illustrating the main educational concept with accurate proportions, labeled components, professional academic quality, clean white background, publication-ready illustration'
    }],
    keyTerms: [],
    contextNotes: []
  };

  let accumulatedText = '';

  try {
    console.log('🎯 Starting streamTextContent...');
    const finalText = await streamTextContent(
      prompt,
      (chunk) => {
        // Accumulate chunks locally and send for display
        accumulatedText += chunk;
        console.log(`📦 Chunk received: ${chunk.length} chars, total: ${accumulatedText.length}`);
        onStreamUpdate(accumulatedText, false);
      },
      { model: IMMERSIVE_TEXT_MODEL, timeout: 180000 } // Extended timeout for long content
    );
    console.log('🏁 Stream finished, total length:', finalText.length);
    // Signal completion with the final text
    onStreamUpdate(finalText, true);

    const json = extractJsonBlock(finalText);
    return safeJsonParse<ImmersiveContent>(json, fallbackContent);
  } catch (error) {
    console.error('Stream error, checking for partial content:', error);

    // Recovery: If we have substantial content, try to use it instead of failing
    if (accumulatedText.length > 2000) {
      console.log('⚠️ Recovering partial content from interrupted stream (length: ' + accumulatedText.length + ')');
      try {
        // 1. Try to extract and repair JSON
        const rawJson = extractJsonBlock(accumulatedText);
        // Clean up markdown/JSON fences if extractJsonBlock didn't catch them due to truncation
        const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/```$/, '');

        // Attempt aggressive JSON repair (append closing brackets)
        const repairedJson = repairJson(cleanJson);
        const parsedContext = JSON.parse(repairedJson);

        // Validate it has sections
        if (parsedContext && Array.isArray(parsedContext.sections)) {
          console.log('✅ Successfully recovered partial JSON content');
          // Ensure it matches interface
          return { ...fallbackContent, ...parsedContext };
        }
      } catch (e) {
        console.warn('Partial JSON repair failed, falling back to raw text recovery', e);
      }

      // 2. If JSON repair fails, return raw text as a single section
      // Clean up the text for display (remove JSON tokens if they look like clutter)
      let cleanText = accumulatedText;
      // If it looks like it started with JSON markdown, strip the header
      if (cleanText.trim().startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/i, '');
      }

      return {
        title: 'Immersive Learning (Partial)',
        sections: [{
          id: 'partial-recovery',
          title: 'Generated Content (Interrupted)',
          content: cleanText + '\n\n*(Note: Content generation was interrupted by the server. Showing partial results.)*',
          imagePrompt: null
        }],
        keyTerms: [],
        contextNotes: []
      };
    }

    // Fallback to non-streaming if streaming fails AND we don't have enough partial content
    console.log('Not enough partial content to recover, trying non-streaming fallback...');
    const fallbackResponse = await generateTextContent(prompt, { model: IMMERSIVE_TEXT_MODEL });
    onStreamUpdate(fallbackResponse, true);

    const json = extractJsonBlock(fallbackResponse);
    return safeJsonParse<ImmersiveContent>(json, fallbackContent);
  }
};

/**
 * Generate a single quiz question for a specific paragraph.
 * Used for the floating "?" button quiz feature.
 */
export const generateParagraphQuiz = async (paragraph: string): Promise<QuizQuestion> => {
  const prompt = `
    Generate ONE multiple-choice question to test understanding of this specific paragraph:
    
    "${paragraph}"
    
    Return a JSON object:
    {
      "question": "A clear question testing understanding of this specific content",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Brief explanation of why the correct answer is right."
    }

    Rules:
    - Question MUST be directly about the content in the paragraph above
    - Make the question test understanding, not just recall
    - Keep question and options concise
    - Include exactly 4 options
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);

  const fallback: QuizQuestion = {
    question: 'What is the main concept discussed in this section?',
    options: ['Understanding the basics', 'Advanced applications', 'Historical context', 'Future implications'],
    correctAnswerIndex: 0,
    explanation: 'Please review the paragraph for details.'
  };

  return safeJsonParse<QuizQuestion>(json, fallback);
};

/**
 * Enhanced term exploration - generates rich interactive content for clicked terms
 */
export interface EnhancedTermInfo {
  term: string;
  definition: string;
  deepDive: string; // Detailed explanation
  analogy: string; // Real-world analogy to understand the concept
  brainTeaser: {
    question: string;
    hint: string;
    answer: string;
  };
  quickQuiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  funFact: string;
  realWorldExample: string;
  relatedTerms: string[];
  memoryTrick: string; // Mnemonic or memory aid
}

export const generateEnhancedTermInfo = async (
  term: string,
  definition: string,
  documentContext: string
): Promise<EnhancedTermInfo> => {
  const prompt = `
    You are an expert educator. Create rich, interactive learning content for the term "${term}".
    
    Context from document: "${documentContext.slice(0, 2000)}"
    Basic definition: "${definition}"
    
    Return a JSON object with engaging educational content:
    {
      "term": "${term}",
      "definition": "Enhanced, clear definition",
      "deepDive": "2-3 paragraph detailed explanation that goes beyond the basic definition. Explain WHY this matters and HOW it works.",
      "analogy": "A creative real-world analogy that makes this concept click. Use everyday objects or experiences.",
      "brainTeaser": {
        "question": "A thought-provoking puzzle or riddle related to this concept",
        "hint": "A helpful hint without giving away the answer",
        "answer": "The answer with brief explanation"
      },
      "quickQuiz": {
        "question": "A challenging but fair question about this term",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctIndex": 0,
        "explanation": "Why this is the correct answer"
      },
      "funFact": "An interesting, surprising fact related to this term that students will remember",
      "realWorldExample": "A specific real-world application or example where this concept is used",
      "relatedTerms": ["term1", "term2", "term3"],
      "memoryTrick": "A mnemonic device, acronym, or memory trick to remember this concept"
    }
    
    Rules:
    - Make content engaging and memorable, not dry textbook style
    - Use conversational language suitable for students
    - The brain teaser should make students THINK, not just recall
    - The analogy should create an "aha!" moment
    - Keep the fun fact genuinely interesting
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);

  const fallback: EnhancedTermInfo = {
    term,
    definition,
    deepDive: `${term} is an important concept. ${definition}`,
    analogy: `Think of ${term} like a key that unlocks understanding of this topic.`,
    brainTeaser: {
      question: `If you had to explain ${term} to a 5-year-old, what would you say?`,
      hint: 'Focus on the core idea, not technical details.',
      answer: definition
    },
    quickQuiz: {
      question: `What is the main purpose of ${term}?`,
      options: ['Understanding concepts', 'Memorizing facts', 'Solving problems', 'All of the above'],
      correctIndex: 3,
      explanation: 'This term helps in multiple ways.'
    },
    funFact: `The term "${term}" has been fundamental to understanding this subject!`,
    realWorldExample: `${term} is used in many real-world applications.`,
    relatedTerms: [],
    memoryTrick: `Remember: ${term.charAt(0).toUpperCase()} stands for ${term}!`
  };

  return safeJsonParse<EnhancedTermInfo>(json, fallback);
};

/**
 * Generate a brainstorming activity for a section
 */
export interface BrainstormActivity {
  title: string;
  scenario: string;
  challenge: string;
  hints: string[];
  possibleApproaches: string[];
  expertInsight: string;
}

export const generateBrainstormActivity = async (
  sectionContent: string,
  sectionTitle: string
): Promise<BrainstormActivity> => {
  const prompt = `
    Create an engaging brainstorming activity for students learning about "${sectionTitle}".
    
    Section content: "${sectionContent.slice(0, 3000)}"
    
    Return a JSON object:
    {
      "title": "Catchy activity title (e.g., 'The Innovation Challenge')",
      "scenario": "A realistic scenario or problem statement that requires applying the concepts learned. Make it relatable and interesting.",
      "challenge": "The specific challenge or question students need to brainstorm about",
      "hints": ["Hint 1 to get started", "Hint 2 for deeper thinking", "Hint 3 for advanced exploration"],
      "possibleApproaches": ["Approach 1", "Approach 2", "Approach 3"],
      "expertInsight": "What an expert in this field might consider when solving this challenge"
    }
    
    Rules:
    - Make the scenario engaging and relevant to students
    - The challenge should require creative thinking, not just recall
    - Hints should guide without giving away solutions
    - Include multiple valid approaches to encourage diverse thinking
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);

  const fallback: BrainstormActivity = {
    title: 'Think Like an Expert',
    scenario: `Imagine you need to apply ${sectionTitle} in a real situation.`,
    challenge: 'How would you approach this problem using what you learned?',
    hints: ['Start with the basics', 'Consider different perspectives', 'Think about real-world implications'],
    possibleApproaches: ['Analytical approach', 'Creative approach', 'Collaborative approach'],
    expertInsight: 'Experts often combine multiple approaches for the best results.'
  };

  return safeJsonParse<BrainstormActivity>(json, fallback);
};

/**
 * Generate a "What If" exploration activity
 */
export interface WhatIfActivity {
  title: string;
  baseScenario: string;
  whatIfQuestions: {
    question: string;
    thinkingPoints: string[];
    insight: string;
  }[];
}

export const generateWhatIfActivity = async (
  content: string,
  topic: string
): Promise<WhatIfActivity> => {
  const prompt = `
    Create a "What If?" exploration activity about "${topic}" to encourage critical thinking.
    
    Content context: "${content.slice(0, 2000)}"
    
    Return a JSON object:
    {
      "title": "Creative What-If title",
      "baseScenario": "Set up the base scenario that students will explore",
      "whatIfQuestions": [
        {
          "question": "What if [interesting variation]?",
          "thinkingPoints": ["Consider this...", "Also think about...", "Don't forget..."],
          "insight": "The key insight from exploring this question"
        },
        {
          "question": "What if [another variation]?",
          "thinkingPoints": ["Point 1", "Point 2"],
          "insight": "Another valuable insight"
        },
        {
          "question": "What if [challenging variation]?",
          "thinkingPoints": ["Advanced consideration 1", "Advanced consideration 2"],
          "insight": "Deep insight for advanced learners"
        }
      ]
    }
    
    Rules:
    - Make questions genuinely thought-provoking
    - Progress from simpler to more complex what-if scenarios
    - Insights should reveal deeper understanding
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);

  const fallback: WhatIfActivity = {
    title: 'Explore the Possibilities',
    baseScenario: `Consider the core concepts of ${topic}.`,
    whatIfQuestions: [{
      question: 'What if the conditions were different?',
      thinkingPoints: ['Consider the variables', 'Think about cause and effect'],
      insight: 'Understanding conditions helps predict outcomes.'
    }]
  };

  return safeJsonParse<WhatIfActivity>(json, fallback);
};

export const generateImmersiveQuiz = async (text: string): Promise<QuizQuestion[]> => {
  const prompt = `
    Generate a 5-question multiple-choice quiz based on the following text.
    
    Return a JSON array of objects:
    [
      {
        "question": "Question text?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswerIndex": 0,
        "explanation": "Brief explanation of why the correct answer is right."
      }
    ]

    Rules:
    - Include a clear explanation for the correct answer.
    - Questions should test understanding.
    - Keep responses concise.

    Text:
    ${text.slice(0, 8000)}
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);

  const fallback: QuizQuestion[] = [{
    question: 'What is the main topic of this document?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswerIndex: 0,
    explanation: 'Please review the document for details.'
  }];

  return safeJsonParse<QuizQuestion[]>(json, fallback);
};

export const generateAudioScript = async (text: string): Promise<string> => {
  const prompt = `
    Convert the following educational text into an engaging audio lesson script.
    The script should be conversational, like a podcast host explaining the topic to a student.
    Use clear, spoken-word language.
    
    Text:
    ${text.slice(0, 10000)}
  `;

  return await generateTextContent(prompt, { model: IMMERSIVE_TEXT_MODEL });
};

export const generateMindMapData = async (text: string): Promise<MindMapNode> => {
  const prompt = `
    Create a hierarchical mind map structure from the following text.
    
    Return a JSON object representing the root node:
    {
      "id": "root",
      "label": "Main Topic",
      "children": [
        { "id": "child1", "label": "Subtopic 1", "children": [...] }
      ]
    }

    Text:
    ${text.slice(0, 8000)}
  `;

  const response = await generateTextContent(prompt);
  const json = extractJsonBlock(response);

  const fallback: MindMapNode = {
    id: 'root',
    label: 'Main Topic',
    children: [{ id: 'child1', label: 'Key Concept 1' }]
  };





  return safeJsonParse<MindMapNode>(json, fallback);
};

export interface ReactFlowData {
  nodes: Array<{ id: string; data: { label: string }; position: { x: number; y: number }; type?: string }>;
  edges: Array<{ id: string; source: string; target: string; type?: string }>;
}

export const generateReactFlowData = async (text: string): Promise<ReactFlowData> => {
  const prompt = `
    Create a hierarchical mind map from the following text and return it as a JSON object suitable for React Flow.
    
    Return a JSON object with two arrays: "nodes" and "edges".
    
    Structure:
    {
      "nodes": [
        { "id": "1", "data": { "label": "Main Topic" }, "position": { "x": 0, "y": 0 }, "type": "input" },
        { "id": "2", "data": { "label": "Subtopic" }, "position": { "x": 0, "y": 0 } }
      ],
      "edges": [
        { "id": "e1-2", "source": "1", "target": "2" }
      ]
    }
    
    Rules:
    - The root node should have type "input".
    - All positions can be { x: 0, y: 0 } as we will use an auto-layout algorithm.
    - Keep labels concise.
    - Ensure all IDs are unique strings.
    - Create a logical hierarchy based on the text.
    
    Text to analyze:
    ${text.slice(0, 8000)}
  `;

  const response = await generateTextContent(prompt, { model: IMMERSIVE_TEXT_MODEL });
  const json = extractJsonBlock(response);

  const fallback: ReactFlowData = {
    nodes: [
      { id: '1', data: { label: 'Main Topic' }, position: { x: 0, y: 0 }, type: 'input' },
      { id: '2', data: { label: 'Key Concept' }, position: { x: 0, y: 0 } }
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' }
    ]
  };

  return safeJsonParse<ReactFlowData>(json, fallback);
};

export const extendMindMapNode = async (nodeLabel: string, context: string = ''): Promise<ReactFlowData> => {
  const prompt = `
    You are an AI tutor helping a student explore a mind map.
    The student wants to expand on the node: "${nodeLabel}".
    
    Context of the mind map: "${context.slice(0, 500)}..."
    
    Generate 2-3 relevant subtopics or deeper concepts related to "${nodeLabel}".
    Return a JSON object with "nodes" and "edges" to append to the existing graph.
    
    Structure:
    {
      "nodes": [
        { "id": "new_1", "data": { "label": "Subtopic 1" }, "position": { "x": 0, "y": 0 } },
        { "id": "new_2", "data": { "label": "Subtopic 2" }, "position": { "x": 0, "y": 0 } }
      ],
      "edges": [
        { "id": "e_new_1", "source": "original_node_id_placeholder", "target": "new_1" },
        { "id": "e_new_2", "source": "original_node_id_placeholder", "target": "new_2" }
      ]
    }
    
    Rules:
    - Use "original_node_id_placeholder" as the source for all new edges. The frontend will replace this with the actual ID.
    - Generate unique IDs for new nodes (e.g., use a random suffix or descriptive name).
    - Keep labels concise (1-3 words).
    - Focus on educational value and logical hierarchy.
  `;

  const response = await generateTextContent(prompt, { model: IMMERSIVE_TEXT_MODEL });
  const json = extractJsonBlock(response);

  const fallback: ReactFlowData = {
    nodes: [
      { id: `fallback_${Date.now()}_1`, data: { label: 'More Info' }, position: { x: 0, y: 0 } },
      { id: `fallback_${Date.now()}_2`, data: { label: 'Examples' }, position: { x: 0, y: 0 } }
    ],
    edges: [
      { id: `e_fallback_1`, source: 'original_node_id_placeholder', target: `fallback_${Date.now()}_1` },
      { id: `e_fallback_2`, source: 'original_node_id_placeholder', target: `fallback_${Date.now()}_2` }
    ]
  };

  return safeJsonParse<ReactFlowData>(json, fallback);
};

/**
 * Generates academic images using Google's Imagen API (imagen-4.0-generate-001).
 * Based on documentation: https://ai.google.dev/gemini-api/docs/imagen
 * 
 * @param prompt - The image prompt describing what to generate (max 480 tokens)
 * @param aspectRatio - Optional aspect ratio (defaults to 16:9 for widescreen)
 * @param numberOfImages - Number of images to generate (1-4, default: 1)
 * @returns Base64 data URL of the generated image(s)
 */
export const generateImagenImage = async (
  prompt: string,
  aspectRatio: AspectRatio = AspectRatio.LANDSCAPE_16_9,
  numberOfImages: number = 1
): Promise<string> => {
  try {
    const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
    const apiKey = await getSharedGeminiApiKey();

    if (!apiKey) {
      throw new Error('API key not available');
    }

    // Map aspect ratio to Imagen format
    const imagenAspectRatio = aspectRatio === AspectRatio.LANDSCAPE_16_9 ? '16:9' :
      aspectRatio === AspectRatio.PORTRAIT_9_16 ? '9:16' :
        aspectRatio === AspectRatio.SQUARE_1_1 ? '1:1' :
          aspectRatio === AspectRatio.PORTRAIT_3_4 ? '3:4' :
            aspectRatio === AspectRatio.LANDSCAPE_4_3 ? '4:3' : '16:9';

    // Imagen API endpoint - using header for API key as per documentation
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt
          }
        ],
        parameters: {
          sampleCount: Math.min(Math.max(numberOfImages, 1), 4), // Clamp between 1-4
          aspectRatio: imagenAspectRatio,
          imageSize: '1K', // 1K resolution (1024px)
          personGeneration: 'allow_adult' // Default: allow adults, not children
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imagen API error response:', errorText);
      throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Imagen API response structure:', Object.keys(data));

    // Handle different possible response structures
    // Try predictions array first (REST API format)
    if (data.predictions && Array.isArray(data.predictions) && data.predictions.length > 0) {
      const prediction = data.predictions[0];
      // Check for bytesBase64Encoded field
      if (prediction.bytesBase64Encoded) {
        const imageBase64 = prediction.bytesBase64Encoded;
        return `data:image/png;base64,${imageBase64}`;
      }
      // Check for imageBytes field (SDK format)
      if (prediction.imageBytes) {
        const imageBase64 = prediction.imageBytes;
        return `data:image/png;base64,${imageBase64}`;
      }
    }

    // Try generatedImages array (alternative SDK format)
    if (data.generatedImages && Array.isArray(data.generatedImages) && data.generatedImages.length > 0) {
      const generatedImage = data.generatedImages[0];
      if (generatedImage.image?.imageBytes) {
        const imageBase64 = generatedImage.image.imageBytes;
        return `data:image/png;base64,${imageBase64}`;
      }
      if (generatedImage.imageBytes) {
        const imageBase64 = generatedImage.imageBytes;
        return `data:image/png;base64,${imageBase64}`;
      }
    }

    // Log the full response for debugging
    console.error('Unexpected Imagen API response structure:', JSON.stringify(data, null, 2));
    throw new Error('No image data in Imagen API response. Check console for response structure.');
  } catch (error) {
    console.error('Failed to generate image with Imagen API:', error);
    throw error;
  }
};

/**
 * Extracts relevant context from a document based on the user's image prompt.
 * Uses Gemini to identify and extract the most relevant sections from the document.
 * 
 * @param userPrompt - The user's image generation prompt
 * @param documentText - The full document text to search
 * @returns Relevant document context to enhance the image prompt
 */
export const extractDocumentContextForImage = async (
  userPrompt: string,
  documentText: string
): Promise<string> => {
  try {
    // Limit document text to avoid token limits (keep it reasonable)
    const maxDocumentLength = 30000; // ~30k chars should be enough for context
    const truncatedDocument = documentText.length > maxDocumentLength
      ? documentText.slice(0, maxDocumentLength) + '...'
      : documentText;

    const contextPrompt = `You are an expert at extracting relevant information from educational documents for image generation.

TASK: Extract the most relevant information from the provided document that relates to the user's image generation request. Focus on:
- Specific concepts, terms, and details mentioned in the document
- Visual descriptions, structures, or processes described
- Scientific or technical accuracy requirements
- Any specific style or context mentioned

User's Image Request: "${userPrompt}"

Document Content:
${truncatedDocument}

Extract ONLY the relevant information from the document that would help create an accurate, educational image matching the user's request. Be concise but include all important details. If the document doesn't contain relevant information, return "No relevant context found."

Return only the extracted relevant context, without additional commentary.`;

    const { generateTextContent } = await import('./geminiService');
    const context = await generateTextContent(contextPrompt, {
      maxOutputTokens: 2000,
      model: 'gemini-2.5-flash'
    });

    return context.trim();
  } catch (error) {
    console.error('Failed to extract document context:', error);
    return '';
  }
};

/**
 * Enhances a user prompt into a purely academic, well-defined image generation prompt.
 * Uses Gemini to transform the prompt into a detailed, scientifically accurate description.
 * 
 * @param userPrompt - The user's original prompt
 * @param documentContext - Optional document context to enhance accuracy
 * @returns Enhanced academic prompt optimized for educational image generation
 */
const enhancePromptForAcademicImage = async (
  userPrompt: string,
  documentContext?: string
): Promise<string> => {
  try {
    const { generateTextContent } = await import('./geminiService');

    const enhancementPrompt = `You are an expert academic illustrator and prompt engineer specializing in creating detailed, scientifically accurate image generation prompts for educational materials.

TASK: Transform the user's image request into a comprehensive, well-defined academic prompt that will generate a high-quality educational illustration suitable for textbooks, scientific journals, or educational presentations.

CRITICAL REQUIREMENTS:
1. The prompt MUST be purely academic and scientifically accurate
2. Use descriptive, narrative language - describe the scene, don't just list keywords
3. Include specific visual details: composition, lighting, perspective, style, and key elements
4. Specify academic illustration style (textbook diagram, scientific figure, educational infographic, etc.)
5. Include technical accuracy requirements
6. Mention professional color palettes and clean composition
7. Ensure the prompt is detailed enough to generate publication-quality educational imagery

USER'S REQUEST: "${userPrompt}"
${documentContext ? `\nDOCUMENT CONTEXT (use this for accuracy):\n${documentContext}` : ''}

Create a comprehensive, detailed academic image generation prompt that:
- Describes the subject matter with scientific precision
- Specifies the illustration style (e.g., "textbook-style scientific diagram", "educational infographic", "cross-sectional view", "labeled anatomical illustration")
- Includes composition details (camera angle, perspective, framing)
- Mentions lighting appropriate for educational materials (even, clear, professional)
- Specifies color scheme suitable for academic publications
- Ensures scientific accuracy and proper proportions
- Creates a clean, professional composition suitable for educational use

Return ONLY the enhanced prompt text, without any additional commentary or markdown formatting.`;

    const enhancedPrompt = await generateTextContent(enhancementPrompt, {
      maxOutputTokens: 1000,
      model: 'gemini-2.5-flash'
    });

    return enhancedPrompt.trim();
  } catch (error) {
    console.warn('Failed to enhance prompt, using original:', error);
    // Fallback to original prompt with basic academic formatting
    return `A detailed, scientifically accurate academic illustration of ${userPrompt}. Professional textbook-style diagram with clear composition, even lighting, and educational quality suitable for academic publications. Clean, well-defined visual elements with proper proportions and scientific accuracy.`;
  }
};

/**
 * Generates immersive learning images using Gemini 3 Pro Image Preview (Nano Banana Pro).
 * 
 * Official API Documentation: https://ai.google.dev/gemini-api/docs/image-generation
 * 
 * Model: gemini-3-pro-image-preview (Nano Banana Pro)
 * - Supports 1K, 2K, and 4K resolutions
 * - Features real-world grounding using Google Search
 * - Default "Thinking" process that refines composition prior to generation
 * - High-fidelity text rendering for diagrams and educational content
 * 
 * @param prompt - The image prompt describing what to generate
 * @param aspectRatio - Optional aspect ratio (defaults to 16:9 for widescreen)
 * @param documentContext - Optional document context to enhance the prompt
 * @param imageSize - Optional image size: '1K' (1120 tokens), '2K' (1120 tokens), or '4K' (2000 tokens). Defaults to '1K'
 * @returns Base64 data URL of the generated image
 */
export const generateImmersiveImage = async (
  prompt: string,
  aspectRatio: AspectRatio = AspectRatio.LANDSCAPE_16_9,
  documentContext?: string,
  imageSize: '1K' | '2K' | '4K' = '1K'
): Promise<string> => {
  try {
    // Enhance prompt to be purely academic and well-defined
    const enhancedPrompt = await enhancePromptForAcademicImage(prompt, documentContext);
    console.log('📚 Enhanced academic prompt:', enhancedPrompt.substring(0, 200) + '...');

    // Use Gemini 3 Pro Image Preview (Nano Banana Pro) with 1K resolution
    const { GoogleGenAI } = await import('@google/genai');
    const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
    const apiKey = await getSharedGeminiApiKey();

    if (!apiKey) {
      throw new Error('API key not available');
    }

    const genAI = new GoogleGenAI({ apiKey });

    // Map aspect ratio to string format
    const aspectRatioStr = aspectRatio === AspectRatio.LANDSCAPE_16_9 ? '16:9' :
      aspectRatio === AspectRatio.PORTRAIT_9_16 ? '9:16' :
        aspectRatio === AspectRatio.SQUARE_1_1 ? '1:1' :
          aspectRatio === AspectRatio.PORTRAIT_3_4 ? '3:4' :
            aspectRatio === AspectRatio.LANDSCAPE_4_3 ? '4:3' : '16:9';

    console.log(`🎨 Generating image with Gemini 3 Pro Image Preview (Nano Banana Pro) at ${imageSize} resolution...`);

    // Use the official API format as per documentation: https://ai.google.dev/gemini-api/docs/image-generation
    // Reference: https://ai.google.dev/gemini-api/docs/image-generation#image-generation-text-to-image
    const response = await genAI.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [enhancedPrompt], // Simple array format as per official documentation
      config: {
        imageConfig: {
          aspectRatio: aspectRatioStr,
          imageSize: imageSize, // '1K', '2K', or '4K' - see documentation for resolution details
        },
      },
    });

    // Extract image from response - following official API documentation format
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No image candidates returned');
    }

    const parts = candidates[0].content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('No image parts returned');
    }

    // Look for inlineData which contains the base64 image
    // According to documentation: https://ai.google.dev/gemini-api/docs/image-generation
    for (const part of parts) {
      // Check for inlineData (base64 image)
      if (part.inlineData && part.inlineData.data) {
        const base64Data = part.inlineData.data;
        // Check if it already has data URL prefix
        if (base64Data.startsWith('data:')) {
          return base64Data;
        }
        // Return as data URL
        return `data:image/png;base64,${base64Data}`;
      }
      // Also check for text parts that might contain image data
      if (part.text) {
        // Sometimes the API returns text with image reference
        const srcMatch = part.text.match(/src="([^"]+)"/);
        if (srcMatch) {
          return srcMatch[1];
        }
        if (part.text.trim().startsWith('http') || part.text.trim().startsWith('data:')) {
          return part.text.trim();
        }
      }
    }

    throw new Error('No image data found in response');
  } catch (error) {
    console.error('Failed to generate image with Gemini 3 Pro Image Preview:', error);
    // Fallback to educational image generator
    try {
      console.warn('Falling back to educational image generator...');
      const imageDataUrl = await generateEducationalImage(
        prompt,
        aspectRatio,
        ImageSize.K1 // 1024px resolution - fast and high quality
      );
      return imageDataUrl;
    } catch (fallbackError) {
      console.error('All image generation methods failed:', fallbackError);
      // Final fallback to Pollinations AI
      console.warn('Falling back to Pollinations AI for image generation');
      const encodedPrompt = encodeURIComponent(prompt);
      return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true`;
    }
  }
};

/**
 * Fetches and ranks YouTube videos based on document content using Gemini 2.5 Flash.
 * Analyzes video transcripts to determine relevance and returns top 5 most relevant videos.
 * 
 * @param documentText - The document text to find relevant videos for
 * @returns Array of top 5 ranked YouTube videos with relevance scores
 */
export const fetchAndRankYouTubeVideos = async (documentText: string): Promise<RankedYouTubeVideo[]> => {
  try {
    // Step 1: Extract topic and search terms from document using Gemini
    const topicPrompt = `
      Analyze this educational document and extract:
      1. The main topic/subject
      2. 3-5 specific search queries that would find good explanatory YouTube videos about this topic
      
      Return JSON only:
      {
        "mainTopic": "Main topic of the document",
        "searchQueries": ["query1", "query2", "query3"]
      }
      
      Document excerpt:
      ${documentText.slice(0, 4000)}
    `;

    const topicResponse = await generateTextContent(topicPrompt);
    const topicJson = extractJsonBlock(topicResponse);

    interface TopicResult {
      mainTopic: string;
      searchQueries: string[];
    }

    const fallbackTopic: TopicResult = {
      mainTopic: 'educational content',
      searchQueries: ['educational tutorial', 'learning guide']
    };
    const topicData = safeJsonParse<TopicResult>(topicJson, fallbackTopic);
    const searchQueries: string[] = topicData.searchQueries?.length > 0
      ? topicData.searchQueries
      : [topicData.mainTopic || 'educational content'];

    console.log('🔍 Searching YouTube for:', searchQueries);

    // Step 2: Fetch videos from YouTube for each query
    const allVideos: YouTubeVideo[] = [];
    const seenIds = new Set<string>();

    for (const query of searchQueries.slice(0, 3)) {
      try {
        const videos = await fetchYouTubeVideos({ query, maxResults: 8 });
        for (const video of videos) {
          if (!seenIds.has(video.id)) {
            seenIds.add(video.id);
            allVideos.push(video);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch videos for query:', query, e);
      }
    }

    if (allVideos.length === 0) {
      console.warn('No YouTube videos found');
      return [];
    }

    console.log(`📹 Found ${allVideos.length} videos, ranking by relevance...`);

    // Step 3: Sort videos by popularity (subscriber count) and take top 15
    // NOTE: Transcript fetching is disabled due to CORS restrictions from browser
    // We'll rank based on title, description, and channel instead
    const sortedByPopularity = [...allVideos]
      .sort((a, b) => (b.subscriberCount || 0) - (a.subscriberCount || 0))
      .slice(0, 15);

    // Step 4: Use Gemini 2.5 Flash to analyze and rank videos based on metadata
    const analysisPrompt = `
      You are an educational content curator. Analyze these YouTube videos and rank them by relevance to the given document.
      
      DOCUMENT TOPIC AND CONTENT:
      ${documentText.slice(0, 3000)}
      
      YOUTUBE VIDEOS TO RANK:
      ${sortedByPopularity.map((video, idx) => `
      VIDEO ${idx + 1}:
      - Title: ${video.title}
      - Channel: ${video.channelTitle} (${video.subscriberCount ? video.subscriberCount.toLocaleString() + ' subscribers' : 'Unknown subscribers'})
      - Description: ${video.description.slice(0, 500)}
      `).join('\n')}
      
      TASK: Select the TOP 5 most relevant videos that would help a student understand the document content.
      Consider:
      - Content alignment with document topics
      - Educational quality (prefer videos with detailed descriptions)
      - Channel credibility (subscriber count)
      - Video engagement (view count)
      
      Return JSON only (no markdown):
      {
        "rankedVideos": [
          {
            "videoIndex": 0,
            "relevanceScore": 95,
            "relevanceReason": "Brief explanation of why this video is relevant",
            "expectedContent": "1-2 sentence description of what the video likely teaches based on title/description"
          }
        ]
      }
      
      Return exactly 5 videos, ranked from most to least relevant. Keep responses concise.
    `;

    const analysisResponse = await generateTextContent(analysisPrompt);
    const analysisJson = extractJsonBlock(analysisResponse);

    interface RankingResult {
      rankedVideos: Array<{
        videoIndex: number;
        relevanceScore: number;
        relevanceReason: string;
        expectedContent: string;
      }>;
    }

    const fallbackAnalysis: RankingResult = { rankedVideos: [] };
    const analysisData = safeJsonParse<RankingResult>(analysisJson, fallbackAnalysis);

    // Step 5: Build the ranked video list
    const rankedVideos: RankedYouTubeVideo[] = [];

    for (const ranking of analysisData.rankedVideos || []) {
      const idx = ranking.videoIndex;
      if (idx >= 0 && idx < sortedByPopularity.length) {
        const video = sortedByPopularity[idx];
        rankedVideos.push({
          ...video,
          relevanceScore: ranking.relevanceScore || 0,
          relevanceReason: ranking.relevanceReason || '',
          transcriptSummary: ranking.expectedContent || ''
        });
      }
    }

    // If AI ranking failed, return videos sorted by subscriber count
    if (rankedVideos.length === 0 && sortedByPopularity.length > 0) {
      console.log('⚠️ AI ranking failed, falling back to subscriber-based ranking');
      return sortedByPopularity.slice(0, 5).map((video, idx) => ({
        ...video,
        relevanceScore: 80 - idx * 10,
        relevanceReason: 'Ranked by channel popularity',
        transcriptSummary: video.description.slice(0, 200) + '...'
      }));
    }

    console.log(`🎯 Ranked ${rankedVideos.length} videos`);
    return rankedVideos.slice(0, 5);

  } catch (error) {
    console.error('Failed to fetch and rank YouTube videos:', error);
    return [];
  }
};

/**
 * Video Summary and Key Concepts interface
 */
export interface VideoSummary {
  overview: string;
  keyPoints: string[];
  keyConcepts: Array<{
    title: string;
    description: string;
  }>;
  timestamps?: Array<{
    time: string;
    topic: string;
  }>;
}

/**
 * Chat message interface for video discussions
 */
export interface VideoChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Fetches transcript and generates a comprehensive summary for a YouTube video
 * Uses the Gemini API to analyze the transcript
 */
export const generateVideoSummary = async (
  videoId: string,
  videoTitle: string,
  videoDescription: string
): Promise<VideoSummary> => {
  console.log(`📺 Generating summary for video: ${videoId}`);

  // Try to fetch the actual transcript
  let transcriptText: string | null = null;

  try {
    transcriptText = await fetchYouTubeTranscript(videoId);
    if (transcriptText) {
      console.log(`✅ Got transcript: ${transcriptText.length} characters`);
    }
  } catch (e) {
    console.warn('Failed to fetch transcript:', e);
  }

  // Build the prompt based on available content
  const contentToAnalyze = transcriptText
    ? `VIDEO TRANSCRIPT:\n${transcriptText.slice(0, 15000)}`
    : `VIDEO TITLE: ${videoTitle}\n\nVIDEO DESCRIPTION:\n${videoDescription}`;

  const prompt = `
    Analyze this YouTube video content and generate a comprehensive educational summary.
    
    ${contentToAnalyze}
    
    Return a JSON object with the following structure:
    {
      "overview": "A 2-3 paragraph comprehensive summary of what the video teaches. Make it engaging and informative for students.",
      "keyPoints": [
        "Key point 1 - important takeaway",
        "Key point 2 - important takeaway",
        "Key point 3 - important takeaway",
        "Key point 4 - important takeaway",
        "Key point 5 - important takeaway"
      ],
      "keyConcepts": [
        {
          "title": "Concept Name",
          "description": "Clear explanation of this concept from the video"
        }
      ],
      "timestamps": [
        {
          "time": "0:00",
          "topic": "Introduction"
        },
        {
          "time": "2:30",
          "topic": "Main concept discussion"
        }
      ]
    }
    
    Rules:
    - Make the overview engaging and educational
    - Extract 5-7 key points
    - Identify 4-6 key concepts with clear explanations
    - ${transcriptText ? 'Include estimated timestamps based on the transcript content' : 'Omit timestamps since we only have the description'}
    - Keep all text concise but informative
  `;

  try {
    const response = await generateTextContent(prompt, { model: IMMERSIVE_TEXT_MODEL });
    const json = extractJsonBlock(response);

    const fallback: VideoSummary = {
      overview: `This video "${videoTitle}" covers important educational content. ${videoDescription.slice(0, 300)}`,
      keyPoints: [
        'Watch the full video for detailed explanations',
        'Take notes on key concepts presented',
        'Practice with the examples shown'
      ],
      keyConcepts: [
        {
          title: 'Main Topic',
          description: videoDescription.slice(0, 200) || 'Content from this educational video'
        }
      ]
    };

    return safeJsonParse<VideoSummary>(json, fallback);
  } catch (error) {
    console.error('Failed to generate video summary:', error);
    return {
      overview: `This video "${videoTitle}" provides educational content. ${videoDescription.slice(0, 300)}`,
      keyPoints: ['Watch the video for the full content'],
      keyConcepts: []
    };
  }
};

/**
 * Get the raw transcript text for a video
 */
export const getVideoTranscript = async (videoId: string): Promise<string | null> => {
  try {
    return await fetchYouTubeTranscript(videoId);
  } catch (error) {
    console.error('Failed to get video transcript:', error);
    return null;
  }
};

/**
 * Chat with AI about a YouTube video
 * Uses the video transcript and conversation history for context
 */
export const chatAboutVideo = async (
  videoId: string,
  videoTitle: string,
  videoDescription: string,
  userMessage: string,
  conversationHistory: VideoChatMessage[] = [],
  transcriptCache?: string | null
): Promise<string> => {
  console.log(`💬 Chat about video: ${videoId}`);

  // Get transcript if not cached
  let transcript = transcriptCache;
  if (transcript === undefined) {
    try {
      transcript = await fetchYouTubeTranscript(videoId);
    } catch (e) {
      console.warn('Failed to fetch transcript for chat:', e);
      transcript = null;
    }
  }

  // Build conversation context
  const historyText = conversationHistory
    .slice(-6) // Keep last 6 messages for context
    .map(msg => `${msg.role === 'user' ? 'Student' : 'AI Tutor'}: ${msg.content}`)
    .join('\n');

  const contextContent = transcript
    ? `VIDEO TRANSCRIPT (for reference):\n${transcript.slice(0, 10000)}`
    : `VIDEO TITLE: ${videoTitle}\nVIDEO DESCRIPTION: ${videoDescription}`;

  const prompt = `
    You are an AI tutor helping a student understand a YouTube educational video.
    
    VIDEO CONTEXT:
    Title: ${videoTitle}
    ${contextContent}
    
    ${historyText ? `CONVERSATION HISTORY:\n${historyText}\n` : ''}
    
    STUDENT'S QUESTION:
    ${userMessage}
    
    Instructions:
    - Answer the student's question based on the video content
    - Be helpful, clear, and educational
    - If the question is about something not covered in the video, say so politely
    - Use examples from the video when possible
    - Keep your response concise (1-2 short paragraphs max)
    - If asked to summarize, provide a structured summary
    - If asked about specific concepts, explain them clearly
    - Format your response using Markdown (bold, italic, lists, code blocks) for better readability
    - IMPORTANT: You must complete your answer within 1000 tokens. Do not leave the response incomplete.
  `;

  try {
    const response = await generateTextContent(prompt, { maxOutputTokens: 1000 });
    return response;
  } catch (error) {
    console.error('Failed to generate chat response:', error);
    return "I'm sorry, I encountered an error while processing your question. Please try again.";
  }
};

/**
 * Generate quiz questions based on video content
 */
export const generateVideoQuiz = async (
  videoId: string,
  videoTitle: string,
  videoDescription: string,
  transcriptCache?: string | null
): Promise<QuizQuestion[]> => {
  console.log(`📝 Generating quiz for video: ${videoId}`);

  // Get transcript if not cached
  let transcript = transcriptCache;
  if (transcript === undefined) {
    try {
      transcript = await fetchYouTubeTranscript(videoId);
    } catch (e) {
      console.warn('Failed to fetch transcript for quiz:', e);
      transcript = null;
    }
  }

  const contentToAnalyze = transcript
    ? `VIDEO TRANSCRIPT:\n${transcript.slice(0, 12000)}`
    : `VIDEO TITLE: ${videoTitle}\n\nVIDEO DESCRIPTION:\n${videoDescription}`;

  const prompt = `
    Generate a 5-question multiple-choice quiz based on this YouTube video content.
    
    ${contentToAnalyze}
    
    Return a JSON array:
    [
      {
        "question": "Clear question testing understanding of the video content?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswerIndex": 0,
        "explanation": "Brief explanation of why this is the correct answer, referencing the video content."
      }
    ]

    Rules:
    - Questions should test understanding, not just recall
    - Make questions progressively more challenging
    - Include clear explanations
    - Base all questions on the actual video content
  `;

  try {
    const response = await generateTextContent(prompt);
    const json = extractJsonBlock(response);

    const fallback: QuizQuestion[] = [{
      question: `What is the main topic discussed in "${videoTitle}"?`,
      options: ['Topic A', 'Topic B', 'Topic C', 'Topic D'],
      correctAnswerIndex: 0,
      explanation: 'Watch the video for the detailed answer.'
    }];

    return safeJsonParse<QuizQuestion[]>(json, fallback);
  } catch (error) {
    console.error('Failed to generate video quiz:', error);
    return [];
  }
};

/**
 * Generate flashcards from video content
 */
export interface Flashcard {
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const generateVideoFlashcards = async (
  videoId: string,
  videoTitle: string,
  videoDescription: string,
  transcriptCache?: string | null
): Promise<Flashcard[]> => {
  console.log(`🃏 Generating flashcards for video: ${videoId}`);

  // Get transcript if not cached
  let transcript = transcriptCache;
  if (transcript === undefined) {
    try {
      transcript = await fetchYouTubeTranscript(videoId);
    } catch (e) {
      console.warn('Failed to fetch transcript for flashcards:', e);
      transcript = null;
    }
  }

  const contentToAnalyze = transcript
    ? `VIDEO TRANSCRIPT:\n${transcript.slice(0, 12000)}`
    : `VIDEO TITLE: ${videoTitle}\n\nVIDEO DESCRIPTION:\n${videoDescription}`;

  const prompt = `
    Generate educational flashcards based on this YouTube video content.
    
    ${contentToAnalyze}
    
    Return a JSON array of 8-10 flashcards:
    [
      {
        "front": "Question or term to remember",
        "back": "Answer or definition",
        "difficulty": "easy" | "medium" | "hard"
      }
    ]

    Rules:
    - Create a mix of difficulty levels
    - Front should be concise questions or terms
    - Back should be clear, memorable answers
    - Cover the main concepts from the video
    - Make them useful for studying
  `;

  try {
    const response = await generateTextContent(prompt);
    const json = extractJsonBlock(response);

    const fallback: Flashcard[] = [{
      front: `What is "${videoTitle}" about?`,
      back: videoDescription.slice(0, 200) || 'Educational content',
      difficulty: 'easy'
    }];

    return safeJsonParse<Flashcard[]>(json, fallback);
  } catch (error) {
    console.error('Failed to generate flashcards:', error);
    return [];
  }
};

/**
 * Generate a podcast script between two speakers
 */
export const generatePodcastScript = async (
  topic: string,
  context?: string
): Promise<string> => {
  console.log(`🎙️ Generating podcast script for topic: ${topic}`);

  const prompt = `
    Create a podcast script between two speakers: "Host" (Male) and "Expert" (Female).
    
    TOPIC: ${topic}
    ${context ? `CONTEXT:\n${context}` : ''}
    
    Instructions:
    - The conversation should be engaging, educational, and natural.
    - It should be around 800-1000 words.
    - Use "Host" and "Expert" as speaker labels.
    - Format:
      Host: [Text]
      Expert: [Text]
    - Do not include stage directions or sound effects, just the dialogue.
    - Make it sound like a real podcast with back-and-forth interaction.
  `;

  try {
    const response = await generateTextContent(prompt, { maxOutputTokens: 2000, model: IMMERSIVE_TEXT_MODEL });
    return response;
  } catch (error) {
    console.error('Failed to generate podcast script:', error);
    throw error;
  }
};



/**
 * Generate audio from a podcast script
 */
export const generatePodcastAudio = async (
  script: string
): Promise<ArrayBuffer> => {
  console.log('🔊 Generating podcast audio...');

  // Format the script for TTS with speaker instructions
  // The multi-speaker TTS API expects speaker names to match exactly
  const ttsPrompt = `TTS the following conversation between Host and Expert:

${script}`;

  return await generateMultiSpeakerAudio(ttsPrompt, [
    { name: 'Host', voiceName: 'Puck' },      // Puck is upbeat, good for host
    { name: 'Expert', voiceName: 'Aoede' }    // Aoede is breezy, good for expert
  ]);
};

// ============ SIMULATION GENERATION ============

type SimulationVisualStyle = 'standard' | 'voxel';

/**
 * Blueprint for a 3D educational web application simulation
 */
export interface SimulationBlueprint {
  force_single_html_file: "true";
  meta: {
    topic: string;
    academic_level: "Elementary" | "Middle School" | "High School" | "University" | "Research / PhD";
    complexity_rating: number;
  };
  visual_design: {
    theme: "light" | "dark";
    background_hex: string;
    accent_hex: string;
  };
  simulation_logic: {
    scene_description: string;
    preferred_library: "Three.js (Standard)" | "NGL.js / JSmol (Proteins & Chemistry)" | "CircuitJS (Electrical Engineering)" | "MathBox (Complex Calculus/Physics)" | "D3.js (Data Visualization)";
    camera_type: "OrbitControls" | "FirstPerson" | "Fixed" | "Orthographic (2D Technical)";
    entities: Array<{
      name: string;
      asset_type: "primitive_geometry" | "pdb_id" | "gltf_model_url" | "circuit_netlist" | "mathematical_function";
      asset_data: string;
      behavior: string;
    }>;
  };
  interactive_controls: Array<{
    label: string;
    control_type: "slider" | "toggle" | "button" | "text_input";
    variable_affected: string;
  }>;
  educational_content: {
    title: string;
    summary: string;
    key_points: string[];
  };
}

/**
 * The JSON Schema for the simulation blueprint - used with Gemini structured output
 */
const SIMULATION_BLUEPRINT_SCHEMA = {
  type: "object",
  description: "Blueprint for a high-fidelity 3D educational web application based on academic PDF analysis.",
  properties: {
    force_single_html_file: {
      type: "string",
      description: "STRICT REQUIREMENT: The output must always be a single, self-contained HTML file. Always return the string 'true'.",
      enum: ["true"]
    },
    meta: {
      type: "object",
      properties: {
        topic: { type: "string" },
        academic_level: {
          type: "string",
          enum: ["Elementary", "Middle School", "High School", "University", "Research / PhD"]
        },
        complexity_rating: {
          type: "integer",
          minimum: 1,
          maximum: 10
        }
      },
      required: ["topic", "academic_level", "complexity_rating"]
    },
    visual_design: {
      type: "object",
      properties: {
        theme: {
          type: "string",
          description: "UI theme preference. Dark mode is standard for university-level tools.",
          enum: ["light", "dark"]
        },
        background_hex: { type: "string" },
        accent_hex: { type: "string" }
      },
      required: ["theme", "background_hex", "accent_hex"]
    },
    simulation_logic: {
      type: "object",
      description: "Logic defining the 3D environment and specialized engines required.",
      properties: {
        scene_description: { type: "string" },
        preferred_library: {
          type: "string",
          description: "The specific JS library best suited for this academic topic.",
          enum: [
            "Three.js (Standard)",
            "NGL.js / JSmol (Proteins & Chemistry)",
            "CircuitJS (Electrical Engineering)",
            "MathBox (Complex Calculus/Physics)",
            "D3.js (Data Visualization)"
          ]
        },
        camera_type: {
          type: "string",
          enum: ["OrbitControls", "FirstPerson", "Fixed", "Orthographic (2D Technical)"]
        },
        entities: {
          type: "array",
          description: "List of specific scientific objects or models to load.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              asset_type: {
                type: "string",
                description: "Defines if the object is a basic shape, a molecular ID, a 3D model file, or raw data.",
                enum: ["primitive_geometry", "pdb_id", "gltf_model_url", "circuit_netlist", "mathematical_function"]
              },
              asset_data: {
                type: "string",
                description: "The specific data required. E.g., '1CRN' for a protein, a URL for a model, or a formula."
              },
              behavior: { type: "string" }
            },
            required: ["name", "asset_type", "asset_data", "behavior"]
          }
        }
      },
      required: ["scene_description", "preferred_library", "camera_type", "entities"]
    },
    interactive_controls: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          control_type: {
            type: "string",
            enum: ["slider", "toggle", "button", "text_input"]
          },
          variable_affected: { type: "string" }
        },
        required: ["label", "control_type", "variable_affected"]
      }
    },
    educational_content: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_points: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["title", "summary", "key_points"]
    }
  },
  required: ["force_single_html_file", "meta", "visual_design", "simulation_logic", "interactive_controls", "educational_content"]
};

/**
 * Generate a simulation blueprint from document context using Gemini structured output
 */
export const generateSimulationBlueprint = async (
  documentText: string,
  topic: string,
  options?: { visualStyle?: SimulationVisualStyle }
): Promise<SimulationBlueprint> => {
  console.log('🎮 Generating simulation blueprint for:', topic);

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const voxelStyleRequirements = options?.visualStyle === 'voxel'
    ? `
VOXEL STYLE REQUIREMENTS:
- Use a voxel aesthetic: blocky cube-based shapes, grid-aligned, low-poly look
- Prefer "Three.js (Standard)" and primitive geometry for all entities
- Avoid external model URLs, photo textures, or smooth meshes
- Keep visuals clean, professional, and educational`
    : '';

  const prompt = `You are an expert educational simulation designer. Analyze the following academic document and create a detailed blueprint for an interactive 3D educational simulation.

DOCUMENT TOPIC: ${topic}

DOCUMENT CONTENT:
${documentText.substring(0, 15000)}

REQUIREMENTS:
1. Identify the key concepts that would benefit from visualization
2. Choose the most appropriate 3D library for the subject matter
3. Design interactive controls that help students explore the concept
4. Include educational content that explains what students will learn
5. Make sure the simulation is engaging and scientifically accurate
${voxelStyleRequirements}

Create a blueprint that a developer could use to build a complete educational simulation.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMMERSIVE_TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SIMULATION_BLUEPRINT_SCHEMA
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Blueprint generation error:', errorText);
      throw new Error(`Failed to generate blueprint: ${response.status}`);
    }

    const data = await response.json();
    const blueprintText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!blueprintText) {
      throw new Error('No blueprint generated');
    }

    console.log('✅ Blueprint generated successfully');
    const blueprint = JSON.parse(blueprintText) as SimulationBlueprint;
    if (options?.visualStyle === 'voxel') {
      blueprint.simulation_logic.preferred_library = 'Three.js (Standard)';
    }
    return blueprint;
  } catch (error) {
    console.error('Failed to generate simulation blueprint:', error);
    throw error;
  }
};

/**
 * Generate HTML simulation code from a blueprint using Gemini 3 Pro
 */
export const generateSimulationHTML = async (
  blueprint: SimulationBlueprint,
  options?: { visualStyle?: SimulationVisualStyle }
): Promise<string> => {
  console.log('🔨 Generating simulation HTML from blueprint using Gemini 3 Pro...');

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  // Determine which library and setup to use based on blueprint
  const preferredLibrary = options?.visualStyle === 'voxel'
    ? 'Three.js (Standard)'
    : blueprint.simulation_logic.preferred_library;
  const librarySetup = getLibrarySetup(preferredLibrary);
  const voxelStyleRequirements = options?.visualStyle === 'voxel'
    ? `
VOXEL STYLE REQUIREMENTS:
- Build all entities from BoxGeometry voxel blocks (no smooth meshes)
- Use flat shading and a clean, limited color palette
- Keep models grid-aligned and blocky, with readable silhouettes
- Avoid external textures, model URLs, or image assets`
    : '';

  const prompt = `You are an expert web developer. Generate a COMPLETE, working HTML file for this educational simulation.

SIMULATION REQUIREMENTS:
- Topic: ${blueprint.educational_content.title}
- Summary: ${blueprint.educational_content.summary}
- Library: ${preferredLibrary}
- Theme: ${blueprint.visual_design.theme} (background: ${blueprint.visual_design.background_hex}, accent: ${blueprint.visual_design.accent_hex})
- Scene: ${blueprint.simulation_logic.scene_description}
- Entities: ${blueprint.simulation_logic.entities.map(e => `${e.name}: ${e.behavior}`).join('; ')}
- Controls: ${blueprint.interactive_controls.map(c => `${c.label} (${c.control_type})`).join(', ')}
${voxelStyleRequirements}

CRITICAL INSTRUCTIONS:
1. Start with <!DOCTYPE html> - output ONLY HTML, no markdown
2. Use this exact library setup:
${librarySetup}

3. Create a split layout:
   - LEFT (70%): Canvas/visualization area with dark background
   - RIGHT (30%): Info panel with title, description, controls

4. The visualization MUST show something immediately - use simple shapes if complex models fail
5. All controls must be functional and affect the visualization
6. Include smooth animations

Generate the complete HTML now:`;

  try {
    // Use Immersive Learning model for best code generation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMMERSIVE_TEXT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 32000,
            temperature: 1.0  // Gemini 3 works best at temperature 1.0
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTML generation error:', errorText);
      // Fallback to the same model via a simpler prompt if primary call fails
      console.log(`Falling back to ${IMMERSIVE_TEXT_MODEL}...`);
      return await generateSimulationHTMLFallback(blueprint, apiKey, options);
    }

    const data = await response.json();
    let htmlContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!htmlContent) {
      console.log('No HTML from Gemini 3, trying fallback...');
      return await generateSimulationHTMLFallback(blueprint, apiKey, options);
    }

    // Clean up the response - remove markdown code blocks if present
    htmlContent = cleanHtmlResponse(htmlContent);

    // Validate HTML
    if (!htmlContent.includes('<html') && !htmlContent.includes('<!DOCTYPE')) {
      console.log('Invalid HTML structure, trying fallback...');
      return await generateSimulationHTMLFallback(blueprint, apiKey, options);
    }

    console.log('✅ Simulation HTML generated successfully, length:', htmlContent.length);
    return htmlContent;
  } catch (error) {
    console.error('Failed to generate simulation HTML:', error);
    // Try fallback
    try {
      return await generateSimulationHTMLFallback(blueprint, apiKey, options);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      // Return a basic working simulation
      return generateBasicSimulationHTML(blueprint, options);
    }
  }
};

/**
 * Get library-specific setup code
 */
const getLibrarySetup = (library: string): string => {
  switch (library) {
    case 'Three.js (Standard)':
      return `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>`;

    case 'CircuitJS (Electrical Engineering)':
      return `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<!-- Circuit visualization using Three.js primitives -->`;

    case 'D3.js (Data Visualization)':
      return `<script src="https://d3js.org/d3.v7.min.js"></script>`;

    case 'NGL.js / JSmol (Proteins & Chemistry)':
      return `<script src="https://unpkg.com/ngl@2.0.0-dev.39/dist/ngl.js"></script>`;

    case 'MathBox (Complex Calculus/Physics)':
      return `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mathbox@2.3.1/build/mathbox-bundle.min.js"></script>`;

    default:
      return `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`;
  }
};

/**
 * Clean HTML response from markdown artifacts
 */
const cleanHtmlResponse = (html: string): string => {
  let cleaned = html.trim();

  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```html\s*\n?/i, '');
  cleaned = cleaned.replace(/^```\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  // Extract HTML if wrapped in other content
  const htmlMatch = cleaned.match(/<!DOCTYPE html[\s\S]*<\/html>/i) ||
    cleaned.match(/<html[\s\S]*<\/html>/i);
  if (htmlMatch) {
    cleaned = htmlMatch[0];
  }

  return cleaned;
};

/**
 * Fallback HTML generation using the Immersive Learning model
 */
const generateSimulationHTMLFallback = async (
  blueprint: SimulationBlueprint,
  apiKey: string,
  options?: { visualStyle?: SimulationVisualStyle }
): Promise<string> => {
  console.log(`🔄 Using fallback generation with ${IMMERSIVE_TEXT_MODEL}...`);

  const voxelStyleRequirements = options?.visualStyle === 'voxel'
    ? `
Voxel requirements:
- Use only BoxGeometry voxel blocks with flat shading
- Keep a blocky, grid-aligned look with simple colors
- Avoid external textures or model URLs`
    : '';

  const prompt = `Generate a simple but working HTML simulation for: "${blueprint.educational_content.title}"

Requirements:
- Use Three.js from CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- Dark background, rotating 3D shapes representing the concept
- Info panel on the right with title and description
- At least one slider control that affects the animation
${voxelStyleRequirements}

Output ONLY the HTML code starting with <!DOCTYPE html>:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMMERSIVE_TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 16000,
          temperature: 0.7
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error('Fallback generation failed');
  }

  const data = await response.json();
  let htmlContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!htmlContent) {
    throw new Error('No HTML from fallback');
  }

  return cleanHtmlResponse(htmlContent);
};

/**
 * Generate a basic working simulation when all else fails
 */
const generateBasicSimulationHTML = (
  blueprint: SimulationBlueprint,
  options?: { visualStyle?: SimulationVisualStyle }
): string => {
  const theme = blueprint.visual_design.theme;
  const bgColor = blueprint.visual_design.background_hex || (theme === 'dark' ? '#1a1a2e' : '#ffffff');
  const accentColor = blueprint.visual_design.accent_hex || '#ff6d01';
  const useVoxel = options?.visualStyle === 'voxel';
  const meshSetup = useVoxel
    ? `    // Create voxel objects
    const voxelGroup = new THREE.Group();
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const palette = ['${accentColor}', '#5b8cff', '#4ade80', '#f59e0b'];
    const positions = [
      [0, 0, 0],
      [1.1, 0, 0],
      [-1.1, 0, 0],
      [0, 1.1, 0],
      [0, -1.1, 0],
      [0, 0, 1.1]
    ];
    positions.forEach((pos, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: palette[index % palette.length],
        roughness: 0.8,
        metalness: 0.1,
        flatShading: true
      });
      const cube = new THREE.Mesh(cubeGeometry, material);
      cube.position.set(pos[0], pos[1], pos[2]);
      voxelGroup.add(cube);
    });
    const mesh = voxelGroup;
    scene.add(mesh);`
    : `    // Create objects
    const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const material = new THREE.MeshPhongMaterial({ 
      color: '${accentColor}',
      shininess: 100,
      specular: 0x444444
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${blueprint.educational_content.title}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex; 
      height: 100vh; 
      background: ${bgColor};
      color: ${theme === 'dark' ? '#fff' : '#333'};
    }
    #canvas-container { 
      flex: 1; 
      position: relative;
    }
    #info-panel {
      width: 320px;
      padding: 24px;
      background: ${theme === 'dark' ? '#16213e' : '#f5f5f5'};
      overflow-y: auto;
      border-left: 1px solid ${theme === 'dark' ? '#0f3460' : '#ddd'};
    }
    h1 { 
      font-size: 1.5rem; 
      margin-bottom: 16px;
      color: ${accentColor};
    }
    p { 
      line-height: 1.6; 
      margin-bottom: 16px;
      opacity: 0.9;
    }
    .control-group {
      margin-bottom: 20px;
    }
    .control-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
    input[type="range"] {
      width: 100%;
      accent-color: ${accentColor};
    }
    .key-points {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid ${theme === 'dark' ? '#0f3460' : '#ddd'};
    }
    .key-points h3 {
      margin-bottom: 12px;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
    }
    .key-points li {
      margin-bottom: 8px;
      padding-left: 16px;
      position: relative;
    }
    .key-points li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: ${accentColor};
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="info-panel">
    <h1>${blueprint.educational_content.title}</h1>
    <p>${blueprint.educational_content.summary}</p>
    
    <div class="control-group">
      <label>Animation Speed</label>
      <input type="range" id="speed" min="0.1" max="3" step="0.1" value="1">
    </div>
    
    <div class="control-group">
      <label>Scale</label>
      <input type="range" id="scale" min="0.5" max="2" step="0.1" value="1">
    </div>
    
    <div class="key-points">
      <h3>Key Learning Points</h3>
      <ul>
        ${blueprint.educational_content.key_points.map(p => `<li>${p}</li>`).join('\n        ')}
      </ul>
    </div>
  </div>

  <script>
    // Three.js Setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${bgColor}');
    
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    
${meshSetup}
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, -5, 5);
    scene.add(pointLight);
    
    // Controls
    let speed = 1;
    let scale = 1;
    
    document.getElementById('speed').addEventListener('input', (e) => {
      speed = parseFloat(e.target.value);
    });
    
    document.getElementById('scale').addEventListener('input', (e) => {
      scale = parseFloat(e.target.value);
      mesh.scale.setScalar(scale);
    });
    
    // Animation
    function animate() {
      requestAnimationFrame(animate);
      mesh.rotation.x += 0.01 * speed;
      mesh.rotation.y += 0.01 * speed;
      renderer.render(scene, camera);
    }
    animate();
    
    // Resize handler
    window.addEventListener('resize', () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
  </script>
</body>
</html>`;
};

/**
 * Generate complete simulation (blueprint + HTML) from document context
 */
export const generateSimulation = async (
  documentText: string,
  topic: string,
  onProgress?: (stage: string) => void,
  options?: { visualStyle?: SimulationVisualStyle }
): Promise<{ blueprint: SimulationBlueprint; html: string }> => {
  console.log('🎮 Starting full simulation generation for:', topic);

  // Step 1: Generate blueprint
  onProgress?.('Analyzing document and creating simulation blueprint...');
  const blueprint = await generateSimulationBlueprint(documentText, topic, options);

  // Step 2: Generate HTML from blueprint  
  onProgress?.('Generating interactive simulation code...');
  const html = await generateSimulationHTML(blueprint, options);

  return { blueprint, html };
};

// ============================================================================
// ROBOTICS VISION - Gemini Robotics-ER 1.5 Features
// ============================================================================

export interface DetectedObject {
  point: [number, number]; // [y, x] normalized 0-1000
  label: string;
  confidence?: number;
}

export interface BoundingBox {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  label: string;
}

export interface TrajectoryPoint {
  point: [number, number];
  label: string;
}

export interface RoboticsAnalysis {
  objects: DetectedObject[];
  boundingBoxes?: BoundingBox[];
  trajectories?: TrajectoryPoint[];
  sceneDescription?: string;
  spatialReasoning?: string;
}

// Gemini Robotics-ER 1.5 for advanced robotics vision capabilities
const ROBOTICS_MODEL = 'gemini-robotics-er-1.5-preview';

/**
 * Detect and point to objects in an image using Gemini Robotics-ER
 */
export const detectObjectsInImage = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  maxObjects: number = 15
): Promise<DetectedObject[]> => {
  console.log('🤖 Detecting objects with Gemini Robotics-ER...');

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Point to no more than ${maxObjects} items in the image. The label returned should be an identifying name for the object detected.
The answer should follow the json format: [{"point": <point>, "label": <label>}, ...]. The points are in [y, x] format normalized to 0-1000.
If no objects are found, return an empty JSON list [].`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Robotics API error response:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Robotics API error details:', errorJson);
        throw new Error(`Robotics API error: ${response.status} - ${errorJson.error?.message || errorText}`);
      } catch {
        throw new Error(`Robotics API error: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const objects = JSON.parse(jsonMatch[0]) as DetectedObject[];
      console.log(`✅ Detected ${objects.length} objects`);
      return objects;
    }

    return [];
  } catch (error) {
    console.error('Failed to detect objects:', error);
    throw error;
  }
};

/**
 * Detect objects with bounding boxes
 */
export const detectBoundingBoxes = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  maxObjects: number = 25
): Promise<BoundingBox[]> => {
  console.log('🤖 Detecting bounding boxes with Gemini Robotics-ER...');

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Return bounding boxes as a JSON array with labels. Never return masks or code fencing. Limit to ${maxObjects} objects.
If an object is present multiple times, name them according to their unique characteristic (colors, size, position, unique characteristics, etc..).
The format should be as follows: [{"box_2d": [ymin, xmin, ymax, xmax], "label": <label for the object>}] normalized to 0-1000. The values in box_2d must only be integers.
If no objects are found, return an empty JSON list [].`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bounding box API error response:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Bounding box API error details:', errorJson);
        throw new Error(`Robotics API error: ${response.status} - ${errorJson.error?.message || errorText}`);
      } catch {
        throw new Error(`Robotics API error: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const boxes = JSON.parse(jsonMatch[0]) as BoundingBox[];
      console.log(`✅ Detected ${boxes.length} bounding boxes`);
      return boxes;
    }

    return [];
  } catch (error) {
    console.error('Failed to detect bounding boxes:', error);
    throw error;
  }
};

/**
 * Find specific objects by query
 */
export const findSpecificObjects = async (
  imageBase64: string,
  queries: string[],
  mimeType: string = 'image/jpeg'
): Promise<DetectedObject[]> => {
  console.log('🤖 Finding specific objects:', queries);

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Get all points matching the following objects: ${queries.join(', ')}.
The label returned should be an identifying name for the object detected.
The answer should follow the json format: [{"point": <point>, "label": <label>}, ...]. The points are in [y, x] format normalized to 0-1000.
If no matching objects are found, return an empty JSON list [].`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DetectedObject[];
    }

    return [];
  } catch (error) {
    console.error('Failed to find specific objects:', error);
    throw error;
  }
};

/**
 * Find objects by category (e.g., "fruit", "electronics", "furniture")
 */
export const findObjectsByCategory = async (
  imageBase64: string,
  category: string,
  mimeType: string = 'image/jpeg'
): Promise<DetectedObject[]> => {
  console.log('🤖 Finding objects by category:', category);

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Get all points for ${category}. The label returned should be an identifying name for the object detected.
The answer should follow the json format: [{"point": <point>, "label": <label>}, ...]. The points are in [y, x] format normalized to 0-1000.
If no objects in this category are found, return an empty JSON list [].`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DetectedObject[];
    }

    return [];
  } catch (error) {
    console.error('Failed to find objects by category:', error);
    throw error;
  }
};

/**
 * Describe the scene and understand spatial relationships
 */
export const analyzeSceneSpatially = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  question?: string
): Promise<{ description: string; objects: DetectedObject[] }> => {
  console.log('🤖 Analyzing scene spatially...');

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = question
    ? `${question}

Point to relevant objects in your response.
For each object mentioned, provide coordinates in the format: [{"point": [y, x], "label": <label>}] where coordinates are normalized between 0-1000.
First provide your analysis, then at the end provide a JSON array of all relevant object points.`
    : `Describe this scene in detail. Identify all visible objects and explain their spatial relationships.
Point to key objects in the scene.
At the end, provide a JSON array of detected objects: [{"point": [y, x], "label": <label>}] where coordinates are normalized between 0-1000.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            // Higher thinking budget for complex reasoning
            thinkingConfig: { thinkingBudget: 1024 }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract description (everything before the JSON array)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const description = jsonMatch
      ? text.substring(0, text.indexOf(jsonMatch[0])).trim()
      : text;

    let objects: DetectedObject[] = [];
    if (jsonMatch) {
      try {
        objects = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn('Could not parse objects from spatial analysis');
      }
    }

    return { description, objects };
  } catch (error) {
    console.error('Failed to analyze scene spatially:', error);
    throw error;
  }
};

/**
 * Generate trajectory points for moving an object
 */
export const generateTrajectory = async (
  imageBase64: string,
  fromObject: string,
  toLocation: string,
  mimeType: string = 'image/jpeg',
  numPoints: number = 15
): Promise<TrajectoryPoint[]> => {
  console.log('🤖 Generating trajectory from', fromObject, 'to', toLocation);

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Place a point on the ${fromObject}, then ${numPoints} points for the trajectory of moving the ${fromObject} to ${toLocation}.
The points should be labeled by order of the trajectory, from '0' (start point) to <n> (final point).
The answer should follow the json format: [{"point": <point>, "label": <label>}, ...]. The points are in [y, x] format normalized to 0-1000.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TrajectoryPoint[];
    }

    return [];
  } catch (error) {
    console.error('Failed to generate trajectory:', error);
    throw error;
  }
};

/**
 * Classify objects with detailed attributes
 */
export const classifyObjectsDetailed = async (
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ classifications: { label: string; attributes: string[]; point: [number, number] }[] }> => {
  console.log('🤖 Classifying objects with detailed attributes...');

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Identify and classify all visible objects in detail. For each object, provide:
1. A specific label
2. Key attributes (color, size, material, state, etc.)
3. Location point

Return as JSON: [{"label": <name>, "attributes": [<attr1>, <attr2>, ...], "point": [y, x]}] where coordinates are normalized 0-1000.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            thinkingConfig: { thinkingBudget: 512 }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return { classifications: JSON.parse(jsonMatch[0]) };
    }

    return { classifications: [] };
  } catch (error) {
    console.error('Failed to classify objects:', error);
    throw error;
  }
};

/**
 * Answer questions about the scene (Visual QA)
 */
export const answerSceneQuestion = async (
  imageBase64: string,
  question: string,
  mimeType: string = 'image/jpeg'
): Promise<{ answer: string; relevantObjects: DetectedObject[] }> => {
  console.log('🤖 Answering scene question:', question);

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `${question}

Point to any relevant objects in your answer.
Provide your response, then at the end include a JSON array of relevant object locations: [{"point": [y, x], "label": <label>}] normalized 0-1000.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 1024 }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const answer = jsonMatch
      ? text.substring(0, text.indexOf(jsonMatch[0])).trim()
      : text;

    let relevantObjects: DetectedObject[] = [];
    if (jsonMatch) {
      try {
        relevantObjects = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn('Could not parse objects from answer');
      }
    }

    return { answer, relevantObjects };
  } catch (error) {
    console.error('Failed to answer scene question:', error);
    throw error;
  }
};

/**
 * Count objects of a specific type
 */
export const countObjects = async (
  imageBase64: string,
  objectType: string,
  mimeType: string = 'image/jpeg'
): Promise<{ count: number; objects: DetectedObject[] }> => {
  console.log('🤖 Counting objects of type:', objectType);

  const { getSharedGeminiApiKey } = await import('../firebase/apiKeys');
  const apiKey = await getSharedGeminiApiKey();

  const prompt = `Count all ${objectType} visible in this image. Point to each one.
Return: {"count": <number>, "objects": [{"point": [y, x], "label": <label>}, ...]} with coordinates normalized 0-1000.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ROBOTICS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
            // Higher thinking budget for counting accuracy
            thinkingConfig: { thinkingBudget: 2048 }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Robotics API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"count": 0, "objects": []}';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        count: result.count || 0,
        objects: result.objects || []
      };
    }

    return { count: 0, objects: [] };
  } catch (error) {
    console.error('Failed to count objects:', error);
    throw error;
  }
};
