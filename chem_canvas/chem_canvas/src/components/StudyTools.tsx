// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LucideIcon } from 'lucide-react';
import { Volume2, Play, Brain, FileBarChart, Star, HelpCircle, X, Download, Copy, FileText, Upload, Edit3, Save, Trash2, Plus, Palette, MessageSquare, BookOpen, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, Circle, AlertCircle, Settings } from 'lucide-react';
import '@blocknote/react/style.css';
import * as geminiService from '../services/geminiService';
import type { GeneratedFlashcard, GeneratedQuizQuestion } from '../services/geminiService';
import DocumentDesigner from './DocumentDesigner';
import ChatAssistant from './ChatAssistant';
import TestSection from './TestSection';
import MoleculeSearch from './MoleculeSearch';

interface StudyToolsProps {
  isOpen: boolean;
  onClose: () => void;
  sourceContent: string;
  sourceName: string;
  toolType: 'audio' | 'video' | 'mindmap' | 'reports' | 'flashcards' | 'quiz' | 'notes' | 'documents' | 'designer' | 'chat' | 'tests';
  embedded?: boolean;
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

type ActiveTab = 'notes' | 'chat' | 'tests';

const PRIMARY_TABS: ReadonlyArray<{
  id: Extract<ActiveTab, 'notes'>;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'notes', label: 'Notes', icon: Edit3 }
];

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

const DEFAULT_NOTE_MARKDOWN = `## Quick Capture\nUse this space like a Notion page. Try adding headings (\`/heading\`), to-do lists (\`/todo\`), callouts, or equations.\n\n### Ideas\n- [ ] Outline key reactions\n- [ ] Summarise today's lecture\n- [ ] Draft lab report introduction`;

const NOTE_TEMPLATES = [
  {
    id: 'experiment-log',
    label: 'Experiment Log',
    description: 'Observations, reagents, results, and analysis',
    markdown: `## Experiment Overview\n**Objective:** Describe the purpose of this experiment.\n\n### Reagents & Conditions\n- Reagent A: \\n- Reagent B: \\n- Conditions: Temp, pressure, catalysts\n\n### Procedure\n1. Step 1\n2. Step 2\n\n### Observations\n- Notable colour changes\n- Precipitate formation\n\n### Analysis\n- Key insights\n- Potential sources of error`,
  },
  {
    id: 'study-plan',
    label: 'Study Plan',
    description: 'Break down topics, resources, and checkpoints',
    markdown: `## Focus Topic\nDescribe the main concept you're mastering.\n\n### Key Subtopics\n- Topic 1\n- Topic 2\n- Topic 3\n\n### Resources\n- [ ] Textbook pages\n- [ ] Practice problems\n- [ ] Videos/articles\n\n### Reflection\nWhat felt clear? What needs revisiting?`,
  },
  {
    id: 'meeting-notes',
    label: 'Meeting Notes',
    description: 'Agendas, action items, and open questions',
    markdown: `## Agenda\n- Item 1\n- Item 2\n\n### Key Points\n- Speaker & summary\n- Decisions\n\n### Action Items\n- [ ] Owner - Task - Due date\n- [ ] Owner - Task - Due date\n\n### Questions\n- Open question 1\n- Open question 2`,
  },
];

const createPreviewFromMarkdown = (markdown: string) => {
  const firstLine = markdown.split('\n').find((line) => line.trim().length > 0);
  return firstLine ? firstLine.trim().slice(0, 140) : 'Empty note';
};

interface MarkdownTable {
  id: string;
  start: number;
  end: number;
  headers: string[];
  rows: string[][];
}

const TABLE_BLOCK_REGEX = /^(\|.+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|.*\|\r?\n?)*)/gm;

const normaliseTableMatrix = (rows: string[][], columns: number) => {
  if (columns <= 0) {
    return [];
  }

  const createEmptyRow = () => Array.from({ length: columns }, () => '');

  if (!rows.length) {
    return [createEmptyRow()];
  }

  return rows.map((row) =>
    Array.from({ length: columns }, (_, index) => (row[index] ?? '').trim())
  );
};

const buildMarkdownTableString = (headers: string[], rows: string[][]) => {
  const rowColumnCounts = rows.map((row) => row.length);
  const maxRowColumns = rowColumnCounts.length ? Math.max(...rowColumnCounts) : 0;
  const totalColumns = Math.max(headers.length, maxRowColumns, 1);
  const effectiveHeaders = Array.from({ length: totalColumns }, (_, index) => {
    const value = headers[index] ?? `Column ${index + 1}`;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : `Column ${index + 1}`;
  });

  const normalisedRows = normaliseTableMatrix(rows, effectiveHeaders.length);

  const separator = effectiveHeaders.map(() => '---').join(' | ');
  const headerRow = `| ${effectiveHeaders.join(' | ')} |`;
  const separatorRow = `| ${separator} |`;
  const dataRows = normalisedRows.map((row) => `| ${row.map((cell) => (cell || '').trim()).join(' | ')} |`);

  return `${headerRow}\n${separatorRow}\n${dataRows.join('\n')}\n\n`;
};

