import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Loader2, Sparkles, Download, Check, RefreshCw, BookOpen, ChevronRight, X, FileText, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { streamTextContent, generateImage } from '../services/geminiService';

export const InteractiveAssignmentWorkspace: React.FC = () => {
    const [fileData, setFileData] = useState<{ mimeType: string, data: string } | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null); // Legacy text content
    const [fileName, setFileName] = useState<string | null>(null);
    const [topic, setTopic] = useState<string>('');
    const [extractFormulaSheet, setExtractFormulaSheet] = useState<boolean>(false);
    const [questionAndAnswer, setQuestionAndAnswer] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [loadingStep, setLoadingStep] = useState<string>('Ready');
    const [thoughtLog, setThoughtLog] = useState<string[]>([]);
    const [isStreamingThoughts, setIsStreamingThoughts] = useState(false);
    const [showCursor, setShowCursor] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [formulaHtml, setFormulaHtml] = useState<string | null>(null);
    const [isExtractingFormulas, setIsExtractingFormulas] = useState(false);
    const [qaHtml, setQaHtml] = useState<string | null>(null);
    const [isExtractingQA, setIsExtractingQA] = useState(false);
    const [qaUrl, setQaUrl] = useState<string>('');
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);
    const [isCheckingAnswers, setIsCheckingAnswers] = useState(false);
    const [correctedImage, setCorrectedImage] = useState<string | null>(null);
    const terminalRef = useRef<HTMLDivElement>(null);
    
    // Function to generate marked paper image using Gemini 3 Pro Image Preview
    const generateMarkedPaperImage = async (
        imageBase64: string,
        mimeType: string,
        prompt: string
    ): Promise<string> => {
        // Import necessary modules
        const { GoogleGenAI } = await import('@google/genai');
        const { executeWithRotation } = await import('../services/apiKeyRotation');
        
        setThoughtLog(prev => [...prev, '🎨 Using Gemini 3 Pro Image Preview (nano-banana-pro) with 1K resolution...']);
        
        // Use executeWithRotation to get API key and make the request
        return await executeWithRotation(async (apiKey: string) => {
            const genAI = new GoogleGenAI({ apiKey });
            
            // Use Gemini 3 Pro Image Preview with image input and image output
            // According to Gemini 3 docs: https://ai.google.dev/gemini-api/docs/gemini-3#image-gen-strict
            // Note: thinkingConfig is not supported for image-preview model
            const response = await genAI.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageBase64 } },
                        { text: prompt }
                    ]
                }],
                config: {
                    imageConfig: {
                        aspectRatio: '4:3',
                        imageSize: '1K' // 1K resolution as requested
                    },
                    responseModalities: ['Image'] // Request image output
                }
            } as any);
            
            // Extract the generated image
            const candidates = response.candidates;
            if (!candidates || candidates.length === 0) {
                throw new Error('No image candidates returned');
            }
            
            const parts = candidates[0].content?.parts;
            if (!parts || parts.length === 0) {
                throw new Error('No image parts returned');
            }
            
            const imagePart = parts.find((p: any) => p.inlineData);
            if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
                throw new Error('No image data found in response');
            }
            
            return imagePart.inlineData.data;
        });
    };
    
    // Remove any external polyfill.io scripts the model might inject so previews don't fail on blocked domains
    const stripPolyfillScripts = (html: string) =>
        html.replace(
            /<script[^>]+src=[\"']https?:\/\/(?:cdn\.)?polyfill\.io\/[^\"']+[\"'][^>]*>\s*<\/script>/gi,
            ''
        );

    // Animated cursor effect
    useEffect(() => {
        if (!isStreamingThoughts) {
            setShowCursor(false);
            return;
        }
        const interval = setInterval(() => {
            setShowCursor((prev) => !prev);
        }, 500);
        return () => clearInterval(interval);
    }, [isStreamingThoughts]);

    // Auto-scroll terminal
    React.useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [thoughtLog]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoadingStep('Reading file...');

        // Check if it's an image or PDF
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64String = e.target?.result as string;
                // Remove data URL prefix
                const base64Data = base64String.split(',')[1];
                setFileData({
                    mimeType: file.type,
                    data: base64Data
                });
                setFileContent(null); // Clear legacy text content
                setLoadingStep('Ready to generate (File attached)');
            };
            reader.readAsDataURL(file);
        } else {
            // Fallback for text files
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setFileContent(text);
                setFileData(null);
                setLoadingStep('Ready to generate');
            };
            reader.readAsText(file);
        }
    };

    const fetchWebpageScreenshot = async (url: string): Promise<{ mimeType: string, data: string } | null> => {
        setIsFetchingUrl(true);
        setLoadingStep('Fetching webpage content...');
        setThoughtLog(prev => [...prev, `🌐 Fetching content from: ${url}`]);

        try {
            // Validate URL
            const urlObj = new URL(url);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new Error('Only HTTP and HTTPS URLs are supported');
            }

            // Try to use a screenshot service API (free tier available)
            // Using htmlcsstoimage.com API (requires API key) or similar
            // For now, we'll use a CORS proxy to fetch HTML content
            
            // Option 1: Try to fetch HTML via CORS proxy
            const corsProxy = 'https://api.allorigins.win/raw?url=';
            const proxyUrl = corsProxy + encodeURIComponent(url);
            
            setThoughtLog(prev => [...prev, '📥 Fetching webpage HTML...']);
            const htmlResponse = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            if (htmlResponse.ok) {
                const htmlContent = await htmlResponse.text();
                setThoughtLog(prev => [...prev, '✅ Webpage HTML fetched successfully']);
                
                // Convert HTML to base64 for sending to Gemini
                // We'll send it as text/html mime type
                const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
                
                return {
                    mimeType: 'text/html',
                    data: htmlBase64
                };
            } else {
                throw new Error(`Failed to fetch webpage: ${htmlResponse.status}`);
            }
        } catch (error) {
            console.error('Failed to fetch webpage:', error);
            setThoughtLog(prev => [...prev, `⚠️ Could not fetch webpage content directly`]);
            setThoughtLog(prev => [...prev, `📝 Will include URL in prompt for Gemini to fetch`]);
            // Return null to indicate we should use URL in prompt instead
            return null;
        } finally {
            setIsFetchingUrl(false);
        }
    };

    const handleExtractQA = async () => {
        // Check if URL is provided instead of file
        let contentToProcess: { mimeType: string, data: string } | null = null;
        let isUrlMode = false;
        let urlForPrompt = '';

        if (qaUrl && qaUrl.trim()) {
            // URL mode
            try {
                const fetchedContent = await fetchWebpageScreenshot(qaUrl.trim());
                isUrlMode = true;
                urlForPrompt = qaUrl.trim();
                
                if (fetchedContent) {
                    contentToProcess = fetchedContent;
                }
                // If fetchedContent is null, we'll include URL in prompt for Gemini to fetch
            } catch (error) {
                console.error('Error fetching webpage:', error);
                // Continue anyway - we'll include URL in prompt
                isUrlMode = true;
                urlForPrompt = qaUrl.trim();
            }
        } else if (!fileData && !qaUrl.trim()) {
            alert('Please upload a PDF file or provide a webpage URL');
            return;
        } else if (fileData) {
            // File mode
            if (fileData.mimeType !== 'application/pdf') {
                alert('Please upload a PDF file to extract questions and answers');
                return;
            }
            contentToProcess = fileData;
        }

        setIsExtractingQA(true);
        setQuestionAndAnswer(true);
        setQaHtml(null);
        setPreviewHtml(''); // Clear preview during extraction
        setLoadingStep('Initializing Gemini 3 Pro...');
        setThoughtLog([]);
        setIsStreamingThoughts(true);

        try {
            const sourceType = isUrlMode ? 'webpage' : 'PDF document';
            const urlInstruction = isUrlMode && urlForPrompt 
                ? `\n\nIMPORTANT: ${contentToProcess ? 'The content below is from the following webpage URL' : 'Please fetch and analyze the content from the following webpage URL'}: ${urlForPrompt}\n${contentToProcess ? 'Analyze the provided HTML content.' : 'If you have access to fetch URLs, please fetch and analyze the content from this URL directly.'}`
                : '';
            
            const prompt = `You are an expert at extracting and explaining questions and answers from educational documents. Analyze the provided ${sourceType}${isUrlMode && contentToProcess ? ' (HTML content from a webpage)' : isUrlMode ? ' (webpage URL provided)' : ''} and extract ALL questions and their corresponding answers/explanations.${urlInstruction}

CRITICAL REQUIREMENTS:
1. Extract EVERY question found in the document
2. For each question, provide a detailed, step-by-step answer/explanation
3. Organize questions by topic/category if applicable
4. Preserve the context and meaning of each question
5. For EACH question-answer pair, create an ANIMATED, INTERACTIVE Canvas visualization that visually explains the concept

OUTPUT FORMAT:
Generate a complete, self-contained HTML document with:
- Professional styling using Tailwind CSS (via CDN)
- MathJax for rendering LaTeX formulas (via CDN)
- Clean, organized layout with proper sections
- Each Q&A pair should be clearly formatted

VISUALIZATION REQUIREMENTS FOR EACH Q&A:
1. Create an HTML5 Canvas element (width: 600-800px, height: 300-500px) for each question-answer pair
2. Use requestAnimationFrame for smooth, high-frame-rate animations (60fps)
3. Make the visualization INTERACTIVE with controls (sliders, buttons, inputs) to modify parameters
4. Animate the concepts being explained (e.g., if it's about motion, show animated objects; if it's about forces, show animated vectors)
5. Show visual step-by-step solutions when applicable
6. Include labels, diagrams, and visual guides that help understand the answer
7. Use colors and animations that match the concept being explained
8. Add hover effects and tooltips for better interactivity

CANVAS ANIMATION EXAMPLES:
- For physics problems: Animate the physical scenario (projectiles, forces, motion)
- For math problems: Show animated graphs, geometric transformations
- For chemistry problems: Show animated molecular interactions, reactions
- For engineering problems: Show animated systems, mechanisms, circuits
- For conceptual questions: Show animated diagrams explaining the concept

The HTML should:
- Start with <!DOCTYPE html>
- Include proper <head> with MathJax and Tailwind CSS CDN links
- Use <body> with well-structured sections
- Render formulas using MathJax: \\(formula\\) for inline or \\[formula\\] for display
- Include interactive Canvas elements with smooth animations for each Q&A pair
- Use requestAnimationFrame for all animations
- Include interactive controls (sliders, buttons) to modify parameters and see different scenarios
- Be printable and exportable to PDF (canvas can be hidden in print mode)

STRUCTURE FOR EACH Q&A PAIR:
1. Question number/title
2. The question text (formatted clearly)
3. Step-by-step answer/explanation
4. Interactive animated Canvas visualization showing the solution/concept
5. Controls to modify parameters and see different scenarios
6. Key takeaways/formulas used

Return ONLY the complete HTML code, nothing else.`;

            let accumulatedHtml = '';
            let hasStartedOutput = false;
            
            await streamTextContent(
                prompt,
                (chunk) => {
                    // Only accumulate actual HTML content, not thinking
                    if (chunk && chunk.trim() && !chunk.includes('thinking') && !chunk.includes('thought')) {
                        accumulatedHtml += chunk;
                        hasStartedOutput = true;
                        setLoadingStep('Generating Q&A document...');
                        // Update preview in real-time as content streams
                        if (accumulatedHtml.length > 100) {
                            const partialHtml = accumulatedHtml.replace(/^\s*```html\s*/i, '').replace(/```$/, '').trim();
                            if (partialHtml.includes('<') || partialHtml.includes('DOCTYPE')) {
                                setPreviewHtml(partialHtml);
                            }
                        }
                    }
                },
                {
                    model: 'gemini-3-pro-preview',
                    thinking: 'high',
                    inlineData: fileData,
                    onThought: (thought) => {
                        // Show thinking only in sidebar terminal - never in preview
                        setThoughtLog(prev => [...prev, thought]);
                        if (thought.toLowerCase().includes('analyzing') || thought.toLowerCase().includes('extracting')) {
                            setLoadingStep('Analyzing PDF structure...');
                        } else if (thought.toLowerCase().includes('formatting') || thought.toLowerCase().includes('generating')) {
                            setLoadingStep('Formatting Q&A pairs...');
                        } else if (thought.toLowerCase().includes('visualization') || thought.toLowerCase().includes('animation')) {
                            setLoadingStep('Creating visualizations...');
                        } else {
                            setLoadingStep('Processing...');
                        }
                        setIsStreamingThoughts(true);
                    }
                }
            );

            // Clean up response - remove any markdown code blocks
            const cleanHtml = accumulatedHtml
                .replace(/^\s*```html\s*/i, '')
                .replace(/```$/, '')
                .replace(/^\s*```\s*/g, '')
                .trim();

            // Ensure it's valid HTML
            let finalHtml = cleanHtml;
            if (!finalHtml.includes('<!DOCTYPE') && !finalHtml.includes('<html')) {
                // Wrap in HTML structure if needed
                finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Extracted Questions and Answers</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <script>
        window.MathJax = {
            tex: {
                inlineMath: [['\\\\(', '\\\\)']],
                displayMath: [['\\\\[', '\\\\]']]
            }
        };
    </script>
    <style>
        @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
            canvas { display: none; }
        }
    </style>
</head>
<body class="bg-white p-8">
    <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Extracted Questions and Answers</h1>
        ${finalHtml}
    </div>
</body>
</html>`;
            }

            setThoughtLog(prev => [...prev, '✅ Q&A extraction complete']);
            setLoadingStep('Complete!');
            
            // Short delay to show completion before switching to preview
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setQaHtml(finalHtml);
            setPreviewHtml(finalHtml);
            setIsStreamingThoughts(false);
        } catch (error) {
            console.error('Q&A extraction failed:', error);
            setLoadingStep('Error extracting Q&A. Please try again.');
            setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
            setIsStreamingThoughts(false);
            alert('Failed to extract questions and answers. Please ensure the PDF contains Q&A content and try again.');
        } finally {
            setIsExtractingQA(false);
        }
    };

    const handleExtractFormulas = async () => {
        if (!fileData) {
            alert('Please upload a PDF file first');
            return;
        }

        if (fileData.mimeType !== 'application/pdf') {
            alert('Please upload a PDF file to extract formulas');
            return;
        }

        setIsExtractingFormulas(true);
        setExtractFormulaSheet(true);
        setFormulaHtml(null);
        setPreviewHtml(''); // Clear preview during extraction
        setLoadingStep('Initializing Gemini 3 Pro...');
        setThoughtLog([]);
        setIsStreamingThoughts(true);

        try {
            const prompt = `You are a formula extraction expert. Analyze the provided PDF document and extract ALL mathematical formulas, equations, and scientific expressions.

CRITICAL REQUIREMENTS:
1. Extract EVERY formula, equation, and mathematical expression found in the document
2. Format each formula using proper LaTeX syntax
3. Organize formulas by topic/category if applicable
4. Include formula names/descriptions where available
5. Preserve the context and meaning of each formula
6. For EACH formula, create an ANIMATED, INTERACTIVE Canvas visualization that visually explains the formula

OUTPUT FORMAT:
Generate a complete, self-contained HTML document with:
- Professional styling using Tailwind CSS (via CDN)
- MathJax for rendering LaTeX formulas (via CDN)
- Clean, organized layout with proper sections
- Each formula should be clearly labeled and formatted

VISUALIZATION REQUIREMENTS FOR EACH FORMULA:
1. Create an HTML5 Canvas element (width: 600-800px, height: 300-500px) next to or below each formula
2. Use requestAnimationFrame for smooth, high-frame-rate animations (60fps)
3. Make the visualization INTERACTIVE with controls (sliders, buttons, inputs) to modify formula parameters
4. Animate the formula's variables/parameters in real-time based on the actual formula context
5. Show visual representations of what the formula calculates (e.g., if it's velocity, show moving objects; if it's force, show arrows; if it's rotation, show rotating elements)
6. Include labels, axes, and visual guides that help understand the formula
7. Use colors and animations that match the formula's meaning
8. Add hover effects and tooltips for better interactivity

CANVAS ANIMATION EXAMPLES:
- For velocity/speed formulas: Animate objects moving with changing speeds
- For rotation formulas: Show rotating elements with angular velocity visualization
- For force formulas: Show force vectors with animated arrows
- For wave formulas: Show animated wave patterns
- For electrical formulas: Show animated circuits with current flow
- For geometric formulas: Show animated shapes transforming

The HTML should:
- Start with <!DOCTYPE html>
- Include proper <head> with MathJax and Tailwind CSS CDN links
- Use <body> with well-structured sections
- Render formulas using MathJax: \\(formula\\) for inline or \\[formula\\] for display
- Include interactive Canvas elements with smooth animations for each formula
- Use requestAnimationFrame for all animations
- Include interactive controls (sliders, buttons) to modify formula parameters
- Be printable and exportable to PDF (canvas can be hidden in print mode)

STRUCTURE FOR EACH FORMULA:
1. Formula name/title
2. LaTeX-rendered formula (using MathJax)
3. Description/explanation
4. Interactive animated Canvas visualization
5. Controls to modify parameters and see formula behavior

Return ONLY the complete HTML code, nothing else.`;

            let accumulatedHtml = '';
            let hasStartedOutput = false;
            
            await streamTextContent(
                prompt,
                (chunk) => {
                    // Only accumulate actual HTML content, not thinking
                    // The streamTextContent function already filters out thoughts
                    if (chunk && chunk.trim() && !chunk.includes('thinking') && !chunk.includes('thought')) {
                        accumulatedHtml += chunk;
                        hasStartedOutput = true;
                        setLoadingStep('Generating formula sheet...');
                        // Update preview in real-time as content streams
                        if (accumulatedHtml.length > 100) {
                            const partialHtml = accumulatedHtml.replace(/^\s*```html\s*/i, '').replace(/```$/, '').trim();
                            if (partialHtml.includes('<') || partialHtml.includes('DOCTYPE')) {
                                setPreviewHtml(partialHtml);
                            }
                        }
                    }
                },
                {
                    model: 'gemini-3-pro-preview',
                    thinking: 'high',
                    inlineData: fileData,
                    onThought: (thought) => {
                        // Show thinking only in sidebar terminal - never in preview
                        setThoughtLog(prev => [...prev, thought]);
                        if (thought.toLowerCase().includes('analyzing') || thought.toLowerCase().includes('extracting')) {
                            setLoadingStep('Analyzing PDF structure...');
                        } else if (thought.toLowerCase().includes('formatting') || thought.toLowerCase().includes('generating')) {
                            setLoadingStep('Formatting formulas...');
                        } else {
                            setLoadingStep('Processing...');
                        }
                        setIsStreamingThoughts(true);
                    }
                }
            );

            // Clean up response - remove any markdown code blocks
            const cleanHtml = accumulatedHtml
                .replace(/^\s*```html\s*/i, '')
                .replace(/```$/, '')
                .replace(/^\s*```\s*/g, '')
                .trim();

            // Ensure it's valid HTML
            let finalHtml = cleanHtml;
            if (!finalHtml.includes('<!DOCTYPE') && !finalHtml.includes('<html')) {
                // Wrap in HTML structure if needed
                finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Extracted Formula Sheet</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <script>
        window.MathJax = {
            tex: {
                inlineMath: [['\\\\(', '\\\\)']],
                displayMath: [['\\\\[', '\\\\]']]
            }
        };
    </script>
    <style>
        @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body class="bg-white p-8">
    <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Extracted Formula Sheet</h1>
        ${finalHtml}
    </div>
</body>
</html>`;
            }

            setThoughtLog(prev => [...prev, '✅ Formula extraction complete']);
            setLoadingStep('Complete!');
            
            // Short delay to show completion before switching to preview
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setFormulaHtml(finalHtml);
            setPreviewHtml(finalHtml);
            setIsStreamingThoughts(false);
        } catch (error) {
            console.error('Formula extraction failed:', error);
            setLoadingStep('Error extracting formulas. Please try again.');
            setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
            setIsStreamingThoughts(false);
            alert('Failed to extract formulas. Please ensure the PDF contains formulas and try again.');
        } finally {
            setIsExtractingFormulas(false);
        }
    };

    const handleDownloadFormulaPDF = () => {
        if (!formulaHtml) return;
        
        // Create a new window with the HTML content
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to download PDF');
            return;
        }
        
        printWindow.document.write(formulaHtml);
        printWindow.document.close();
        
        // Wait for content to load, then trigger print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleDownloadQAPDF = () => {
        if (!qaHtml) return;
        
        // Create a new window with the HTML content
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to download PDF');
            return;
        }
        
        printWindow.document.write(qaHtml);
        printWindow.document.close();
        
        // Wait for content to load, then trigger print
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    const handleCheckAnswers = async () => {
        if (!fileData) {
            alert('Please upload an image or PDF file with handwritten answers first');
            return;
        }

        // Accept both image files and PDFs for answer checking
        if (!fileData.mimeType.startsWith('image/') && fileData.mimeType !== 'application/pdf') {
            alert('Please upload an image file (JPG, PNG) or PDF file with handwritten answers');
            return;
        }

        setIsCheckingAnswers(true);
        setCorrectedImage(null);
        setPreviewHtml(''); // Clear preview during checking
        setLoadingStep('Initializing Gemini 3 Pro Image Preview...');
        setThoughtLog([]);
        setIsStreamingThoughts(true);

        try {
            setThoughtLog(prev => [...prev, '📝 Analyzing handwritten answers...']);
            setLoadingStep('Analyzing answers...');

            // First, use Gemini 3 Pro Preview to analyze the handwritten answers
            const analysisPrompt = `You are an expert teacher grading handwritten student answers. Analyze this handwritten answer sheet (image or PDF) and provide:

1. A detailed assessment of each answer
2. Correct answers for comparison
3. Marks/points for each question
4. Total score
5. Feedback comments

Return your analysis in a structured format that can be used to mark the paper.`;

            // Use Gemini 3 Pro Preview for analysis
            let analysisResult = '';
            await streamTextContent(
                analysisPrompt,
                (chunk) => {
                    if (chunk && chunk.trim()) {
                        analysisResult += chunk;
                        setThoughtLog(prev => {
                            const lastLog = prev[prev.length - 1] || '';
                            if (lastLog.startsWith('📊 Analysis:')) {
                                return [...prev.slice(0, -1), `📊 Analysis: ${analysisResult.slice(0, 200)}...`];
                            }
                            return [...prev, `📊 Analysis: ${analysisResult.slice(0, 200)}...`];
                        });
                    }
                },
                {
                    model: 'gemini-3-pro-preview',
                    thinking: 'high',
                    inlineData: fileData,
                    onThought: (thought) => {
                        setThoughtLog(prev => [...prev, thought]);
                        if (thought.toLowerCase().includes('analyzing') || thought.toLowerCase().includes('grading')) {
                            setLoadingStep('Grading answers...');
                        } else if (thought.toLowerCase().includes('generating') || thought.toLowerCase().includes('marking')) {
                            setLoadingStep('Generating marked paper...');
                        }
                        setIsStreamingThoughts(true);
                    }
                }
            );

            setThoughtLog(prev => [...prev, '✅ Analysis complete']);
            setLoadingStep('Generating marked paper with check marks and scores...');

            // Now use Gemini 3 Pro Image Preview to generate the marked paper
            const imageGenerationPrompt = `Create a marked and graded version of this handwritten answer sheet (image or PDF page). 

CRITICAL REQUIREMENT: All corrections, markings, and comments MUST be made directly OVER the original image. Do not create a new image or replace the original - overlay the marks on top of the existing handwritten paper.

REQUIREMENTS:
1. Show the ORIGINAL handwritten answers clearly visible - preserve the entire original image
2. Add RED check marks (✓) for correct answers - OVERLAY these directly on the original image
3. Add RED X marks (✗) for incorrect answers with corrections nearby - OVERLAY these directly on the original image
4. Add scores/marks in RED circles or boxes next to each answer (e.g., "5/10", "8/10") - OVERLAY these directly on the original image
5. Add a total score at the top or bottom (e.g., "Total: 45/50") - OVERLAY this directly on the original image
6. Add brief feedback comments in GREEN ink next to answers where needed - use normal, clear handwriting style - OVERLAY these directly on the original image
7. Use a teacher's marking style - neat, clear, professional, normal handwriting
8. Make sure all marks are clearly visible and don't obscure the original handwriting - marks should be OVERLAID on top
9. Use realistic red pen marks for check marks, X marks, and scores - all OVERLAID on the original
10. Use GREEN fine-line pen for all teacher comments and feedback - normal, clear handwriting style - OVERLAID on the original
11. Maintain the original paper/background appearance exactly as it is
12. All teacher comments should be written in GREEN ink with fine-line pen style and normal, clear handwriting - OVERLAID on the original image

The image should look exactly like a real teacher marked this paper by hand with normal handwriting, with all marks OVERLAID directly on the original paper. Include:
- Check marks for correct answers (RED) - OVERLAID on original
- X marks and corrections for wrong answers (RED) - OVERLAID on original
- Numerical scores for each question (RED) - OVERLAID on original
- Total score prominently displayed (RED) - OVERLAID on original
- Helpful feedback comments in GREEN ink with fine-line pen and normal, clear handwriting style - OVERLAID on original

IMPORTANT NOTES:
- All teacher comments and feedback must be written in GREEN ink using a fine-line pen with normal, clear handwriting style (not cursive)
- ALL corrections, markings, and comments must be OVERLAID directly on the original image - do not replace or recreate the image
- The original handwritten paper must remain completely visible with marks added on top of it

Generate this as a high-quality image showing the original paper with marks OVERLAID on top of it, exactly as if a teacher marked it by hand.`;

            setThoughtLog(prev => [...prev, '🎨 Generating marked paper image with Gemini 3 Pro Image Preview...']);
            
            // Use Gemini 3 Pro Image Preview to generate the marked paper
            // We need to send both the original image and the prompt
            // Since generateImage doesn't support image input, we'll use the vision API approach
            // with gemini-3-pro-image-preview model
            
            // Import the necessary function for vision with image generation
            const { generateVisionContent } = await import('../services/geminiService');
            
            // Create a combined prompt that includes the analysis
            const fullPrompt = `${imageGenerationPrompt}

ANALYSIS RESULTS:
${analysisResult}

CRITICAL: Generate an image that shows the ORIGINAL handwritten paper with teacher's marks OVERLAID directly on top of it. The output image must:
- Preserve the ENTIRE original image exactly as it is
- OVERLAY RED check marks, X marks, and scores directly on top of the original image
- OVERLAY GREEN fine-line pen comments with normal, clear handwriting style directly on top of the original image
- All comments must be written in GREEN ink using fine-line pen with normal, clear handwriting (not cursive)
- The handwriting should look like an experienced teacher's normal, readable script
- All marks, corrections, and comments must be OVERLAID on the original - do not replace or recreate the image
- The original handwritten answers must remain fully visible with marks added on top`;

            // Use Gemini 3 Pro Image Preview with the original image as input
            // We'll need to call the API directly since we need image input + image output
            const markedImageBase64 = await generateMarkedPaperImage(fileData.data, fileData.mimeType, fullPrompt);

            setThoughtLog(prev => [...prev, '✅ Marked paper generated successfully']);
            setLoadingStep('Complete!');
            
            // Create HTML to display only the marked image (no text analysis)
            const markedImageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marked Answer Sheet</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; padding: 20px; background: #f5f5f5; }
        .image-container { max-width: 100%; text-align: center; }
        .marked-image { max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        @media print {
            body { background: white; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="max-w-6xl mx-auto">
        <div class="image-container">
            <img src="data:image/png;base64,${markedImageBase64}" alt="Marked Answer Sheet" class="marked-image" />
        </div>
    </div>
</body>
</html>`;

            setCorrectedImage(markedImageBase64);
            setPreviewHtml(markedImageHtml);
            setIsStreamingThoughts(false);
        } catch (error) {
            console.error('Answer checking failed:', error);
            setLoadingStep('Error checking answers. Please try again.');
            setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
            setIsStreamingThoughts(false);
            alert('Failed to check answers. Please ensure the image or PDF contains handwritten answers and try again.');
        } finally {
            setIsCheckingAnswers(false);
        }
    };

    const handleGenerate = async () => {
        if (!fileContent && !fileData && !topic) return;

        setIsGenerating(true);
        setLoadingStep('Initializing Gemini 3 Pro...');
        setGeneratedHtml(null);
        setPreviewHtml('');
        setThoughtLog([]);
        setIsStreamingThoughts(true);

        try {
            const prompt = `
        Content to process:
        ${fileContent ? `Uploaded File Content:\n${fileContent.slice(0, 20000)}...` : ''}
        ${fileData ? '[Attached File Processing Active]' : ''}
        
        Topic/Context: ${topic || 'General Science/Math'}

        Create a single, self-contained HTML file to explain [${topic || fileName || 'the provided concept'}]. 
        
        CRITICAL INSTRUCTION:
        If an uploaded file (PDF/Image) is provided, you MUST solve EVERY SINGLE QUESTION or concept presented in it. 
        Do not skip any questions. Be exhaustive.
        
        STRICT OUTPUT FORMAT:
        The HTML must follow this exact structure sequentially:
        
        1. **The Question/Problem**: State the core problem(s) or concept(s) clearly at the top. If multiple questions, list them all.
        2. **The Answer/Explanation**: Provide a detailed, step-by-step solution or explanation for EACH question found.
        3. **Visual Diagrams (SVG)**: Include static or semi-static SVG diagrams to illustrate the concept next.
        4. **Interactive Simulation (Canvas)**: AFTER the answer and diagrams, you MUST provide a fully animated, high-frame-rate Canvas simulation.
           - REQUIREMENT: Use 'requestAnimationFrame' to create a smooth animation loop.
           - REQUIREMENT: The canvas must NOT be static. It should animate parameters over time (e.g., a wave moving, a projectile flying, a graph drawing live).
           - Include interactive controls (sliders, run/pause buttons).
           - The simulation should visually demonstrate the physics/math concepts in motion.
        
        Tech Stack & Styling:
        - Use Tailwind CSS for a clean, modern, responsive design via CDN.
        - Use MathJax for professional LaTeX rendering of all formulas via CDN.
        - Ensure all JavaScript is contained within the single HTML file.
        
        IMPORTANT: Return ONLY the raw HTML code starting with <!DOCTYPE html> and ending with </html>.
      `;

            let accumulatedHtml = '';
            const sanitizePartialHtml = (html: string) =>
                stripPolyfillScripts(html.replace(/^\s*```html\s*/i, '').replace(/```$/, ''));

            await streamTextContent(
                prompt,
                (chunk) => {
                    accumulatedHtml += chunk;
                },
                {
                    model: 'gemini-3-pro-preview',
                    thinking: 'high',
                    inlineData: fileData || undefined,
                    onThought: (thought) => {
                        setThoughtLog(prev => [...prev, thought]);
                        setLoadingStep('Thinking...');
                        setIsStreamingThoughts(true);
                    }
                }
            );

            // Clean up response if it contains markdown code blocks
            const cleanHtml = sanitizePartialHtml(accumulatedHtml).trim();

            setThoughtLog(prev => [...prev, '✅ Generation complete']);

            // Short delay to show completion before switching to preview
            await new Promise(resolve => setTimeout(resolve, 1500));
            setGeneratedHtml(cleanHtml);
            setPreviewHtml(cleanHtml);
            setLoadingStep('Complete!');
        } catch (error) {
            console.error('Generation failed:', error);
            setLoadingStep('Error encountered. Please try again.');
            setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
        } finally {
            setIsGenerating(false);
            setIsStreamingThoughts(false);
        }
    };

    const handleDownload = () => {
        if (!generatedHtml) return;
        const blob = new Blob([generatedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interactive-${(topic || fileName || 'assignment').replace(/\s+/g, '-').toLowerCase()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const previewDoc = previewHtml || (correctedImage ? `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Marked Answer Sheet</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; padding: 20px; background: #f5f5f5; }
        .image-container { max-width: 100%; text-align: center; }
        .marked-image { max-width: 100%; height: auto; border: 2px solid #ddd; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="max-w-6xl mx-auto">
        <div class="image-container">
            <img src="data:image/png;base64,${correctedImage}" alt="Marked Answer Sheet" class="marked-image" />
        </div>
    </div>
</body>
</html>` : '') || formulaHtml || qaHtml || generatedHtml || '';
    const canGenerate = Boolean(fileContent || fileData || topic);
    const disableGenerate = isGenerating || !canGenerate;

    return (
        <div className="flex flex-1 w-full h-screen min-h-screen max-h-screen bg-[#eef2f7] overflow-hidden text-slate-900">
            {/* Left Sidebar - Input & Thinking Stream */}
            {sidebarOpen && (
                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-screen" style={{ backgroundColor: '#1F1F1F' }}>
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Upload Source Material</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border border-white/10 bg-white/5 hover:bg-white/10 p-5 flex flex-col items-center justify-center cursor-pointer transition-all group"
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".txt,.md,.pdf,.html"
                                    onChange={handleFileUpload}
                                />
                                {fileName ? (
                                    <div className="flex flex-col items-center text-slate-100">
                                        <Check className="w-7 h-7 mb-2" />
                                        <span className="text-xs font-medium text-center break-all">{fileName}</span>
                                        <span className="text-[11px] text-slate-400 mt-1">Click to replace</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-white transition-colors">
                                        <FileUp className="w-6 h-6 mb-2" />
                                        <span className="text-xs font-medium">Upload / Paste Notes</span>
                                        <span className="text-[11px] mt-1">PDF, Text, or Markdown</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Topic Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Topic / Concept</label>
                            <input
                                type="text"
                                placeholder="e.g. Projectile Motion..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Options</label>
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={handleExtractFormulas}
                                    disabled={!fileData || isExtractingFormulas}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                        extractFormulaSheet
                                            ? 'bg-[#3b5b8a] text-white border border-[#4a6ba8] shadow-md'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                    } ${!fileData ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isExtractingFormulas ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Extracting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-4 h-4" />
                                            <span>Extract Formula Sheet</span>
                                        </>
                                    )}
                                </button>
                                {/* URL Input for Q&A */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-300">Or enter webpage URL:</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            placeholder="https://example.com/page"
                                            value={qaUrl}
                                            onChange={(e) => setQaUrl(e.target.value)}
                                            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent outline-none transition-all text-sm"
                                        />
                                        {qaUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setQaUrl('')}
                                                className="px-2 text-slate-400 hover:text-white transition-colors"
                                                title="Clear URL"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleExtractQA}
                                    disabled={(!fileData && !qaUrl.trim()) || isExtractingQA || isFetchingUrl}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                        questionAndAnswer
                                            ? 'bg-[#3b5b8a] text-white border border-[#4a6ba8] shadow-md'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                    } ${(!fileData && !qaUrl.trim()) || isFetchingUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isExtractingQA || isFetchingUrl ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>{isFetchingUrl ? 'Fetching webpage...' : 'Extracting...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <BookOpen className="w-4 h-4" />
                                            <span>Question and Answer</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCheckAnswers}
                                    disabled={!fileData || isCheckingAnswers || (!fileData.mimeType.startsWith('image/') && fileData.mimeType !== 'application/pdf')}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                        correctedImage
                                            ? 'bg-green-600 text-white border border-green-500 shadow-md'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                    } ${(!fileData || (!fileData.mimeType.startsWith('image/') && fileData.mimeType !== 'application/pdf')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isCheckingAnswers ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Checking answers...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Answer Checker</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={disableGenerate}
                            className={`
            w-full py-3 flex items-center justify-center gap-2 font-semibold text-sm uppercase tracking-wide transition-all
            ${disableGenerate
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-[#2c4066] text-white hover:bg-[#34507c] active:scale-95'}
          `}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-xs">{loadingStep}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Generate</span>
                                </>
                            )}
                        </button>

                        <div className="h-px bg-slate-700"></div>

                        {/* Thinking Terminal - Show only thinking/thoughts */}
                        {(isGenerating || isExtractingFormulas || isExtractingQA || isCheckingAnswers || thoughtLog.length > 0) && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles className="w-3 h-3" />
                                    Model Thinking Process
                                </label>
                                <div 
                                    ref={terminalRef}
                                    className="bg-black/40 border border-slate-700 rounded p-3 h-64 overflow-y-auto font-mono text-xs text-green-400"
                                    style={{ 
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: '#475569 #1e293b'
                                    }}
                                >
                                    {thoughtLog.length === 0 ? (
                                        <div className="text-slate-500">
                                            {isGenerating || isExtractingFormulas ? (
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>Waiting for model thoughts...</span>
                                                </div>
                                            ) : (
                                                <span>Thinking process will appear here...</span>
                                            )}
                                        </div>
                                    ) : (
                                        thoughtLog.map((thought, idx) => (
                                            <div key={idx} className="mb-1">
                                                <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span>{' '}
                                                <span className={thought.startsWith('✅') ? 'text-green-400' : thought.startsWith('❌') ? 'text-red-400' : 'text-green-300'}>
                                                    {thought}
                                                </span>
                                                {showCursor && idx === thoughtLog.length - 1 && (
                                                    <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse">|</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                                {loadingStep && (isGenerating || isExtractingFormulas) && (
                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>{loadingStep}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Collapse Button */}
                    <div className="border-t border-slate-700 p-3">
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                            <ChevronRight className="w-4 h-4" />
                            <span>Collapse Panel</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Right Side - Full Width HTML Preview */}
            <div className="flex-1 bg-[#f6f8fc] w-full h-screen max-h-screen min-h-0 overflow-hidden flex flex-col relative">
                {!sidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="absolute top-4 left-4 p-2 bg-slate-800 text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
                        title="Open sidebar"
                    >
                        <ChevronRight className="w-5 h-5 transform rotate-180" />
                    </button>
                )}

                {/* HTML Preview - FULL HEIGHT */}
                <div className="flex-1 w-full h-full min-h-0 overflow-auto">
                    {previewDoc && !isGenerating && !isExtractingFormulas && !isExtractingQA && !isCheckingAnswers ? (
                        <iframe
                            srcDoc={previewDoc}
                            className="w-full h-full min-h-screen border-0 block"
                            title="Interactive Preview"
                            sandbox="allow-scripts allow-same-origin"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                            {(isGenerating || isExtractingFormulas) ? (
                                <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                    <div className="relative w-16 h-16">
                                        <div className="absolute inset-0 bg-slate-300 opacity-40 blur-xl"></div>
                                        <Loader2 className="w-16 h-16 animate-spin text-[#2c4066] relative" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-slate-700 mb-2">
                                            {isExtractingFormulas ? 'Extracting Formulas from PDF' : 'Generating Interactive Content'}
                                        </p>
                                        <p className="text-sm text-slate-500 mb-4">Watch the thinking stream on the left for live reasoning process</p>
                                        <div className="flex items-center justify-center gap-2 text-xs text-[#2c4066]">
                                            <span className="inline-block w-2 h-2 bg-[#2c4066] animate-pulse"></span>
                                            <span>{loadingStep || 'Gemini 3 Pro is thinking...'}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6 text-center max-w-xl">
                                    <div className="w-24 h-24 bg-[#e4e9f2] flex items-center justify-center">
                                        <BookOpen className="w-12 h-12 text-[#2c4066]" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-700 mb-2">Ready to Explore</h3>
                                        <p className="text-slate-500 mb-6">
                                            Upload a file or enter a topic, then generate an interactive learning experience powered by Gemini 3 Pro with live reasoning.
                                        </p>
                                        <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <FileUp className="w-4 h-4" />
                                                <span>Upload or paste</span>
                                            </div>
                                            <div className="w-1 h-1 bg-slate-300"></div>
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4" />
                                                <span>Generate</span>
                                            </div>
                                            <div className="w-1 h-1 bg-slate-300"></div>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4" />
                                                <span>Learn</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Toolbar - Bottom when content is ready */}
                {(generatedHtml || formulaHtml || qaHtml || correctedImage) && (
                    <div className="h-16 border-t border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-slate-600">
                                {correctedImage ? 'Marked Answer Sheet' : formulaHtml ? 'Formula Sheet' : qaHtml ? 'Questions & Answers' : 'Preview Active'}
                            </span>
                            <span className="text-xs text-slate-400">
                                {correctedImage ? '• Teacher-marked paper with scores' : formulaHtml ? '• LaTeX formatted formulas' : qaHtml ? '• Interactive Q&A with visualizations' : '• Self-contained HTML file'}
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            {!formulaHtml && !qaHtml && !correctedImage && (
                                <>
                                    <button
                                        onClick={handleGenerate}
                                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        title="Regenerate"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                    </button>
                                    <div className="h-6 w-px bg-slate-200"></div>
                                </>
                            )}
                            {correctedImage && (
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = `data:image/png;base64,${correctedImage}`;
                                        link.download = 'marked-answer-sheet.png';
                                        link.click();
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-all font-medium text-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Marked Image
                                </button>
                            )}
                            {!correctedImage && (
                                <button
                                    onClick={formulaHtml ? handleDownloadFormulaPDF : qaHtml ? handleDownloadQAPDF : handleDownload}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#2c4066] text-white hover:bg-[#34507c] transition-all font-medium text-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    {(formulaHtml || qaHtml) ? 'Download PDF' : 'Download HTML'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
