import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, Sparkles, Target, Brain, Zap, 
  CheckCircle, AlertCircle, Play, Atom, Activity, BookOpen,
  MessageSquare, BarChart3, Microscope, Lightbulb, Eye, Flame
} from 'lucide-react';
import { DocumentSidebar } from './DocumentSidebar';
import { AutoContentSurface, type ChemistryContextSnapshot } from './AutoContentSurface';
import QuestionReferencePreview from './QuestionReferencePreview';
import type { MoleculeData } from '../services/pubchemService';
import JSmolViewer from './JSmolViewer';

interface LessonBite {
  id: string;
  title: string;
  focus: string;
  type: 'teach' | 'practice' | 'challenge';
  xp: number;
  heartCost: number;
  teach: string;
  prompt: string;
  activityType: 'multiple_choice' | 'fill_blank' | 'reflection';
  options?: string[];
  answerIndex?: number;
  correctAnswer?: string;
  acceptableAnswers?: string[];
  rubric?: string;
  tip?: string;
  reward?: string;
}

interface FocusedLearningSessionProps {
  lessonBites: LessonBite[];
  onProgressUpdate?: (completedCount: number, totalCount: number) => void;
  academicLevel?: string;
  documentContent?: string;
  documentName?: string;
  documentFileUrl?: string | null;
}

type InteractiveElementType =
  | 'molecule-search'
  | 'ar-viewer'
  | 'sdf-structure'
  | 'reaction-svg'
  | 'simulation'
  | 'none';

interface BiteWithVisuals extends LessonBite {
  interactiveType: InteractiveElementType;
  visualContent?: {
    title?: string;
    description?: string;
    url?: string;
    smiles?: string;
    reactionSmiles?: string;
  };
}

const enrichBiteWithVisuals = (bite: LessonBite, index: number): BiteWithVisuals => {
  const types: InteractiveElementType[] = [
    'molecule-search',
    'reaction-svg',
    'simulation',
    'ar-viewer',
    'sdf-structure'
  ];

  const typeIndex = index % types.length;
  const interactiveType = types[typeIndex];

  return {
    ...bite,
    interactiveType,
    visualContent: {
      title: `${bite.title} - Interactive`,
      description: bite.focus,
    }
  };
};

const getInteractiveIcon = (type: InteractiveElementType) => {
  switch (type) {
    case 'molecule-search':
      return <Microscope className="h-5 w-5" />;
    case 'reaction-svg':
      return <Zap className="h-5 w-5" />;
    case 'simulation':
      return <BarChart3 className="h-5 w-5" />;
    case 'ar-viewer':
      return <Atom className="h-5 w-5" />;
    case 'sdf-structure':
      return <Activity className="h-5 w-5" />;
    default:
      return <Lightbulb className="h-5 w-5" />;
  }
};

const getInteractiveLabel = (type: InteractiveElementType) => {
  switch (type) {
    case 'molecule-search':
      return 'Molecular Search';
    case 'reaction-svg':
      return 'Reaction Visualization';
    case 'simulation':
      return 'Interactive Simulation';
    case 'ar-viewer':
      return 'AR Molecular Viewer';
    case 'sdf-structure':
      return 'Structure Explorer';
    default:
      return 'Interactive Content';
  }
};

