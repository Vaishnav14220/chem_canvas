import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, Play, Brain, FileBarChart, Star, HelpCircle, X, Download, Copy, FileText, Upload, Edit3, Save, Trash2, Plus, Palette, MessageSquare, BookOpen, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import * as geminiService from '../services/geminiService';
import type { GeneratedFlashcard, GeneratedQuizQuestion } from '../services/geminiService';
import DocumentDesigner from './DocumentDesigner';
import ChatAssistant from './ChatAssistant';
import TestSection from './TestSection';

interface StudyToolsProps {
  isOpen: boolean;
  onClose: () => void;
  sourceContent: string;
  sourceName: string;
  toolType: 'audio' | 'video' | 'mindmap' | 'reports' | 'flashcards' | 'quiz' | 'notes' | 'documents' | 'designer' | 'chat' | 'tests';
}

interface MindMapNode {
  title: string;
  description?: string;
  children?: MindMapNode[];
}

type StudyContent =
  | { type: 'flashcards'; cards: GeneratedFlashcard[]; rawText?: string }
  | { type: 'quiz'; questions: GeneratedQuizQuestion[]; rawText?: string }
  | { type: 'mindmap'; centralTopic: string; nodes: MindMapNode[]; rawText?: string }
  | { type: 'audio' | 'video' | 'reports'; text: string; rawText?: string };

const MAX_CONTEXT_CHARS = 4000;

const extractJsonBlock = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return trimmed;
};

