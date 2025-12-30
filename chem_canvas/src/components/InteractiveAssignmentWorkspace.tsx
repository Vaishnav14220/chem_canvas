import React, { useState, useRef, useEffect } from 'react';
import { FileUp, Loader2, Sparkles, Download, Check, RefreshCw, BookOpen, ChevronRight, ChevronLeft, X, GitBranch, FileText, CheckCircle } from 'lucide-react';
import { generateTextContent, generateVisionContent, streamTextContent, annotateImageWithFeedback } from '../services/geminiService';
import { extractTextFromPdf } from '../utils/pdfTextExtractor';
import { extractPDFPages } from '../services/ocrService';
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
import { FormulaExtractionWorkspace, type FormulaItem } from './FormulaExtractionWorkspace';

// Props interface for receiving initial file data from parent
interface InteractiveAssignmentWorkspaceProps {
    initialFileData?: { mimeType: string; data: string } | null;
    initialFileContent?: string | null;
    initialFileName?: string | null;
    initialTopic?: string;
    initialUseToT?: boolean;
    selectedFeature?: string | null;
    autoGenerate?: boolean;
    onBack?: () => void;
}

export const InteractiveAssignmentWorkspace: React.FC<InteractiveAssignmentWorkspaceProps> = ({
    initialFileData = null,
    initialFileContent = null,
    initialFileName = null,
    initialTopic = '',
    initialUseToT = false,
    selectedFeature = null,
    autoGenerate = false,
    onBack,
}) => {
    // Initialize state from props
    const [fileData, setFileData] = useState<{ mimeType: string, data: string } | null>(initialFileData);
    const [fileContent, setFileContent] = useState<string | null>(initialFileContent); // Legacy text content
    const [fileName, setFileName] = useState<string | null>(initialFileName);
    const [topic, setTopic] = useState<string>(initialTopic);

    // Set options based on selectedFeature prop
    const [extractFormulaSheet, setExtractFormulaSheet] = useState<boolean>(selectedFeature === 'extract-formulas');
    const [questionAndAnswer, setQuestionAndAnswer] = useState<boolean>(selectedFeature === 'qa-generator');

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
    const [useToT, setUseToT] = useState<boolean>(initialUseToT);
    const [totResponse, setTotResponse] = useState<ExamPrepToTResponse | null>(null);
    const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
    const [totStage, setTotStage] = useState<'analyzing' | 'generating' | 'evaluating' | 'selecting' | 'complete'>('analyzing');
    const [isToTGenerating, setIsToTGenerating] = useState(false);
    const [isToTReviewing, setIsToTReviewing] = useState(false);

    // Answer checking / image annotation state
    const [isChecking, setIsChecking] = useState(false);
    const [annotatedImage, setAnnotatedImage] = useState<{ data: string; mimeType: string } | null>(null);
    const [checkingFeedback, setCheckingFeedback] = useState<string | null>(null);

    // Formula extraction state
    const [extractedFormulas, setExtractedFormulas] = useState<FormulaItem[] | null>(null);
    const [isExtractingFormulas, setIsExtractingFormulas] = useState(false);
    const [sourceMarkdown, setSourceMarkdown] = useState<string | null>(null);
    const [isExtractingSource, setIsExtractingSource] = useState(false);
    const autoGenerateRef = useRef<string | null>(null);

    // Sync state from props when initial values change (from dashboard upload)
    useEffect(() => {
        if (initialFileData) {
            setFileData(initialFileData);
        }
    }, [initialFileData]);

    useEffect(() => {
        if (initialFileContent) {
            setFileContent(initialFileContent);
        }
    }, [initialFileContent]);

    useEffect(() => {
        if (initialFileName) {
            setFileName(initialFileName);
        }
    }, [initialFileName]);

    useEffect(() => {
        if (initialTopic) {
            setTopic(initialTopic);
        }
    }, [initialTopic]);

    useEffect(() => {
        setUseToT(initialUseToT);
    }, [initialUseToT]);

    useEffect(() => {
        setExtractFormulaSheet(selectedFeature === 'extract-formulas');
        setQuestionAndAnswer(selectedFeature === 'qa-generator');
    }, [selectedFeature]);

    useEffect(() => {
        setExtractedFormulas(null);
    }, [selectedFeature, fileName, fileContent, fileData]);

    useEffect(() => {
        setSourceMarkdown(null);
    }, [selectedFeature, fileName, fileContent, fileData]);

    // Remove any external polyfill.io scripts the model might inject so previews don't fail on blocked domains
    const stripPolyfillScripts = (html: string) =>
        html.replace(
            /<script[^>]+src=[\"']https?:\/\/(?:cdn\.)?polyfill\.io\/[^\"']+[\"'][^>]*>\s*<\/script>/gi,
            ''
        );

    const stripMarkdownFence = (markdown: string) =>
        markdown.replace(/^\s*```(?:markdown)?/i, '').replace(/```\s*$/i, '').trim();

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        try {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
                    }, timeoutMs);
                })
            ]);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    };

    const base64ToFile = (base64: string, mimeType: string, name: string): File => {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i += 1) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new File([byteArray], name, { type: mimeType });
    };

    const toMarkdownFromExtractedText = (text: string): string =>
        text
            .replace(/\[Page\s+(\d+)\]/gi, '## Page $1')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

    const normalizeFormulaItem = (item: any, index: number): FormulaItem | null => {
        const variables = Array.isArray(item?.variables)
            ? item.variables
                  .map((variable: any) => ({
                      symbol: String(variable?.symbol || variable?.name || '').trim(),
                      definition: String(variable?.definition || variable?.meaning || '').trim(),
                      unit: variable?.unit ? String(variable.unit).trim() : undefined
                  }))
                  .filter((variable: any) => variable.symbol && variable.definition)
            : [];
        const latex = String(item?.latex || item?.equation || item?.formula || '').trim();
        if (!latex) return null;
        return {
            id: item?.id ? String(item.id) : `${index + 1}`,
            label: item?.label || item?.title || undefined,
            page: typeof item?.page === 'number' ? item.page : item?.pageNumber,
            latex,
            variables,
            status: item?.status === 'unknown' ? 'unknown' : 'verified'
        };
    };

    const normalizeFormulaItems = (items: any[]): FormulaItem[] =>
        items.map((item, index) => normalizeFormulaItem(item, index)).filter(Boolean) as FormulaItem[];

    const FALLBACK_DEFINITION = 'Definition not found in document.';

    const getVariableScore = (variables: FormulaItem['variables']) =>
        variables.reduce((score, variable) => {
            if (!variable.definition) return score;
            if (variable.definition.trim().toLowerCase() === FALLBACK_DEFINITION.toLowerCase()) return score;
            return score + 1;
        }, 0);

    const getFormulaKey = (item: FormulaItem) => item.latex;

    const mergeFormulaItem = (current: FormulaItem, incoming: FormulaItem): FormulaItem => ({
        ...current,
        label: current.label || incoming.label,
        page: current.page ?? incoming.page,
        variables: getVariableScore(incoming.variables) > getVariableScore(current.variables)
            ? incoming.variables
            : current.variables,
        status: current.status === 'verified' || incoming.status === 'verified' ? 'verified' : current.status
    });

    const mergeFormulaItems = (current: FormulaItem[], incoming: FormulaItem[]) => {
        const map = new Map(current.map((item) => [getFormulaKey(item), item]));
        incoming.forEach((item) => {
            const key = getFormulaKey(item);
            const existing = map.get(key);
            map.set(key, existing ? mergeFormulaItem(existing, item) : item);
        });
        return Array.from(map.values());
    };

    const parseFormulaResponse = (raw: string): FormulaItem[] => {
        const cleaned = raw.replace(/```json/gi, '```').replace(/```/g, '').trim();
        const sanitizeJson = (value: string) => value.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
        const startArr = cleaned.indexOf('[');
        const startObj = cleaned.indexOf('{');
        let jsonPayload = cleaned;
        if (startArr !== -1 && (startArr < startObj || startObj === -1)) {
            const endArr = cleaned.lastIndexOf(']');
            if (endArr !== -1) {
                jsonPayload = cleaned.slice(startArr, endArr + 1);
            }
        } else if (startObj !== -1) {
            const endObj = cleaned.lastIndexOf('}');
            if (endObj !== -1) {
                jsonPayload = cleaned.slice(startObj, endObj + 1);
            }
        }
        try {
            const parsed = JSON.parse(jsonPayload);
            if (Array.isArray(parsed)) {
                return normalizeFormulaItems(parsed);
            }
            if (parsed && Array.isArray(parsed.formulas)) {
                return normalizeFormulaItems(parsed.formulas);
            }
            return [];
        } catch {
            const parsed = JSON.parse(sanitizeJson(jsonPayload));
            if (Array.isArray(parsed)) {
                return normalizeFormulaItems(parsed);
            }
            if (parsed && Array.isArray(parsed.formulas)) {
                return normalizeFormulaItems(parsed.formulas);
            }
            return [];
        }
    };

    const extractFormulaCandidatesFromText = (text: string): string[] => {
        const candidates = new Set<string>();
        const addCandidate = (value: string) => {
            const trimmed = value.replace(/\s+/g, ' ').trim();
            if (!trimmed || trimmed.length < 4) return;
            const hasMath =
                /[=≈≥≤<>]/.test(trimmed) ||
                /\\(frac|sum|int|sqrt|Delta|Omega|mu|sigma|theta|alpha|beta|gamma|pi|lambda)/.test(trimmed) ||
                /[±∑∫√]/.test(trimmed);
            if (!hasMath) return;
            candidates.add(trimmed);
        };

        const blockRegex = /\$\$([\s\S]+?)\$\$/g;
        let blockMatch = blockRegex.exec(text);
        while (blockMatch) {
            addCandidate(blockMatch[1]);
            blockMatch = blockRegex.exec(text);
        }

        const inlineRegex = /\$([^\n$]+?)\$/g;
        let inlineMatch = inlineRegex.exec(text);
        while (inlineMatch) {
            addCandidate(inlineMatch[1]);
            inlineMatch = inlineRegex.exec(text);
        }

        text.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed.length < 4 || trimmed.length > 140) return;
            addCandidate(trimmed);
        });

        return Array.from(candidates);
    };

    const extractVariableSymbols = (latex: string): string[] => {
        const blacklist = new Set([
            '\\frac',
            '\\sqrt',
            '\\ln',
            '\\log',
            '\\sin',
            '\\cos',
            '\\tan',
            '\\cdot',
            '\\times',
            '\\left',
            '\\right',
            '\\sum',
            '\\int'
        ]);
        const tokens = latex.match(/\\[A-Za-z]+|[A-Za-z]+/g) ?? [];
        const symbols: string[] = [];
        for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i];
            if (token.startsWith('\\') && blacklist.has(token)) {
                continue;
            }
            if (token.startsWith('\\') && i + 1 < tokens.length && /^[A-Za-z]+$/.test(tokens[i + 1])) {
                const combined = `${token} ${tokens[i + 1]}`;
                symbols.push(combined);
                i += 1;
                continue;
            }
            if (/^[A-Za-z]+$/.test(token) || token.startsWith('\\')) {
                symbols.push(token);
            }
        }
        return Array.from(new Set(symbols));
    };

    const ensureVariableDefinitions = (items: FormulaItem[]): FormulaItem[] =>
        items.map((item) => {
            if (item.variables && item.variables.length > 0) return item;
            const symbols = extractVariableSymbols(item.latex);
            if (!symbols.length) return item;
            return {
                ...item,
                variables: symbols.map((symbol) => ({
                    symbol,
                    definition: FALLBACK_DEFINITION
                }))
            };
        });

    const buildFormulaItemsFromText = (text: string): FormulaItem[] =>
        extractFormulaCandidatesFromText(text).map((latex, index) => ({
            id: `f-${index + 1}`,
            label: undefined,
            latex,
            variables: [],
            status: 'unknown'
        }));

    const detectAssignmentText = (text: string) =>
        /(assignment|problem|question|exercise|worksheet|homework|aufgabe|task|solve)/i.test(text);

    const chunkSourceText = (text: string, chunkSize = 12000) => {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
    };

    const extractSourceTextForFormulas = async (): Promise<string> => {
        if (fileContent?.trim()) {
            return fileContent.trim();
        }
        if (!fileData) {
            return '';
        }
        setIsExtractingSource(true);
        try {
            if (fileData.mimeType === 'application/pdf') {
                setLoadingStep('Reading PDF text...');
                const file = base64ToFile(fileData.data, fileData.mimeType, fileName || 'document.pdf');
                const extracted = await withTimeout(
                    extractTextFromPdf(file, 12, true),
                    45000,
                    'PDF text extraction'
                );
                return extracted?.trim() ?? '';
            }
            if (fileData.mimeType.startsWith('image/')) {
                setLoadingStep('Reading image text...');
                const prompt = `Extract all readable text from this image. Preserve formulas in LaTeX where possible.`;
                const extracted = await withTimeout(
                    generateVisionContent(prompt, fileData.data, fileData.mimeType, {
                        model: 'gemini-3-pro-preview'
                    }),
                    45000,
                    'Image text extraction'
                );
                return extracted?.trim() ?? '';
            }
        } catch (error) {
            console.error('Source text extraction failed:', error);
        } finally {
            setIsExtractingSource(false);
        }
        return '';
    };

    const buildFormulaExtractionPrompt = (chunk: string, isAssignment: boolean, index: number, total: number) => `
You are a formula extraction engine. Return ONLY JSON.

Output format:
{
  "formulas": [
    {
      "label": "SHORT LABEL",
      "page": 4,
      "latex": "\\\\Delta U = Q - W",
      "variables": [
        { "symbol": "\\\\Delta U", "definition": "Change in internal energy" },
        { "symbol": "Q", "definition": "Heat added to system" }
      ],
      "status": "verified"
    }
  ]
}

Rules:
- Extract every explicit formula in the text.
- If this is an assignment/problem set, ALSO include formulas required to solve the questions, even if not explicitly written.
- Use LaTeX for the formula string without surrounding $$.
- Use "unknown" status for inferred/required formulas.
- If page number is unknown, omit it.
- Provide variable definitions from the text when possible. If missing, use "${FALLBACK_DEFINITION}".
- Keep latex and symbols precise (no prose).

Context:
- File: ${fileName || 'Document'}
- Chunk: ${index + 1} of ${total}
- Assignment mode: ${isAssignment ? 'yes' : 'no'}

Content:
${chunk}
`;

    const extractFormulasFromText = async (sourceText: string): Promise<FormulaItem[]> => {
        if (!sourceText.trim()) return [];
        const isAssignment = detectAssignmentText(sourceText);
        const chunks = chunkSourceText(sourceText, 12000);
        let combined: FormulaItem[] = [];

        for (let i = 0; i < chunks.length; i += 1) {
            setThoughtLog(prev => [...prev, `Scanning formulas (chunk ${i + 1}/${chunks.length})...`]);
            setLoadingStep(`Extracting formulas (${i + 1}/${chunks.length})...`);
            const prompt = buildFormulaExtractionPrompt(chunks[i], isAssignment, i, chunks.length);
            try {
                const raw = await withTimeout(
                    generateTextContent(prompt, {
                        model: 'gemini-3-pro-preview',
                        maxOutputTokens: 4096
                    }),
                    45000,
                    'Formula extraction'
                );
                const parsed = parseFormulaResponse(raw);
                if (parsed.length > 0) {
                    combined = mergeFormulaItems(combined, parsed);
                } else {
                    const fallback = buildFormulaItemsFromText(chunks[i]);
                    combined = mergeFormulaItems(combined, fallback);
                }
                const nextPreview = ensureVariableDefinitions(combined);
                setExtractedFormulas(nextPreview);
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                continue;
            } catch (error) {
                console.warn('Formula extraction chunk failed:', error);
            }

            const fallback = buildFormulaItemsFromText(chunks[i]);
            combined = mergeFormulaItems(combined, fallback);
            const nextPreview = ensureVariableDefinitions(combined);
            setExtractedFormulas(nextPreview);
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }

        return ensureVariableDefinitions(combined);
    };

    const extractFormulasFromPdfPages = async (pdfFile: File) => {
        setThoughtLog(prev => [...prev, 'Rendering PDF pages for vision extraction...']);
        const pages = await extractPDFPages(pdfFile, (progress, status) => {
            setLoadingStep(status);
        });
        if (!pages.length) {
            setThoughtLog(prev => [...prev, 'No pages rendered for vision extraction.']);
            return;
        }

        for (let index = 0; index < pages.length; index += 1) {
            setLoadingStep(`Analyzing page ${index + 1}/${pages.length}...`);
            const dataUrl = pages[index];
            const base64 = dataUrl.split(',')[1] || dataUrl;
            const prompt = `
Extract ALL formulas from this PDF page image and return ONLY JSON.

Output format:
{
  "formulas": [
    {
      "label": "SHORT LABEL",
      "page": ${index + 1},
      "latex": "\\\\Delta U = Q - W",
      "variables": [
        { "symbol": "\\\\Delta U", "definition": "Change in internal energy" },
        { "symbol": "Q", "definition": "Heat added to system" }
      ],
      "status": "verified"
    }
  ]
}

Rules:
- Extract every explicit formula visible on the page.
- If the page contains assignment questions, ALSO include formulas required to solve them.
- Use LaTeX for the formula string without surrounding $$.
- Use "unknown" status for inferred/required formulas.
- If a definition is missing, use "${FALLBACK_DEFINITION}".
`;
            try {
                const raw = await withTimeout(
                    generateVisionContent(prompt, base64, 'image/png', { model: 'gemini-3-pro-preview' }),
                    45000,
                    'Vision formula extraction'
                );
                const parsed = parseFormulaResponse(raw).map((item) => ({
                    ...item,
                    page: item.page ?? index + 1
                }));
                if (parsed.length > 0) {
                    setExtractedFormulas((prev) => mergeFormulaItems(prev ?? [], ensureVariableDefinitions(parsed)));
                }
            } catch (error) {
                console.warn('Vision extraction failed for page', index + 1, error);
            }
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
    };

    const runFormulaExtractionFlow = async () => {
        setIsExtractingFormulas(true);
        setExtractedFormulas([]);
        setLoadingStep('Extracting formulas...');
        setThoughtLog(prev => [...prev, 'Analyzing document for formulas...']);

        const sourceText = await extractSourceTextForFormulas();
        if (!sourceText.trim()) {
            setSourceMarkdown(null);
            setThoughtLog(prev => [...prev, 'No readable text found in the document.']);
            if (fileData?.mimeType === 'application/pdf') {
                setThoughtLog(prev => [...prev, 'Switching to vision-based formula extraction...']);
                const pdfFile = base64ToFile(fileData.data, fileData.mimeType, fileName || 'document.pdf');
                await extractFormulasFromPdfPages(pdfFile);
                setIsExtractingFormulas(false);
                return;
            }
            setIsExtractingFormulas(false);
            return;
        }

        setSourceMarkdown(toMarkdownFromExtractedText(sourceText.slice(0, 20000)));
        const fastCandidates = buildFormulaItemsFromText(sourceText);
        if (fastCandidates.length > 0) {
            setThoughtLog(prev => [...prev, `Quick scan found ${fastCandidates.length} formulas.`]);
            setExtractedFormulas(ensureVariableDefinitions(fastCandidates));
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }

        const formulas = await extractFormulasFromText(sourceText);
        if (formulas.length === 0) {
            setThoughtLog(prev => [...prev, 'No formulas detected from the source.']);
        } else {
            setThoughtLog(prev => [...prev, `Extracted ${formulas.length} formulas.`]);
        }
        setExtractedFormulas(formulas);

        if (fileData?.mimeType === 'application/pdf' && (formulas.length === 0 || sourceText.length < 400)) {
            const pdfFile = base64ToFile(fileData.data, fileData.mimeType, fileName || 'document.pdf');
            await extractFormulasFromPdfPages(pdfFile);
        }

        setIsExtractingFormulas(false);
    };

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
    const canGenerate = Boolean(fileContent || fileData || topic);
    const autoGenerateKey = `${selectedFeature || 'none'}:${fileName || ''}:${topic || ''}:${fileContent?.length || 0}:${fileData ? fileData.data.length : 0}:${useToT ? 'tot' : 'no'}`;
    const handleToTContinue = () => {
        setIsToTGenerating(false);
        setIsToTReviewing(false);
    };

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
        setExtractedFormulas(null);
        setSourceMarkdown(null);
        setThoughtLog([]);
        setIsStreamingThoughts(true);
        setIsToTReviewing(false);

        const resolvedMode =
            selectedFeature === 'extract-formulas'
                ? 'formula_extraction'
                : selectedFeature === 'qa-generator'
                    ? 'question_answer'
                    : selectedFeature === 'smart-summary'
                        ? 'smart_summary'
                        : selectedFeature === 'flashcards'
                            ? 'flashcards'
                            : selectedFeature === 'timeline-generator'
                                ? 'timeline'
                                : selectedFeature === 'tree-of-thoughts'
                                    ? 'tree_of_thoughts'
                                    : selectedFeature === 'check-my-work'
                                        ? 'check_my_work'
                                        : extractFormulaSheet
                                            ? 'formula_extraction'
                                            : questionAndAnswer
                                                ? 'question_answer'
                                                : 'comprehensive';

        const useToTPlanning = useToT || resolvedMode === 'tree_of_thoughts';
        const isFormulaMode = resolvedMode === 'formula_extraction';
        const isQaMode = resolvedMode === 'question_answer';
        const isSummaryMode = resolvedMode === 'smart_summary';
        const isFlashcardsMode = resolvedMode === 'flashcards';
        const isTimelineMode = resolvedMode === 'timeline';
        const isTreeMode = resolvedMode === 'tree_of_thoughts';
        const isCheckMyWorkMode = resolvedMode === 'check_my_work';
        const isComprehensiveMode = resolvedMode === 'comprehensive';

        // Tree of Thoughts Enhanced Mode: Use ToT internally for better reasoning, then generate HTML
        if (useToTPlanning) {
            setIsToTGenerating(true);
            setTotStage('analyzing');

            // Determine mode for ToT planning
            const mode = resolvedMode;
            const modeLabels: Record<string, string> = {
                formula_extraction: 'Formula Sheet',
                question_answer: 'Q&A Mode',
                smart_summary: 'Smart Summary',
                flashcards: 'Flashcards',
                timeline: 'Study Timeline',
                tree_of_thoughts: 'Tree of Thoughts',
                check_my_work: 'Check My Work',
                comprehensive: 'Interactive Lesson'
            };

            setLoadingStep(`Planning best ${modeLabels[mode] || 'Interactive'} approach...`);

            let totInsights = '';

            try {
                const constraints = getDefaultConstraints(topic || fileName || '');

                // Get mode-specific criteria
                let criteria = getDefaultCriteria(topic || fileName || '');
                if (mode === 'formula_extraction') {
                    criteria = [
                        'Clear organization of formulas by category',
                        'Complete variable definitions',
                        'Proper LaTeX formatting',
                        'Printable layout design',
                        'Worked examples for key formulas'
                    ];
                } else if (mode === 'question_answer') {
                    criteria = [
                        'Multiple difficulty levels (Easy/Medium/Hard)',
                        'Interactive answer reveal functionality',
                        'Detailed step-by-step explanations',
                        'Hint system for each question',
                        'Progress tracking and scoring'
                    ];
                } else if (mode === 'smart_summary') {
                    criteria = [
                        'Concise high-signal summary',
                        'Key definitions and formulas included',
                        'Clear sectioning and hierarchy',
                        'Actionable study tips',
                        'Avoids fluff or repetition'
                    ];
                } else if (mode === 'flashcards') {
                    criteria = [
                        'Clear front/back prompts',
                        'Mix of definitions, formulas, and applications',
                        'Short, testable phrasing',
                        'Consistent formatting',
                        'Covers all major subtopics'
                    ];
                } else if (mode === 'timeline') {
                    criteria = [
                        'Week-by-week structure with milestones',
                        'Balanced workload and review spacing',
                        'Includes practice and checkpoint tasks',
                        'Time estimates per session',
                        'Aligned with topic difficulty'
                    ];
                } else if (mode === 'tree_of_thoughts') {
                    criteria = [
                        'Hierarchical breakdown of subtopics',
                        'Prerequisites and dependencies',
                        'Logical study order',
                        'Clear scope for each branch',
                        'Actionable next steps'
                    ];
                }

                // Stage progression for animation
                setTimeout(() => {
                    setTotStage('generating');
                    setThoughtLog(prev => [...prev, 'Generating candidate approaches...']);
                }, 800);
                setTimeout(() => {
                    setTotStage('evaluating');
                    setLoadingStep('Evaluating teaching strategies...');
                    setThoughtLog(prev => [...prev, 'Scoring approaches against criteria...']);
                }, 1600);
                setTimeout(() => {
                    setTotStage('selecting');
                    setLoadingStep('Selecting optimal approach...');
                    setThoughtLog(prev => [...prev, 'Selecting the strongest strategy...']);
                }, 2400);

                // Get ToT reasoning internally
                const modePrefix = mode === 'formula_extraction'
                    ? 'Create formula sheet for: '
                    : mode === 'question_answer'
                        ? 'Create Q&A practice for: '
                        : mode === 'smart_summary'
                            ? 'Summarize key points for: '
                            : mode === 'flashcards'
                                ? 'Create flashcards for: '
                                : mode === 'timeline'
                                    ? 'Create study timeline for: '
                                    : mode === 'tree_of_thoughts'
                                        ? 'Plan study tree for: '
                                        : 'Exploring teaching approaches for: ';
                setThoughtLog(prev => [...prev, modePrefix + (topic || fileName)]);

                const problemDescription = mode === 'formula_extraction'
                    ? `Extract and organize formulas for: ${topic || fileName || 'Exam preparation'}`
                    : mode === 'question_answer'
                        ? `Create practice questions and answers for: ${topic || fileName || 'Exam preparation'}`
                        : mode === 'smart_summary'
                            ? `Summarize key concepts for: ${topic || fileName || 'Exam preparation'}`
                            : mode === 'flashcards'
                                ? `Create flashcards for: ${topic || fileName || 'Exam preparation'}`
                                : mode === 'timeline'
                                    ? `Build a study timeline for: ${topic || fileName || 'Exam preparation'}`
                                    : mode === 'tree_of_thoughts'
                                        ? `Generate a study plan tree for: ${topic || fileName || 'Exam preparation'}`
                                        : topic || fileName || 'Exam preparation';

                const totResult = await withTimeout(
                    generateStudyPlanTree(
                        problemDescription,
                        constraints,
                        criteria,
                        fileContent || undefined
                    ),
                    45000,
                    'Tree of Thoughts'
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

                if (!isFormulaMode) {
                    // Give user time to view the reasoning tree (keep isToTGenerating true so tree stays visible)
                    setThoughtLog(prev => [...prev, '? Reviewing strategy before generating content...']);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error('ToT planning failed, continuing with standard approach:', error);
                totInsights = ''; // Continue without ToT enhancement
                setThoughtLog(prev => [...prev, 'Planning skipped or timed out, using standard approach.']);
                setIsToTGenerating(false);
                setTotStage('complete');
            }

            if (isTreeMode) {
                setIsGenerating(false);
                setIsToTGenerating(false);
                setIsStreamingThoughts(false);
                setLoadingStep('Complete!');
                return;
            }

            if (isFormulaMode) {
                setIsToTReviewing(false);
                const extractionStart = Date.now();
                setLoadingStep('Extracting formulas...');
                setThoughtLog(prev => [...prev, 'Extracting source into markdown...']);
                await runFormulaExtractionFlow();
                const elapsed = Date.now() - extractionStart;
                const minViewMs = 0;
                if (elapsed < minViewMs) {
                    await new Promise(resolve => setTimeout(resolve, minViewMs - elapsed));
                }
                setIsToTGenerating(false);
                setIsGenerating(false);
                setIsStreamingThoughts(false);
                setLoadingStep('Complete!');
                return;
            }

            // Continue generating HTML while showing the ToT tree
            // (keep isToTGenerating true so the tree stays visible)
            setThoughtLog(prev => [...prev, '🚀 Now generating interactive content using selected strategy...']);
            setLoadingStep('Generating content with selected strategy...');

            try {
                // Determine generation mode based on options
                const modeDescription = isFormulaMode
                    ? 'FORMULA SHEET EXTRACTION'
                    : isQaMode
                        ? 'QUESTION AND ANSWER FORMAT'
                        : isSummaryMode
                            ? 'SMART SUMMARY'
                            : isFlashcardsMode
                                ? 'FLASHCARDS'
                                : isTimelineMode
                                    ? 'STUDY TIMELINE'
                                    : isTreeMode
                                        ? 'TREE OF THOUGHTS'
                                        : isCheckMyWorkMode
                                            ? 'CHECK MY WORK'
                                            : 'COMPREHENSIVE LEARNING MATERIAL';

                const modeSpecificInstructions = isFormulaMode
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
                    : isQaMode
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
                        : isSummaryMode
                            ? `
SPECIAL MODE: SMART SUMMARY
Your PRIMARY TASK is to create a concise, high-signal summary with:
1. Key concepts in short bullet points
2. Essential definitions with brief explanations
3. Formula highlights using LaTeX where needed
4. Common mistakes or misconceptions to avoid
5. A short list of study tips and takeaways
`
                            : isFlashcardsMode
                                ? `
SPECIAL MODE: FLASHCARDS
Your PRIMARY TASK is to create an interactive flashcard deck with:
1. 12-20 flashcards covering terms, formulas, and applications
2. A front/back card layout with click-to-flip behavior
3. Next/Previous navigation and a progress indicator
4. Short prompts on the front and clear answers on the back
5. A quick recap section at the end
`
                                : isTimelineMode
                                    ? `
SPECIAL MODE: STUDY TIMELINE
Your PRIMARY TASK is to create a structured study plan with:
1. A week-by-week schedule based on topic density
2. Time estimates per session and review checkpoints
3. A checklist for Week 1 to help the student start
4. Clear milestones and revision sessions
5. A final recap and exam readiness checklist
`
                                    : isTreeMode
                                        ? `
SPECIAL MODE: TREE OF THOUGHTS
Your PRIMARY TASK is to create a structured study tree with:
1. A root topic and 2-4 levels of nested subtopics
2. Prerequisites and dependencies between nodes
3. A suggested study order and pacing notes
4. Key outcomes for each branch
`
                                        : '';

                const criticalInstruction = isSummaryMode
                    ? '- Cover all major concepts without fluff or repetition.'
                    : isFlashcardsMode
                        ? '- Include every essential term, formula, and relationship from the source.'
                        : isTimelineMode
                            ? '- Use the source density to pace the schedule and include review cycles.'
                            : isTreeMode
                                ? '- Focus on a clear hierarchy and prerequisites.'
                                : isCheckMyWorkMode
                                    ? '- If a student submission is present, focus on corrections and feedback.'
                                    : '- If an uploaded file (PDF/Image) is provided, you MUST solve EVERY SINGLE QUESTION or concept presented in it.\\n- Do not skip any questions. Be exhaustive.';

                const outputFormat = isFormulaMode
                    ? `1. **Overview**: Brief intro and what the formula sheet covers.
2. **Formula Index**: A table of contents with topic headings.
3. **Formula Sections**: Grouped by topic with LaTeX equations and short usage notes.
4. **Variable Definitions**: Bullet list of symbols and meanings for each section.
5. **Worked Examples**: 2-4 short examples showing how to apply key formulas.
6. **Printable Summary**: A compact recap section at the end.`
                    : isQaMode
                        ? `1. **Overview**: What the learner will practice.
2. **Question Sets**: Easy, Medium, Hard sections.
3. **Hints and Answers**: Each question includes a hint and reveal.
4. **Practice Tracker**: Simple progress indicator or score summary.
5. **Quick Recap**: Key takeaways and formulas.`
                        : isSummaryMode
                            ? `1. **Overview**: Short, clear summary title and scope.
2. **Key Concepts**: Bullet list of the most important ideas.
3. **Definitions**: Term -> definition pairs.
4. **Formula Highlights**: LaTeX blocks for critical equations.
5. **Common Pitfalls**: Mistakes to avoid.
6. **Study Tips**: 3-5 actionable tips.`
                            : isFlashcardsMode
                                ? `1. **Overview**: Topic intro and card count.
2. **Flashcard Deck**: Interactive front/back cards with navigation.
3. **Review Mode**: Shuffle and restart controls.
4. **Quick Recap**: Key topics covered.`
                                : isTimelineMode
                                    ? `1. **Overview**: Total study duration and goal.
2. **Weekly Schedule**: Table with week, focus areas, and tasks.
3. **Week 1 Checklist**: Daily breakdown to get started.
4. **Milestones**: Checkpoints and review sessions.
5. **Final Review Plan**: Exam readiness checklist.`
                                    : isTreeMode
                                        ? `1. **Root Topic**: Short description.
2. **Study Tree**: Nested list of branches and sub-branches.
3. **Prerequisites**: Dependencies and suggested order.
4. **Branch Outcomes**: Goals for each branch.
5. **Next Steps**: Actionable study sequence.`
                                        : `1. **Overview/Learning Objectives**: Brief intro stating what the learner will master.
2. **The Question/Problem**: State the core problem(s) or concept(s) clearly.
3. **Conceptual Foundation**: Explain the underlying theory/principles BEFORE solving.
4. **Step-by-Step Solution**: Detailed, numbered steps for EACH problem with clear reasoning.
5. **Visual Diagrams (SVG)**: Include clear, labeled SVG diagrams to illustrate concepts.
6. **Key Formulas Section**: Highlight all important formulas with proper LaTeX delimiters.
7. **INTERACTIVE SIMULATION (Canvas)**:
   - Create a FULL-FEATURED animated Canvas simulation
   - Use 'requestAnimationFrame' for 60fps smooth animation
   - Show the concept visually animating
   - Include multiple interactive controls: sliders, buttons, checkboxes
8. **Practice Problems WITH ANSWER CHECKING**:
   - Create 3-5 practice problems with input fields
   - Each problem should have an input/textarea for user answers
   - Include a "Check Answer" button for each problem
   - Reveal the correct answer after checking with explanation
9. **Quick Reference Summary**: A compact cheat-sheet section at the end.`;

                const answerCheckingSnippet = (isQaMode || isComprehensiveMode)
                    ? `ANSWER CHECKING JAVASCRIPT (include this script):
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
    feedbackEl.innerHTML = '<span class="text-green-500">Correct!</span>';
    feedbackEl.style.display = 'inline';
  } else {
    feedbackEl.innerHTML = '<span class="text-red-500">Try again. Hint: ' + correctAnswer + '</span>';
    feedbackEl.style.display = 'inline';
  }
}
</script>`
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
${fileContent ? `Uploaded File Content:
${fileContent.slice(0, 20000)}...` : ''}
${fileData ? '[Attached File Processing Active]' : ''}

Topic/Context: ${topic || 'General Science/Math'}

CRITICAL INSTRUCTION:
${totInsights ? '- Follow the AI Teaching Plan above for the optimal learning experience.' : ''}
${criticalInstruction}
${isComprehensiveMode ? '- PRIORITIZE INTERACTIVE ANIMATED SIMULATIONS over static content.' : ''}

STRICT OUTPUT FORMAT - The HTML must include ALL of these in sequence:

${outputFormat}

${answerCheckingSnippet}

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
                if (!isTreeMode) {
                    setTotResponse(null); // Clear ToT data so HTML preview shows
                }
                setIsStreamingThoughts(false);
            }
            return;
        }

        if (isFormulaMode) {
            setIsToTReviewing(false);
            const extractionStart = Date.now();
            setLoadingStep('Extracting formulas...');
            setThoughtLog(prev => [...prev, 'Extracting source into markdown...']);
            await runFormulaExtractionFlow();
            const elapsed = Date.now() - extractionStart;
            const minViewMs = 0;
            if (elapsed < minViewMs) {
                await new Promise(resolve => setTimeout(resolve, minViewMs - elapsed));
            }
            setIsGenerating(false);
            setIsToTGenerating(false);
            setIsStreamingThoughts(false);
            setLoadingStep('Complete!');
            return;
        }

        // Legacy HTML mode
        setLoadingStep('Initializing Gemini 3 Pro...');

        try {
            const modeDescription = isFormulaMode
                ? 'FORMULA SHEET EXTRACTION'
                : isQaMode
                    ? 'QUESTION AND ANSWER FORMAT'
                    : isSummaryMode
                        ? 'SMART SUMMARY'
                        : isFlashcardsMode
                            ? 'FLASHCARDS'
                            : isTimelineMode
                                ? 'STUDY TIMELINE'
                                : isTreeMode
                                    ? 'TREE OF THOUGHTS'
                                    : isCheckMyWorkMode
                                        ? 'CHECK MY WORK'
                                        : 'COMPREHENSIVE LEARNING MATERIAL';

            const modeSpecificInstructions = isFormulaMode
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
                : isQaMode
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
                    : isSummaryMode
                        ? `
SPECIAL MODE: SMART SUMMARY
Your PRIMARY TASK is to create a concise, high-signal summary with:
1. Key concepts in short bullet points
2. Essential definitions with brief explanations
3. Formula highlights using LaTeX where needed
4. Common mistakes or misconceptions to avoid
5. A short list of study tips and takeaways
`
                        : isFlashcardsMode
                            ? `
SPECIAL MODE: FLASHCARDS
Your PRIMARY TASK is to create an interactive flashcard deck with:
1. 12-20 flashcards covering terms, formulas, and applications
2. A front/back card layout with click-to-flip behavior
3. Next/Previous navigation and a progress indicator
4. Short prompts on the front and clear answers on the back
5. A quick recap section at the end
`
                            : isTimelineMode
                                ? `
SPECIAL MODE: STUDY TIMELINE
Your PRIMARY TASK is to create a structured study plan with:
1. A week-by-week schedule based on topic density
2. Time estimates per session and review checkpoints
3. A checklist for Week 1 to help the student start
4. Clear milestones and revision sessions
5. A final recap and exam readiness checklist
`
                                : isTreeMode
                                    ? `
SPECIAL MODE: TREE OF THOUGHTS
Your PRIMARY TASK is to create a structured study tree with:
1. A root topic and 2-4 levels of nested subtopics
2. Prerequisites and dependencies between nodes
3. A suggested study order and pacing notes
4. Key outcomes for each branch
`
                                    : '';

            const criticalInstruction = isSummaryMode
                ? '- Cover all major concepts without fluff or repetition.'
                : isFlashcardsMode
                    ? '- Include every essential term, formula, and relationship from the source.'
                    : isTimelineMode
                        ? '- Use the source density to pace the schedule and include review cycles.'
                        : isTreeMode
                            ? '- Focus on a clear hierarchy and prerequisites.'
                            : isCheckMyWorkMode
                                ? '- If a student submission is present, focus on corrections and feedback.'
                                : '- If an uploaded file (PDF/Image) is provided, you MUST solve EVERY SINGLE QUESTION or concept presented in it.\\n- Do not skip any questions. Be exhaustive.';

            const outputFormat = isFormulaMode
                ? `1. **Overview**: Brief intro and what the formula sheet covers.
2. **Formula Index**: A table of contents with topic headings.
3. **Formula Sections**: Grouped by topic with LaTeX equations and short usage notes.
4. **Variable Definitions**: Bullet list of symbols and meanings for each section.
5. **Worked Examples**: 2-4 short examples showing how to apply key formulas.
6. **Printable Summary**: A compact recap section at the end.`
                : isQaMode
                    ? `1. **Overview**: What the learner will practice.
2. **Question Sets**: Easy, Medium, Hard sections.
3. **Hints and Answers**: Each question includes a hint and reveal.
4. **Practice Tracker**: Simple progress indicator or score summary.
5. **Quick Recap**: Key takeaways and formulas.`
                    : isSummaryMode
                        ? `1. **Overview**: Short, clear summary title and scope.
2. **Key Concepts**: Bullet list of the most important ideas.
3. **Definitions**: Term -> definition pairs.
4. **Formula Highlights**: LaTeX blocks for critical equations.
5. **Common Pitfalls**: Mistakes to avoid.
6. **Study Tips**: 3-5 actionable tips.`
                        : isFlashcardsMode
                            ? `1. **Overview**: Topic intro and card count.
2. **Flashcard Deck**: Interactive front/back cards with navigation.
3. **Review Mode**: Shuffle and restart controls.
4. **Quick Recap**: Key topics covered.`
                            : isTimelineMode
                                ? `1. **Overview**: Total study duration and goal.
2. **Weekly Schedule**: Table with week, focus areas, and tasks.
3. **Week 1 Checklist**: Daily breakdown to get started.
4. **Milestones**: Checkpoints and review sessions.
5. **Final Review Plan**: Exam readiness checklist.`
                                : isTreeMode
                                    ? `1. **Root Topic**: Short description.
2. **Study Tree**: Nested list of branches and sub-branches.
3. **Prerequisites**: Dependencies and suggested order.
4. **Branch Outcomes**: Goals for each branch.
5. **Next Steps**: Actionable study sequence.`
                                    : `1. **Overview/Learning Objectives**: Brief intro stating what the learner will master.
2. **The Question/Problem**: State the core problem(s) or concept(s) clearly.
3. **Conceptual Foundation**: Explain the underlying theory/principles BEFORE solving.
4. **Step-by-Step Solution**: Detailed, numbered steps for EACH problem with clear reasoning.
5. **Visual Diagrams (SVG)**: Include clear, labeled SVG diagrams to illustrate concepts.
6. **Key Formulas Section**: Highlight all important formulas with proper LaTeX delimiters.
7. **INTERACTIVE SIMULATION (Canvas)**:
   - Create a FULL-FEATURED animated Canvas simulation
   - Use 'requestAnimationFrame' for 60fps smooth animation
   - Show the concept visually animating
   - Include multiple interactive controls: sliders, buttons, checkboxes
8. **Practice Problems WITH ANSWER CHECKING**:
   - Create 3-5 practice problems with input fields
   - Each problem should have an input/textarea for user answers
   - Include a "Check Answer" button for each problem
   - Reveal the correct answer after checking with explanation
9. **Quick Reference Summary**: A compact cheat-sheet section at the end.`;

            const answerCheckingSnippet = (isQaMode || isComprehensiveMode)
                ? `ANSWER CHECKING JAVASCRIPT (include this script):
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
    feedbackEl.innerHTML = '<span class="text-green-500">Correct!</span>';
    feedbackEl.style.display = 'inline';
  } else {
    feedbackEl.innerHTML = '<span class="text-red-500">Try again. Hint: ' + correctAnswer + '</span>';
    feedbackEl.style.display = 'inline';
  }
}
</script>`
                : '';

            const prompt = `
Content to process:
${fileContent ? `Uploaded File Content:
${fileContent.slice(0, 20000)}...` : ''}
${fileData ? '[Attached File Processing Active]' : ''}

Topic/Context: ${topic || 'General Science/Math'}

Create a single, self-contained HTML file to explain [${topic || fileName || 'the provided concept'}].

${modeSpecificInstructions ? `--- GENERATION MODE: ${modeDescription} ---
${modeSpecificInstructions}
--- END MODE INSTRUCTIONS ---
` : ''}

CRITICAL INSTRUCTION:
${criticalInstruction}
${isComprehensiveMode ? '- PRIORITIZE INTERACTIVE ANIMATED SIMULATIONS over static content.' : ''}

STRICT OUTPUT FORMAT - The HTML must include ALL of these in sequence:

${outputFormat}

${answerCheckingSnippet}

MATHJAX SETUP - CRITICAL (put this in the <head>):
<script>
MathJax = {
  tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] },
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

    useEffect(() => {
        if (!autoGenerate || !selectedFeature || !canGenerate) return;
        if (isGenerating || isExtractingFormulas || isExtractingSource || isToTGenerating) return;
        if (autoGenerateRef.current === autoGenerateKey) return;
        autoGenerateRef.current = autoGenerateKey;
        void handleGenerate();
    }, [
        autoGenerate,
        selectedFeature,
        canGenerate,
        isGenerating,
        isExtractingFormulas,
        isExtractingSource,
        isToTGenerating,
        autoGenerateKey
    ]);

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
    const isFormulaFeature = selectedFeature === 'extract-formulas' || extractFormulaSheet;
    const isTreeFeature = selectedFeature === 'tree-of-thoughts';
    const isCheckMyWorkFeature = selectedFeature === 'check-my-work';
    const disableGenerate = isGenerating || !canGenerate;
    const sourcePreviewUrl = fileData ? `data:${fileData.mimeType};base64,${fileData.data}` : null;
    const isSubmissionPdf = fileData?.mimeType === 'application/pdf';
    const isSubmissionImage = Boolean(fileData?.mimeType?.startsWith('image/'));

    if (isFormulaFeature && isToTGenerating) {
        return (
            <div className="fixed inset-0 z-50 h-full w-full bg-slate-900">
                <ToTLiveViewer
                    totData={totResponse}
                    thoughts={thoughtLog}
                    isGenerating={isToTGenerating}
                    stage={totStage}
                    showContinue={isToTReviewing}
                    onContinue={handleToTContinue}
                    continueLabel="Continue to Extraction"
                />
            </div>
        );
    }

    if (isFormulaFeature) {
        const formulaLoading = isGenerating || isExtractingFormulas || isExtractingSource || isToTGenerating || (autoGenerate && !extractedFormulas);
        return (
            <FormulaExtractionWorkspace
                onBack={onBack || (() => undefined)}
                fileName={fileName || 'Assignment.pdf'}
                fileData={fileData}
                fileContent={fileContent}
                sourceMarkdown={sourceMarkdown}
                formulas={extractedFormulas ?? []}
                isLoading={formulaLoading}
            />
        );
    }

    if (isCheckMyWorkFeature) {
        return (
            <div className="flex flex-1 w-full h-full min-h-0 bg-[#eef2f7] overflow-hidden text-slate-900">
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Back to Assignment</span>
                                </button>
                            )}
                            <div className="hidden sm:block">
                                <div className="text-sm font-semibold text-slate-800">Check My Work</div>
                                <div className="text-xs text-slate-500">Upload a PDF or image and get annotated feedback.</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="application/pdf,image/*"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-[#2c4066] text-white hover:bg-[#34507c] transition-colors"
                            >
                                Upload Submission
                            </button>
                            {fileName && (
                                <span className="text-xs text-slate-500 truncate max-w-[220px]">{fileName}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 flex bg-white">
                        <div className="flex h-full w-1/2 flex-col border-r border-slate-200 bg-white">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                                <div className="text-sm font-semibold text-slate-700">Submission</div>
                                {fileName && (
                                    <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>
                                )}
                            </div>
                            <div className="flex-1 bg-slate-50 overflow-auto">
                                {sourcePreviewUrl ? (
                                    isSubmissionPdf ? (
                                        <iframe
                                            src={sourcePreviewUrl}
                                            className="w-full h-full border-0"
                                            title="Submission PDF"
                                        />
                                    ) : isSubmissionImage ? (
                                        <div className="w-full h-full flex items-center justify-center p-4">
                                            <img
                                                src={sourcePreviewUrl}
                                                alt="Submission"
                                                className="max-w-full max-h-full object-contain shadow-md bg-white"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
                                            Unsupported file type.
                                        </div>
                                    )
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-center text-slate-400 gap-2 px-6">
                                        <FileUp className="w-8 h-8 text-slate-300" />
                                        <p className="text-sm font-medium text-slate-500">Upload a PDF or image to review.</p>
                                        <p className="text-xs text-slate-400">Use the upload button above.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex h-full w-1/2 flex-col bg-white">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                                <div className="text-sm font-semibold text-slate-700">Corrections & Feedback</div>
                                <div className="flex items-center gap-2">
                                    {annotatedImage && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = `data:${annotatedImage.mimeType};base64,${annotatedImage.data}`;
                                                    link.download = 'annotated-work.png';
                                                    link.click();
                                                }}
                                                className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-500"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setAnnotatedImage(null);
                                                    setCheckingFeedback(null);
                                                }}
                                                className="px-2 py-1 text-xs bg-red-600/10 text-red-500 rounded hover:bg-red-600/20"
                                            >
                                                Clear
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-50 overflow-auto p-4">
                                {isChecking ? (
                                    <div className="flex flex-col items-center justify-center text-center text-slate-500 gap-3 h-full">
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                                        <p className="text-sm font-medium">Checking your work...</p>
                                    </div>
                                ) : annotatedImage ? (
                                    <div className="w-full flex flex-col items-center gap-4">
                                        <img
                                            src={`data:${annotatedImage.mimeType};base64,${annotatedImage.data}`}
                                            alt="Annotated feedback"
                                            className="max-w-full shadow-lg bg-white"
                                        />
                                        {checkingFeedback && (
                                            <div className="w-full bg-white border border-slate-200 rounded-lg p-4">
                                                <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-2">
                                                    Feedback Summary
                                                </div>
                                                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                                    {checkingFeedback}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center text-slate-500 gap-4 h-full">
                                        <CheckCircle className="w-9 h-9 text-emerald-400" />
                                        <p className="text-sm font-medium">Run "Check My Work" to see corrections.</p>
                                        <button
                                            onClick={handleCheckMyWork}
                                            disabled={isChecking || !fileData}
                                            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded
                                                    ${isChecking || !fileData
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                        >
                                            Check My Work
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 w-full h-full min-h-0 bg-[#eef2f7] overflow-hidden text-slate-900">
            {/* Left Sidebar - Input & Thinking Stream */}
            {sidebarOpen && (
                <div className="w-96 flex-shrink-0 border-r border-white/10 flex flex-col overflow-hidden z-20 shadow-[0_20px_60px_rgba(0,0,0,0.35)] h-full" style={{ backgroundColor: '#1F1F1F' }}>
                    {/* Back Button Header */}
                    {onBack && (
                        <div className="border-b border-slate-700 p-4">
                            <button
                                onClick={onBack}
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Back to Dashboard</span>
                            </button>
                        </div>
                    )}
                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto flex flex-col p-6 gap-6">
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
                        <div className="absolute inset-0">
                            <ToTLiveViewer
                                totData={totResponse}
                                thoughts={thoughtLog}
                                isGenerating={isToTGenerating}
                                stage={totStage}
                            />
                        </div>
                    ) : isTreeFeature && totResponse ? (
                        <div className="absolute inset-0 w-full h-full bg-slate-900 overflow-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                <div className="mb-4">
                                    <h2 className="text-xl font-bold text-white">Tree of Thoughts Plan</h2>
                                    <p className="text-sm text-slate-400">Expand branches to explore alternate study paths.</p>
                                </div>
                                <ExamPrepToTViewer
                                    data={totResponse}
                                    onExpandNode={handleExpandNode}
                                    expandingNodeId={expandingNodeId}
                                />
                            </div>
                        </div>
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
                            ) : autoGenerate && selectedFeature ? (
                                <div className="flex flex-col items-center gap-4 text-center max-w-md">
                                    <Loader2 className="w-10 h-10 animate-spin text-[#2c4066]" />
                                    <div>
                                        <p className="text-lg font-bold text-slate-700 mb-1">Preparing your module</p>
                                        <p className="text-sm text-slate-500">Starting analysis and generation...</p>
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