const extractMarkdownTables = (markdown: string): MarkdownTable[] => {
  if (!markdown) return [];

  const tables: MarkdownTable[] = [];
  const regex = new RegExp(TABLE_BLOCK_REGEX);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const rawBlock = match[0];
    const start = match.index;
    const end = start + rawBlock.length;
    const trimmedBlock = rawBlock.trimEnd();
    const lines = trimmedBlock.split(/\r?\n/);
    if (lines.length < 2) continue;

    const headerCellsRaw = lines[0].split('|').slice(1, -1).map((cell) => cell.trim());
    const rowLines = lines.slice(2).filter((line) => line.trim().startsWith('|'));
    const rowCellCollections = rowLines.map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

    const maxRowColumns = rowCellCollections.length
      ? Math.max(...rowCellCollections.map((cells) => cells.length))
      : 0;
    const columnCount = Math.max(headerCellsRaw.length, maxRowColumns, 1);

    const headers = Array.from({ length: columnCount }, (_, index) => {
      const value = headerCellsRaw[index] ?? `Column ${index + 1}`;
      return value.trim();
    });
    const rows = rowCellCollections.map((cells) =>
      Array.from({ length: columnCount }, (_, index) => (cells[index] ?? '').trim())
    );

    tables.push({
      id: `table-${tables.length}`,
      start,
      end,
      headers,
      rows,
    });
  }

  return tables;
};