const splitIntoSnippets = (text: string, limit: number, maxLength: number) => {
  return text
    .replace(/\r/g, ' ')
    .split(/[\n\.]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
};

const extractFocusAreas = (text: string, limit = 4) => {
  if (!text) return [];
  const snippets = splitIntoSnippets(text, limit * 2, 80);
  const unique: string[] = [];
  for (const snippet of snippets) {
    const normalized = snippet.replace(/[^\w\s-]/g, '').trim();
    if (!normalized) continue;
    if (!unique.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      unique.push(normalized);
    }
    if (unique.length >= limit) break;
  }
  return unique;
};

const buildContextNotes = (text: string, limit = 5) => {
  if (!text) return [];
  return splitIntoSnippets(text, limit, 160);
};

const normalizeMindMapNode = (input: any): MindMapNode | null => {
  if (!input || typeof input !== 'object') return null;
  const candidate = input.title ?? input.name ?? input.topic ?? '';
  const title = typeof candidate === 'string' ? candidate.trim() : '';
  if (!title) return null;

  const descriptionCandidate = input.description ?? input.detail ?? input.summary ?? input.notes ?? '';
  const description = typeof descriptionCandidate === 'string' ? descriptionCandidate.trim() : '';

  const node: MindMapNode = { title };
  if (description) {
    node.description = description;
  }

  const childrenSource = input.children ?? input.nodes ?? input.branches ?? [];
  if (Array.isArray(childrenSource)) {
    const children = childrenSource
      .map(normalizeMindMapNode)
      .filter((child): child is MindMapNode => child !== null);
    if (children.length) {
      node.children = children;
    }
  }

  return node;
};

const parseMindMapResponse = (raw: string) => {
  const payload = extractJsonBlock(raw);
  const parsed = JSON.parse(payload);

  const centralTopic = typeof parsed.centralTopic === 'string' && parsed.centralTopic.trim()
    ? parsed.centralTopic.trim()
    : typeof parsed.topic === 'string' && parsed.topic.trim()
      ? parsed.topic.trim()
      : 'Mind Map';

  const nodeCandidates = Array.isArray(parsed.nodes)
    ? parsed.nodes
    : Array.isArray(parsed.branches)
      ? parsed.branches
      : parsed.structure && Array.isArray(parsed.structure.nodes)
        ? parsed.structure.nodes
        : [];

  const nodes = nodeCandidates
    .map(normalizeMindMapNode)
    .filter((node: MindMapNode | null): node is MindMapNode => node !== null);

  if (!nodes.length) {
    throw new Error('Mind map response did not include any branches.');
  }

  return { centralTopic, nodes };
};

const buildMindMapPrompt = (topic: string, source: string) => {
  const lines = [
    'You are an expert chemistry study coach generating a hierarchical mind map.',
    `Central topic: ${topic}.`,
    'Return only valid JSON using this schema:',
    '{',
    '  "centralTopic": "string",',
    '  "nodes": [',
    '    {',
    '      "title": "string",',
    '      "description": "string (<= 120 characters)",',
    '      "children": [ ... recursive same structure ... ]',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Provide at least 3 main branches.',
    '- Include up to 3 levels of depth when useful.',
    '- Keep descriptions concise and student-friendly.',
    '- Output JSON only, with no commentary.'
  ];

  if (source) {
    lines.push(`Study material to prioritise (trimmed):\n${source.slice(0, MAX_CONTEXT_CHARS)}`);
  } else {
    lines.push('No source material provided; rely on core chemistry knowledge.');
  }

  return lines.join('\n');
};

const buildNarrativePrompt = (type: 'audio' | 'video' | 'reports', topic: string, source: string) => {
  const baseIntro =
    type === 'audio'
      ? 'Create an engaging audio lesson script for a chemistry student.'
      : type === 'video'
        ? 'Create a concise chemistry video outline with narration and visual direction.'
        : 'Write a synthesized chemistry study report with actionable insights.';

  const lines = [baseIntro, `Focus topic: ${topic}.`];

  if (source) {
    lines.push('Primary study material (trimmed to 4000 characters):');
    lines.push(source.slice(0, MAX_CONTEXT_CHARS));
  } else {
    lines.push('No study material provided; draw from subject matter expertise.');
  }

  if (type === 'audio') {
    lines.push('Structure the script with headings and include approximate duration per section in parentheses. Use markdown with bullet lists for key points.');
    lines.push('Sections: Opening hook, 3-5 teaching segments (with analogies), recap, action items.');
  } else if (type === 'video') {
    lines.push('Produce 5-7 scenes. For each scene include: Title, Narration (2-4 sentences), Visuals (animations/diagrams/demos).');
    lines.push('Format output with markdown headings (###) and bullet lists. Conclude with a summary call-to-action.');
  } else {
    lines.push('Organise the report into markdown headings with these sections: Executive Summary, Key Concepts, Detailed Insights, Applications, Quick Revision Checklist.');
    lines.push('Use bullet lists where helpful and keep explanations concise (2-3 sentences per point).');
  }

  return lines.join('\n');
};

const formatMindMapForExport = (centralTopic: string, nodes: MindMapNode[]) => {
  const lines = [`# ${centralTopic} Mind Map`, ''];

  const walk = (branches: MindMapNode[], depth = 0) => {
    branches.forEach((branch) => {
      const indent = '  '.repeat(depth);
      const description = branch.description ? `: ${branch.description}` : '';
      lines.push(`${indent}- ${branch.title}${description}`);
      if (branch.children && branch.children.length) {
        walk(branch.children, depth + 1);
      }
    });
  };

  walk(nodes);
  return lines.join('\n');
};

const formatFlashcardsForExport = (cards: GeneratedFlashcard[]) => {
  return cards
    .map((card, index) => {
      const lines = [`Card ${index + 1}`, `Front: ${card.front}`, `Back: ${card.back}`];
      if (card.mnemonic) lines.push(`Mnemonic: ${card.mnemonic}`);
      if (card.confidenceTag) lines.push(`Confidence: ${card.confidenceTag}`);
      if (card.difficulty) lines.push(`Difficulty: ${card.difficulty}`);
      if (card.tags?.length) lines.push(`Tags: ${card.tags.join(', ')}`);
      return lines.join('\n');
    })
    .join('\n\n');
};

const formatQuizForExport = (questions: GeneratedQuizQuestion[]) => {
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
  return questions
    .map((question, index) => {
      const lines = [`Question ${index + 1}: ${question.prompt}`];
      question.options.forEach((option, optionIndex) => {
        lines.push(`  ${optionLabels[optionIndex] || String(optionIndex + 1)}. ${option}`);
      });
      const correctLabel = optionLabels[question.correctOptionIndex] || String(question.correctOptionIndex + 1);
      lines.push(`Answer: ${correctLabel}`);
      if (question.explanation) {
        lines.push(`Explanation: ${question.explanation}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
};

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  modifiedAt: Date;
}

interface UploadedDocument {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

export default function StudyTools({ isOpen, onClose, sourceContent, sourceName, toolType }: StudyToolsProps) {
  const [activeTab, setActiveTab] = useState<'study' | 'documents' | 'notes' | 'designer'>('study');
  const [isGenerating, setIsGenerating] = useState(false);
  const [studyContent, setStudyContent] = useState<StudyContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [quizResponses, setQuizResponses] = useState<Record<number, number | null>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  
  // Document upload state
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [showDocumentDesigner, setShowDocumentDesigner] = useState(false);
  const [showChatAssistant, setShowChatAssistant] = useState(false);
  const [showTestSection, setShowTestSection] = useState(false);

  const sanitizedTopic = topicInput.trim();
  const sanitizedSource = useMemo(() => sourceContent.trim(), [sourceContent]);
  const effectivePrompt = useMemo(() => {
    if (sanitizedTopic && sanitizedSource) {
      return `${sanitizedTopic}\n\n${sanitizedSource}`;
    }
    return sanitizedTopic || sanitizedSource;
  }, [sanitizedTopic, sanitizedSource]);
  const hasSourceContent = sanitizedSource.length > 0;
  const displaySourceName = hasSourceContent ? sourceName : 'No sources';

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('study');
    setIsGenerating(false);
    setStudyContent(null);
    setError(null);
    setShowDocumentDesigner(false);
    setShowChatAssistant(false);
    setShowTestSection(false);
    const normalizedSourceName = sourceName && sourceName.toLowerCase() === 'no sources' ? '' : sourceName;
    setTopicInput(normalizedSourceName && sanitizedSource ? normalizedSourceName : '');
    setActiveCardIndex(0);
    setShowFlashcardBack(false);
    setQuizResponses({});
    setQuizSubmitted(false);
  }, [toolType, isOpen, sourceName, sanitizedSource]);

  const generateStudyContent = async () => {
    if (!geminiService.isGeminiInitialized()) {
      setError('Please configure your Gemini API key in Settings before generating study materials.');
      return;
    }

    if (!effectivePrompt) {
      setError('Add a topic or upload reference material to generate study resources.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const topicLabel =
        sanitizedTopic || (sourceName && sourceName.toLowerCase() !== 'no sources' ? sourceName : 'Chemistry Study Session');

      const focusAreas = extractFocusAreas(sanitizedSource);
      const contextNotes = buildContextNotes(sanitizedSource);

      switch (toolType) {
        case 'flashcards': {
          const cards = await geminiService.generateFlashcardDeck({
            topic: topicLabel,
            count: 8,
            learnerLevel: 'intermediate',
            emphasis: focusAreas.length ? focusAreas : undefined
          });
          setStudyContent({ type: 'flashcards', cards });
          setActiveCardIndex(0);
          setShowFlashcardBack(false);
          break;
        }
        case 'quiz': {
          const questions = await geminiService.generateAdaptiveQuizQuestions({
            topic: topicLabel,
            count: 6,
            difficulty: 'intermediate',
            focusAreas,
            contextNotes
          });
          setStudyContent({ type: 'quiz', questions });
          setQuizResponses({});
          setQuizSubmitted(false);
          break;
        }
        case 'mindmap': {
          const prompt = buildMindMapPrompt(topicLabel, sanitizedSource);
          const response = await geminiService.generateTextContent(prompt);
          const { centralTopic, nodes } = parseMindMapResponse(response);
          setStudyContent({ type: 'mindmap', centralTopic, nodes, rawText: response });
          break;
        }
        case 'audio':
        case 'video':
        case 'reports': {
          const prompt = buildNarrativePrompt(toolType, topicLabel, sanitizedSource);
          const text = await geminiService.generateTextContent(prompt);
          setStudyContent({ type: toolType, text, rawText: text });
          break;
        }
        default:
          setError('This study tool is not yet supported.');
      }
    } catch (err: any) {
      console.error('Study tool generation failed:', err);
      setError(err.message || 'Failed to generate study content.');
    } finally {
      setIsGenerating(false);
    }
  };

  const quizScore = useMemo(() => {
    if (!studyContent || studyContent.type !== 'quiz' || !quizSubmitted) {
      return 0;
    }
    return studyContent.questions.reduce((score, question, index) => {
      return score + (quizResponses[index] === question.correctOptionIndex ? 1 : 0);
    }, 0);
  }, [quizSubmitted, quizResponses, studyContent]);

  const renderMindMapNodes = (nodes: MindMapNode[], depth = 0) => {
    return (
      <div className={`space-y-3 ${depth > 0 ? 'pl-4 border-l border-border/60' : ''}`}>
        {nodes.map((node, idx) => (
          <div key={`${node.title}-${idx}`} className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary/80" />
              <div>
                <h4 className="font-semibold">{node.title}</h4>
                {node.description && (
                  <p className="text-sm text-muted-foreground">{node.description}</p>
                )}
              </div>
            </div>
            {node.children && node.children.length > 0 && (
              <div className="mt-2">
                {renderMindMapNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMindMapContent = (centralTopic: string, nodes: MindMapNode[]) => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{centralTopic}</h2>
        <p className="text-sm text-muted-foreground">Visualise how the key concepts connect.</p>
      </div>
      {renderMindMapNodes(nodes)}
    </div>
  );

  const renderFlashcards = (cards: GeneratedFlashcard[]) => {
    if (!cards.length) {
      return <p className="text-muted-foreground">No flashcards generated yet.</p>;
    }

    const currentCard = cards[activeCardIndex];
    const meta: string[] = [];
    if (currentCard.confidenceTag) meta.push(`Confidence: ${currentCard.confidenceTag}`);
    if (currentCard.difficulty) meta.push(`Difficulty: ${currentCard.difficulty}`);
    if (currentCard.tags?.length) meta.push(`Tags: ${currentCard.tags.join(', ')}`);

    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Card {activeCardIndex + 1} of {cards.length}
          </span>
          <button
            onClick={() => {
              setShowFlashcardBack(false);
              setActiveCardIndex(0);
            }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <button
          onClick={() => setShowFlashcardBack((prev) => !prev)}
          className="w-full max-w-lg min-h-[220px] bg-gradient-to-br from-primary/10 via-background to-primary/5 border border-border/60 rounded-2xl p-6 shadow-sm transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <div className="text-sm uppercase tracking-wide text-muted-foreground mb-3">
            {showFlashcardBack ? 'Answer' : 'Prompt'}
          </div>
          <div className="text-lg font-semibold leading-relaxed text-left">
            {showFlashcardBack ? currentCard.back : currentCard.front}
          </div>
          {showFlashcardBack && currentCard.mnemonic && (
            <div className="mt-4 text-sm text-primary/80">
              Mnemonic: {currentCard.mnemonic}
            </div>
          )}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowFlashcardBack(false);
              setActiveCardIndex((prev) => Math.max(prev - 1, 0));
            }}
            disabled={activeCardIndex === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/70 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={() => setShowFlashcardBack((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Flip Card
          </button>
          <button
            onClick={() => {
              setShowFlashcardBack(false);
              setActiveCardIndex((prev) => Math.min(prev + 1, cards.length - 1));
            }}
            disabled={activeCardIndex === cards.length - 1}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/70 transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {meta.length > 0 && (
          <div className="text-xs text-muted-foreground flex flex-wrap justify-center gap-3">
            {meta.map((item, idx) => (
              <span key={idx} className="px-2 py-1 rounded-full bg-muted/70">
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderQuiz = (questions: GeneratedQuizQuestion[]) => {
    if (!questions.length) {
      return <p className="text-muted-foreground">No quiz questions generated yet.</p>;
    }

    const allAnswered = questions.every((_, index) => typeof quizResponses[index] === 'number');

    return (
      <div className="space-y-6">
        {questions.map((question, index) => {
          const selected = quizResponses[index] ?? null;
          const isCorrect = quizSubmitted && selected === question.correctOptionIndex;
          return (
            <div key={index} className="border border-border rounded-xl p-5 bg-muted/30">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <p className="font-medium text-sm md:text-base">{question.prompt}</p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => {
                      const isSelected = selected === optionIndex;
                      const isAnswer = question.correctOptionIndex === optionIndex;
                      return (
                        <button
                          key={optionIndex}
                          type="button"
                          onClick={() => {
                            if (quizSubmitted) return;
                            setQuizResponses((prev) => ({ ...prev, [index]: optionIndex }));
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                            quizSubmitted
                              ? isAnswer
                                ? 'border-green-500 bg-green-500/10 text-green-500'
                                : isSelected
                                  ? 'border-red-500 bg-red-500/10 text-red-500'
                                  : 'border-border bg-background/60 text-foreground'
                              : isSelected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/60 hover:bg-muted/60'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Circle className={`h-3 w-3 ${isSelected ? 'fill-current' : ''}`} />
                            {option}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {quizSubmitted && (
                    <div className={`flex items-center gap-2 text-sm ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
                      {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      <span>{question.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {quizSubmitted ? (
            <div className="text-sm font-medium text-muted-foreground">
              Score: {quizScore} / {questions.length}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select an answer for each question, then check your results.
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setQuizResponses({});
                setQuizSubmitted(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/70 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={() => setQuizSubmitted(true)}
              disabled={!allAnswered || quizSubmitted}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              Check Answers
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderNarrative = (text: string) => (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );

  const renderStudyContent = () => {
    if (!studyContent) return null;
    switch (studyContent.type) {
      case 'flashcards':
        return renderFlashcards(studyContent.cards);
      case 'quiz':
        return renderQuiz(studyContent.questions);
      case 'mindmap':
        return renderMindMapContent(studyContent.centralTopic, studyContent.nodes);
      case 'audio':
      case 'video':
      case 'reports':
        return renderNarrative(studyContent.text);
      default:
        return null;
    }
  };

  const getExportText = (content: StudyContent): string => {
    switch (content.type) {
      case 'flashcards':
        return formatFlashcardsForExport(content.cards);
      case 'quiz':
        return formatQuizForExport(content.questions);
      case 'mindmap':
        return formatMindMapForExport(content.centralTopic, content.nodes);
      case 'audio':
      case 'video':
      case 'reports':
        return content.text;
    }
  };

  const copyStudyContentToClipboard = () => {
    if (!studyContent) return;
    const exportText = getExportText(studyContent);
    navigator.clipboard.writeText(exportText);
  };

  const downloadStudyContent = () => {
    if (!studyContent) return;
    const exportText = getExportText(studyContent);
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = getToolDisplayName(studyContent.type).replace(/\s+/g, '-');
    a.download = `${label}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const content = await file.text();
      const newDocument: UploadedDocument = {
        id: Date.now().toString(),
        name: file.name,
        content: content,
        size: file.size,
        type: file.type,
        uploadedAt: new Date()
      };
      
      setUploadedDocuments(prev => [...prev, newDocument]);
    } catch (error) {
      setError('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    
    setNotes(prev => [...prev, newNote]);
    setSelectedNote(newNote);
    setNoteTitle('New Note');
    setNoteContent('');
    setIsEditing(true);
  };

  const saveNote = () => {
    if (!selectedNote) return;
    
    const updatedNote: Note = {
      ...selectedNote,
      title: noteTitle,
      content: noteContent,
      modifiedAt: new Date()
    };
    
    setNotes(prev => prev.map(note => 
      note.id === selectedNote.id ? updatedNote : note
    ));
    
    setSelectedNote(updatedNote);
    setIsEditing(false);
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setIsEditing(false);
    }
  };

  const getToolDisplayName = (type: string) => {
    const names = {
      audio: 'Audio Overview',
      video: 'Video Overview',
      mindmap: 'Mind Map',
      reports: 'Reports',
      flashcards: 'Flashcards',
      quiz: 'Quiz',
      notes: 'Custom Notes',
      documents: 'Document Manager',
      designer: 'Document Designer',
      chat: 'Chat Assistant',
      tests: 'AI Test Center'
    };
    return names[type as keyof typeof names] || type;
  };

  const getToolIcon = (type: string) => {
    const icons = {
      audio: Volume2,
      video: Play,
      mindmap: Brain,
      reports: FileBarChart,
      flashcards: Star,
      quiz: HelpCircle,
      notes: Edit3,
      documents: FileText,
      designer: Palette,
      chat: MessageSquare,
      tests: BookOpen
    };
    return icons[type as keyof typeof icons] || HelpCircle;
  };

  if (!isOpen) return null;

  const Icon = getToolIcon(toolType);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-lg w-[900px] max-w-[90vw] max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{getToolDisplayName(toolType)}</h2>
              <p className="text-sm text-muted-foreground">Source: {displaySourceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'study', label: 'Study Tools', icon: Brain },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'notes', label: 'Notes', icon: Edit3 },
              { id: 'designer', label: 'Designer', icon: Palette }
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  data-tool={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap py-4 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
            
            {/* Direct Access Buttons */}
            <div className="ml-auto flex items-center gap-2">
              <button
                data-tool="chat"
                onClick={() => setShowChatAssistant(true)}
                className="inline-flex items-center gap-2 whitespace-nowrap py-2 px-3 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Chat Assistant
              </button>
              
              <button
                data-tool="tests"
                onClick={() => setShowTestSection(true)}
                className="inline-flex items-center gap-2 whitespace-nowrap py-2 px-3 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                AI Test Center
              </button>
            </div>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Study Tools Tab */}
          {activeTab === 'study' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {!studyContent ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="w-full max-w-xl space-y-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
                        <Icon className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold">
                        Generate {getToolDisplayName(toolType)}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {hasSourceContent
                          ? `We will combine your ${displaySourceName.toLowerCase()} materials with Gemini to build personalized ${getToolDisplayName(toolType).toLowerCase()}.`
                          : 'Add a topic or keywords so Gemini can craft focused study materials for you.'}
                      </p>
                    </div>

                    <div className="bg-muted/40 border border-border/60 rounded-lg p-4 text-left space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Study focus</label>
                        <span className="text-xs text-muted-foreground">Optional prompt</span>
                      </div>
                      <textarea
                        value={topicInput}
                        onChange={(event) => setTopicInput(event.target.value)}
                        rows={3}
                        placeholder="e.g. Acid-base titration steps, VSEPR shapes, enthalpy trends..."
                        className="w-full resize-none rounded-lg border border-border bg-background/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <p className="text-xs text-muted-foreground">
                        {hasSourceContent
                          ? 'Tip: refine the topic to steer generation. Your uploaded sources remain the primary reference.'
                          : 'Paste brief notes or a topic title to guide Gemini if you have no sources yet.'}
                      </p>
                    </div>

                    {error && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-left">
                        <p className="text-destructive text-sm">{error}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-muted-foreground">
                        {hasSourceContent
                          ? `Context: ${displaySourceName}`
                          : 'Need inspiration? Start with a concise topic description.'}
                      </div>
                      <button
                        onClick={generateStudyContent}
                        disabled={isGenerating || !effectivePrompt}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 gap-2"
                      >
                        {isGenerating ? (
                          <>
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Icon className="h-4 w-4" />
                            Generate {getToolDisplayName(toolType)}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Toolbar */}
                  <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-green-500/20">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Generated Successfully</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyStudyContentToClipboard}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                      <button
                        onClick={downloadStudyContent}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>

                  {/* Generated Content */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-5">
                      <div>
                        <h1 className="text-2xl font-bold">{getToolDisplayName(studyContent.type)}</h1>
                        <p className="text-sm text-muted-foreground">
                          {sanitizedTopic
                            ? `Focus: ${sanitizedTopic}`
                            : hasSourceContent
                              ? `Generated from ${displaySourceName}`
                              : 'Generated using Gemini insights'}
                        </p>
                      </div>
                      {renderStudyContent()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-6">
                {/* Quick Start Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                      <span className="text-sm font-bold">1</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1">Quick Start Guide</h4>
                      <p className="text-sm text-blue-700 mb-3">
                        Upload your documents first, then use the tools below to analyze and create content from them.
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
                            <span className="text-xs font-bold">2</span>
                          </div>
                          <span className="text-green-700 font-medium">Chat with documents</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white">
                            <span className="text-xs font-bold">3</span>
                          </div>
                          <span className="text-purple-700 font-medium">Generate tests</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Document Manager</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowChatAssistant(true)}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-9 px-4 gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Chat Assistant
                    </button>
                    <button
                      onClick={() => setShowTestSection(true)}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-purple-600 text-white hover:bg-purple-700 h-9 px-4 gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                      AI Test Center
                    </button>
                    <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 gap-2 cursor-pointer">
                      <Upload className="h-4 w-4" />
                      {isUploading ? 'Uploading...' : 'Upload Document'}
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  {uploadedDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="text-lg font-medium mb-2">No documents uploaded</h4>
                      <p className="text-muted-foreground">Upload your study materials to get started</p>
                    </div>
                  ) : (
                    uploadedDocuments.map((doc) => (
                      <div key={doc.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <h4 className="font-medium">{doc.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {doc.type} • {(doc.size / 1024).toFixed(1)} KB • {doc.uploadedAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8">
                              <Download className="h-4 w-4" />
                            </button>
                            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="flex-1 overflow-hidden flex">
              {/* Notes Sidebar */}
              <div className="w-64 border-r border-border bg-muted/20">
                <div className="p-4 border-b border-border">
                  <button
                    onClick={createNewNote}
                    className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Note
                  </button>
                </div>
                
                <div className="p-2">
                  {notes.length === 0 ? (
                    <div className="text-center py-8">
                      <Edit3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {notes.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => {
                            setSelectedNote(note);
                            setNoteTitle(note.title);
                            setNoteContent(note.content);
                            setIsEditing(false);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedNote?.id === note.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <h4 className="font-medium text-sm truncate">{note.title}</h4>
                          <p className="text-xs opacity-70 truncate">{note.content.substring(0, 50)}...</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Note Editor */}
              <div className="flex-1 flex flex-col">
                {selectedNote ? (
                  <>
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        {isEditing ? (
                          <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        ) : (
                          <h3 className="text-lg font-semibold">{selectedNote.title}</h3>
                        )}
                        
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveNote}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 w-8"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setIsEditing(false)}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteNote(selectedNote.id)}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 p-4">
                      {isEditing ? (
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Start writing your notes..."
                          className="w-full h-full resize-none border-none outline-none bg-transparent text-sm leading-relaxed"
                        />
                      ) : (
                        <div className="w-full h-full text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedNote.content || 'No content yet. Click edit to start writing.'}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Edit3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="text-lg font-medium mb-2">Select a note</h4>
                      <p className="text-muted-foreground">Choose a note from the sidebar or create a new one</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Document Designer Tab */}
          {activeTab === 'designer' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1">
                <DocumentDesigner 
                  isOpen={true} 
                  onClose={() => setActiveTab('study')} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/50 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Generated from: {sourceName}
          </div>
          <div className="flex items-center gap-3">
            {studyContent && (
              <button
                onClick={() => {
                  setStudyContent(null);
                  setError(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Generate New
              </button>
            )}
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      
      {/* Chat Assistant Modal */}
      <ChatAssistant 
        isOpen={showChatAssistant} 
        onClose={() => setShowChatAssistant(false)} 
      />
      
      {/* Test Section Modal */}
      <TestSection 
        isOpen={showTestSection} 
        onClose={() => setShowTestSection(false)} 
      />
    </div>
  );
}