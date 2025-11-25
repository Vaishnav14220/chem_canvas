/**
 * Research Paper Generator Workspace
 * 
 * A comprehensive workspace for generating research papers using AI agents.
 * Features:
 * - Multi-file upload (literature, data, reports, notes)
 * - Specialized sub-agents for each paper section
 * - Real-time progress tracking
 * - LaTeX output with PDF preview
 * - Interactive editing of generated sections
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft,
  Upload,
  FileText,
  File,
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Settings,
  Users,
  BookOpen,
  FileCode,
  Download,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Eye,
  Edit,
  RefreshCw,
  Sparkles,
  Brain,
  FlaskConical,
  BarChart3,
  MessageSquare,
  ListChecks,
  GraduationCap,
  Lightbulb,
  PenTool,
  Image
} from 'lucide-react';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

import {
  uploadFile,
  addTextContent,
  removeFile,
  initializePaperConfig,
  generateFullPaper,
  compileToLatex,
  compilePaper,
  getResearchPaperState,
  resetResearchPaper,
  subscribeToResearchPaperEvents,
  SUB_AGENTS,
  type UploadedFile,
  type ResearchPaperConfig,
  type PaperSection,
  type AgentProgress,
  type ResearchPaperEvent
} from '../services/researchPaperAgentService';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ResearchPaperWorkspaceProps {
  onBack?: () => void;
}

// Agent icons mapping
const AGENT_ICONS: Record<string, React.ReactNode> = {
  'Literature Review Agent': <BookOpen className="w-4 h-4" />,
  'Introduction Agent': <Lightbulb className="w-4 h-4" />,
  'Methodology Agent': <FlaskConical className="w-4 h-4" />,
  'Results Agent': <BarChart3 className="w-4 h-4" />,
  'Discussion Agent': <MessageSquare className="w-4 h-4" />,
  'Conclusion Agent': <ListChecks className="w-4 h-4" />,
  'Abstract Agent': <PenTool className="w-4 h-4" />,
  'References Agent': <FileText className="w-4 h-4" />
};

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  literature: <BookOpen className="w-4 h-4 text-blue-400" />,
  data: <BarChart3 className="w-4 h-4 text-green-400" />,
  report: <FileText className="w-4 h-4 text-orange-400" />,
  notes: <Edit className="w-4 h-4 text-purple-400" />,
  other: <File className="w-4 h-4 text-gray-400" />
};

const ResearchPaperWorkspace: React.FC<ResearchPaperWorkspaceProps> = ({ onBack }) => {
  // State
  const [currentStep, setCurrentStep] = useState<'upload' | 'configure' | 'generate' | 'review'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>([]);
  const [latexDocument, setLatexDocument] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // PDF viewer state
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);
  
  // Store stable PDF URL reference
  const pdfUrlRef = useRef<string | null>(null);
  
  // Config state
  const [config, setConfig] = useState<ResearchPaperConfig>({
    title: '',
    authors: [''],
    affiliation: '',
    abstract: '',
    paperType: 'research',
    targetLength: 'medium',
    citationStyle: 'apa',
    includeAppendix: false
  });
  
  // Dialog state
  const [showAddTextDialog, setShowAddTextDialog] = useState(false);
  const [textContentName, setTextContentName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textContentType, setTextContentType] = useState<UploadedFile['type']>('notes');
  
  // Active tab in generate step
  const [activeTab, setActiveTab] = useState<'progress' | 'sections' | 'latex' | 'preview' | 'images'>('progress');
  
  // Collected extracted images from all uploaded files
  const extractedImages = useMemo(() => {
    const images: Array<{ filename: string; base64: string; caption: string; source: string }> = [];
    uploadedFiles.forEach(file => {
      if (file.extractedImages && file.extractedImages.length > 0) {
        file.extractedImages.forEach((img, idx) => {
          images.push({
            filename: img.filename || `image_${idx + 1}.png`,
            base64: img.base64 || '',
            caption: img.caption || `Image ${idx + 1} from ${file.name}`,
            source: file.name
          });
        });
      }
    });
    return images;
  }, [uploadedFiles]);
  
  // Memoize pdfUrl for react-pdf - only update when URL actually changes
  const pdfFile = useMemo(() => {
    if (pdfUrl && pdfUrl !== pdfUrlRef.current) {
      // Clean up old URL before setting new one
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      pdfUrlRef.current = pdfUrl;
    }
    return pdfUrlRef.current;
  }, [pdfUrl]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = subscribeToResearchPaperEvents((event: ResearchPaperEvent) => {
      setLogs(prev => [...prev, event.message]);
      
      const state = getResearchPaperState();
      setUploadedFiles([...state.uploadedFiles]);
      setSections([...state.sections]);
      setAgentProgress([...state.agentProgress]);
      setErrors([...state.errors]);
      
      if (state.latexDocument) {
        setLatexDocument(state.latexDocument);
      }
      if (state.compiledPdfUrl) {
        setPdfUrl(state.compiledPdfUrl);
      }
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, []);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: UploadedFile['type']) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      try {
        await uploadFile(file, type);
        const state = getResearchPaperState();
        setUploadedFiles([...state.uploadedFiles]);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
    
    // Reset input
    e.target.value = '';
  };

  // Add text content handler
  const handleAddTextContent = () => {
    if (!textContentName.trim() || !textContent.trim()) return;
    
    addTextContent(textContentName, textContent, textContentType);
    const state = getResearchPaperState();
    setUploadedFiles([...state.uploadedFiles]);
    
    setShowAddTextDialog(false);
    setTextContentName('');
    setTextContent('');
  };

  // Remove file handler
  const handleRemoveFile = (fileId: string) => {
    removeFile(fileId);
    const state = getResearchPaperState();
    setUploadedFiles([...state.uploadedFiles]);
  };

  // Start generation
  const handleGenerate = async () => {
    if (!config.title.trim()) {
      alert('Please enter a paper title');
      return;
    }
    
    setIsGenerating(true);
    setCurrentStep('generate');
    setActiveTab('progress');
    setProgress(0);
    setLogs([]);
    setErrors([]);
    
    try {
      const result = await generateFullPaper(config, (p, msg) => {
        setProgress(p);
        setProgressMessage(msg);
      });
      
      setLatexDocument(result.latexDocument);
      if (result.pdfUrl) {
        setPdfUrl(result.pdfUrl);
      }
      
      setCurrentStep('review');
      setActiveTab('preview');
    } catch (error) {
      console.error('Generation error:', error);
      setErrors(prev => [...prev, error instanceof Error ? error.message : 'Unknown error']);
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate a section
  const handleRegenerateSection = async (sectionId: string) => {
    // TODO: Implement section regeneration
    alert('Section regeneration coming soon!');
  };

  // Edit section
  const handleEditSection = (section: PaperSection) => {
    setEditingSection(section.id);
    setEditContent(section.content);
  };

  // Save edited section
  const handleSaveSection = () => {
    if (!editingSection) return;
    
    setSections(prev => prev.map(s => 
      s.id === editingSection 
        ? { ...s, content: editContent, latexContent: editContent }
        : s
    ));
    
    setEditingSection(null);
    setEditContent('');
  };

  // Recompile LaTeX
  const handleRecompile = async () => {
    setIsGenerating(true);
    try {
      const latex = compileToLatex();
      setLatexDocument(latex);
      
      const result = await compilePaper();
      if (result.pdfUrl) {
        setPdfUrl(result.pdfUrl);
      }
    } catch (error) {
      console.error('Recompilation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy LaTeX to clipboard
  const handleCopyLatex = async () => {
    await navigator.clipboard.writeText(latexDocument);
    alert('LaTeX copied to clipboard!');
  };

  // Download LaTeX
  const handleDownloadLatex = () => {
    const blob = new Blob([latexDocument], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.title.replace(/\s+/g, '_')}.tex`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download PDF
  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = `${config.title.replace(/\s+/g, '_')}.pdf`;
      a.click();
    }
  };

  // Reset and start over
  const handleReset = () => {
    if (confirm('Are you sure you want to start over? All progress will be lost.')) {
      resetResearchPaper();
      setCurrentStep('upload');
      setUploadedFiles([]);
      setSections([]);
      setAgentProgress([]);
      setLatexDocument('');
      setPdfUrl(null);
      setLogs([]);
      setErrors([]);
      setProgress(0);
      setConfig({
        title: '',
        authors: [''],
        affiliation: '',
        abstract: '',
        paperType: 'research',
        targetLength: 'medium',
        citationStyle: 'apa',
        includeAppendix: false
      });
    }
  };

  // Render upload step
  const renderUploadStep = () => (
    <div className="space-y-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            Upload Source Materials
          </CardTitle>
          <CardDescription>
            Upload literature, data files, reports, or notes that will inform your research paper.
            The AI agents will analyze these materials to generate comprehensive content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Literature Upload */}
            <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-blue-500 transition-colors">
              <label className="flex flex-col items-center cursor-pointer">
                <BookOpen className="w-8 h-8 text-blue-400 mb-2" />
                <span className="font-medium text-blue-400">Literature</span>
                <span className="text-xs text-gray-500 text-center mt-1">
                  Research papers, articles, reviews
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.tex"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'literature')}
                />
              </label>
            </div>

            {/* Data Upload */}
            <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-green-500 transition-colors">
              <label className="flex flex-col items-center cursor-pointer">
                <BarChart3 className="w-8 h-8 text-green-400 mb-2" />
                <span className="font-medium text-green-400">Data</span>
                <span className="text-xs text-gray-500 text-center mt-1">
                  CSV, JSON, experimental results
                </span>
                <input
                  type="file"
                  multiple
                  accept=".csv,.json,.txt,.xlsx"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'data')}
                />
              </label>
            </div>

            {/* Report Upload */}
            <div className="p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-orange-500 transition-colors">
              <label className="flex flex-col items-center cursor-pointer">
                <FileText className="w-8 h-8 text-orange-400 mb-2" />
                <span className="font-medium text-orange-400">Reports</span>
                <span className="text-xs text-gray-500 text-center mt-1">
                  Lab reports, summaries, drafts
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'report')}
                />
              </label>
            </div>

            {/* Add Text Content */}
            <div 
              className="p-4 border-2 border-dashed border-gray-600 rounded-lg hover:border-purple-500 transition-colors cursor-pointer"
              onClick={() => setShowAddTextDialog(true)}
            >
              <div className="flex flex-col items-center">
                <Edit className="w-8 h-8 text-purple-400 mb-2" />
                <span className="font-medium text-purple-400">Add Notes</span>
                <span className="text-xs text-gray-500 text-center mt-1">
                  Paste text content directly
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Files ({uploadedFiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadedFiles.map(file => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {FILE_TYPE_ICONS[file.type]}
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {file.type} • {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep('configure')}
          disabled={uploadedFiles.length === 0}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Continue to Configuration
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // Render configure step
  const renderConfigureStep = () => (
    <div className="space-y-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Paper Configuration
          </CardTitle>
          <CardDescription>
            Configure your research paper settings. The AI agents will use this information
            to generate appropriate content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Paper Title *</label>
            <Input
              value={config.title}
              onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter your research paper title"
              className="bg-gray-700 border-gray-600"
            />
          </div>

          {/* Authors */}
          <div>
            <label className="text-sm font-medium mb-1 block">Authors</label>
            <Input
              value={config.authors.join(', ')}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                authors: e.target.value.split(',').map(a => a.trim()) 
              }))}
              placeholder="Author 1, Author 2, Author 3"
              className="bg-gray-700 border-gray-600"
            />
          </div>

          {/* Affiliation */}
          <div>
            <label className="text-sm font-medium mb-1 block">Affiliation</label>
            <Input
              value={config.affiliation}
              onChange={(e) => setConfig(prev => ({ ...prev, affiliation: e.target.value }))}
              placeholder="University or Institution"
              className="bg-gray-700 border-gray-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Paper Type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Paper Type</label>
              <select
                value={config.paperType}
                onChange={(e) => setConfig(prev => ({ ...prev, paperType: e.target.value as any }))}
                className="w-full rounded-md bg-gray-700 border border-gray-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="research">Research Paper</option>
                <option value="review">Literature Review</option>
                <option value="case-study">Case Study</option>
                <option value="thesis">Thesis/Dissertation</option>
              </select>
            </div>

            {/* Target Length */}
            <div>
              <label className="text-sm font-medium mb-1 block">Target Length</label>
              <select
                value={config.targetLength}
                onChange={(e) => setConfig(prev => ({ ...prev, targetLength: e.target.value as any }))}
                className="w-full rounded-md bg-gray-700 border border-gray-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="short">Short (~3,000 words)</option>
                <option value="medium">Medium (~8,000 words)</option>
                <option value="long">Long (~15,000 words)</option>
                <option value="thesis">Thesis (~30,000+ words)</option>
              </select>
            </div>

            {/* Citation Style */}
            <div>
              <label className="text-sm font-medium mb-1 block">Citation Style</label>
              <select
                value={config.citationStyle}
                onChange={(e) => setConfig(prev => ({ ...prev, citationStyle: e.target.value as any }))}
                className="w-full rounded-md bg-gray-700 border border-gray-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="apa">APA</option>
                <option value="ieee">IEEE</option>
                <option value="chicago">Chicago</option>
                <option value="mla">MLA</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Overview */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            AI Agents
          </CardTitle>
          <CardDescription>
            These specialized agents will collaborate to write your paper.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUB_AGENTS.map(agent => (
              <div 
                key={agent.name}
                className="p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-2 mb-1">
                  {AGENT_ICONS[agent.name]}
                  <span className="text-sm font-medium">{agent.name.replace(' Agent', '')}</span>
                </div>
                <p className="text-xs text-gray-500">{agent.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('upload')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={!config.title.trim() || isGenerating}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Paper
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render generate/review step
  const renderGenerateStep = () => (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 bg-gray-800">
          <TabsTrigger value="progress">
            <Brain className="w-4 h-4 mr-2" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="sections">
            <FileText className="w-4 h-4 mr-2" />
            Sections
          </TabsTrigger>
          <TabsTrigger value="latex">
            <FileCode className="w-4 h-4 mr-2" />
            LaTeX
          </TabsTrigger>
          <TabsTrigger value="images" className="relative">
            <Image className="w-4 h-4 mr-2" />
            Images
            {extractedImages.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-purple-600 text-white text-xs px-1.5">
                {extractedImages.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Download className="w-4 h-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Progress Tab */}
        <TabsContent value="progress" className="flex-1 overflow-hidden">
          <div className="h-full flex gap-4">
            {/* Agent Progress */}
            <div className="w-1/3">
              <Card className="h-full bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Agent Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agentProgress.map(agent => (
                      <div key={agent.agentName} className="p-2 bg-gray-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {AGENT_ICONS[agent.agentName]}
                            <span className="text-sm font-medium">
                              {agent.agentName.replace(' Agent', '')}
                            </span>
                          </div>
                          {agent.status === 'completed' && (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          )}
                          {agent.status === 'working' && (
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                          )}
                          {agent.status === 'error' && (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        {agent.currentTask && (
                          <p className="text-xs text-gray-500">{agent.currentTask}</p>
                        )}
                        <Progress value={agent.progress} className="h-1 mt-1" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Logs */}
            <div className="flex-1">
              <Card className="h-full bg-gray-800/50 border-gray-700 flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Activity Log</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-1 font-mono text-xs">
                      {logs.map((log, i) => (
                        <p key={i} className="text-gray-400">{log}</p>
                      ))}
                      {isGenerating && (
                        <p className="text-purple-400 animate-pulse">Processing...</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-500 mt-1">{progressMessage}</p>
          </div>
        </TabsContent>

        {/* Sections Tab */}
        <TabsContent value="sections" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-4">
              {sections.map(section => (
                <Card key={section.id} className="bg-gray-800/50 border-gray-700">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {AGENT_ICONS[section.agent]}
                        {section.title}
                        {section.status === 'completed' && (
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            {section.wordCount} words
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2">
                        {section.status === 'completed' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSection(section)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRegenerateSection(section.id)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {section.status === 'pending' && (
                      <p className="text-gray-500 italic">Waiting to generate...</p>
                    )}
                    {section.status === 'in-progress' && (
                      <div className="flex items-center gap-2 text-purple-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Writing...</span>
                      </div>
                    )}
                    {section.status === 'completed' && (
                      <div className="text-sm text-gray-300 whitespace-pre-wrap">
                        {section.content.substring(0, 500)}
                        {section.content.length > 500 && '...'}
                      </div>
                    )}
                    {section.status === 'error' && (
                      <p className="text-red-400">Error generating this section</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* LaTeX Tab */}
        <TabsContent value="latex" className="flex-1 overflow-hidden">
          <Card className="h-full bg-gray-800/50 border-gray-700 flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">LaTeX Source</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyLatex}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadLatex}>
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRecompile} disabled={isGenerating}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                    Recompile
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
                  {latexDocument || 'LaTeX will appear here after generation...'}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab - Shows extracted images from uploaded documents */}
        <TabsContent value="images" className="flex-1 overflow-hidden">
          <Card className="h-full bg-gray-800/50 border-gray-700 flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Extracted Images</CardTitle>
                  <CardDescription>
                    {extractedImages.length > 0 
                      ? `${extractedImages.length} images extracted from uploaded documents`
                      : 'No images extracted yet. Upload PDF documents with images.'}
                  </CardDescription>
                </div>
                {extractedImages.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Download all images as a zip would require additional library
                      // For now, just show a message
                      alert('Right-click on individual images to save them.');
                    }}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Save Images
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {extractedImages.length > 0 ? (
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
                    {extractedImages.map((img, index) => (
                      <div 
                        key={index} 
                        className="bg-gray-700/50 rounded-lg overflow-hidden border border-gray-600 hover:border-purple-500 transition-colors"
                      >
                        <div className="aspect-square bg-gray-800 flex items-center justify-center p-2">
                          <img 
                            src={img.base64} 
                            alt={img.caption}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div className="p-2 border-t border-gray-600">
                          <p className="text-xs text-gray-300 truncate font-medium">{img.filename}</p>
                          <p className="text-xs text-gray-500 truncate">{img.source}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{img.caption}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="mb-2">No images extracted yet</p>
                    <p className="text-sm">Upload PDF documents containing images, diagrams, or figures.</p>
                    <p className="text-sm text-gray-600 mt-2">Images will be automatically extracted and shown here.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="flex-1 overflow-hidden">
          <Card className="h-full bg-gray-800/50 border-gray-700 flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">PDF Preview</CardTitle>
                <div className="flex items-center gap-2">
                  {numPages > 1 && (
                    <div className="flex items-center gap-1 mr-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        ←
                      </Button>
                      <span className="text-xs text-gray-400 mx-1">{currentPage}/{numPages}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages}
                      >
                        →
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setPdfScale(s => Math.max(0.5, s - 0.1))}>−</Button>
                    <span className="text-xs text-gray-400 w-12 text-center">{Math.round(pdfScale * 100)}%</span>
                    <Button variant="ghost" size="sm" onClick={() => setPdfScale(s => Math.min(2, s + 0.1))}>+</Button>
                  </div>
                  {pdfUrl && (
                    <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {pdfFile ? (
                <ScrollArea className="h-full bg-gray-600 rounded">
                  <div className="flex justify-center p-4">
                    <Document
                      file={pdfFile}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      onLoadError={(error) => console.error('PDF load error:', error)}
                      loading={
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                        </div>
                      }
                      className="shadow-xl"
                    >
                      <Page
                        pageNumber={currentPage}
                        scale={pdfScale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="bg-white"
                      />
                    </Document>
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>PDF will appear here after compilation</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Errors</span>
          </div>
          {errors.map((error, i) => (
            <p key={i} className="text-sm text-red-300">{error}</p>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-4 flex justify-between">
        <Button variant="outline" onClick={handleReset}>
          Start Over
        </Button>
        {currentStep === 'review' && (
          <Button
            onClick={() => window.open('https://www.overleaf.com/project', '_blank')}
            className="bg-green-600 hover:bg-green-700"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Overleaf
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-bold">Research Paper Generator</h1>
          </div>
        </div>
        
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={currentStep === 'upload' ? 'default' : 'outline'}
            className={currentStep === 'upload' ? 'bg-purple-600' : ''}
          >
            1. Upload
          </Badge>
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <Badge 
            variant={currentStep === 'configure' ? 'default' : 'outline'}
            className={currentStep === 'configure' ? 'bg-purple-600' : ''}
          >
            2. Configure
          </Badge>
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <Badge 
            variant={currentStep === 'generate' || currentStep === 'review' ? 'default' : 'outline'}
            className={currentStep === 'generate' || currentStep === 'review' ? 'bg-purple-600' : ''}
          >
            3. Generate
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {currentStep === 'upload' && renderUploadStep()}
        {currentStep === 'configure' && renderConfigureStep()}
        {(currentStep === 'generate' || currentStep === 'review') && renderGenerateStep()}
      </main>

      {/* Add Text Dialog */}
      <Dialog open={showAddTextDialog} onOpenChange={setShowAddTextDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Text Content</DialogTitle>
            <DialogDescription>
              Paste text content directly. This could be notes, abstracts, methodology descriptions, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input
                  value={textContentName}
                  onChange={(e) => setTextContentName(e.target.value)}
                  placeholder="e.g., Research Notes"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <select
                  value={textContentType}
                  onChange={(e) => setTextContentType(e.target.value as 'literature' | 'data' | 'report' | 'notes' | 'other')}
                  className="w-full rounded-md bg-gray-700 border border-gray-600 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="literature">Literature</option>
                  <option value="data">Data</option>
                  <option value="report">Report</option>
                  <option value="notes">Notes</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Content</label>
              <Textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste your text content here..."
                className="bg-gray-700 border-gray-600 min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTextDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddTextContent}
              disabled={!textContentName.trim() || !textContent.trim()}
            >
              Add Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="bg-gray-700 border-gray-600 min-h-[400px] font-mono text-sm"
            />
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSection(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResearchPaperWorkspace;