interface Note {
  id: string;
  title: string;
  content: string;
  preview?: string;
  tags?: string[];
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

interface TableMarkdownRendererProps {
  content: string;
  editableTables?: boolean;
  tables?: MarkdownTable[];
  onEditTable?: (table: MarkdownTable) => void;
}

// Custom component to render markdown with table styling and editing affordances
const TableMarkdownRenderer: React.FC<TableMarkdownRendererProps> = ({
  content,
  editableTables = false,
  tables = [],
  onEditTable,
}) => {
  const tableIndexRef = useRef(0);
  tableIndexRef.current = 0;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ ...props }) => <h1 className="text-3xl font-bold mt-4 mb-2" {...props} />,
        h2: ({ ...props }) => <h2 className="text-2xl font-bold mt-3 mb-2" {...props} />,
        h3: ({ ...props }) => <h3 className="text-xl font-bold mt-2 mb-1" {...props} />,
        p: ({ ...props }) => <p className="text-sm leading-relaxed mb-2" {...props} />,
        ul: ({ ...props }) => <ul className="list-disc list-inside space-y-1 mb-2" {...props} />,
        ol: ({ ...props }) => <ol className="list-decimal list-inside space-y-1 mb-2" {...props} />,
        li: ({ ...props }) => <li className="text-sm" {...props} />,
        code: ({ ...props }) => <code className="bg-muted px-2 py-1 rounded text-xs font-mono" {...props} />,
        pre: ({ children, ...props }) => {
          const child = React.Children.toArray(children)[0] as any;
          const codeContent = child?.props?.children || '';
          const language = child?.props?.className?.replace('language-', '') || '';

          if (language === 'sdf:molecule') {
            return (
              <div className="bg-muted p-3 rounded-lg mb-2 border">
                <div className="text-xs text-muted-foreground mb-2 font-mono">
                  SDF Molecule Structure
                </div>
                <div className="bg-white p-2 rounded text-xs font-mono overflow-x-auto max-h-32">
                  {codeContent.split('\n').slice(0, 5).join('\n')}...
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  💡 This SDF data can be inserted into the canvas for 3D visualization
                </div>
              </div>
            );
          }

          return (
            <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-2" {...props}>
              {children}
            </pre>
          );
        },
        blockquote: ({ ...props }) => (
          <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-2" {...props} />
        ),
        a: ({ ...props }) => <a className="text-primary hover:underline" {...props} />,
        table: ({ children, className, ...props }) => {
          const index = tableIndexRef.current++;
          const tableMeta = tables[index];
          const mergedClassName = [
            'w-full border-collapse text-sm',
            '[&_th]:bg-muted/60',
            '[&_th]:text-xs',
            '[&_th]:font-semibold',
            '[&_th]:uppercase',
            '[&_th]:tracking-wide',
            '[&_th]:text-muted-foreground',
            '[&_td]:text-sm',
            '[&_td]:align-top',
            '[&_td]:text-foreground',
            '[&_td]:border',
            '[&_th]:border',
            '[&_td]:border-border',
            '[&_th]:border-border',
            '[&_td]:px-3',
            '[&_td]:py-2',
            '[&_th]:px-3',
            '[&_th]:py-2',
            '[&_tr:nth-child(even)_td]:bg-muted/40',
            className ?? '',
          ]
            .join(' ')
            .trim();

          return (
            <div className="group relative mb-4 overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
              <div className="overflow-x-auto">
                <table className={mergedClassName} {...props}>
                  {children}
                </table>
              </div>
              {editableTables && tableMeta && (
                <button
                  type="button"
                  onClick={() => onEditTable?.(tableMeta)}
                  className="absolute right-3 top-3 inline-flex items-center rounded-md border border-border bg-background/80 px-2 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  Edit Table
                </button>
              )}
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default function StudyTools({ isOpen, onClose, sourceContent, sourceName, toolType, embedded = false }: StudyToolsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('notes');
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
  const [noteTitle, setNoteTitle] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [noteContent, setNoteContent] = useState(DEFAULT_NOTE_MARKDOWN);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Molecule search state
  const [showMoleculeSearch, setShowMoleculeSearch] = useState(false);

  // Table configuration state
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableData, setTableData] = useState<string[][]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [tableModalMode, setTableModalMode] = useState<'insert' | 'edit'>('insert');
  const [tableModalSelection, setTableModalSelection] = useState<{ start: number; end: number } | null>(null);

  // Slash command mappings
  const slashCommands: Record<string, string> = {
    '/heading': '# ',
    '/h1': '# ',
    '/h2': '## ',
    '/h3': '### ',
    '/h4': '#### ',
    '/bullet': '- ',
    '/list': '- ',
    '/todo': '- [ ] ',
    '/check': '- [x] ',
    '/code': '```\nCode here\n```',
    '/quote': '> ',
    '/hr': '---',
    '/divider': '---',
    '/table': '', // Special command - opens table configuration modal
    '/molecule': '', // Special command - opens molecule search
  };

  const handleMoleculeSelect = useCallback((moleculeData: any) => {
    setShowMoleculeSearch(false);

    // Insert molecule PNG image into notes
    const pngUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/CID/${moleculeData.cid}/PNG?image_size=300x300`;
    const moleculeBlock = `![${moleculeData.name}](${pngUrl})\n\n**${moleculeData.name}** (CID: ${moleculeData.cid})\n- Formula: ${moleculeData.molecularFormula}\n- Molecular Weight: ${moleculeData.molecularWeight}\n- SMILES: \`${moleculeData.smiles}\`\n\n`;

    setNoteContent(prev => prev + moleculeBlock);
  }, []);

  // Initialize table data when dimensions change
  useEffect(() => {
    setTableHeaders((prev) =>
      Array.from({ length: tableColumns }, (_, index) => prev[index] ?? `Column ${index + 1}`)
    );
    setTableData((prev) =>
      Array.from({ length: tableRows }, (_, rowIndex) =>
        Array.from({ length: tableColumns }, (_, colIndex) => prev[rowIndex]?.[colIndex] ?? '')
      )
    );
  }, [tableRows, tableColumns]);

  const updateTableCell = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...tableData];
    if (!newData[rowIndex]) newData[rowIndex] = [];
    newData[rowIndex][colIndex] = value;
    setTableData(newData);
  };

  const updateTableHeader = (colIndex: number, value: string) => {
    const newHeaders = [...tableHeaders];
    newHeaders[colIndex] = value;
    setTableHeaders(newHeaders);
  };

  const handleTableCreate = useCallback(() => {
    const effectiveColumns = Math.max(tableHeaders.length, tableColumns, 1);
    const normalisedHeaders = Array.from({ length: effectiveColumns }, (_, index) => tableHeaders[index] ?? `Column ${index + 1}`);
    const normalisedData = normaliseTableMatrix(tableData, effectiveColumns);
    const tableMarkdown = buildMarkdownTableString(normalisedHeaders, normalisedData);

    setShowTableModal(false);

    const applyReplacement = (before: string, after: string) => {
      const updatedContent = before + tableMarkdown + after;
      setNoteContent(updatedContent);

      setTimeout(() => {
        const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
        if (textarea) {
          const newCursorPos = before.length + tableMarkdown.length;
          textarea.selectionStart = newCursorPos;
          textarea.selectionEnd = newCursorPos;
          textarea.focus();
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 100);
    };

    if (tableModalMode === 'edit' && tableModalSelection) {
      const { start, end } = tableModalSelection;
      const before = noteContent.slice(0, start);
      const after = noteContent.slice(end);
      applyReplacement(before, after);
    } else {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        const before = noteContent.substring(0, cursorPos);
        const after = noteContent.substring(cursorPos);
        applyReplacement(before, after);
      } else {
        // Fallback: append to the end if editor is not focused
        setNoteContent((current) => current + tableMarkdown);
      }
    }

    setTableModalMode('insert');
    setTableModalSelection(null);
    setTableRows(3);
    setTableColumns(3);
    setTableData([]);
    setTableHeaders([]);
  }, [noteContent, tableColumns, tableData, tableHeaders, tableModalMode, tableModalSelection]);

  const downloadAsDoc = useCallback(() => {
    // Convert markdown to simple HTML
    let htmlContent = noteContent
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/!\[([^\]]*)\]\(([^)]*)\)/gim, '<img src="$2" alt="$1" style="max-width: 100%;">')
      .replace(/\[([^\]]*)\]\(([^)]*)\)/gim, '<a href="$2">$1</a>')
      .replace(/`([^`]*)`/gim, '<code>$1</code>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');

    // Convert markdown tables to HTML tables
    const tableRegex = /(\|.*\|\n\|.*\|\n)((?:\|.*\|\n)*)/g;
    htmlContent = htmlContent.replace(tableRegex, (match) => {
      const lines = match.trim().split('\n');
      if (lines.length < 2) return match;

      let html = '<table border="1" style="border-collapse: collapse; width: 100%;">';
      lines.forEach((line, index) => {
        if (index === 1) return; // Skip separator line
        const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
        const tag = index === 0 ? 'th' : 'td';
        html += '<tr>';
        cells.forEach(cell => {
          html += `<${tag} style="padding: 8px; text-align: left;">${cell}</${tag}>`;
        });
        html += '</tr>';
      });
      html += '</table>';
      return html;
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Notes Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1, h2, h3 { color: #333; margin-top: 20px; }
          p { line-height: 1.6; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <p>${htmlContent}</p>
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes.doc';
    a.click();
    URL.revokeObjectURL(url);
  }, [noteContent]);

  const downloadAsPdf = useCallback(() => {
    // For PDF, we'll create a simple text-based PDF using a data URL
    const textContent = noteContent
      .replace(/!\[([^\]]*)\]\(([^)]*)\)/gim, '[Image: $1]')
      .replace(/\[([^\]]*)\]\(([^)]*)\)/gim, '$1')
      .replace(/`([^`]*)`/gim, '$1');

    // Simple PDF creation using a minimal PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length ${textContent.length + 100}
>>
stream
BT
/F1 12 Tf
72 720 Td
${textContent.split('\n').map(line => `(${line}) Tj\n0 -14 Td`).join('')}
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000274 00000 n
0000001000 00000 n
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
1100
%%EOF`;

    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }, [noteContent]);

  const selectAutocompleteCommand = (commandKey: string, textarea: HTMLTextAreaElement) => {
    setShowAutocomplete(false);

    // Handle special commands
    if (commandKey === '/molecule') {
      setShowMoleculeSearch(true);
      return;
    }

    if (commandKey === '/table') {
      setTableModalMode('insert');
      setTableModalSelection(null);
      setTableRows(3);
      setTableColumns(3);
      setTableHeaders([]);
      setTableData([]);
      setShowTableModal(true);
      return;
    }

    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Get text before cursor
    const textBeforeCursor = text.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];

    // Replace the "/" with the selected command
    if (currentLine === '/') {
      const replacement = slashCommands[commandKey];
      const newLines = [...lines];
      newLines[currentLineIndex] = replacement;
      const newContent = newLines.join('\n') + text.substring(cursorPos);

      setNoteContent(newContent);

      // Set cursor position after replacement
      setTimeout(() => {
        // Calculate new cursor position: account for replacement length
        // The replacement replaces the "/" character, so we add the full replacement length
        const newCursorPos = textBeforeCursor.length - 1 + replacement.length;
        textarea.selectionStart = newCursorPos;
        textarea.selectionEnd = newCursorPos;
        textarea.focus();
      }, 0);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle autocomplete navigation
    if (showAutocomplete) {
      const commandKeys = Object.keys(slashCommands);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedCommandIndex((prev) =>
            prev < commandKeys.length - 1 ? prev + 1 : prev
          );
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedCommandIndex((prev) => prev > 0 ? prev - 1 : prev);
          return;
        case 'Enter':
          e.preventDefault();
          const commandKeysArray = Object.keys(slashCommands);
          const selectedCommand = commandKeysArray[selectedCommandIndex];
          selectAutocompleteCommand(selectedCommand, e.currentTarget);
          return;
        case 'Escape':
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        case 'Tab':
          e.preventDefault();
          const tabCommandKeys = Object.keys(slashCommands);
          const tabSelectedCommand = tabCommandKeys[selectedCommandIndex];
          selectAutocompleteCommand(tabSelectedCommand, e.currentTarget);
          return;
      }
    }

    // Handle slash commands on space or enter (legacy support)
    if (e.key === ' ' || e.key === 'Enter') {
      const textarea = e.currentTarget;
      const text = textarea.value;
      const cursorPos = textarea.selectionStart;

      // Get the current line
      const textBeforeCursor = text.substring(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      // Check if current line starts with a slash command
      const slashMatch = currentLine.match(/^\/(\w+)$/);

      if (slashMatch) {
        const commandKey = `/${slashMatch[1]}`;

        if (slashCommands[commandKey]) {
          e.preventDefault();

          // Remove the slash command from the text
          const beforeCommand = textBeforeCursor.substring(0, textBeforeCursor.length - commandKey.length);
          const afterCursor = text.substring(cursorPos);

          // Add the replacement
          const replacement = slashCommands[commandKey];
          const newContent = beforeCommand + replacement + (e.key === 'Enter' ? '\n' : ' ') + afterCursor;

          setNoteContent(newContent);

          // Set cursor position after replacement
          setTimeout(() => {
            textarea.selectionStart = beforeCommand.length + replacement.length + (e.key === 'Enter' ? 1 : 1);
            textarea.selectionEnd = textarea.selectionStart;
            textarea.focus();
          }, 0);
        }
      }
    }
  };

  const handleNoteContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const textarea = e.target;

    // Check for autocomplete trigger (just "/")
    const lines = newValue.split('\n');
    const lastLine = lines[lines.length - 1];

    if (lastLine === '/' && !showAutocomplete) {
      // Show autocomplete dropdown
      const rect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
      const linesBefore = newValue.substring(0, textarea.selectionStart).split('\n').length - 1;

      setAutocompletePosition({
        top: rect.top + (linesBefore * lineHeight) + lineHeight,
        left: rect.left + 16 // padding
      });
      setShowAutocomplete(true);
      setSelectedCommandIndex(0);
      setNoteContent(newValue);
      return;
    } else if (lastLine !== '/' && showAutocomplete) {
      // Hide autocomplete if user types something else
      setShowAutocomplete(false);
    }

    // Check for slash commands in the last line
    const slashCommandPattern = /^\/(\w+)\s/;
    const slashMatch = lastLine.match(slashCommandPattern);

    if (slashMatch) {
      const commandKey = `/${slashMatch[1]}`;

      if (slashCommands[commandKey]) {
        // Hide autocomplete and replace the slash command
        setShowAutocomplete(false);

        // Replace the slash command
        const replacement = slashCommands[commandKey];
        const newLastLine = lastLine.replace(/^\/(\w+)\s/, replacement);

        // Reconstruct the full content
        lines[lines.length - 1] = newLastLine;
        const finalContent = lines.join('\n');

        setNoteContent(finalContent);

        // Set cursor position after replacement
        setTimeout(() => {
          const newCursorPos = finalContent.length - (newValue.length - textarea.selectionStart) + (replacement.length - commandKey.length - 1);
          textarea.selectionStart = newCursorPos;
          textarea.selectionEnd = newCursorPos;
          textarea.focus();
        }, 0);

        return;
      }
    }

    setNoteContent(newValue);
  };

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
  const tablesInNote = useMemo(() => extractMarkdownTables(noteContent), [noteContent]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('notes');
    setIsGenerating(false);
    setStudyContent(null);
    setError(null);
    setNoteContent(DEFAULT_NOTE_MARKDOWN);
    setSelectedNote(null);
    setIsEditing(false);
    setNoteTitle('');
    setNoteTags([]);
    setNewTag('');
  }, [toolType, isOpen, sourceName, sanitizedSource]);

  useEffect(() => {
    if (selectedNote) {
      setNoteTitle(selectedNote.title);
      setNoteTags(selectedNote.tags ?? []);
      setNoteContent(selectedNote.content || DEFAULT_NOTE_MARKDOWN);
    } else {
      setNoteTitle('');
      setNoteTags([]);
      setNoteContent(DEFAULT_NOTE_MARKDOWN);
    }
  }, [selectedNote]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAutocomplete) {
        const target = event.target as HTMLElement;
        if (!target.closest('.autocomplete-dropdown') && !target.closest('textarea')) {
          setShowAutocomplete(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAutocomplete]);

  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    setNoteTags((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
    setNewTag('');
  }, [newTag]);

  const handleRemoveTag = useCallback((tag: string) => {
    setNoteTags((current) => current.filter((item) => item !== tag));
  }, []);

  const openTableEditorFromPreview = useCallback(
    (table: MarkdownTable) => {
      const columns = Math.max(table.headers.length, 1);
      const normalisedRows = normaliseTableMatrix(table.rows, columns);

      setTableModalMode('edit');
      setTableModalSelection({ start: table.start, end: table.end });
      setTableHeaders(Array.from({ length: columns }, (_, index) => table.headers[index] ?? `Column ${index + 1}`));
      setTableData(normalisedRows);
      setTableColumns(columns);
      setTableRows(normalisedRows.length);
      setShowTableModal(true);
    },
    [setShowTableModal, setTableColumns, setTableData, setTableHeaders, setTableModalMode, setTableModalSelection, setTableRows]
  );

  const applyTemplate = useCallback(
    (markdown: string) => {
      setNoteContent(markdown);
      setIsEditing(true);
    },
    []
  );

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
      <TableMarkdownRenderer content={text} />
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

  const handleRemoveUploadedDocument = (documentId: string) => {
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
  };

  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'Notion-Style Note',
      content: DEFAULT_NOTE_MARKDOWN,
      preview: createPreviewFromMarkdown(DEFAULT_NOTE_MARKDOWN),
      tags: [],
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    
    setNotes(prev => [...prev, newNote]);
    setSelectedNote(newNote);
    setNoteTitle('Notion-Style Note');
    setNoteTags([]);
    setNewTag('');
    setIsEditing(true);
  };

  const saveNote = () => {
    if (!selectedNote) return;

    const sanitizedTitle = noteTitle.trim() || 'Untitled note';
    const markdown = noteContent;

    const updatedNote: Note = {
      ...selectedNote,
      title: sanitizedTitle,
      content: markdown,
      preview: createPreviewFromMarkdown(markdown),
      tags: noteTags,
      modifiedAt: new Date()
    };

    setNotes(prev => prev.map(note => note.id === selectedNote.id ? updatedNote : note));
    setSelectedNote(updatedNote);
    setIsEditing(false);
  };

  const deleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);

    if (selectedNote?.id === noteId) {
      const nextNote = updatedNotes[0] ?? null;
      setSelectedNote(nextNote);
      setIsEditing(false);
      setNoteTags(nextNote?.tags ?? []);
      setNoteTitle(nextNote?.title ?? '');
      setNewTag('');
    }
  };

  function getToolDisplayName(type: string) {
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
  }

  function getToolIcon(type: string) {
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
  }

  const headerConfig = useMemo(() => {
    const baseIconClass = 'flex h-10 w-10 items-center justify-center rounded-lg';
    if (activeTab === 'documents') {
      const totalDocuments = uploadedDocuments.length;
      return {
        icon: FileText,
        iconClass: `${baseIconClass} bg-blue-500/10 text-blue-400`,
        title: 'Document Library',
        subtitle: totalDocuments ? 'Upload and organize study materials' : 'Add your first document to unlock analysis',
        badge: totalDocuments ? `${totalDocuments} ${totalDocuments === 1 ? 'file' : 'files'}` : 'No uploads'
      };
    }
    if (activeTab === 'notes') {
      return {
        icon: Edit3,
        iconClass: `${baseIconClass} bg-amber-500/10 text-amber-500`,
        title: 'Notes Workspace',
        subtitle: selectedNote ? `Editing: ${selectedNote.title}` : 'Create, tag, and organize your study notes',
        badge: notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : 'Fresh page'
      };
    }
    if (activeTab === 'designer') {
      return {
        icon: Palette,
        iconClass: `${baseIconClass} bg-purple-500/10 text-purple-400`,
        title: 'Document Designer',
        subtitle: 'Craft polished study guides with drag-and-drop blocks',
        badge: 'Layout mode'
      };
    }
    if (activeTab === 'chat') {
      return {
        icon: MessageSquare,
        iconClass: `${baseIconClass} bg-green-500/10 text-green-500`,
        title: 'Chat Assistant',
        subtitle: 'Ask follow-ups powered by your study materials',
        badge: 'Live help'
      };
    }
    if (activeTab === 'tests') {
      return {
        icon: BookOpen,
        iconClass: `${baseIconClass} bg-pink-500/10 text-pink-500`,
        title: 'AI Test Center',
        subtitle: 'Generate quizzes, exams, and quick checks',
        badge: 'Assessments'
      };
    }

    const detailParts: string[] = [];
    if (sanitizedTopic) {
      detailParts.push(`Focus: ${sanitizedTopic}`);
    }
    if (hasSourceContent) {
      detailParts.push(`Source: ${displaySourceName}`);
    }
    const subtitle = detailParts.join(' • ') || 'Build personalized study aids with Gemini';

    return {
      icon: getToolIcon(toolType),
      iconClass: `${baseIconClass} bg-primary/10 text-primary`,
      title: getToolDisplayName(toolType),
      subtitle,
      badge: 'Study suite'
    };
  }, [activeTab, displaySourceName, hasSourceContent, notes.length, sanitizedTopic, selectedNote, toolType, uploadedDocuments.length]);

  const ToolIcon = getToolIcon(toolType);

  if (!isOpen) return null;

  const HeaderIcon = headerConfig.icon;

  const content = (
    <div className="w-full">
      <div
        className={`${
          embedded
            ? 'w-full h-full flex flex-col'
            : 'bg-card border border-border rounded-lg shadow-lg w-[min(1100px,95vw)] max-h-[92vh] flex flex-col overflow-hidden animate-slide-up'
        }`}
      >

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={headerConfig.iconClass}>
              <HeaderIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{headerConfig.title}</h2>
              {headerConfig.subtitle && (
                <p className="text-sm text-muted-foreground">{headerConfig.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {headerConfig.badge && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {headerConfig.badge}
              </span>
            )}
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6">
            {PRIMARY_TABS.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  data-tool={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                onClick={() => setActiveTab('chat')}
                className="inline-flex items-center gap-2 whitespace-nowrap py-2 px-3 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Chat Assistant
              </button>
              
              <button
                data-tool="tests"
                onClick={() => setActiveTab('tests')}
                className="inline-flex items-center gap-2 whitespace-nowrap py-2 px-3 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                AI Test Center
              </button>
            </div>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Notes Sidebar */}
              <div className="w-64 border-r border-border bg-muted/20 flex flex-col">
                <div className="p-4 border-b border-border">
                  <button
                    onClick={createNewNote}
                    className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Note
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
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
                            setIsEditing(false);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            selectedNote?.id === note.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <h4 className="font-medium text-sm truncate">{note.title}</h4>
                          <p className="text-xs opacity-70 truncate">{note.preview || 'No preview available.'}</p>
                          {note.tags && note.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {note.tags.map((tag) => (
                                <span
                                  key={`${note.id}-${tag}`}
                                  className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground/80"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Note Editor - Full Screen Split Pane */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {selectedNote ? (
                  <>
                    {/* Header */}
                    <div className="flex flex-col gap-4 border-b border-border px-6 py-4 md:flex-row md:items-center md:justify-between bg-muted/30">
                      <div className="flex-1 space-y-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Give your note a descriptive title"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        ) : (
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-foreground">{selectedNote.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              Last updated {selectedNote.modifiedAt.toLocaleString()}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {noteTags.map((tag) => (
                            <span
                              key={`${selectedNote.id}-${tag}`}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-primary"
                            >
                              #{tag}
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTag(tag)}
                                  className="rounded-full bg-transparent p-0.5 text-primary transition hover:bg-primary/20"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                          {isEditing && (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newTag}
                                onChange={(event) => setNewTag(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleAddTag();
                                  }
                                }}
                                placeholder="Add tag"
                                className="h-8 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              />
                              <button
                                type="button"
                                onClick={handleAddTag}
                                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/20"
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start md:self-auto">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                void saveNote();
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90"
                              title="Save note"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditing(false)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-muted"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsEditing(true)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-muted"
                              title="Edit note"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(selectedNote.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive text-destructive transition hover:bg-destructive/10"
                              title="Delete note"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div className="border-b border-border bg-muted/40 px-6 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {NOTE_TEMPLATES.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => void applyTemplate(template.markdown)}
                              className="group flex flex-col rounded-md border border-border bg-background px-3 py-2 text-left text-xs transition hover:border-primary/60 hover:bg-primary/5"
                            >
                              <span className="font-medium text-foreground">{template.label}</span>
                              <span className="text-[11px] text-muted-foreground group-hover:text-primary/80">
                                {template.description}
                              </span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => void applyTemplate(DEFAULT_NOTE_MARKDOWN)}
                            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
                          >
                            Reset Layout
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Split Pane: Editor + Preview */}
                    <div className="flex-1 min-h-0 flex overflow-hidden">
                      {/* Left: Editor */}
                      <div className="flex-1 min-h-0 flex flex-col border-r border-border px-6 py-4">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                          Markdown Editor
                        </div>
                        <textarea
                          className="flex-1 w-full p-4 text-sm bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                          value={noteContent}
                          onChange={handleNoteContentChange}
                          onKeyDown={handleNoteKeyDown}
                          placeholder="Write your markdown note here...&#10;&#10;# Heading&#10;**Bold** *Italic* `code`&#10;- List item&#10;> Quote"
                          spellCheck="true"
                        />

                        {/* Autocomplete Dropdown */}
                        {showAutocomplete && (
                          <div
                            className="autocomplete-dropdown absolute z-50 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                            style={{
                              top: autocompletePosition.top,
                              left: autocompletePosition.left,
                              width: '250px'
                            }}
                          >
                            {Object.entries(slashCommands).map(([command, replacement], index) => (
                              <button
                                key={command}
                                onClick={() => {
                                  const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                                  if (textarea) {
                                    selectAutocompleteCommand(command, textarea);
                                  }
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                                  index === selectedCommandIndex ? 'bg-primary/10 text-primary' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-primary">{command}</span>
                                  <span className="text-muted-foreground truncate">
                                    {replacement.replace(/\n/g, ' ')}
                                  </span>
                                </div>
                                {index === selectedCommandIndex && (
                                  <div className="w-2 h-2 bg-primary rounded-full" />
                                )}
                              </button>
                            ))}
                            <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/50">
                              Use ↑↓ to navigate, Enter/Tab to select, Esc to cancel
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Preview */}
                      <div className="flex-1 min-h-0 flex flex-col px-6 py-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Preview
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={downloadAsDoc}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                              title="Download as Word Document"
                            >
                              <FileText className="h-3 w-3" />
                              .doc
                            </button>
                            <button
                              onClick={downloadAsPdf}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                              title="Download as PDF"
                            >
                              <Download className="h-3 w-3" />
                              .pdf
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 prose prose-invert max-w-none overflow-y-auto">
                          <TableMarkdownRenderer
                            content={noteContent || '_Start typing to see preview..._'}
                            editableTables={isEditing}
                            tables={tablesInNote}
                            onEditTable={openTableEditorFromPreview}
                          />
                        </div>
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="px-6 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
                        💡 Tip: Click Edit to write your note. Use Markdown formatting for rich text styling.
                      </div>
                    )}
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

          {/* Chat Assistant Modal */}
          <div>
            <ChatAssistant 
              isOpen={activeTab === 'chat'} 
              onClose={() => setActiveTab('notes')} 
            />
            
            {/* Test Section Modal */}
            <TestSection
              isOpen={activeTab === 'tests'}
              onClose={() => setActiveTab('notes')}
            />

            {/* Molecule Search Modal */}
            <MoleculeSearch
              isOpen={showMoleculeSearch}
              onClose={() => setShowMoleculeSearch(false)}
              onSelectMolecule={handleMoleculeSelect}
            />
          </div>

          {/* Table Configuration Modal */}
          {showTableModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-lg font-semibold">{tableModalMode === 'edit' ? 'Edit Table' : 'Create Table'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tableModalMode === 'edit'
                      ? 'Adjust the size and contents, then we will update your existing table.'
                      : 'Specify the dimensions, fill in the cells, and we will insert it into your note.'}
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Columns</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={tableColumns}
                        onChange={(e) => setTableColumns(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Rows</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={tableRows}
                        onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-4">
                    {tableModalMode === 'edit'
                      ? `Updating to ${tableColumns} ${tableColumns === 1 ? 'column' : 'columns'} and ${tableRows} ${tableRows === 1 ? 'row' : 'rows'}.`
                      : `This will create a table with ${tableColumns} ${tableColumns === 1 ? 'column' : 'columns'} and ${tableRows} ${tableRows === 1 ? 'row' : 'rows'}.`}
                  </div>


                  {/* Editable Table */}
                  <div className="border border-border rounded-lg p-4 bg-muted/30 max-h-96 overflow-y-auto">
                    <div className="text-xs font-medium text-muted-foreground mb-3">Fill in your table data:</div>
                    <div className="overflow-x-auto">
                      <table className="border-collapse border-2 border-gray-400 w-full bg-white shadow-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            {Array.from({ length: tableColumns }, (_, i) => (
                              <th key={i} className="border border-gray-300 px-2 py-2 text-left font-bold text-xs bg-gray-50">
                                <input
                                  type="text"
                                  value={tableHeaders[i] || ''}
                                  onChange={(e) => updateTableHeader(i, e.target.value)}
                                  placeholder={`Column ${i + 1}`}
                                  className="w-full px-2 py-1 text-xs border border-gray-200 bg-white hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded transition-colors"
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: tableRows }, (_, rowIndex) => (
                            <tr key={rowIndex}>
                              {Array.from({ length: tableColumns }, (_, colIndex) => (
                                <td key={colIndex} className="border border-gray-300 px-2 py-1">
                                  <input
                                    type="text"
                                    value={tableData[rowIndex]?.[colIndex] || ''}
                                    onChange={(e) => updateTableCell(rowIndex, colIndex, e.target.value)}
                                    placeholder={`Cell ${rowIndex + 1},${colIndex + 1}`}
                                    className="w-full px-2 py-1 text-xs border border-gray-200 bg-white hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded transition-colors"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Click any cell to edit • Data will be saved in your table
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowTableModal(false);
                      setTableRows(3);
                      setTableColumns(3);
                      setTableData([]);
                      setTableHeaders([]);
                      setTableModalMode('insert');
                      setTableModalSelection(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTableCreate}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    {tableModalMode === 'edit' ? 'Update Table' : 'Create Table'}
                  </button>
                </div>
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
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="flex min-h-full w-full items-start justify-center p-4">
        {content}
      </div>
    </div>
  );
}
