import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Loader2, Sparkles, Download, Check, RefreshCw, BookOpen, ChevronRight, X, GitBranch, FileText, CheckCircle } from 'lucide-react';
import { streamTextContent, annotateImageWithFeedback } from '../services/geminiService';
import {
    generateStudyPlanTree,
    expandTreeNode,
    TotNode,
    ExamPrepToTResponse,
    getDefaultConstraints,
    getDefaultCriteria
} from '../services/examPrepToTService';
import { ExamPrepToTViewer } from './ExamPrepToTViewer';
import { ToTLiveViewer } from './ToTLiveViewer';

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
    const terminalRef = useRef<HTMLDivElement>(null);

    // Tree of Thoughts state
    const [useToT, setUseToT] = useState<boolean>(true); // ToT mode enabled by default
    const [totResponse, setTotResponse] = useState<ExamPrepToTResponse | null>(null);
    const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
    const [totStage, setTotStage] = useState<'analyzing' | 'generating' | 'evaluating' | 'selecting' | 'complete'>('analyzing');
    const [isToTGenerating, setIsToTGenerating] = useState(false);

    // Answer checking / image annotation state
    const [isChecking, setIsChecking] = useState(false);
    const [annotatedImage, setAnnotatedImage] = useState<{ data: string; mimeType: string } | null>(null);
    const [checkingFeedback, setCheckingFeedback] = useState<string | null>(null);

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

    /**
     * Check My Work - Annotates uploaded image/PDF with red checkmarks/green comments
     */
    const handleCheckMyWork = async () => {
        if (!fileData) {
            alert('Please upload an image or PDF of your work first.');
            return;
        }

        // Works with images and PDFs
        const isImage = fileData.mimeType.startsWith('image/');
        const isPdf = fileData.mimeType === 'application/pdf';

        if (!isImage && !isPdf) {
            alert('Check My Work requires an IMAGE (JPEG, PNG) or PDF file.');
            return;
        }

        setIsChecking(true);
        setAnnotatedImage(null);
        setCheckingFeedback(null);
        setLoadingStep('Analyzing your work...');
        setThoughtLog(['🔍 Analyzing student work...']);

        try {
            setThoughtLog(prev => [...prev, '✏️ Adding annotations with Gemini 3 Pro Image...']);

            const result = await annotateImageWithFeedback(
                fileData.data,
                fileData.mimeType,
                topic || undefined
            );

            setAnnotatedImage({
                data: result.annotatedImageBase64,
                mimeType: result.mimeType
            });
            setCheckingFeedback(result.feedback);
            setThoughtLog(prev => [...prev, '✅ Work checked! See annotated image.']);
            setLoadingStep('Complete!');
        } catch (error) {
            console.error('Check My Work failed:', error);
            setCheckingFeedback(`Error: ${error}`);
            setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
            setLoadingStep('Error occurred');
        } finally {
            setIsChecking(false);
        }
    };

    const handleGenerate = async () => {
        if (!fileContent && !fileData && !topic) return;

        setIsGenerating(true);
        setGeneratedHtml(null);
        setPreviewHtml('');
        setTotResponse(null);
        setThoughtLog([]);
        setIsStreamingThoughts(true);

        // Tree of Thoughts Enhanced Mode: Use ToT internally for better reasoning, then generate HTML
        if (useToT) {
            setIsToTGenerating(true);
            setTotStage('analyzing');

            // Determine mode for ToT planning
            const mode = extractFormulaSheet
                ? 'formula_extraction'
                : questionAndAnswer
                    ? 'question_answer'
                    : 'comprehensive';

            const modeLabels = {
                formula_extraction: 'Formula Sheet',
                question_answer: 'Q&A Mode',
                comprehensive: 'Interactive Lesson'
            };

            setLoadingStep(`Planning best ${modeLabels[mode]} approach...`);

            let totInsights = '';

            try {
                const constraints = getDefaultConstraints(topic || fileName || '');

                // Get mode-specific criteria
                let criteria = getDefaultCriteria(topic || fileName || '');
                if (extractFormulaSheet) {
                    criteria = [
                        'Clear organization of formulas by category',
                        'Complete variable definitions',
                        'Proper LaTeX formatting',
                        'Printable layout design',
                        'Worked examples for key formulas'
                    ];
                } else if (questionAndAnswer) {
                    criteria = [
                        'Multiple difficulty levels (Easy/Medium/Hard)',
                        'Interactive answer reveal functionality',
                        'Detailed step-by-step explanations',
                        'Hint system for each question',
                        'Progress tracking and scoring'
                    ];
                }

                // Stage progression for animation
                setTimeout(() => setTotStage('generating'), 800);
                setTimeout(() => {
                    setTotStage('evaluating');
                    setLoadingStep('Evaluating teaching strategies...');
                }, 1600);
                setTimeout(() => {
                    setTotStage('selecting');
                    setLoadingStep('Selecting optimal approach...');
                }, 2400);

                // Get ToT reasoning internally
                const modePrefix = extractFormulaSheet
                    ? 'Create formula sheet for: '
                    : questionAndAnswer
                        ? 'Create Q&A practice for: '
                        : '🔍 Exploring teaching approaches for: ';
                setThoughtLog(prev => [...prev, modePrefix + (topic || fileName)]);

                const problemDescription = extractFormulaSheet
                    ? `Extract and organize formulas for: ${topic || fileName || 'Exam preparation'}`
                    : questionAndAnswer
                        ? `Create practice questions and answers for: ${topic || fileName || 'Exam preparation'}`
                        : topic || fileName || 'Exam preparation';

                const totResult = await generateStudyPlanTree(
                    problemDescription,
                    constraints,
                    criteria,
                    fileContent || undefined
                );

                // Store the result so we can display it in the live viewer
                setTotResponse(totResult);
                setThoughtLog(prev => [...prev, `📊 Generated ${totResult.tree.length} candidate approaches`]);

                // Extract the best approach insights from ToT
                const selectedNode = totResult.tree.find(n => n.id === totResult.selectedId);
                const expandedNodes = totResult.tree.filter(n => n.status === 'expanded' || n.status === 'selected');
                const rejectedNodes = totResult.tree.filter(n => n.status === 'rejected');

                // Log the branches explored
                totResult.tree.forEach(node => {
                    if (!node.parentId) {
                        setThoughtLog(prev => [...prev, `🌳 Root: ${node.title}`]);
                    } else if (node.status === 'expanded') {
                        setThoughtLog(prev => [...prev, `🔄 Expanded: ${node.title} (score: ${node.score})`]);
                    } else if (node.status === 'selected') {
                        setThoughtLog(prev => [...prev, `✅ Selected: ${node.title} (score: ${node.score})`]);
                    } else if (node.status === 'rejected') {
                        setThoughtLog(prev => [...prev, `❌ Rejected: ${node.title} (score: ${node.score})`]);
                    } else {
                        setThoughtLog(prev => [...prev, `📋 Candidate: ${node.title} (score: ${node.score})`]);
                    }
                });

                totInsights = `
TEACHING STRATEGY (from AI Planning):
Best Approach: ${selectedNode?.title || 'Comprehensive Explanation'}
Rationale: ${selectedNode?.summary || totResult.finalAnswer}
Key Strengths: ${selectedNode?.pros?.join(', ') || 'Clear explanations, visual aids'}

Recommended Teaching Elements:
${expandedNodes.map(n => `- ${n.title}: ${n.summary}`).join('\n')}

Rejected Approaches: ${rejectedNodes.map(n => n.title).join(', ') || 'None'}

Final Strategy: ${totResult.finalAnswer}
`;
                setTotStage('complete');
                setThoughtLog(prev => [...prev, '✅ Teaching strategy selected: ' + (selectedNode?.title || 'Optimized approach')]);

                // Give user time to view the reasoning tree (keep isToTGenerating true so tree stays visible)
                setThoughtLog(prev => [...prev, '⏳ Reviewing strategy before generating content...']);
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error('ToT planning failed, continuing with standard approach:', error);
                totInsights = ''; // Continue without ToT enhancement
                setThoughtLog(prev => [...prev, '⚠️ Planning skipped, using standard approach']);
            }

            // Continue generating HTML while showing the ToT tree
            // (keep isToTGenerating true so the tree stays visible)
            setThoughtLog(prev => [...prev, '🚀 Now generating interactive content using selected strategy...']);
            setLoadingStep('Generating content with selected strategy...');

            try {
                // Determine generation mode based on options
                const modeDescription = extractFormulaSheet
                    ? 'FORMULA SHEET EXTRACTION'
                    : questionAndAnswer
                        ? 'QUESTION AND ANSWER FORMAT'
                        : 'COMPREHENSIVE LEARNING MATERIAL';

                const modeSpecificInstructions = extractFormulaSheet
                    ? `
SPECIAL MODE: EXTRACT FORMULA SHEET
Your PRIMARY TASK is to create a CLEAN, PRINTABLE FORMULA SHEET with:
1. Extract ALL formulas, equations, and key mathematical relationships from the content
2. Organize formulas by topic/category with clear headings
3. Include variable definitions for each formula (what each symbol means)
4. Use LaTeX for all mathematical notation
5. Create a clean, structured layout suitable for printing/study
6. Add brief descriptions of when to use each formula
7. Include worked examples for the most important formulas
8. Create an index/table of contents at the top
9. Make it visually clean with good spacing and clear typography
`
                    : questionAndAnswer
                        ? `
SPECIAL MODE: QUESTION AND ANSWER FORMAT  
Your PRIMARY TASK is to create PRACTICE Q&A material with:
1. Extract or generate questions based on the content
2. Provide detailed answers with step-by-step explanations
3. Include multiple difficulty levels (Easy, Medium, Hard)
4. Add hints for each question
5. Include "Show Answer" functionality that reveals answers on click
6. Create flashcard-style interactive elements
7. Add a quiz mode where users can test themselves
8. Include explanations for why wrong answers are wrong
9. Provide a scoring/progress tracker
`
                        : '';

                const enhancedPrompt = `
${totInsights ? `--- AI TEACHING PLAN ---
${totInsights}
--- END PLAN ---

Using the above teaching strategy, ` : ''}Create a single, self-contained HTML file to explain [${topic || fileName || 'the provided concept'}].

${modeSpecificInstructions ? `--- GENERATION MODE: ${modeDescription} ---
${modeSpecificInstructions}
--- END MODE INSTRUCTIONS ---
` : ''}

Content to process:
${fileContent ? `Uploaded File Content:\n${fileContent.slice(0, 20000)}...` : ''}
${fileData ? '[Attached File Processing Active]' : ''}

Topic/Context: ${topic || 'General Science/Math'}

CRITICAL INSTRUCTION:
${totInsights ? '- Follow the AI Teaching Plan above for the optimal learning experience.' : ''}
- If an uploaded file (PDF/Image) is provided, you MUST solve EVERY SINGLE QUESTION or concept presented in it.
- Do not skip any questions. Be exhaustive.
${!extractFormulaSheet && !questionAndAnswer ? '- PRIORITIZE INTERACTIVE ANIMATED SIMULATIONS over static content.' : ''}

STRICT OUTPUT FORMAT - The HTML must include ALL of these in sequence:

1. **Overview/Learning Objectives**: Brief intro stating what the learner will master.
2. **The Question/Problem**: State the core problem(s) or concept(s) clearly.
3. **Conceptual Foundation**: Explain the underlying theory/principles BEFORE solving.
4. **Step-by-Step Solution**: Detailed, numbered steps for EACH problem with clear reasoning.
5. **Visual Diagrams (SVG)**: Include clear, labeled SVG diagrams to illustrate concepts.
6. **Key Formulas Section**: Highlight all important formulas with proper LaTeX delimiters.
7. **INTERACTIVE SIMULATION (Canvas) - THIS IS THE MOST IMPORTANT SECTION**:
   - Create a FULL-FEATURED animated Canvas simulation
   - Use 'requestAnimationFrame' for 60fps smooth animation
   - Show the concept VISUALLY ANIMATING (moving projectile, oscillating wave, rotating object, etc.)
   - Include MULTIPLE interactive controls: sliders, buttons, checkboxes
   - Let the user CHANGE PARAMETERS and see immediate visual response
   - Make it visually impressive with colors, gradients, trails
8. **Practice Problems WITH ANSWER CHECKING**:
   - Create 3-5 practice problems with input fields
   - Each problem should have an input/textarea for user answers
   - Include a "Check Answer" button for EACH problem
   - Show instant feedback: green checkmark ✅ for correct, red X ❌ for wrong
   - Reveal the correct answer after checking with explanation
   - Store correct answers in JavaScript variables and compare on button click
   - Example structure:
     <div class="problem">
       <p>Problem 1: Calculate...</p>
       <input type="text" id="answer1" placeholder="Your answer">
       <button onclick="checkAnswer(1, 'correct_value')">Check</button>
       <span id="feedback1"></span>
     </div>
9. **Quick Reference Summary**: A compact cheat-sheet section at the end.

ANSWER CHECKING JAVASCRIPT (include this script):
<script>
function checkAnswer(problemNum, correctAnswer) {
  const userAnswer = document.getElementById('answer' + problemNum).value.trim().toLowerCase();
  const feedbackEl = document.getElementById('feedback' + problemNum);
  const correct = correctAnswer.toLowerCase();
  // Allow for numerical tolerance
  const numUser = parseFloat(userAnswer);
  const numCorrect = parseFloat(correct);
  const isCorrect = userAnswer === correct || 
    (Math.abs(numUser - numCorrect) < 0.01 * Math.abs(numCorrect));
  if (isCorrect) {
    feedbackEl.innerHTML = '<span class="text-green-500">✅ Correct!</span>';
    feedbackEl.style.display = 'inline';
  } else {
    feedbackEl.innerHTML = '<span class="text-red-500">❌ Try again. Hint: ' + correctAnswer + '</span>';
    feedbackEl.style.display = 'inline';
  }
}
</script>

MATHJAX SETUP - CRITICAL (put this in the <head>):
<script>
MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
  },
  svg: { fontCache: 'global' }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>

For LaTeX formulas, use $ for inline math and $$ for display math.
Example: $E = mc^2$ for inline, $$\\sum_{i=1}^n x_i$$ for display.

Tech Stack & Styling:
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use MathJax 3 as shown above for LaTeX rendering.
- Use a dark theme with good contrast.
- Style practice problems with nice borders, hover effects, and clear feedback areas.
- Ensure all JavaScript is contained within the single HTML file.

IMPORTANT: Return ONLY the raw HTML code starting with <!DOCTYPE html> and ending with </html>.
`;

                let accumulatedHtml = '';
                const sanitizePartialHtml = (html: string) =>
                    stripPolyfillScripts(html.replace(/^\s*```html\s*/i, '').replace(/```$/, ''));

                await streamTextContent(
                    enhancedPrompt,
                    (chunk) => {
                        accumulatedHtml += chunk;
                    },
                    {
                        model: 'gemini-3-pro-preview',
                        thinking: 'high',
                        inlineData: fileData || undefined,
                        onThought: (thought) => {
                            setThoughtLog(prev => [...prev, thought]);
                            setLoadingStep('Generating content...');
                        }
                    }
                );

                const cleanHtml = sanitizePartialHtml(accumulatedHtml).trim();
                setThoughtLog(prev => [...prev, '✅ Interactive content generated']);

                await new Promise(resolve => setTimeout(resolve, 500));
                setGeneratedHtml(cleanHtml);
                setPreviewHtml(cleanHtml);
                setLoadingStep('Complete!');
            } catch (error) {
                console.error('Content generation failed:', error);
                setLoadingStep('Error encountered. Please try again.');
                setThoughtLog(prev => [...prev, `❌ Error: ${error}`]);
            } finally {
                setIsGenerating(false);
                setIsToTGenerating(false);
                setTotResponse(null); // Clear ToT data so HTML preview shows
                setIsStreamingThoughts(false);
            }
            return;
        }

        // Legacy HTML mode
        setLoadingStep('Initializing Gemini 3 Pro...');

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
        5. **Practice Problems WITH ANSWER CHECKING**:
           - Create 3-5 practice problems with input fields
           - Include a "Check Answer" button for EACH problem
           - Show instant feedback: ✅ for correct, ❌ for wrong with hints
           - Use this checkAnswer function:
             function checkAnswer(problemNum, correctAnswer) {
               const userAnswer = document.getElementById('answer' + problemNum).value.trim().toLowerCase();
               const feedbackEl = document.getElementById('feedback' + problemNum);
               const isCorrect = userAnswer === correctAnswer.toLowerCase() || 
                 Math.abs(parseFloat(userAnswer) - parseFloat(correctAnswer)) < 0.01 * Math.abs(parseFloat(correctAnswer));
               feedbackEl.innerHTML = isCorrect ? '<span class="text-green-500">✅ Correct!</span>' : 
                 '<span class="text-red-500">❌ Try again. Answer: ' + correctAnswer + '</span>';
             }
        
        MATHJAX SETUP - CRITICAL (put this in the <head>):
        <script>
        MathJax = {
          tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']] },
          svg: { fontCache: 'global' }
        };
        </script>
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
        
        Tech Stack & Styling:
        - Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
        - Use MathJax 3 as shown above for LaTeX rendering.
        - Use a dark theme with good contrast.
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

    // Handle expanding a ToT node
    const handleExpandNode = async (node: TotNode) => {
        if (!totResponse) return;

        setExpandingNodeId(node.id);
        try {
            const newChildren = await expandTreeNode(
                node,
                totResponse.problem,
                totResponse.tree
            );

            // Update the node status and add children
            const updatedTree = totResponse.tree.map(n =>
                n.id === node.id ? { ...n, status: 'expanded' as const } : n
            );

            setTotResponse({
                ...totResponse,
                tree: [...updatedTree, ...newChildren]
            });
        } catch (error) {
            console.error('Failed to expand node:', error);
        } finally {
            setExpandingNodeId(null);
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

    const previewDoc = previewHtml || generatedHtml || '';
    const canGenerate = Boolean(fileContent || fileData || topic);
    const disableGenerate = isGenerating || !canGenerate;

    return (
        <div className="flex flex-1 w-full h-full min-h-0 bg-[#eef2f7] overflow-hidden text-slate-900">
            {/* Left Sidebar - Input & Thinking Stream */}
            {sidebarOpen && (
                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-full" style={{ backgroundColor: '#1F1F1F' }}>
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
                                    onClick={() => setExtractFormulaSheet(!extractFormulaSheet)}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all ${extractFormulaSheet
                                        ? 'bg-[#3b5b8a] text-white border border-[#4a6ba8] shadow-md'
                                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    Extract Formula Sheet
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQuestionAndAnswer(!questionAndAnswer)}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all ${questionAndAnswer
                                        ? 'bg-[#3b5b8a] text-white border border-[#4a6ba8] shadow-md'
                                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    Question and Answer
                                </button>
                            </div>
                            {/* Tree of Thoughts Toggle */}
                            <div className="mt-3 pt-3 border-t border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setUseToT(!useToT)}
                                    className={`w-full px-4 py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2 ${useToT
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-md'
                                        : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <GitBranch className="w-4 h-4" />
                                    Tree of Thoughts
                                    {useToT && <Check className="w-3 h-3" />}
                                </button>
                                <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                                    {useToT ? 'Generates structured study plan tree' : 'Generates interactive HTML lesson'}
                                </p>
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

                        {/* Check My Work Button - Uses Gemini 3 Pro Image to annotate */}
                        <button
                            onClick={handleCheckMyWork}
                            disabled={isChecking || !fileData}
                            className={`
                                w-full py-2.5 flex items-center justify-center gap-2 font-medium text-sm transition-all border
                                ${isChecking || !fileData
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 active:scale-95'}
                            `}
                            title="Upload an image of your work to get it checked with annotations"
                        >
                            {isChecking ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Checking...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Check My Work</span>
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-slate-500 text-center mb-2">
                            Upload image/PDF → Get annotated feedback
                        </p>

                        <div className="h-px bg-slate-700"></div>
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
            <div className="flex-1 bg-[#f6f8fc] w-full h-full min-h-0 flex flex-col relative">
                {!sidebarOpen && (
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="absolute top-4 left-4 p-2 bg-slate-800 text-white hover:bg-slate-700 transition-colors z-10 shadow-lg"
                        title="Open sidebar"
                    >
                        <ChevronRight className="w-5 h-5 transform rotate-180" />
                    </button>
                )}

                {/* HTML Preview - FULL HEIGHT with proper scrolling */}
                <div className="flex-1 w-full relative min-h-0">
                    {/* Show real ToT reasoning during planning phase */}
                    {isToTGenerating ? (
                        <ToTLiveViewer
                            totData={totResponse}
                            thoughts={thoughtLog}
                            isGenerating={isToTGenerating}
                            stage={totStage}
                        />
                    ) : annotatedImage ? (
                        /* Enhanced annotated image viewer with zoom and navigation */
                        <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col">
                            {/* Header Controls */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    Work Checked - Annotated Feedback
                                </h2>
                                <div className="flex items-center gap-2">
                                    {/* Zoom Controls */}
                                    <div className="flex items-center gap-1 bg-slate-700 rounded-lg px-2 py-1">
                                        <button
                                            onClick={() => {
                                                const img = document.getElementById('annotated-img') as HTMLImageElement;
                                                if (img) {
                                                    const currentWidth = parseInt(img.style.width) || 100;
                                                    img.style.width = Math.max(25, currentWidth - 25) + '%';
                                                }
                                            }}
                                            className="px-2 py-1 text-white hover:bg-slate-600 rounded text-sm"
                                            title="Zoom Out"
                                        >
                                            −
                                        </button>
                                        <span className="text-slate-300 text-xs px-2">Zoom</span>
                                        <button
                                            onClick={() => {
                                                const img = document.getElementById('annotated-img') as HTMLImageElement;
                                                if (img) {
                                                    const currentWidth = parseInt(img.style.width) || 100;
                                                    img.style.width = Math.min(300, currentWidth + 25) + '%';
                                                }
                                            }}
                                            className="px-2 py-1 text-white hover:bg-slate-600 rounded text-sm"
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                    </div>
                                    {/* Fit to Width */}
                                    <button
                                        onClick={() => {
                                            const img = document.getElementById('annotated-img') as HTMLImageElement;
                                            if (img) img.style.width = '100%';
                                        }}
                                        className="px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs rounded"
                                    >
                                        Fit Width
                                    </button>
                                    {/* Full Size */}
                                    <button
                                        onClick={() => {
                                            const img = document.getElementById('annotated-img') as HTMLImageElement;
                                            if (img) img.style.width = 'auto';
                                        }}
                                        className="px-3 py-1 bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs rounded"
                                    >
                                        Full Size
                                    </button>
                                    {/* Download */}
                                    <button
                                        onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `data:${annotatedImage.mimeType};base64,${annotatedImage.data}`;
                                            link.download = 'annotated-work.png';
                                            link.click();
                                        }}
                                        className="px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-500 text-xs rounded flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" />
                                        Save
                                    </button>
                                    {/* Clear */}
                                    <button
                                        onClick={() => {
                                            setAnnotatedImage(null);
                                            setCheckingFeedback(null);
                                        }}
                                        className="px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 text-xs rounded border border-red-600/40"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-slate-800/50 text-center py-2 border-b border-slate-700">
                                <p className="text-xs text-slate-400">
                                    💡 Tip: Use zoom controls to view each page clearly. Scroll to navigate between pages.
                                </p>
                            </div>

                            {/* Scrollable Image Container */}
                            <div className="flex-1 overflow-auto p-4 bg-slate-950">
                                <div className="min-w-full flex justify-center">
                                    <img
                                        id="annotated-img"
                                        src={`data:${annotatedImage.mimeType};base64,${annotatedImage.data}`}
                                        alt="Annotated work with feedback"
                                        className="bg-white shadow-2xl rounded-lg cursor-zoom-in"
                                        style={{ width: '100%', maxWidth: 'none' }}
                                        onClick={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            if (img.style.width === 'auto' || img.style.width === '200%') {
                                                img.style.width = '100%';
                                            } else {
                                                img.style.width = '200%';
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Feedback Panel - Collapsible at bottom */}
                            {checkingFeedback && (
                                <div className="border-t border-slate-700 bg-slate-800 max-h-40 overflow-auto">
                                    <details className="p-4">
                                        <summary className="text-sm font-bold text-emerald-400 cursor-pointer uppercase tracking-wide">
                                            📝 Feedback Summary (click to expand)
                                        </summary>
                                        <p className="text-slate-300 text-sm whitespace-pre-wrap mt-2 pl-4">
                                            {checkingFeedback}
                                        </p>
                                    </details>
                                </div>
                            )}
                        </div>
                    ) : previewDoc ? (
                        <iframe
                            srcDoc={previewDoc}
                            className="absolute inset-0 w-full h-full border-0"
                            title="Interactive Preview"
                            sandbox="allow-scripts allow-same-origin"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f6f8fc] text-slate-500 px-8 overflow-auto">
                            {isGenerating ? (
                                <div className="flex flex-col items-center gap-6 text-center max-w-md">
                                    <div className="relative w-16 h-16">
                                        <div className="absolute inset-0 bg-slate-300 opacity-40 blur-xl"></div>
                                        <Loader2 className="w-16 h-16 animate-spin text-[#2c4066] relative" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-bold text-slate-700 mb-2">Generating Interactive Content</p>
                                        <p className="text-sm text-slate-500 mb-4">Watch the thinking stream on the left for live reasoning process</p>
                                        <div className="flex items-center justify-center gap-2 text-xs text-[#2c4066]">
                                            <span className="inline-block w-2 h-2 bg-[#2c4066] animate-pulse"></span>
                                            <span>Gemini 3 Pro is thinking...</span>
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
                {generatedHtml && (
                    <div className="h-16 border-t border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-medium text-slate-600">Preview Active</span>
                            <span className="text-xs text-slate-400">• Self-contained HTML file</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleGenerate}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Regenerate"
                            >
                                <RefreshCw className="w-5 h-5" />
                            </button>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download HTML
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
