import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Loader2, Brain, Target, BookOpen, Zap, CheckCircle, XCircle, ArrowRight, Lightbulb, RefreshCw, Award, AlertCircle, Play, Volume2, Copy, StickyNote } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { executeWithRotation } from '../services/apiKeyRotation';
import { auth } from '../firebase/config';
import { 
  getLearningPreferences, 
  saveSessionData, 
  getAdaptivePrompts,
  type LearningPreferences,
  type SessionData
} from '../firebase/learningPreferences';

interface SubjectExplorerProps {
  onClose: () => void;
  apiKey: string;
}

// Agent workflow types
type WorkflowStage = 'upload' | 'topic_selection' | 'assessment' | 'learning';

interface Topic {
  id: string;
  name: string;
  description?: string;
}

interface TopicSelectionResponse {
  interaction_type: 'topic_selection';
  message: string;
  topics: string[];
  academic_level?: string;
}

interface AssessmentChoiceResponse {
  interaction_type: 'assessment_choice';
  options: Array<{
    id: string;
    text: string;
  }>;
}

interface KnowledgeGap {
  concept: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface KnowledgeGapReport {
  gaps: KnowledgeGap[];
  strengths: string[];
  overall_level: string;
}

// Interactive Module Types
interface Flashcard {
  module_type: 'flashcard';
  front: string;
  back: string;
}

interface MCQMulti {
  module_type: 'mcq_multi';
  question: string;
  options: Array<{ id: string; text: string }>;
  correct_ids: string[];
}

interface ShortAnswer {
  module_type: 'short_answer';
  question: string;
  keywords_to_check: string[];
}

interface FillBlanks {
  module_type: 'fill_blanks';
  text: string;
  blanks: string[];
}

interface MatchPairs {
  module_type: 'match_pairs';
  prompt: string;
  column_a: string[];
  column_b: string[];
  correct_pairs: Array<{ a: string; b: string }>;
}

type InteractiveModule = Flashcard | MCQMulti | ShortAnswer | FillBlanks | MatchPairs;

// Helper function to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const SubjectExplorer: React.FC<SubjectExplorerProps> = ({ onClose, apiKey }) => {
  const [stage, setStage] = useState<WorkflowStage>('upload');
  const [documentContent, setDocumentContent] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // Agent 1: Librarian state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [academicLevel, setAcademicLevel] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  // Agent 2: Assessor state
  const [assessmentType, setAssessmentType] = useState<string | null>(null);
  const [currentModule, setCurrentModule] = useState<InteractiveModule | null>(null);
  const [knowledgeGapReport, setKnowledgeGapReport] = useState<KnowledgeGapReport | null>(null);
  
  // Agent 3: Tutor state
  const [learningContent, setLearningContent] = useState<string>('');
  const [tutorModules, setTutorModules] = useState<InteractiveModule[]>([]);
  const [currentTutorModuleIndex, setCurrentTutorModuleIndex] = useState(0);
  const [userProgress, setUserProgress] = useState<Array<{ success: boolean; moduleType: string }>>([]);
  