const FocusedLearningSession: React.FC<FocusedLearningSessionProps> = ({
  lessonBites,
  onProgressUpdate,
  academicLevel = 'university',
  documentContent = '',
  documentName = 'Document',
  documentFileUrl = null
}) => {
  const [currentBiteIndex, setCurrentBiteIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [textInput, setTextInput] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | null>(null);
  const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Open by default to show PDF
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const [chemistryContext, setChemistryContext] = useState<ChemistryContextSnapshot | null>(null);

  const currentBite = useMemo(() => {
    return enrichBiteWithVisuals(lessonBites[currentBiteIndex], currentBiteIndex);
  }, [lessonBites, currentBiteIndex]);

  const completedCount = Object.keys(selectedOptions).length + Object.keys(textInput).length;
  const progress = Math.round((completedCount / lessonBites.length) * 100);
  const activeJsmolPlan = chemistryContext?.jsmolPlan || null;
  const topReaction = chemistryContext?.reactions?.[0];
  const topSimulation = chemistryContext?.simulations?.[0];
  const highlightedMolecules = chemistryContext?.molecules?.slice(0, 3) || [];

  const handleOptionSelect = (optionIndex: number) => {
    setSelectedOptions(prev => ({
      ...prev,
      [currentBite.id]: optionIndex
    }));

    const isCorrect = optionIndex === currentBite.answerIndex;
    if (isCorrect) {
      setFeedback('✅ Correct! Great job understanding this concept.');
      setFeedbackType('success');
      setTimeout(() => {
        setFeedback(null);
        setFeedbackType(null);
      }, 2000);
    } else {
      setFeedback(`❌ Not quite right. The correct answer is: ${currentBite.options?.[currentBite.answerIndex ?? 0]}`);
      setFeedbackType('error');
    }

    onProgressUpdate?.(Object.keys(selectedOptions).length + 1, lessonBites.length);
  };

  const handleTextSubmit = (answer: string) => {
    if (!answer.trim()) {
      setFeedback('Please enter an answer.');
      setFeedbackType('info');
      return;
    }

    setTextInput(prev => ({
      ...prev,
      [currentBite.id]: answer
    }));

    const normalizedAnswer = answer.toLowerCase().trim();
    const isCorrect = currentBite.acceptableAnswers?.some(
      a => a.toLowerCase().trim() === normalizedAnswer
    ) || normalizedAnswer === currentBite.correctAnswer?.toLowerCase().trim();

    if (isCorrect) {
      setFeedback('✅ Perfect! You got it right.');
      setFeedbackType('success');
      setTimeout(() => {
        setFeedback(null);
        setFeedbackType(null);
      }, 2000);
    } else {
      setFeedback(`💡 The expected answer was: ${currentBite.correctAnswer}`);
      setFeedbackType('info');
    }

    onProgressUpdate?.(Object.keys(selectedOptions).length + Object.keys(textInput).length + 1, lessonBites.length);
  };

  const handleNext = () => {
    if (currentBiteIndex < lessonBites.length - 1) {
      setCurrentBiteIndex(currentBiteIndex + 1);
      setFeedback(null);
      setFeedbackType(null);
    }
  };

  const handlePrevious = () => {
    if (currentBiteIndex > 0) {
      setCurrentBiteIndex(currentBiteIndex - 1);
      setFeedback(null);
      setFeedbackType(null);
    }
  };

  // Memoize callbacks to prevent AutoContentSurface from re-analyzing
  const handleHighlightLines = useCallback((lines: number[]) => {
    console.log('[FocusedLearningSession] Received highlight lines:', lines);
    setHighlightedLines(lines);
  }, []);

  const referencePages = useMemo(() => {
    const combined = `${currentBite.teach ?? ''} ${currentBite.prompt ?? ''}`;
    const matches = Array.from(combined.matchAll(/Page\s+(\d{1,4})/gi));
    const pageNumbers = matches
      .map((match) => Number.parseInt(match[1], 10))
      .filter((num) => Number.isFinite(num) && num > 0);
    return Array.from(new Set(pageNumbers)).sort((a, b) => a - b);
  }, [currentBite]);

  const handleReferenceClick = (page: number) => {
    setRequestedPage(page);
    setIsSidebarOpen(true);
  };

  useEffect(() => {
    setRequestedPage(null);
  }, [currentBiteIndex]);

  // Log when sidebar state or highlights change
  useEffect(() => {
    console.log('[FocusedLearningSession] State update:', {
      isSidebarOpen,
      highlightedLines,
      documentFileUrl: documentFileUrl ? 'Available' : 'Not available',
      documentContentLength: documentContent.length
    });
  }, [isSidebarOpen, highlightedLines, documentFileUrl, documentContent]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col">
      {/* Header with Progress */}
      <div className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between max-w-full">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">
                {currentBite.title}
              </h2>
              <p className="text-xs text-slate-400">
                Question {currentBiteIndex + 1} of {lessonBites.length}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Progress</p>
                <p className="text-xl font-bold text-white">{progress}%</p>
              </div>
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`relative p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isSidebarOpen 
                    ? 'bg-blue-600/40 text-blue-200' 
                    : 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/40'
                }`}
                title={isSidebarOpen ? 'Close PDF sidebar' : 'Open PDF sidebar'}
              >
                <Eye className="h-5 w-5" />
                {documentFileUrl && !isSidebarOpen && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: Auto Content (Hidden on small screens) */}
        <div className="hidden lg:flex lg:w-80 border-r border-slate-700 bg-slate-900/30 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-0">
            <AutoContentSurface
              lessonContent={currentBite.teach}
              lessonTitle={currentBite.title}
              documentContent={documentContent}
              onHighlightLines={handleHighlightLines}
              academicLevel={academicLevel}
              onChemistryContextUpdate={setChemistryContext}
            />
          </div>
        </div>

        {/* CENTER: Main Learning Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 py-8 sm:px-5 lg:px-6">
              
              {/* Teaching Content */}
              <div className="mb-6 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-slate-900/50 p-6">
                <div className="mb-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/20 border border-blue-500/40 px-3 py-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                      {currentBite.type === 'teach' ? '📚 Learn' : currentBite.type === 'practice' ? '🎯 Practice' : '🏆 Challenge'}
                    </span>
                  </div>
                </div>

                {currentBite.teach && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <h3 className="font-semibold text-white mb-2">Concept Explanation:</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {currentBite.teach}
                    </p>
                  </div>
                )}
              </div>

              {/* Main Grid: Visualization + Quiz Side by Side */}
              <div className="grid lg:grid-cols-2 gap-6">
                
                {/* LEFT: Visualization Panel */}
                <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/50 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="rounded-lg bg-purple-600/20 p-2">
                      {getInteractiveIcon(currentBite.interactiveType)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">
                        {getInteractiveLabel(currentBite.interactiveType)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Interactive visualization
                      </p>
                    </div>
                  </div>

                  <div className="min-h-80 rounded-lg border border-slate-600 bg-slate-950 p-6 flex flex-col items-center justify-center text-center">
                    {currentBite.interactiveType === 'molecule-search' && (
                      activeJsmolPlan ? (
                        <div className="space-y-4 w-full">
                          <JSmolViewer script={activeJsmolPlan.script} height={260} backgroundColor="#020617" />
                          <div className="text-left">
                            <p className="text-slate-300 font-medium">{activeJsmolPlan.title}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              {activeJsmolPlan.description || 'Explore the molecular geometry directly in the viewer.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 w-full">
                          <Microscope className="h-12 w-12 text-purple-400 mx-auto" />
                          <div>
                            <p className="text-slate-300 font-medium">Molecular Visualization</p>
                            <p className="text-xs text-slate-500 mt-2">
                              3D molecular structures will display here
                            </p>
                          </div>
                        </div>
                      )
                    )}

                    {currentBite.interactiveType === 'reaction-svg' && (
                      topReaction ? (
                        <div className="space-y-3 w-full text-left">
                          <div className="flex items-center gap-2 text-yellow-300">
                            <Zap className="h-5 w-5" />
                            <span className="uppercase text-xs tracking-wide">Key Reaction</span>
                          </div>
                          <p className="text-slate-200 font-semibold capitalize">{topReaction.name}</p>
                          <p className="text-xs text-slate-400 italic">"{topReaction.context || 'Mechanistic insight'}"</p>
                        </div>
                      ) : (
                        <div className="space-y-4 w-full">
                          <Zap className="h-12 w-12 text-yellow-400 mx-auto" />
                          <div>
                            <p className="text-slate-300 font-medium">Reaction Mechanism</p>
                            <p className="text-xs text-slate-500 mt-2">
                              Reaction visualization with electron flow
                            </p>
                          </div>
                        </div>
                      )
                    )}

                    {currentBite.interactiveType === 'simulation' && (
                      topSimulation ? (
                        <div className="space-y-3 w-full text-left">
                          <div className="flex items-center gap-2 text-blue-300">
                            <BarChart3 className="h-5 w-5" />
                            <span className="uppercase text-xs tracking-wide">Simulation Idea</span>
                          </div>
                          <p className="text-slate-200 font-semibold capitalize">{topSimulation.type}</p>
                          <p className="text-xs text-slate-400">
                            Confidence {Math.round(topSimulation.confidence * 100)}% · Adjust parameters to explore the outcome.
                          </p>
                          <button className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition">
                            <Play className="h-4 w-4 inline mr-2" />
                            Launch Simulation
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4 w-full">
                          <BarChart3 className="h-12 w-12 text-blue-400 mx-auto" />
                          <div>
                            <p className="text-slate-300 font-medium">Interactive Simulation</p>
                            <p className="text-xs text-slate-500 mt-2">
                              Adjust parameters to explore outcomes
                            </p>
                          </div>
                          <button className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition">
                            <Play className="h-4 w-4 inline mr-2" />
                            Launch Simulation
                          </button>
                        </div>
                      )
                    )}

                    {currentBite.interactiveType === 'ar-viewer' && (
                      <div className="space-y-4 w-full">
                        <Atom className="h-12 w-12 text-cyan-400 mx-auto" />
                        <div>
                          <p className="text-slate-300 font-medium">3D AR Viewer</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {highlightedMolecules.length
                              ? `Focus on ${highlightedMolecules.map(m => m.name).join(', ')}`
                              : 'Augmented reality molecular visualization'}
                          </p>
                        </div>
                        <button className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition">
                          <Atom className="h-4 w-4 inline mr-2" />
                          View in AR
                        </button>
                      </div>
                    )}

                    {currentBite.interactiveType === 'sdf-structure' && (
                      <div className="space-y-4 w-full">
                        <Activity className="h-12 w-12 text-green-400 mx-auto" />
                        <div>
                          <p className="text-slate-300 font-medium">Structure Explorer</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {highlightedMolecules.length
                              ? `Compare structures: ${highlightedMolecules.map(m => m.name).join(', ')}`
                              : 'Examine stereochemistry and geometry'}
                          </p>
                        </div>
                        <button className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition">
                          <Activity className="h-4 w-4 inline mr-2" />
                          Explore
                        </button>
                      </div>
                    )}

                  </div>
                </div>

                {/* RIGHT: Question and Answer Section */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/50 p-6">
                    <h3 className="text-xl font-bold text-white mb-4">
                      {currentBite.prompt}
                    </h3>

                    {referencePages.length > 0 && documentFileUrl && (
                      <div className="mb-4 space-y-3">
                        <div className="rounded-lg border border-blue-500/40 bg-blue-600/20 p-3 text-xs text-blue-100">
                          <p className="text-sm font-semibold text-blue-50">Source diagrams referenced in this question</p>
                          <p className="mt-1 text-[11px] text-blue-200/80">
                            Tap a page to jump directly to the diagram inside the document viewer.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {referencePages.map((page) => (
                              <button
                                key={page}
                                type="button"
                                onClick={() => handleReferenceClick(page)}
                                className="rounded-full border border-blue-400/50 bg-blue-500/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-50 hover:border-blue-300/80 hover:bg-blue-500/80"
                              >
                                View Page {page}
                              </button>
                            ))}
                          </div>
                        </div>

                        <QuestionReferencePreview
                          documentFileUrl={documentFileUrl}
                          pages={referencePages}
                        />
                      </div>
                    )}

                    {/* Multiple Choice */}
                    {currentBite.activityType === 'multiple_choice' && (
                      <div className="space-y-3">
                        {currentBite.options?.map((option, idx) => {
                          const selected = selectedOptions[currentBite.id] === idx;
                          const correctAnswerIdx = currentBite.answerIndex;
                          const isCorrect = idx === correctAnswerIdx;
                          const showResult = selectedOptions[currentBite.id] !== undefined;

                          let buttonClass = 'border-slate-600 bg-slate-800/50 hover:border-purple-400/60 text-slate-200';
                          if (showResult) {
                            if (isCorrect) buttonClass = 'border-green-400/60 bg-green-500/10 text-green-200';
                            else if (selected) buttonClass = 'border-red-400/60 bg-red-500/10 text-red-200';
                            else buttonClass = 'border-slate-700 bg-slate-900 text-slate-400';
                          } else if (selected) {
                            buttonClass = 'border-purple-400 bg-purple-500/10 text-purple-200';
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => handleOptionSelect(idx)}
                              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${buttonClass}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  isCorrect && showResult ? 'border-green-400 bg-green-500/20' :
                                  selected && showResult ? 'border-red-400 bg-red-500/20' :
                                  selected ? 'border-purple-400 bg-purple-500/20' :
                                  'border-slate-500'
                                }`}>
                                  {selected && showResult && isCorrect && <CheckCircle className="h-4 w-4 text-green-400" />}
                                  {selected && showResult && !isCorrect && <AlertCircle className="h-4 w-4 text-red-400" />}
                                </div>
                                <span className="text-sm">{option}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Fill Blank */}
                    {currentBite.activityType === 'fill_blank' && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={textInput[currentBite.id] ?? ''}
                            onChange={(e) => setTextInput(prev => ({ ...prev, [currentBite.id]: e.target.value }))}
                            placeholder="Type your answer..."
                            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit(textInput[currentBite.id] ?? '')}
                          />
                          <button
                            onClick={() => handleTextSubmit(textInput[currentBite.id] ?? '')}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition"
                          >
                            Check
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reflection */}
                    {currentBite.activityType === 'reflection' && (
                      <div className="space-y-3">
                        <textarea
                          value={textInput[currentBite.id] ?? ''}
                          onChange={(e) => setTextInput(prev => ({ ...prev, [currentBite.id]: e.target.value }))}
                          placeholder="Write your reflection..."
                          rows={4}
                          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={() => handleTextSubmit(textInput[currentBite.id] ?? '')}
                          className="w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg text-white text-sm font-semibold hover:shadow-lg transition"
                        >
                          Save Reflection
                        </button>
                      </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                      <div className={`mt-4 p-3 rounded-lg text-sm ${
                        feedbackType === 'success' 
                          ? 'bg-green-500/10 border border-green-500/50 text-green-300' 
                          : feedbackType === 'error'
                          ? 'bg-red-500/10 border border-red-500/50 text-red-300'
                          : 'bg-blue-500/10 border border-blue-500/50 text-blue-300'
                      }`}>
                        {feedback}
                      </div>
                    )}
                  </div>

                  {/* Hint/Tip Section */}
                  {currentBite.tip && (
                    <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/20 to-slate-900/50 p-6">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-yellow-600/20 p-2 flex-shrink-0">
                          <Lightbulb className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-yellow-200 mb-1">💡 Hint</h4>
                          <p className="text-sm text-slate-300 leading-relaxed">
                            {currentBite.tip}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reward Section */}
                  {currentBite.reward && selectedOptions[currentBite.id] === currentBite.answerIndex && (
                    <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/20 to-slate-900/50 p-6">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-emerald-600/20 p-2 flex-shrink-0">
                          <Sparkles className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-emerald-200 mb-1">🎉 Well Done!</h4>
                          <p className="text-sm text-slate-300 leading-relaxed">
                            {currentBite.reward}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {chemistryContext && (
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  {highlightedMolecules.length > 0 && (
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400 mb-3">
                        <Microscope className="h-4 w-4 text-purple-300" />
                        Highlighted Molecules
                      </div>
                      <ul className="space-y-2">
                        {highlightedMolecules.map((molecule) => (
                          <li key={molecule.name} className="flex items-center justify-between text-sm text-slate-200">
                            <span>{molecule.name}</span>
                            <span className="text-slate-400">{Math.round(molecule.confidence * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {topReaction && (
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400 mb-3">
                        <Flame className="h-4 w-4 text-amber-300" />
                        Reaction Insight
                      </div>
                      <p className="text-slate-200 font-semibold capitalize">{topReaction.name}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {topReaction.context || 'Referenced from your document'}
                      </p>
                    </div>
                  )}

                  {chemistryContext.resources.length > 0 && (
                    <div className="lg:col-span-2 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400 mb-3">
                        <BookOpen className="h-4 w-4 text-emerald-300" />
                        Suggested Resources
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {chemistryContext.resources.slice(0, 2).map((resource, index) => (
                          <a
                            key={`${resource.title}-${index}`}
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-left hover:border-emerald-400/60 transition-colors"
                          >
                            <p className="text-sm font-semibold text-slate-200 truncate">{resource.title}</p>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                              {resource.reason || resource.description}
                            </p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="mt-6 flex gap-3 justify-between">
                <button
                  onClick={handlePrevious}
                  disabled={currentBiteIndex === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentBiteIndex === lessonBites.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: PDF Sidebar (Desktop only) */}
        {isSidebarOpen && (
          <div className="hidden lg:flex lg:w-96 border-l border-slate-700 bg-slate-900/50 flex-col overflow-hidden">
            <DocumentSidebar
              documentContent={documentContent}
              documentName={documentName}
              highlightedLines={highlightedLines}
              currentLesson={currentBite.title}
              isOpen={true}
              onToggle={setIsSidebarOpen}
              documentFileUrl={documentFileUrl}
              requestedPage={requestedPage}
              onClearRequestedPage={() => setRequestedPage(null)}
            />
          </div>
        )}
      </div>

      {/* Mobile DocumentSidebar Overlay (Mobile only) */}
      <div className="lg:hidden">
        {isSidebarOpen && (
          <DocumentSidebar
            documentContent={documentContent}
            documentName={documentName}
            highlightedLines={highlightedLines}
            currentLesson={currentBite.title}
            isOpen={isSidebarOpen}
            onToggle={setIsSidebarOpen}
            documentFileUrl={documentFileUrl}
            requestedPage={requestedPage}
            onClearRequestedPage={() => setRequestedPage(null)}
          />
        )}
      </div>
    </div>
  );
};

export default FocusedLearningSession;