  // User interaction state
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [fillBlanksAnswers, setFillBlanksAnswers] = useState<string[]>([]);
  const [matchPairsAnswers, setMatchPairsAnswers] = useState<Map<string, string>>(new Map());
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  
  // Hints and attempt tracking
  const [attemptCount, setAttemptCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState('');
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  
  // Learning preferences tracking
  const [learningPreferences, setLearningPreferences] = useState<LearningPreferences | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [readingStartTime, setReadingStartTime] = useState<number>(0);
  const [currentSessionData, setCurrentSessionData] = useState<Partial<SessionData>>({
    questionsAttempted: 0,
    questionsCorrectFirstTry: 0,
    questionsSkipped: [],
    hintsUsed: 0,
    attemptsPerQuestion: [],
    moduleTypesUsed: [],
    moduleTypesSucceeded: [],
    timeSpentReading: 0,
    timeSpentOnExercises: 0,
  });
  
  // Interactive learning content state
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [interactiveSimulationActive, setInteractiveSimulationActive] = useState(false);
  const [conceptHighlights, setConceptHighlights] = useState<string[]>([]);
  const [userNotes, setUserNotes] = useState<Map<string, string>>(new Map());

  // Load user learning preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      const user = auth.currentUser;
      if (user) {
        const prefs = await getLearningPreferences(user.uid);
        setLearningPreferences(prefs);
        console.log('[SubjectExplorer] Loaded learning preferences:', prefs);
      }
    };
    loadPreferences();
  }, []);

  // Monitor API key changes
  useEffect(() => {
    console.log('[SubjectExplorer] API key updated:', apiKey ? `${apiKey.substring(0, 10)}...` : 'none');
  }, [apiKey]);

  // Initialize Gemini with fallback models
  const getGeminiModel = (modelName: string, useApiKey?: string) => {
    const keyToUse = useApiKey || apiKey;
    if (!keyToUse) {
      throw new Error('API key is required');
    }
    const genAI = new GoogleGenerativeAI(keyToUse);
    return genAI.getGenerativeModel({ model: modelName });
  };

  const callGeminiWithFallback = async (prompt: string, schema?: any) => {
    const models = ['gemini-flash-latest']; // Use only flash for speed
    
    for (const modelName of models) {
      try {
        // First try with user's API key directly (no rotation)
        if (apiKey) {
          try {
            console.log(`[SubjectExplorer] Attempting with user's API key and model: ${modelName}`);
            const model = getGeminiModel(modelName, apiKey);
            
            if (schema) {
              const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  responseSchema: schema,
                },
              });
              return JSON.parse(result.response.text());
            } else {
              const result = await model.generateContent(prompt);
              return result.response.text();
            }
          } catch (directError: any) {
            // If user's key fails (not rate limit), try rotation
            if (directError?.message?.includes('429') || directError?.message?.includes('quota')) {
              console.log(`[SubjectExplorer] User's API key is rate limited for ${modelName}, trying rotation...`);
            } else {
              console.warn(`[SubjectExplorer] Error with user's API key for ${modelName}:`, directError);
            }
          }
        }
        
        // Fall back to API key rotation
        console.log(`[SubjectExplorer] Attempting with rotation for model: ${modelName}`);
        return await executeWithRotation(async () => {
          const model = getGeminiModel(modelName);
          
          if (schema) {
            const result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: schema,
              },
            });
            return JSON.parse(result.response.text());
          } else {
            const result = await model.generateContent(prompt);
            return result.response.text();
          }
        });
      } catch (error) {
        console.error(`[SubjectExplorer] Error with model ${modelName}:`, error);
        if (modelName === models[models.length - 1]) {
          throw error;
        }
        console.log(`[SubjectExplorer] Falling back to next model...`);
      }
    }
  };

  // Agent 1: Librarian - Extract topics and academic level
  const analyzeDocument = async (file: File) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing document and extracting topics...');
    
    try {
      let documentText = '';
      
      // Extract text based on file type
      if (file.type === 'application/pdf') {
        console.log('[SubjectExplorer] Processing PDF file...');
        setProcessingMessage('Extracting text from PDF...');
        
        // Convert PDF to base64
        const bytes = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(bytes);
        console.log('[SubjectExplorer] PDF converted to base64, length:', base64Data.length);
        
        // Use Gemini to extract text from PDF
        const models = ['gemini-2.5-pro', 'gemini-flash-latest'];
        
        for (const modelName of models) {
          try {
            if (apiKey) {
              const genAI = new GoogleGenerativeAI(apiKey);
              const model = genAI.getGenerativeModel({ model: modelName });
              
              const result = await model.generateContent([
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data
                  }
                },
                `Please extract the complete text content from this PDF document.

CRITICAL REQUIREMENTS:
1. Preserve ALL text content from the document
2. Maintain the document structure and organization
3. Include all important information: headings, body text, lists, tables, etc.
4. Be thorough - don't summarize, extract the full text

Provide the complete text content.`
              ]);
              
              documentText = result.response.text();
              console.log('[SubjectExplorer] PDF text extracted, length:', documentText.length);
              break;
            }
          } catch (error) {
            console.error(`[SubjectExplorer] Error extracting PDF with ${modelName}:`, error);
            if (modelName === models[models.length - 1]) {
              throw new Error('Failed to extract text from PDF. Please add your API key in Settings.');
            }
          }
        }
        
        if (!documentText) {
          throw new Error('Failed to extract text from PDF');
        }
      } else {
        // For text files (.txt, .md)
        console.log('[SubjectExplorer] Processing text file...');
        const reader = new FileReader();
        documentText = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }
      
      setDocumentContent(documentText);
      
      // Now analyze the extracted text
      setProcessingMessage('Analyzing topics and academic level...');
      
      const schema = {
        type: SchemaType.OBJECT,
        properties: {
          interaction_type: { type: SchemaType.STRING },
          message: { type: SchemaType.STRING },
          topics: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          },
          academic_level: { type: SchemaType.STRING }
        },
        required: ['interaction_type', 'message', 'topics', 'academic_level']
      };

      const prompt = `You are the "Librarian" agent in an adaptive tutoring system. Analyze this document and:
1. Determine the academic level (e.g., "undergraduate chemistry", "high school physics", etc.)
2. Extract 4-6 primary topics that are central to this document
3. Present them in a structured format for topic selection

Document content:
${documentText.substring(0, 8000)}

Respond with a JSON object containing:
- interaction_type: "topic_selection"
- message: A friendly message asking the user to select a topic
- topics: Array of topic names
- academic_level: The determined academic level`;

      const response = await callGeminiWithFallback(prompt, schema) as TopicSelectionResponse;
      
      setAcademicLevel(response.academic_level || 'general');
      setTopics(response.topics.map((topic, idx) => ({ id: `topic-${idx}`, name: topic })));
      setStage('topic_selection');
    } catch (error: any) {
      console.error('[SubjectExplorer] Error analyzing document:', error);
      
      // Reset to upload stage on error
      setStage('upload');
      
      // Provide helpful error message and show modal for API key issues
      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
        setShowFeedback(true);
      } else if (error?.message?.includes('API key')) {
        setFeedbackMessage('⚠️ No API key available. Please add your Gemini API key in Settings.');
        setShowApiKeyModal(true);
        setShowFeedback(true);
      } else {
        setFeedbackMessage('Failed to analyze document. Please try again or add your API key in Settings for better reliability.');
        setShowFeedback(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 2: Assessor - Generate assessment
  const generateAssessment = async (topic: Topic, assessmentType: string) => {
    setIsProcessing(true);
    setProcessingMessage('Generating assessment...');
    
    try {
      let moduleSchema: any;
      let prompt: string;

      if (assessmentType === 'quiz') {
        moduleSchema = {
          type: SchemaType.OBJECT,
          properties: {
            module_type: { type: SchemaType.STRING },
            question: { type: SchemaType.STRING },
            options: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  text: { type: SchemaType.STRING }
                },
                required: ['id', 'text']
              }
            },
            correct_ids: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ['module_type', 'question', 'options', 'correct_ids']
        };

        prompt = `You are the "Assessor" agent. Create a baseline knowledge quiz for the topic "${topic.name}" at ${academicLevel} level.
Generate a multiple-choice question (with 2-3 correct answers) to assess foundational knowledge.

Document context:
${documentContent.substring(0, 4000)}

Respond with a JSON object for an mcq_multi module.`;
      } else if (assessmentType === 'flashcards') {
        moduleSchema = {
          type: SchemaType.OBJECT,
          properties: {
            module_type: { type: SchemaType.STRING },
            front: { type: SchemaType.STRING },
            back: { type: SchemaType.STRING }
          },
          required: ['module_type', 'front', 'back']
        };

        prompt = `You are the "Assessor" agent. Create a flashcard for the topic "${topic.name}" at ${academicLevel} level.
The flashcard should test a key concept or definition.

Document context:
${documentContent.substring(0, 4000)}

Respond with a JSON object for a flashcard module.`;
      } else {
        // canvas_prompt or short_answer
        moduleSchema = {
          type: SchemaType.OBJECT,
          properties: {
            module_type: { type: SchemaType.STRING },
            question: { type: SchemaType.STRING },
            keywords_to_check: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ['module_type', 'question', 'keywords_to_check']
        };

        prompt = `You are the "Assessor" agent. Create a short answer question for the topic "${topic.name}" at ${academicLevel} level.
Ask the user to explain a concept in 1-2 sentences.

Document context:
${documentContent.substring(0, 4000)}

Respond with a JSON object for a short_answer module.`;
      }

      const module = await callGeminiWithFallback(prompt, moduleSchema);
      setCurrentModule(module);
      setStage('assessment');
    } catch (error: any) {
      console.error('[SubjectExplorer] Error generating assessment:', error);
      
      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
      } else {
        setFeedbackMessage('Failed to generate assessment. Please try again or add your API key in Settings.');
      }
      setShowFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 2: Assessor - Analyze assessment results
  const analyzeAssessmentResults = async (isCorrect: boolean, userResponse: any) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing your knowledge...');
    
    try {
      const schema = {
        type: SchemaType.OBJECT,
        properties: {
          gaps: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                concept: { type: SchemaType.STRING },
                severity: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING }
              },
              required: ['concept', 'severity', 'description']
            }
          },
          strengths: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          },
          overall_level: { type: SchemaType.STRING }
        },
        required: ['gaps', 'strengths', 'overall_level']
      };

      const prompt = `You are the "Assessor" agent. Analyze the user's performance on this assessment:

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}
Assessment Type: ${currentModule?.module_type}
User's Response: ${JSON.stringify(userResponse)}
Result: ${isCorrect ? 'Correct' : 'Incorrect'}

Document context:
${documentContent.substring(0, 4000)}

Create a Knowledge Gap Report identifying:
1. Specific knowledge gaps (if any)
2. Strengths demonstrated
3. Overall proficiency level

Respond with a structured JSON report.`;

      const report = await callGeminiWithFallback(prompt, schema) as KnowledgeGapReport;
      setKnowledgeGapReport(report);
      setStage('learning');
      
      // Generate initial learning content
      await generateLearningPath(report);
    } catch (error: any) {
      console.error('[SubjectExplorer] Error analyzing results:', error);
      
      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
      } else {
        setFeedbackMessage('Failed to analyze results. Please try again or add your API key in Settings.');
      }
      setShowFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 3: Tutor - Generate adaptive learning path
  const generateLearningPath = async (gapReport: KnowledgeGapReport) => {
    setIsProcessing(true);
    setProcessingMessage('Creating personalized learning path...');
    setReadingStartTime(Date.now()); // Start tracking reading time
    
    try {
      // Get adaptive prompts based on user preferences
      const adaptiveGuidelines = learningPreferences 
        ? getAdaptivePrompts(learningPreferences)
        : {
            contentLengthGuideline: 'Provide balanced explanations (3-4 paragraphs, around 300 words).',
            styleGuidelines: '',
            moduleTypePreference: '',
          };

      // First, generate INTERACTIVE explanatory content with visual elements
      const contentPrompt = `You are the "Tutor" agent creating INTERACTIVE learning content. Based on this Knowledge Gap Report, create engaging step-by-step content:

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}
Knowledge Gaps: ${JSON.stringify(gapReport.gaps)}
Strengths: ${JSON.stringify(gapReport.strengths)}

Document context:
${documentContent.substring(0, 4000)}

ADAPTIVE TEACHING GUIDELINES:
- ${adaptiveGuidelines.contentLengthGuideline}
${adaptiveGuidelines.styleGuidelines ? `- ${adaptiveGuidelines.styleGuidelines}` : ''}

${learningPreferences?.topicsStruggledWith.includes(selectedTopic?.name || '') 
  ? '⚠️ IMPORTANT: This student has struggled with this topic before. Break down into smaller steps with clear explanations.'
  : ''}

INTERACTIVE CONTENT STRUCTURE - Create a GRADUAL learning experience:

# Understanding ${selectedTopic?.name}

[CONCEPT_CARD]
Title: What is ${selectedTopic?.name}?
Description: [2-3 sentence simple explanation that anyone can understand]
Icon: [one emoji representing the concept]
[/CONCEPT_CARD]

## Step-by-Step Breakdown

[DIAGRAM]
Type: flowchart
Description: [Clear description of the process/concept]
Image: [Optional: Add a public image URL from Wikimedia Commons, educational sites, or diagram repositories that illustrates this concept]
Steps:
1. [First step - simple and clear]
2. [Second step - build on first]
3. [Third step - continue building]
4. [Final step - complete understanding]
[/DIAGRAM]

## See It In Action

[EXAMPLE]
Scenario: [Real-world relatable scenario that demonstrates this concept]
Connection: [How this connects to what they just learned]
[/EXAMPLE]

## Deep Insights

[INSIGHT]
[One key insight that makes them say "Aha!"]
[/INSIGHT]

[INSIGHT]
[A practical tip or common misconception cleared]
[/INSIGHT]

## Quick Recap

[SUMMARY]
**What we learned:**
- [Key point 1]
- [Key point 2]  
- [Key point 3]
- [Why it matters]
[/SUMMARY]

Make each section build on the previous one. Use simple language. Include specific numbered steps in DIAGRAM sections. If relevant educational images exist online (Wikimedia, educational resources), include their URLs in the Image field.`;

      const content = await callGeminiWithFallback(contentPrompt);
      setLearningContent(content);
      
      // Track content length
      setCurrentSessionData(prev => ({
        ...prev,
        contentLengthProvided: content.split(' ').length,
      }));

      // Generate an interactive module to test understanding
      await generateTutorModule(gapReport.gaps[0]);
    } catch (error: any) {
      console.error('[SubjectExplorer] Error generating learning path:', error);
      
      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
      } else {
        setFeedbackMessage('Failed to generate learning path. Please try again or add your API key in Settings.');
      }
      setShowFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 3: Tutor - Generate interactive module with AI-driven format selection
  const generateTutorModule = async (gap: KnowledgeGap) => {
    try {
      // AI Agent: Module Format Selector
      // Analyzes user's learning history to choose optimal teaching format
      const selectedModuleType = await selectOptimalModuleType(gap);
      
      console.log('[ModuleSelector] Selected format:', selectedModuleType, 'for concept:', gap.concept);
      
      // Track module type usage
      setCurrentSessionData(prev => ({
        ...prev,
        moduleTypesUsed: [...(prev.moduleTypesUsed || []), selectedModuleType],
      }));

      // Generate module based on selected type
      let module: InteractiveModule;
      
      switch (selectedModuleType) {
        case 'fill_blanks':
          module = await generateFillBlanksModule(gap);
          break;
        case 'mcq_multi':
          module = await generateMCQModule(gap);
          break;
        case 'match_pairs':
          module = await generateMatchPairsModule(gap);
          break;
        case 'short_answer':
          module = await generateShortAnswerModule(gap);
          break;
        case 'flashcard':
          module = await generateFlashcardModule(gap);
          break;
        default:
          module = await generateFillBlanksModule(gap);
      }
      
      setTutorModules([module]);
      setCurrentTutorModuleIndex(0);
      
      // Track reading time before exercise
      if (readingStartTime > 0) {
        const readingTime = Math.floor((Date.now() - readingStartTime) / 1000);
        setCurrentSessionData(prev => ({
          ...prev,
          timeSpentReading: (prev.timeSpentReading || 0) + readingTime,
        }));
      }
    } catch (error) {
      console.error('Error generating tutor module:', error);
      // Fallback to fill_blanks
      const fallbackModule = await generateFillBlanksModule(gap);
      setTutorModules([fallbackModule]);
      setCurrentTutorModuleIndex(0);
    }
  };

  // AI Agent: Intelligent Module Format Selector
  const selectOptimalModuleType = async (gap: KnowledgeGap): Promise<string> => {
    try {
      // Build analysis context from user's learning history
      const recentAttempts = currentSessionData.attemptsPerQuestion?.slice(-5) || [];
      const avgRecentAttempts = recentAttempts.length > 0 
        ? recentAttempts.reduce((a, b) => a + b, 0) / recentAttempts.length 
        : 0;
      
      const recentModules = currentSessionData.moduleTypesUsed?.slice(-3) || [];
      const recentSuccesses = currentSessionData.moduleTypesSucceeded?.slice(-3) || [];
      
      // Determine struggling patterns
      const isStrugglingWithCurrent = avgRecentAttempts > 2;
      const hasSkippedOnTopic = learningPreferences?.skippedQuestions
        .filter(q => q.topic === selectedTopic?.name).length || 0;
      
      // Call Gemini to intelligently select module type
      const analysisPrompt = `You are an AI Teaching Assistant specializing in adaptive learning.

STUDENT LEARNING PROFILE:
- Current Topic: ${selectedTopic?.name}
- Concept to Teach: "${gap.concept}"
- Gap Severity: ${gap.severity}
- Academic Level: ${academicLevel}

RECENT PERFORMANCE:
- Average Attempts per Question: ${avgRecentAttempts.toFixed(1)}
- Recently Used Formats: ${recentModules.length > 0 ? recentModules.join(', ') : 'None yet'}
- Succeeded With: ${recentSuccesses.length > 0 ? recentSuccesses.join(', ') : 'None yet'}
- Questions Skipped on This Topic: ${hasSkippedOnTopic}
- Is Struggling: ${isStrugglingWithCurrent ? 'YES' : 'No'}

LEARNING PREFERENCES:
- Information Length: ${learningPreferences?.informationLength || 'moderate'}
- Needs More Examples: ${learningPreferences?.needsMoreExamples || false}
- Prefers Analogies: ${learningPreferences?.prefersAnalogyExplanations || false}

AVAILABLE TEACHING FORMATS:
1. "fill_blanks" - Good for testing recall and understanding of key terms in context
2. "mcq_multi" - Good for concept recognition and comparison of options
3. "match_pairs" - Good for connecting related concepts, visual learners, breaking info into chunks
4. "short_answer" - Good for deep understanding and explanation skills
5. "flashcard" - Good for memorization and quick review of definitions

SELECTION RULES:
- If student is struggling (avg attempts > 2), avoid fill_blanks and short_answer
- If student skipped questions, use match_pairs or mcq_multi (easier to engage)
- If student prefers brief content, use match_pairs or flashcard (bite-sized)
- Vary the format! Don't use the same type twice in a row
- For high-severity gaps, use interactive formats (match_pairs, mcq_multi)
- For low-severity gaps, can use fill_blanks or short_answer

Based on this analysis, which ONE format would be most effective for THIS student learning THIS concept?

Respond with ONLY the format name: fill_blanks, mcq_multi, match_pairs, short_answer, or flashcard`;

      const response = await callGeminiWithFallback(analysisPrompt);
      const selectedType = response.toLowerCase().trim();
      
      // Validate response
      const validTypes = ['fill_blanks', 'mcq_multi', 'match_pairs', 'short_answer', 'flashcard'];
      if (validTypes.includes(selectedType)) {
        return selectedType;
      }
      
      // Fallback logic if AI doesn't respond properly
      console.warn('[ModuleSelector] Invalid AI response, using fallback logic');
      return getFallbackModuleType(isStrugglingWithCurrent, hasSkippedOnTopic, recentModules);
      
    } catch (error) {
      console.error('[ModuleSelector] Error in AI selection:', error);
      // Use fallback logic
      const recentModules = currentSessionData.moduleTypesUsed?.slice(-3) || [];
      return getFallbackModuleType(false, 0, recentModules);
    }
  };

  // Fallback module selection logic
  const getFallbackModuleType = (
    isStruggling: boolean,
    skippedCount: number,
    recentModules: string[]
  ): string => {
    const lastModule = recentModules[recentModules.length - 1];
    
    // Ensure variety
    const availableTypes = ['fill_blanks', 'mcq_multi', 'match_pairs', 'short_answer', 'flashcard'];
    const notRecentTypes = availableTypes.filter(t => !recentModules.includes(t));
    
    if (isStruggling || skippedCount > 0) {
      // Use easier, more interactive formats
      const easyTypes = notRecentTypes.filter(t => 
        ['match_pairs', 'mcq_multi', 'flashcard'].includes(t)
      );
      return easyTypes.length > 0 ? easyTypes[0] : 'match_pairs';
    }
    
    // Use variety
    return notRecentTypes.length > 0 ? notRecentTypes[0] : 'fill_blanks';
  };

  // Generate Fill-in-the-Blanks Module
  const generateFillBlanksModule = async (gap: KnowledgeGap): Promise<FillBlanks> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        text: { type: SchemaType.STRING },
        blanks: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ['module_type', 'text', 'blanks']
    };

    const prompt = `You are the "Tutor" agent. Create a fill-in-the-blanks exercise to test understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Create a sentence or short paragraph with 2-3 blanks marked as [____]. 
Provide the correct answers in the blanks array.
Make it engaging and relevant to real-world applications.

Respond with a JSON object for a fill_blanks module.`;

    return await callGeminiWithFallback(prompt, schema) as FillBlanks;
  };

  // Generate MCQ Module
  const generateMCQModule = async (gap: KnowledgeGap): Promise<MCQMulti> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        question: { type: SchemaType.STRING },
        options: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              text: { type: SchemaType.STRING }
            },
            required: ['id', 'text']
          }
        },
        correct_ids: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ['module_type', 'question', 'options', 'correct_ids']
    };

    const prompt = `You are the "Tutor" agent. Create a multiple-choice question to test understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Create a clear question with 4-5 options. Mark 1-2 correct answers.
Options should be plausible but distinguishable.

Respond with a JSON object:
{
  "module_type": "mcq_multi",
  "question": "...",
  "options": [
    {"id": "a", "text": "..."},
    {"id": "b", "text": "..."},
    ...
  ],
  "correct_ids": ["a", "c"]
}`;

    return await callGeminiWithFallback(prompt, schema) as MCQMulti;
  };

  // Generate Match Pairs Module
  const generateMatchPairsModule = async (gap: KnowledgeGap): Promise<MatchPairs> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        prompt: { type: SchemaType.STRING },
        column_a: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        },
        column_b: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        },
        correct_pairs: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              a: { type: SchemaType.STRING },
              b: { type: SchemaType.STRING }
            },
            required: ['a', 'b']
          }
        }
      },
      required: ['module_type', 'prompt', 'column_a', 'column_b', 'correct_pairs']
    };

    const prompt = `You are the "Tutor" agent. Create a matching exercise to test understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Create 4-5 pairs of related items (terms and definitions, concepts and examples, etc.).
This format helps students connect ideas and is easier for those who struggle with large chunks of information.

Respond with a JSON object:
{
  "module_type": "match_pairs",
  "prompt": "Match each term with its correct definition",
  "column_a": ["Term 1", "Term 2", ...],
  "column_b": ["Definition A", "Definition B", ...],
  "correct_pairs": [
    {"a": "Term 1", "b": "Definition A"},
    ...
  ]
}`;

    return await callGeminiWithFallback(prompt, schema) as MatchPairs;
  };

  // Generate Short Answer Module
  const generateShortAnswerModule = async (gap: KnowledgeGap): Promise<ShortAnswer> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        question: { type: SchemaType.STRING },
        keywords_to_check: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ['module_type', 'question', 'keywords_to_check']
    };

    const prompt = `You are the "Tutor" agent. Create a short-answer question to test deep understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Create an open-ended question that requires explanation.
Provide 3-5 key terms/concepts that should appear in a correct answer.

Respond with a JSON object:
{
  "module_type": "short_answer",
  "question": "...",
  "keywords_to_check": ["keyword1", "keyword2", ...]
}`;

    return await callGeminiWithFallback(prompt, schema) as ShortAnswer;
  };

  // Generate Flashcard Module
  const generateFlashcardModule = async (gap: KnowledgeGap): Promise<Flashcard> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        front: { type: SchemaType.STRING },
        back: { type: SchemaType.STRING }
      },
      required: ['module_type', 'front', 'back']
    };

    const prompt = `You are the "Tutor" agent. Create a flashcard to help memorize: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Create a clear question/term for the front and a concise answer/definition for the back.
Keep the back brief (1-3 sentences).

Respond with a JSON object:
{
  "module_type": "flashcard",
  "front": "Question or term...",
  "back": "Answer or definition..."
}`;

    return await callGeminiWithFallback(prompt, schema) as Flashcard;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setDocumentName(file.name);
    
    // Validate file type
    const validTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      setFeedbackMessage('⚠️ Please upload a PDF, TXT, or Markdown file.');
      setShowFeedback(true);
      return;
    }
    
    // Analyze the document directly
    await analyzeDocument(file);
  };

  // Handle topic selection
  const handleTopicSelect = (topic: Topic) => {
    setSelectedTopic(topic);
  };

  // Handle assessment type selection
  const handleAssessmentTypeSelect = (type: string) => {
    setAssessmentType(type);
    if (selectedTopic) {
      generateAssessment(selectedTopic, type);
    }
  };

  // Handle module answer submission
  const handleSubmitAnswer = async () => {
    if (!currentModule) return;

    let isCorrect = false;
    let userResponse: any = null;

    if (currentModule.module_type === 'mcq_multi') {
      const correctIds = currentModule.correct_ids.sort();
      const selectedIds = selectedOptions.sort();
      isCorrect = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
      userResponse = selectedOptions;
      
      setFeedbackMessage(isCorrect 
        ? '✓ Correct! Well done!' 
        : `✗ Not quite. The correct answers were: ${currentModule.correct_ids.join(', ')}`);
    } else if (currentModule.module_type === 'short_answer') {
      const keywords = currentModule.keywords_to_check;
      const answer = shortAnswerText.toLowerCase();
      const foundKeywords = keywords.filter(kw => answer.includes(kw.toLowerCase()));
      isCorrect = foundKeywords.length >= Math.ceil(keywords.length * 0.6);
      userResponse = shortAnswerText;
      
      setFeedbackMessage(isCorrect
        ? '✓ Good answer! You covered the key concepts.'
        : `✗ Your answer is missing some key concepts: ${keywords.filter(kw => !foundKeywords.includes(kw)).join(', ')}`);
    } else if (currentModule.module_type === 'flashcard') {
      isCorrect = true; // Flashcards are self-assessment
      userResponse = 'reviewed';
      setFeedbackMessage('Great! Let\'s move on to the next step.');
    }

    setShowFeedback(true);
    
    // Wait a moment before analyzing
    setTimeout(() => {
      analyzeAssessmentResults(isCorrect, userResponse);
    }, 2000);
  };

  // Handle tutor module answer
  const handleTutorModuleAnswer = async () => {
    if (!tutorModules[currentTutorModuleIndex]) return;

    const module = tutorModules[currentTutorModuleIndex];
    let isCorrect = false;
    let correctCount = 0;
    let totalCount = 0;
    let wrongIndices: number[] = [];

    // Check answers based on module type
    if (module.module_type === 'fill_blanks') {
      const fillModule = module as FillBlanks;
      const correctAnswers = fillModule.blanks.map(b => b.toLowerCase().trim());
      const userAnswersLower = fillBlanksAnswers.map(a => (a || '').toLowerCase().trim());
      
      userAnswersLower.forEach((ans, idx) => {
        if (correctAnswers[idx] !== ans) {
          wrongIndices.push(idx);
        }
      });
      
      correctCount = userAnswersLower.filter((ans, idx) => 
        correctAnswers[idx] === ans
      ).length;
      totalCount = correctAnswers.length;
      isCorrect = correctCount === totalCount;
      
    } else if (module.module_type === 'mcq_multi') {
      const mcqModule = module as MCQMulti;
      const correctIds = mcqModule.correct_ids.sort();
      const selectedIds = selectedOptions.sort();
      isCorrect = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
      correctCount = isCorrect ? 1 : 0;
      totalCount = 1;
      
    } else if (module.module_type === 'match_pairs') {
      const matchModule = module as MatchPairs;
      correctCount = 0;
      totalCount = matchModule.correct_pairs.length;
      
      matchModule.correct_pairs.forEach((pair, idx) => {
        const userMatch = matchPairsAnswers.get(pair.a);
        if (userMatch === pair.b) {
          correctCount++;
        } else {
          wrongIndices.push(idx);
        }
      });
      
      isCorrect = correctCount === totalCount;
      
    } else if (module.module_type === 'short_answer') {
      const shortModule = module as ShortAnswer;
      const keywords = shortModule.keywords_to_check;
      const answer = shortAnswerText.toLowerCase();
      const foundKeywords = keywords.filter(kw => answer.includes(kw.toLowerCase()));
      correctCount = foundKeywords.length;
      totalCount = keywords.length;
      isCorrect = correctCount >= Math.ceil(totalCount * 0.6);
      
    } else if (module.module_type === 'flashcard') {
      // Flashcards are always "correct" when user clicks
      isCorrect = true;
      correctCount = 1;
      totalCount = 1;
    }
    
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);
    setWrongAnswers(wrongIndices);
    
    // Update session data
    setCurrentSessionData(prev => ({
      ...prev,
      questionsAttempted: (prev.questionsAttempted || 0) + 1,
      questionsCorrectFirstTry: newAttemptCount === 1 && isCorrect 
        ? (prev.questionsCorrectFirstTry || 0) + 1 
        : (prev.questionsCorrectFirstTry || 0),
      attemptsPerQuestion: [...(prev.attemptsPerQuestion || []), newAttemptCount],
      hintsUsed: (prev.hintsUsed || 0) + (showHint ? 1 : 0),
    }));
    
    if (isCorrect) {
      setUserProgress([...userProgress, { success: true, moduleType: module.module_type }]);
      setFeedbackMessage(`✓ Excellent! You got it ${newAttemptCount === 1 ? 'on the first try' : `after ${newAttemptCount} attempts`}!`);
      setShowFeedback(true);
      setShowHint(false);
      setAttemptCount(0);
      setWrongAnswers([]);
      
      // Track successful module type
      setCurrentSessionData(prev => ({
        ...prev,
        moduleTypesSucceeded: [...(prev.moduleTypesSucceeded || []), module.module_type],
        contentWasUnderstood: true,
      }));
      
      // Save session data to Firebase
      const user = auth.currentUser;
      if (user && selectedTopic && currentSessionData) {
        await saveSessionData({
          userId: user.uid,
          topicId: selectedTopic.id,
          topicName: selectedTopic.name,
          contentLengthProvided: currentSessionData.contentLengthProvided || 0,
          contentWasUnderstood: true,
          questionsAttempted: (currentSessionData.questionsAttempted || 0) + 1,
          questionsCorrectFirstTry: newAttemptCount === 1 
            ? (currentSessionData.questionsCorrectFirstTry || 0) + 1 
            : (currentSessionData.questionsCorrectFirstTry || 0),
          questionsSkipped: currentSessionData.questionsSkipped || [],
          hintsUsed: currentSessionData.hintsUsed || 0,
          attemptsPerQuestion: [...(currentSessionData.attemptsPerQuestion || []), newAttemptCount],
          moduleTypesUsed: currentSessionData.moduleTypesUsed || [],
          moduleTypesSucceeded: [...(currentSessionData.moduleTypesSucceeded || []), module.module_type],
          timeSpentReading: currentSessionData.timeSpentReading || 0,
          timeSpentOnExercises: Math.floor((Date.now() - sessionStartTime) / 1000),
          timestamp: new Date(),
        });
        
        // Reload preferences for next session
        const updatedPrefs = await getLearningPreferences(user.uid);
        setLearningPreferences(updatedPrefs);
      }
      
      // Check if there are more gaps to address
      if (knowledgeGapReport && knowledgeGapReport.gaps.length > 1) {
        setTimeout(() => {
          setShowFeedback(false);
          setFillBlanksAnswers([]);
          setSelectedOptions([]);
          setShortAnswerText('');
          setMatchPairsAnswers(new Map());
          generateLearningPath({
            ...knowledgeGapReport,
            gaps: knowledgeGapReport.gaps.slice(1)
          });
        }, 3000);
      } else {
        setTimeout(() => {
          setFeedbackMessage('🎉 Congratulations! You\'ve completed the learning path for this topic!');
          setShowFeedback(true);
        }, 2000);
      }
    } else {
      setUserProgress([...userProgress, { success: false, moduleType: module.module_type }]);
      
      // Update session with failed attempt
      setCurrentSessionData(prev => ({
        ...prev,
        contentWasUnderstood: false,
      }));
      
      // Generate contextual hint based on attempt count and module type
      if (newAttemptCount === 1) {
        setFeedbackMessage(`✗ ${correctCount} out of ${totalCount} correct. Try again!`);
        setShowFeedback(true);
      } else if (newAttemptCount === 2) {
        // Show hint after 2nd attempt
        setCurrentSessionData(prev => ({
          ...prev,
          hintsUsed: (prev.hintsUsed || 0) + 1,
        }));
        
        let hintMessage = '';
        if (module.module_type === 'fill_blanks') {
          hintMessage = `💡 Hint: ${wrongIndices.length === 1 ? 'The incorrect answer is' : 'The incorrect answers are'} in position${wrongIndices.length > 1 ? 's' : ''}: ${wrongIndices.map(i => i + 1).join(', ')}. Think about the key concepts from the lesson above.`;
        } else if (module.module_type === 'mcq_multi') {
          hintMessage = `💡 Hint: Look carefully at each option. The correct answer(s) directly relate to the key concept explained above.`;
        } else if (module.module_type === 'match_pairs') {
          hintMessage = `💡 Hint: ${wrongIndices.length} pair(s) are incorrect. Focus on the definitions and try to match them with their most logical terms.`;
        } else if (module.module_type === 'short_answer') {
          const shortModule = module as ShortAnswer;
          const missingKeywords = shortModule.keywords_to_check.slice(0, 2);
          hintMessage = `💡 Hint: Your answer should include these concepts: ${missingKeywords.join(', ')}`;
        }
        
        setCurrentHint(hintMessage);
        setShowHint(true);
        setFeedbackMessage(`✗ ${correctCount} out of ${totalCount} correct. Check the hint below!`);
        setShowFeedback(true);
      } else if (newAttemptCount >= 3) {
        // Show stronger hint
        let hintMessage = '';
        if (module.module_type === 'fill_blanks') {
          const fillModule = module as FillBlanks;
          const firstWrongIdx = wrongIndices[0];
          const correctAnswer = fillModule.blanks[firstWrongIdx];
          hintMessage = `💡 Strong Hint: Answer #${firstWrongIdx + 1} should be "${correctAnswer}". Use this to help with the others!`;
        } else if (module.module_type === 'mcq_multi') {
          const mcqModule = module as MCQMulti;
          hintMessage = `💡 Strong Hint: The correct answer ID(s) start with: ${mcqModule.correct_ids[0]}`;
        } else if (module.module_type === 'match_pairs') {
          const matchModule = module as MatchPairs;
          const firstCorrectPair = matchModule.correct_pairs[0];
          hintMessage = `💡 Strong Hint: "${firstCorrectPair.a}" matches with "${firstCorrectPair.b}"`;
        } else if (module.module_type === 'short_answer') {
          const shortModule = module as ShortAnswer;
          hintMessage = `💡 Strong Hint: Make sure to mention: ${shortModule.keywords_to_check.join(', ')}`;
        }
        
        setCurrentHint(hintMessage);
        setShowHint(true);
        setFeedbackMessage(`✗ Still ${correctCount} out of ${totalCount} correct. Here's a stronger hint!`);
        setShowFeedback(true);
      }
      
      // After 4 attempts, offer to show all answers or re-explain
      if (newAttemptCount >= 4) {
        setTimeout(() => {
          const shouldReExplain = confirm('This format seems challenging for you. Would you like me to:\n\nOK = Try a DIFFERENT teaching format (recommended)\nCancel = See answers and continue');
          
          if (shouldReExplain) {
            // Track re-explanation request
            setCurrentSessionData(prev => ({
              ...prev,
              hintsUsed: (prev.hintsUsed || 0) + 1,
            }));
            
            setIsProcessing(true);
            setProcessingMessage('Switching to a different teaching format...');
            
            // Generate a new module with a DIFFERENT format
            if (knowledgeGapReport) {
              generateTutorModule(knowledgeGapReport.gaps[0]).then(() => {
                setAttemptCount(0);
                setShowHint(false);
                setShowFeedback(false);
                setWrongAnswers([]);
                setFillBlanksAnswers([]);
                setSelectedOptions([]);
                setShortAnswerText('');
                setMatchPairsAnswers(new Map());
                setIsProcessing(false);
                setFeedbackMessage('✨ Let\'s try a different approach to learn this concept!');
                setShowFeedback(true);
              });
            }
          } else {
            // Show answers based on module type
            if (module.module_type === 'fill_blanks') {
              setFillBlanksAnswers((module as FillBlanks).blanks);
            } else if (module.module_type === 'mcq_multi') {
              setSelectedOptions((module as MCQMulti).correct_ids);
            } else if (module.module_type === 'match_pairs') {
              const matchModule = module as MatchPairs;
              const correctMap = new Map();
              matchModule.correct_pairs.forEach(pair => correctMap.set(pair.a, pair.b));
              setMatchPairsAnswers(correctMap);
            }
            setFeedbackMessage(`✓ Here are the correct answers. Review them and click "Check Answer" to continue.`);
            setShowFeedback(true);
            setAttemptCount(0);
          }
        }, 1000);
      }
    }
  };

  // Handle skipping a question
  const handleSkipQuestion = async () => {
    if (!tutorModules[currentTutorModuleIndex] || !selectedTopic) return;

    const module = tutorModules[currentTutorModuleIndex] as FillBlanks;
    const user = auth.currentUser;
    
    // Track skipped question
    setCurrentSessionData(prev => ({
      ...prev,
      questionsSkipped: [
        ...(prev.questionsSkipped || []),
        {
          question: module.text,
          concepts: knowledgeGapReport?.gaps.map(g => g.concept) || [],
        },
      ],
    }));
    
    // Move to next gap or finish
    if (knowledgeGapReport && knowledgeGapReport.gaps.length > 1) {
      setFeedbackMessage('⏭️ Question skipped. Let\'s try a different approach...');
      setShowFeedback(true);
      
      setTimeout(() => {
        setShowFeedback(false);
        setFillBlanksAnswers([]);
        setAttemptCount(0);
        setShowHint(false);
        setWrongAnswers([]);
        
        generateLearningPath({
          ...knowledgeGapReport,
          gaps: knowledgeGapReport.gaps.slice(1)
        });
      }, 2000);
    } else {
      setFeedbackMessage('📝 You\'ve completed this session. We\'ll adapt your learning path based on your preferences!');
      setShowFeedback(true);
      
      // Save session even with skipped questions
      if (user && selectedTopic && currentSessionData) {
        await saveSessionData({
          userId: user.uid,
          topicId: selectedTopic.id,
          topicName: selectedTopic.name,
          contentLengthProvided: currentSessionData.contentLengthProvided || 0,
          contentWasUnderstood: false, // Skipped means didn't understand
          questionsAttempted: (currentSessionData.questionsAttempted || 0) + 1,
          questionsCorrectFirstTry: currentSessionData.questionsCorrectFirstTry || 0,
          questionsSkipped: [
            ...(currentSessionData.questionsSkipped || []),
            {
              question: module.text,
              concepts: knowledgeGapReport?.gaps.map(g => g.concept) || [],
            },
          ],
          hintsUsed: currentSessionData.hintsUsed || 0,
          attemptsPerQuestion: currentSessionData.attemptsPerQuestion || [],
          moduleTypesUsed: currentSessionData.moduleTypesUsed || [],
          moduleTypesSucceeded: currentSessionData.moduleTypesSucceeded || [],
          timeSpentReading: currentSessionData.timeSpentReading || 0,
          timeSpentOnExercises: Math.floor((Date.now() - sessionStartTime) / 1000),
          timestamp: new Date(),
        });
        
        // Reload preferences
        const updatedPrefs = await getLearningPreferences(user.uid);
        setLearningPreferences(updatedPrefs);
      }
    }
  };

  // Render math text with KaTeX
  const renderMathText = (text: string) => {
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={index} math={part.slice(2, -2)} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={index} math={part.slice(1, -1)} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Enhanced ReactMarkdown component that handles math
  const MarkdownWithMath = ({ children, components = {} }: { children: string; components?: any }) => {
    // Pre-process to convert LaTeX-style formulas to KaTeX format
    const processedContent = children
      .replace(/\$([^\$]+?)\$/g, (match, formula) => {
        // Return a special marker that we'll replace with KaTeX component
        return `<MATH_INLINE>${formula}</MATH_INLINE>`;
      })
      .replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        return `<MATH_BLOCK>${formula}</MATH_BLOCK>`;
      });

    return (
      <ReactMarkdown
        components={{
          ...components,
          p: ({node, children, ...props}) => {
            // Check if paragraph contains math
            const text = String(children);
            if (text.includes('<MATH_INLINE>') || text.includes('<MATH_BLOCK>')) {
              return <div {...props}>{renderInlineWithMath(text)}</div>;
            }
            const Component = components?.p || 'p';
            return <Component {...props}>{children}</Component>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  const renderInlineWithMath = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    let keyCounter = 0;
    
    // Combined regex to find both inline and block math
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
    let match;
    
    while ((match = mathRegex.exec(text)) !== null) {
      // Add text before math
      if (match.index > currentIndex) {
        const textBefore = text.substring(currentIndex, match.index);
        parts.push(<span key={`text-${keyCounter++}`} dangerouslySetInnerHTML={{ __html: formatText(textBefore) }} />);
      }
      
      // Add math
      const mathContent = match[0];
      if (mathContent.startsWith('$$')) {
        parts.push(<BlockMath key={`math-${keyCounter++}`} math={mathContent.slice(2, -2)} />);
      } else {
        parts.push(<InlineMath key={`math-${keyCounter++}`} math={mathContent.slice(1, -1)} />);
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      parts.push(<span key={`text-${keyCounter++}`} dangerouslySetInnerHTML={{ __html: formatText(remainingText) }} />);
    }
    
    return <>{parts}</>;
  };
  
  // Format text with bold, italic, code
  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-300 font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-blue-300">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-900 px-2 py-0.5 rounded text-purple-300 text-sm">$1</code>');
  };

  // Parse and render interactive learning content
  const renderInteractiveLearningContent = (content: string) => {
    const sections: JSX.Element[] = [];
    let workingContent = content;
    let match;
    
    // Parse CONCEPT_CARD
    const conceptCardRegex = /\[CONCEPT_CARD\]([\s\S]*?)\[\/CONCEPT_CARD\]/g;
    while ((match = conceptCardRegex.exec(content)) !== null) {
      const cardContent = match[1];
      const titleMatch = cardContent.match(/Title:\s*(.+)/);
      const descMatch = cardContent.match(/Description:\s*(.+)/);
      const iconMatch = cardContent.match(/Icon:\s*(.+)/);
      
      sections.push(
        <div key={`card-${match.index}`} className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-2 border-purple-500/50 rounded-xl p-6 mb-6 hover:scale-[1.02] transition-transform">
          <div className="flex items-start gap-4">
            <div className="text-5xl">{iconMatch?.[1].trim() || '📘'}</div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-white mb-2">{titleMatch?.[1].trim() || 'Key Concept'}</h4>
              <p className="text-slate-200 leading-relaxed">{descMatch?.[1].trim()}</p>
            </div>
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(conceptCardRegex, '');
    
    // Parse DIAGRAM
    const diagramRegex = /\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/g;
    while ((match = diagramRegex.exec(content)) !== null) {
      const diagramContent = match[1];
      const typeMatch = diagramContent.match(/Type:\s*(.+)/);
      const descMatch = diagramContent.match(/Description:\s*([\s\S]*?)(?=Steps:|Image:|$)/);
      const stepsMatch = diagramContent.match(/Steps:\s*([\s\S]*?)(?=Image:|$)/);
      const imageMatch = diagramContent.match(/Image:\s*(.+)/);
      
      const type = typeMatch?.[1].trim() || 'process';
      const description = descMatch?.[1].trim() || '';
      const stepsText = stepsMatch?.[1] || '';
      const imageUrl = imageMatch?.[1].trim();
      const steps = stepsText.split('\n').filter(s => s.trim()).map(s => s.replace(/^\d+\.\s*/, '').trim());
      
      sections.push(
        <div key={`diagram-${match.index}`} className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-6 w-6 text-yellow-400" />
            <h5 className="text-xl font-bold text-white capitalize">⚡ Interactive {type}</h5>
          </div>
          <div className="text-slate-300 mb-6 leading-relaxed prose prose-invert max-w-none">
            {renderInlineWithMath(description)}
          </div>
          {imageUrl && (
            <div className="mb-6 rounded-lg overflow-hidden border border-slate-600">
              <img src={imageUrl} alt={type} className="w-full h-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="bg-slate-800/80 px-3 py-2 text-xs text-slate-400">
                Source: <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{new URL(imageUrl).hostname}</a>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {steps.length > 0 ? steps.map((step, idx) => (
              <div key={idx} className="group relative bg-slate-800/50 border-l-4 border-purple-500 rounded-r-lg p-4 hover:bg-slate-700/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600/30 border-2 border-purple-400 flex items-center justify-center font-bold text-purple-300">{idx + 1}</div>
                  <div className="flex-1 text-white prose prose-invert max-w-none">
                    <div className="font-medium group-hover:text-purple-300 transition-colors">
                      {renderInlineWithMath(step)}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {idx < steps.length - 1 && <div className="ml-5 mt-2 h-6 w-0.5 bg-gradient-to-b from-purple-500/50 to-transparent"></div>}
              </div>
            )) : <div className="grid grid-cols-3 gap-4">{['Start', 'Process', 'Result'].map((label, idx) => <div key={idx} className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg p-6 text-center border border-purple-500/30 hover:scale-105 transition-transform cursor-pointer"><div className="text-4xl mb-3">{idx === 0 ? '🎯' : idx === 1 ? '⚡' : '✨'}</div><div className="text-purple-300 font-semibold">{label}</div></div>)}</div>}
          </div>
          <div className="mt-6 flex justify-center">
            <button onClick={() => { setShowSimulation(true); setSimulationTopic(selectedTopic?.name || type); }} className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform shadow-lg hover:shadow-purple-500/50">
              <Play className="h-5 w-5 group-hover:animate-pulse" />Launch Interactive Simulation
            </button>
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(diagramRegex, '');
    
    // Parse EXAMPLE
    const exampleRegex = /\[EXAMPLE\]([\s\S]*?)\[\/EXAMPLE\]/g;
    while ((match = exampleRegex.exec(content)) !== null) {
      const exampleContent = match[1];
      const scenarioMatch = exampleContent.match(/Scenario:\s*([\s\S]*?)(?=Connection:|$)/);
      const connectionMatch = exampleContent.match(/Connection:\s*([\s\S]*?)$/);
      
      sections.push(
        <div key={`example-${match.index}`} className="bg-green-900/20 border-l-4 border-green-500 rounded-r-lg p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🌍</div>
            <div className="flex-1">
              <h5 className="text-lg font-semibold text-green-300 mb-3">Real-World Example</h5>
              <div className="mb-3">
                <strong className="text-green-200">Scenario:</strong>
                <div className="mt-1 text-white">
                  {renderInlineWithMath(scenarioMatch?.[1].trim() || '')}
                </div>
              </div>
              <div>
                <strong className="text-green-200">Connection:</strong>
                <div className="mt-1 text-slate-300">
                  {renderInlineWithMath(connectionMatch?.[1].trim() || '')}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(exampleRegex, '');
    
    // Parse INSIGHT
    const insightRegex = /\[INSIGHT\]([\s\S]*?)\[\/INSIGHT\]/g;
    while ((match = insightRegex.exec(content)) !== null) {
      sections.push(
        <div key={`insight-${match.index}`} className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-4 flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-yellow-400 mt-1 flex-shrink-0" />
          <div className="text-yellow-100 flex-1">
            {renderInlineWithMath(match[1].trim())}
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(insightRegex, '');
    
    // Parse SUMMARY
    const summaryRegex = /\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/g;
    while ((match = summaryRegex.exec(content)) !== null) {
      sections.push(
        <div key={`summary-${match.index}`} className="bg-blue-900/20 border-2 border-blue-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4"><CheckCircle className="h-6 w-6 text-blue-400" /><h5 className="text-xl font-bold text-blue-300">Quick Summary</h5></div>
          <div className="prose prose-invert max-w-none text-slate-200">
            {renderInlineWithMath(match[1])}
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(summaryRegex, '');
    
    // Render remaining content
    if (workingContent.trim()) {
      // Split content by paragraphs and render each with math support
      const paragraphs = workingContent.split(/\n\n+/);
      sections.push(
        <div key="remaining" className="space-y-4">
          {paragraphs.map((para, idx) => {
            if (para.trim().startsWith('#')) {
              // Heading
              const level = para.match(/^#+/)?.[0].length || 1;
              const text = para.replace(/^#+\s*/, '');
              const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
              const className = level === 1 ? 'text-3xl font-bold text-white mb-4 mt-6' :
                               level === 2 ? 'text-2xl font-bold text-white mb-3 mt-6' :
                               'text-xl font-semibold text-white mb-2 mt-4';
              return <HeadingTag key={idx} className={className}>{renderInlineWithMath(text)}</HeadingTag>;
            } else if (para.trim().startsWith('-') || para.trim().startsWith('*')) {
              // List
              const items = para.split('\n').filter(l => l.trim());
              return (
                <ul key={idx} className="list-disc list-inside space-y-2 mb-4 text-slate-200">
                  {items.map((item, i) => (
                    <li key={i} className="ml-4">{renderInlineWithMath(item.replace(/^[-*]\s*/, ''))}</li>
                  ))}
                </ul>
              );
            } else if (para.trim().match(/^\d+\./)) {
              // Numbered list
              const items = para.split('\n').filter(l => l.trim());
              return (
                <ol key={idx} className="list-decimal list-inside space-y-2 mb-4 text-slate-200">
                  {items.map((item, i) => (
                    <li key={i} className="ml-4">{renderInlineWithMath(item.replace(/^\d+\.\s*/, ''))}</li>
                  ))}
                </ol>
              );
            } else if (para.trim().startsWith('>')) {
              // Blockquote
              const text = para.replace(/^>\s*/gm, '');
              return (
                <blockquote key={idx} className="border-l-4 border-purple-500 pl-4 italic text-slate-300 my-4">
                  {renderInlineWithMath(text)}
                </blockquote>
              );
            } else if (para.trim()) {
              // Regular paragraph
              return (
                <p key={idx} className="text-slate-200 mb-4 leading-relaxed">
                  {renderInlineWithMath(para)}
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }
    
    return sections;
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-900 to-blue-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <Brain className="h-6 w-6 text-purple-300" />
            Subject Explorer
          </h2>
          <p className="text-slate-300 text-sm mt-1">Adaptive Multi-Agent Tutoring System</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 mt-20 overflow-y-auto">
        <div className="w-full px-4 md:px-8 lg:px-12">
          {/* Progress Indicator */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${stage === 'upload' ? 'text-purple-400' : 'text-green-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${stage === 'upload' ? 'border-purple-400 bg-purple-400/20' : 'border-green-400 bg-green-400/20'}`}>
                {stage !== 'upload' ? <CheckCircle className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
              </div>
              <span className="font-medium">Upload</span>
            </div>
            
            <ArrowRight className="h-4 w-4 text-slate-500" />
            
            <div className={`flex items-center gap-2 ${stage === 'topic_selection' ? 'text-purple-400' : stage === 'assessment' || stage === 'learning' ? 'text-green-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${stage === 'topic_selection' ? 'border-purple-400 bg-purple-400/20' : stage === 'assessment' || stage === 'learning' ? 'border-green-400 bg-green-400/20' : 'border-slate-500'}`}>
                {stage === 'assessment' || stage === 'learning' ? <CheckCircle className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              </div>
              <span className="font-medium">Topics</span>
            </div>
            
            <ArrowRight className="h-4 w-4 text-slate-500" />
            
            <div className={`flex items-center gap-2 ${stage === 'assessment' ? 'text-purple-400' : stage === 'learning' ? 'text-green-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${stage === 'assessment' ? 'border-purple-400 bg-purple-400/20' : stage === 'learning' ? 'border-green-400 bg-green-400/20' : 'border-slate-500'}`}>
                {stage === 'learning' ? <CheckCircle className="h-5 w-5" /> : <Target className="h-5 w-5" />}
              </div>
              <span className="font-medium">Assess</span>
            </div>
            
            <ArrowRight className="h-4 w-4 text-slate-500" />
            
            <div className={`flex items-center gap-2 ${stage === 'learning' ? 'text-purple-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${stage === 'learning' ? 'border-purple-400 bg-purple-400/20' : 'border-slate-500'}`}>
                <Zap className="h-5 w-5" />
              </div>
              <span className="font-medium">Learn</span>
            </div>
          </div>

          {/* Loading State */}
          {isProcessing && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 mb-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white text-lg font-medium">{processingMessage}</p>
            </div>
          )}

          {/* Feedback Messages */}
          {showFeedback && feedbackMessage && (
            <div className={`mb-6 p-4 rounded-lg border ${
              feedbackMessage.includes('✓') || feedbackMessage.includes('🎉')
                ? 'bg-green-900/20 border-green-500 text-green-200'
                : 'bg-red-900/20 border-red-500 text-red-200'
            }`}>
              <p className="font-medium">{feedbackMessage}</p>
            </div>
          )}

          {/* Stage 1: Upload Document */}
          {stage === 'upload' && !isProcessing && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
              {/* API Key Notice */}
              {!apiKey && (
                <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/40 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-200 font-medium mb-1">💡 Tip: Add Your API Key</p>
                      <p className="text-yellow-300/80 text-sm">
                        For better reliability and to avoid rate limits, add your personal Gemini API key in Settings. 
                        Get a free API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-200">Google AI Studio</a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="text-center mb-6">
                <FileText className="h-16 w-16 text-purple-400 mx-auto mb-4" />
                <h3 className="text-white text-xl font-bold mb-2">Upload Your Study Material</h3>
                <p className="text-slate-400">Upload a document to begin your personalized learning journey</p>
              </div>
              
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-slate-700/50 transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-12 w-12 text-slate-400 mb-3" />
                  <p className="mb-2 text-sm text-slate-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">TXT, PDF, or Markdown files</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.pdf,.md"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {/* Stage 2: Topic Selection */}
          {stage === 'topic_selection' && !isProcessing && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
              <div className="mb-6">
                <h3 className="text-white text-xl font-bold mb-2">Select a Topic to Study</h3>
                <p className="text-slate-400">Choose a topic you'd like to explore from "{documentName}"</p>
                <div className="mt-2 inline-flex items-center gap-2 bg-blue-900/30 border border-blue-500/30 rounded-full px-3 py-1">
                  <Award className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-300 text-sm">Academic Level: {academicLevel}</span>
                </div>
              </div>
              
              {topics.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
                  <h4 className="text-white text-lg font-semibold mb-2">No Topics Found</h4>
                  <p className="text-slate-400 mb-4">
                    We couldn't extract topics from your document. This might be due to an API issue.
                  </p>
                  <button
                    onClick={() => {
                      setStage('upload');
                      setShowApiKeyModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
                  >
                    Try Again with API Key
                  </button>
                </div>
              ) : (
                <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleTopicSelect(topic)}
                    className={`p-6 rounded-lg border-2 text-left transition-all ${
                      selectedTopic?.id === topic.id
                        ? 'border-purple-400 bg-purple-900/30'
                        : 'border-slate-600 bg-slate-700/30 hover:border-purple-400/50'
                    }`}
                  >
                    <h4 className="text-white font-semibold mb-2">{topic.name}</h4>
                    {selectedTopic?.id === topic.id && (
                      <CheckCircle className="h-5 w-5 text-purple-400 mt-2" />
                    )}
                  </button>
                ))}
              </div>

              {selectedTopic && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h4 className="text-white font-semibold mb-4">How would you like to assess your knowledge?</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleAssessmentTypeSelect('quiz')}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/30 hover:border-green-400 hover:bg-green-900/20 transition-all"
                    >
                      <Target className="h-8 w-8 text-green-400 mb-2" />
                      <p className="text-white font-medium">Quick Quiz</p>
                    </button>
                    
                    <button
                      onClick={() => handleAssessmentTypeSelect('flashcards')}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/30 hover:border-blue-400 hover:bg-blue-900/20 transition-all"
                    >
                      <BookOpen className="h-8 w-8 text-blue-400 mb-2" />
                      <p className="text-white font-medium">Flashcards</p>
                    </button>
                    
                    <button
                      onClick={() => handleAssessmentTypeSelect('summary')}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/30 hover:border-yellow-400 hover:bg-yellow-900/20 transition-all"
                    >
                      <Lightbulb className="h-8 w-8 text-yellow-400 mb-2" />
                      <p className="text-white font-medium">Write Summary</p>
                    </button>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          )}

          {/* Stage 3: Assessment */}
          {stage === 'assessment' && currentModule && !isProcessing && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
              <div className="mb-6">
                <h3 className="text-white text-xl font-bold mb-2">Assessment: {selectedTopic?.name}</h3>
                <p className="text-slate-400">Let's check your baseline knowledge</p>
              </div>

              {/* MCQ Multi */}
              {currentModule.module_type === 'mcq_multi' && (
                <div>
                  <h4 className="text-white font-medium mb-4">{currentModule.question}</h4>
                  <div className="space-y-3">
                    {currentModule.options.map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedOptions.includes(option.id)
                            ? 'border-purple-400 bg-purple-900/30'
                            : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(option.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOptions([...selectedOptions, option.id]);
                            } else {
                              setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                            }
                          }}
                          className="mr-3"
                        />
                        <span className="text-white">{option.text}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm mt-3 italic">Select all that apply</p>
                </div>
              )}

              {/* Flashcard */}
              {currentModule.module_type === 'flashcard' && (
                <div className="text-center">
                  <div className="bg-slate-700 rounded-lg p-8 mb-4 min-h-[200px] flex items-center justify-center cursor-pointer"
                    onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                  >
                    <div className="text-white text-lg">
                      {showFlashcardBack ? renderMathText(currentModule.back) : renderMathText(currentModule.front)}
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">Click to flip</p>
                </div>
              )}

              {/* Short Answer */}
              {currentModule.module_type === 'short_answer' && (
                <div>
                  <h4 className="text-white font-medium mb-4">{currentModule.question}</h4>
                  <textarea
                    value={shortAnswerText}
                    onChange={(e) => setShortAnswerText(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-4 text-white min-h-[120px] focus:outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="Type your answer here..."
                  />
                </div>
              )}

              <button
                onClick={handleSubmitAnswer}
                disabled={
                  (currentModule.module_type === 'mcq_multi' && selectedOptions.length === 0) ||
                  (currentModule.module_type === 'short_answer' && shortAnswerText.trim() === '')
                }
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            </div>
          )}

          {/* Stage 4: Learning Path */}
          {stage === 'learning' && !isProcessing && (
            <div className="space-y-6">
              {/* Learning Preferences Dashboard */}
              {learningPreferences && (
                <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-700/50 rounded-lg p-6">
                  <h3 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-indigo-400" />
                    Your Adaptive Learning Profile
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <p className="text-slate-400 mb-1">Content Preference</p>
                      <p className="text-white font-medium capitalize">
                        {learningPreferences.informationLength} Explanations
                      </p>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <p className="text-slate-400 mb-1">Learning Style</p>
                      <p className="text-white font-medium">
                        {learningPreferences.prefersAnalogyExplanations ? '🎯 Analogies & Examples' : '📝 Direct Teaching'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-lg">
                      <p className="text-slate-400 mb-1">Success Rate</p>
                      <p className="text-white font-medium">
                        {learningPreferences.averageAttemptsBeforeSuccess > 0 
                          ? `${(1 / learningPreferences.averageAttemptsBeforeSuccess * 100).toFixed(0)}%`
                          : 'Starting out'}
                      </p>
                    </div>
                  </div>
                  <p className="text-indigo-200 text-xs mt-3">
                    💡 This system adapts to your learning style based on your interactions
                  </p>
                </div>
              )}
              
              {/* Knowledge Gap Report */}
              {knowledgeGapReport && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
                    <Target className="h-6 w-6 text-purple-400" />
                    Your Knowledge Profile
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-red-300 font-semibold mb-2">Areas to Improve:</h4>
                      <ul className="space-y-2">
                        {knowledgeGapReport.gaps.map((gap, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-400 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-white font-medium">{gap.concept}</p>
                              <p className="text-slate-400 text-sm">{gap.description}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-green-300 font-semibold mb-2">Your Strengths:</h4>
                      <ul className="space-y-2">
                        {knowledgeGapReport.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400 mt-1 flex-shrink-0" />
                            <p className="text-white">{strength}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-200 text-sm">
                      <strong>Overall Level:</strong> {knowledgeGapReport.overall_level}
                    </p>
                  </div>
                </div>
              )}

              {/* Interactive Learning Content */}
              {learningContent && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-white text-2xl font-bold flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg">
                        <Lightbulb className="h-6 w-6 text-white" />
                      </div>
                      Interactive Learning Experience
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const highlights = learningContent.match(/\*\*(.*?)\*\*/g)?.map(m => m.replace(/\*\*/g, '')) || [];
                          setConceptHighlights(highlights);
                        }}
                        className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg text-purple-300 text-sm transition-all flex items-center gap-2"
                        title="Highlight key concepts"
                      >
                        <Zap className="h-4 w-4" />
                        Highlights
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-6 bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500"
                      style={{ width: `${(expandedSections.size / 5) * 100}%` }}
                    ></div>
                  </div>
                  
                  {/* Interactive Content Sections */}
                  <div className="space-y-4">
                    {renderInteractiveLearningContent(learningContent)}
                  </div>
                  
                  {/* Key Concepts Highlight */}
                  {conceptHighlights.length > 0 && (
                    <div className="mt-6 bg-purple-900/20 border border-purple-500/30 rounded-lg p-5">
                      <h5 className="text-lg font-semibold text-purple-300 mb-3 flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Key Concepts to Remember
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {conceptHighlights.map((concept, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-purple-600/30 border border-purple-500/50 rounded-full text-purple-200 text-sm"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Personal Notes Section */}
                  <div className="mt-6 bg-slate-800/50 border border-slate-600 rounded-lg p-5">
                    <h5 className="text-lg font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      📝 My Notes
                    </h5>
                    <textarea
                      placeholder="Write your own notes, questions, or insights here..."
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg p-4 text-white min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-slate-400"
                      value={userNotes.get(selectedTopic?.id || '') || ''}
                      onChange={(e) => {
                        const newNotes = new Map(userNotes);
                        newNotes.set(selectedTopic?.id || '', e.target.value);
                        setUserNotes(newNotes);
                      }}
                    />
                  </div>
                  
                  {/* Interactive Actions */}
                  <div className="mt-6 flex gap-3 flex-wrap">
                    <button
                      onClick={() => {
                        const text = learningContent.replace(/\[.*?\]/g, '').replace(/#/g, '');
                        const speech = new SpeechSynthesisUtterance(text.substring(0, 500));
                        window.speechSynthesis.speak(speech);
                      }}
                      className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg text-blue-300 transition-all flex items-center gap-2"
                    >
                      <span className="text-lg">🔊</span>
                      Listen to Content
                    </button>
                    
                    <button
                      onClick={() => {
                        setInteractiveSimulationActive(!interactiveSimulationActive);
                      }}
                      className={`px-4 py-2 border rounded-lg transition-all flex items-center gap-2 ${
                        interactiveSimulationActive
                          ? 'bg-green-600/30 border-green-500/50 text-green-300'
                          : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span className="text-lg">⚡</span>
                      {interactiveSimulationActive ? 'Simulation Active' : 'Try Interactive Demo'}
                    </button>
                    
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(learningContent);
                        setFeedbackMessage('✓ Content copied to clipboard!');
                        setShowFeedback(true);
                        setTimeout(() => setShowFeedback(false), 2000);
                      }}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-lg text-slate-300 transition-all flex items-center gap-2"
                    >
                      <span className="text-lg">📋</span>
                      Copy Content
                    </button>
                  </div>
                  
                  {/* Interactive Simulation Overlay */}
                  {interactiveSimulationActive && (
                    <div className="mt-6 bg-gradient-to-br from-green-900/30 to-blue-900/30 border-2 border-green-500/50 rounded-xl p-6 animate-in">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-xl font-bold text-green-300 flex items-center gap-2">
                          <Zap className="h-6 w-6" />
                          Interactive Simulation
                        </h5>
                        <button
                          onClick={() => setInteractiveSimulationActive(false)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5 text-slate-400" />
                        </button>
                      </div>
                      
                      <div className="bg-slate-900 rounded-lg p-8 border border-slate-600">
                        <div className="text-center space-y-4">
                          <div className="text-6xl mb-4">🧪</div>
                          <p className="text-white text-lg">Visualize the Concept</p>
                          <p className="text-slate-400">
                            {knowledgeGapReport?.gaps[0]?.concept || 'Current Topic'}
                          </p>
                          
                          {/* Simple Interactive Slider Demo */}
                          <div className="mt-6 space-y-3">
                            <label className="block text-slate-300 text-sm">Adjust parameters:</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              className="w-full"
                              onChange={(e) => {
                                // Interactive simulation logic here
                              }}
                            />
                            <div className="grid grid-cols-3 gap-4 mt-4">
                              <div className="bg-slate-800 rounded-lg p-3">
                                <div className="text-blue-400 text-2xl font-bold">+</div>
                                <div className="text-slate-400 text-xs">Increase</div>
                              </div>
                              <div className="bg-slate-800 rounded-lg p-3">
                                <div className="text-purple-400 text-2xl font-bold">⟷</div>
                                <div className="text-slate-400 text-xs">Balance</div>
                              </div>
                              <div className="bg-slate-800 rounded-lg p-3">
                                <div className="text-red-400 text-2xl font-bold">-</div>
                                <div className="text-slate-400 text-xs">Decrease</div>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-slate-500 text-sm mt-4">
                            💡 Experiment with the controls to see how concepts interact
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Learning Module */}
              {tutorModules.length > 0 && tutorModules[currentTutorModuleIndex] && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <h3 className="text-white text-xl font-bold mb-4">Practice Exercise</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Format: <span className="text-purple-400 font-medium capitalize">
                      {tutorModules[currentTutorModuleIndex].module_type.replace('_', ' ')}
                    </span>
                  </p>
                  
                  {/* Fill in the Blanks */}
                  {tutorModules[currentTutorModuleIndex].module_type === 'fill_blanks' && (
                    <div>
                      <p className="text-white mb-4 leading-relaxed">
                        {(tutorModules[currentTutorModuleIndex] as FillBlanks).text.split('[____]').map((part, idx, arr) => (
                          <React.Fragment key={idx}>
                            {part}
                            {idx < arr.length - 1 && (
                              <input
                                type="text"
                                value={fillBlanksAnswers[idx] || ''}
                                onChange={(e) => {
                                  const newAnswers = [...fillBlanksAnswers];
                                  newAnswers[idx] = e.target.value;
                                  setFillBlanksAnswers(newAnswers);
                                }}
                                className={`mx-2 px-3 py-1 bg-slate-700 border rounded text-white focus:outline-none focus:ring-2 transition-all ${
                                  wrongAnswers.includes(idx)
                                    ? 'border-red-500 focus:ring-red-400 animate-shake'
                                    : fillBlanksAnswers[idx] && attemptCount > 0 && !wrongAnswers.includes(idx)
                                    ? 'border-green-500 focus:ring-green-400'
                                    : 'border-slate-600 focus:ring-purple-400'
                                }`}
                                placeholder="___"
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </p>
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {tutorModules[currentTutorModuleIndex].module_type === 'mcq_multi' && (
                    <div>
                      <h4 className="text-white font-medium mb-4">
                        {(tutorModules[currentTutorModuleIndex] as MCQMulti).question}
                      </h4>
                      <div className="space-y-3">
                        {(tutorModules[currentTutorModuleIndex] as MCQMulti).options.map((option) => (
                          <label
                            key={option.id}
                            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedOptions.includes(option.id)
                                ? 'bg-purple-900/30 border-purple-500'
                                : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedOptions.includes(option.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOptions([...selectedOptions, option.id]);
                                } else {
                                  setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                                }
                              }}
                              className="w-5 h-5"
                            />
                            <span className="text-white">{option.text}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-slate-400 text-sm mt-2">Select all that apply</p>
                    </div>
                  )}

                  {/* Match Pairs */}
                  {tutorModules[currentTutorModuleIndex].module_type === 'match_pairs' && (
                    <div>
                      <p className="text-white mb-4">
                        {(tutorModules[currentTutorModuleIndex] as MatchPairs).prompt}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-slate-400 text-sm font-semibold mb-2">Column A</h5>
                          <div className="space-y-2">
                            {(tutorModules[currentTutorModuleIndex] as MatchPairs).column_a.map((item, idx) => (
                              <div key={idx} className="bg-slate-700 p-3 rounded-lg">
                                <p className="text-white text-sm">{item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-slate-400 text-sm font-semibold mb-2">Column B</h5>
                          <div className="space-y-2">
                            {(tutorModules[currentTutorModuleIndex] as MatchPairs).column_b.map((item, idx) => (
                              <select
                                key={idx}
                                value={Array.from(matchPairsAnswers.entries()).find(([k, v]) => v === item)?.[0] || ''}
                                onChange={(e) => {
                                  const newMap = new Map(matchPairsAnswers);
                                  // Remove previous mapping to this item
                                  Array.from(newMap.entries()).forEach(([k, v]) => {
                                    if (v === item) newMap.delete(k);
                                  });
                                  // Add new mapping
                                  if (e.target.value) {
                                    newMap.set(e.target.value, item);
                                  }
                                  setMatchPairsAnswers(newMap);
                                }}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                              >
                                <option value="">Select match...</option>
                                {(tutorModules[currentTutorModuleIndex] as MatchPairs).column_a.map((aItem, aIdx) => (
                                  <option key={aIdx} value={aItem}>{aItem}</option>
                                ))}
                              </select>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Short Answer */}
                  {tutorModules[currentTutorModuleIndex].module_type === 'short_answer' && (
                    <div>
                      <h4 className="text-white font-medium mb-4">
                        {(tutorModules[currentTutorModuleIndex] as ShortAnswer).question}
                      </h4>
                      <textarea
                        value={shortAnswerText}
                        onChange={(e) => setShortAnswerText(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg p-4 text-white min-h-[120px] focus:outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="Type your answer here..."
                      />
                      <p className="text-slate-400 text-sm mt-2">
                        Expected concepts: {(tutorModules[currentTutorModuleIndex] as ShortAnswer).keywords_to_check.join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Flashcard */}
                  {tutorModules[currentTutorModuleIndex].module_type === 'flashcard' && (
                    <div>
                      <div
                        onClick={() => setShowFlashcardBack(!showFlashcardBack)}
                        className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-2 border-purple-500/50 rounded-xl p-8 min-h-[200px] cursor-pointer hover:scale-105 transition-transform flex items-center justify-center"
                      >
                        <div className="text-center">
                          <p className="text-white text-lg">
                            {showFlashcardBack 
                              ? (tutorModules[currentTutorModuleIndex] as Flashcard).back
                              : (tutorModules[currentTutorModuleIndex] as Flashcard).front}
                          </p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm text-center mt-2">
                        {showFlashcardBack ? 'Click to see question' : 'Click to see answer'}
                      </p>
                    </div>
                  )}
                      
                  {/* Hint Display */}
                  {showHint && currentHint && (
                    <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                      <p className="text-yellow-200 text-sm">{currentHint}</p>
                    </div>
                  )}
                  
                  {/* Feedback Message */}
                  {showFeedback && feedbackMessage && (
                    <div className={`mt-4 p-4 rounded-lg ${
                      feedbackMessage.startsWith('✓') || feedbackMessage.startsWith('🎉') || feedbackMessage.startsWith('✨')
                        ? 'bg-green-900/30 border border-green-600/50'
                        : feedbackMessage.startsWith('⏭️')
                        ? 'bg-blue-900/30 border border-blue-600/50'
                        : 'bg-red-900/30 border border-red-600/50'
                    }`}>
                      <p className={
                        feedbackMessage.startsWith('✓') || feedbackMessage.startsWith('🎉') || feedbackMessage.startsWith('✨')
                          ? 'text-green-200' 
                          : feedbackMessage.startsWith('⏭️')
                          ? 'text-blue-200'
                          : 'text-red-200'
                      }>
                        {feedbackMessage}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleTutorModuleAnswer}
                      disabled={
                        (tutorModules[currentTutorModuleIndex].module_type === 'mcq_multi' && selectedOptions.length === 0) ||
                        (tutorModules[currentTutorModuleIndex].module_type === 'short_answer' && shortAnswerText.trim() === '') ||
                        (tutorModules[currentTutorModuleIndex].module_type === 'match_pairs' && matchPairsAnswers.size === 0)
                      }
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
                    >
                      Check Answer
                    </button>
                    
                    <button
                      onClick={handleSkipQuestion}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg font-medium transition-all border border-slate-600 hover:border-slate-500"
                      title="Skip this question and try a different learning approach"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Tracker */}
              {userProgress.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
                  <h3 className="text-white text-lg font-bold mb-4">Your Progress</h3>
                  <div className="flex gap-2">
                    {userProgress.map((progress, idx) => (
                      <div
                        key={idx}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          progress.success ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        {progress.success ? <CheckCircle className="h-5 w-5 text-white" /> : <XCircle className="h-5 w-5 text-white" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* API Key Required Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-800 border-2 border-yellow-500/50 rounded-xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-yellow-400" />
              </div>
              <h3 className="text-white text-2xl font-bold mb-2">API Key Required</h3>
              <p className="text-slate-300">
                To use the Subject Explorer, please add your Gemini API key in Settings.
              </p>
            </div>

            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mb-6">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                How to get a free API key:
              </h4>
              <ol className="text-slate-300 text-sm space-y-2 list-decimal list-inside">
                <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a></li>
                <li>Sign in with your Google account</li>
                <li>Click "Create API Key"</li>
                <li>Copy the key and paste it in Settings (⚙️)</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-4 py-3 rounded-lg font-medium transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowApiKeyModal(false);
                  onClose();
                }}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-3 rounded-lg font-medium transition-all"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectExplorer;
