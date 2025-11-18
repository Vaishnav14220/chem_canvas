import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export interface LearningPreferences {
  userId: string;
  
  // Content preferences
  informationLength: 'brief' | 'moderate' | 'detailed'; // Brief (1-2 paragraphs), Moderate (3-5), Detailed (6+)
  preferredContentTypes: string[]; // ['visual', 'text', 'interactive', 'examples']
  
  // Interaction preferences
  preferredModuleTypes: string[]; // ['fill_blanks', 'mcq_multi', 'flashcard', 'short_answer', 'match_pairs']
  difficultyPreference: 'incremental' | 'challenging' | 'adaptive';
  
  // Learning patterns
  averageAttemptsBeforeSuccess: number;
  topicsStruggledWith: string[];
  topicsExcelledAt: string[];
  skippedQuestions: Array<{
    topic: string;
    question: string;
    timestamp: Date;
  }>;
  
  // Engagement metrics
  averageReadingTime: number; // in seconds
  completionRate: number; // percentage
  hintsRequested: number;
  reExplanationsRequested: number;
  
  // Adaptive settings
  needsMoreExamples: boolean;
  prefersAnalogyExplanations: boolean;
  respondsWellToVisuals: boolean;
  
  // Metadata
  lastUpdated: Date;
  sessionsCount: number;
}

export interface SessionData {
  userId: string;
  topicId: string;
  topicName: string;
  
  // Session metrics
  contentLengthProvided: number; // word count
  contentWasUnderstood: boolean; // based on quiz performance
  
  questionsAttempted: number;
  questionsCorrectFirstTry: number;
  questionsSkipped: Array<{
    question: string;
    concepts: string[];
  }>;
  
  hintsUsed: number;
  attemptsPerQuestion: number[];
  
  moduleTypesUsed: string[];
  moduleTypesSucceeded: string[];
  
  timeSpentReading: number; // seconds
  timeSpentOnExercises: number; // seconds
  
  timestamp: Date;
}

// Initialize default preferences for new users
export const getDefaultPreferences = (userId: string): LearningPreferences => ({
  userId,
  informationLength: 'moderate',
  preferredContentTypes: ['text', 'examples'],
  preferredModuleTypes: ['fill_blanks', 'mcq_multi'],
  difficultyPreference: 'adaptive',
  averageAttemptsBeforeSuccess: 0,
  topicsStruggledWith: [],
  topicsExcelledAt: [],
  skippedQuestions: [],
  averageReadingTime: 0,
  completionRate: 0,
  hintsRequested: 0,
  reExplanationsRequested: 0,
  needsMoreExamples: false,
  prefersAnalogyExplanations: false,
  respondsWellToVisuals: false,
  lastUpdated: new Date(),
  sessionsCount: 0,
});

// Get user learning preferences
export const getLearningPreferences = async (userId: string): Promise<LearningPreferences> => {
  try {
    const docRef = doc(db, 'learningPreferences', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        skippedQuestions: data.skippedQuestions?.map((q: any) => ({
          ...q,
          timestamp: q.timestamp?.toDate() || new Date(),
        })) || [],
      } as LearningPreferences;
    } else {
      // Create default preferences
      const defaultPrefs = getDefaultPreferences(userId);
      await setDoc(docRef, {
        ...defaultPrefs,
        lastUpdated: serverTimestamp(),
      });
      return defaultPrefs;
    }
  } catch (error) {
    console.error('Error getting learning preferences:', error);
    return getDefaultPreferences(userId);
  }
};

// Update learning preferences based on session data
export const updateLearningPreferences = async (
  userId: string,
  sessionData: SessionData
): Promise<void> => {
  try {
    const docRef = doc(db, 'learningPreferences', userId);
    const currentPrefs = await getLearningPreferences(userId);
    
    // Analyze information length preference
    let informationLength = currentPrefs.informationLength;
    if (!sessionData.contentWasUnderstood && sessionData.contentLengthProvided > 500) {
      // User struggled with long content - prefer shorter chunks
      informationLength = currentPrefs.informationLength === 'detailed' ? 'moderate' : 'brief';
    } else if (sessionData.contentWasUnderstood && sessionData.contentLengthProvided < 200) {
      // User succeeded with brief content but might handle more
      if (currentPrefs.informationLength === 'brief' && currentPrefs.sessionsCount > 3) {
        informationLength = 'moderate';
      }
    }
    
    // Analyze preferred module types
    const successfulModules = sessionData.moduleTypesSucceeded;
    const preferredModuleTypes = Array.from(
      new Set([...currentPrefs.preferredModuleTypes, ...successfulModules])
    ).slice(0, 3); // Keep top 3
    
    // Track topics struggled with
    const topicsStruggledWith = currentPrefs.topicsStruggledWith;
    if (sessionData.questionsCorrectFirstTry / sessionData.questionsAttempted < 0.5) {
      if (!topicsStruggledWith.includes(sessionData.topicName)) {
        topicsStruggledWith.push(sessionData.topicName);
      }
    }
    
    // Track topics excelled at
    const topicsExcelledAt = currentPrefs.topicsExcelledAt;
    if (sessionData.questionsCorrectFirstTry / sessionData.questionsAttempted >= 0.8) {
      if (!topicsExcelledAt.includes(sessionData.topicName)) {
        topicsExcelledAt.push(sessionData.topicName);
      }
    }
    
    // Update skipped questions
    const skippedQuestions = [
      ...currentPrefs.skippedQuestions,
      ...sessionData.questionsSkipped.map(q => ({
        topic: sessionData.topicName,
        question: q.question,
        timestamp: new Date(),
      })),
    ];
    
    // Calculate averages
    const totalSessions = currentPrefs.sessionsCount + 1;
    const averageAttemptsBeforeSuccess = 
      (currentPrefs.averageAttemptsBeforeSuccess * currentPrefs.sessionsCount +
        sessionData.attemptsPerQuestion.reduce((a, b) => a + b, 0) / sessionData.attemptsPerQuestion.length) /
      totalSessions;
    
    const averageReadingTime = 
      (currentPrefs.averageReadingTime * currentPrefs.sessionsCount + sessionData.timeSpentReading) /
      totalSessions;
    
    // Determine adaptive settings
    const needsMoreExamples = sessionData.hintsUsed > 2 || sessionData.attemptsPerQuestion.some(a => a > 3);
    const prefersAnalogyExplanations = sessionData.hintsUsed > 1 && !sessionData.contentWasUnderstood;
    
    // Update preferences
    await updateDoc(docRef, {
      informationLength,
      preferredModuleTypes,
      topicsStruggledWith,
      topicsExcelledAt,
      skippedQuestions: skippedQuestions.slice(-20), // Keep last 20
      averageAttemptsBeforeSuccess,
      averageReadingTime,
      hintsRequested: currentPrefs.hintsRequested + sessionData.hintsUsed,
      needsMoreExamples,
      prefersAnalogyExplanations,
      lastUpdated: serverTimestamp(),
      sessionsCount: totalSessions,
    });
  } catch (error) {
    console.error('Error updating learning preferences:', error);
  }
};

// Save session data
export const saveSessionData = async (sessionData: SessionData): Promise<void> => {
  try {
    const sessionRef = doc(db, 'learningSessions', `${sessionData.userId}_${Date.now()}`);
    await setDoc(sessionRef, {
      ...sessionData,
      timestamp: serverTimestamp(),
    });
    
    // Update preferences based on this session
    await updateLearningPreferences(sessionData.userId, sessionData);
  } catch (error) {
    console.error('Error saving session data:', error);
  }
};

// Get adaptive prompts based on preferences
export const getAdaptivePrompts = (preferences: LearningPreferences) => {
  const contentLengthGuideline = {
    brief: 'Keep explanations concise (1-2 short paragraphs, max 150 words). Use bullet points.',
    moderate: 'Provide balanced explanations (3-4 paragraphs, around 300 words). Include examples.',
    detailed: 'Give comprehensive explanations (5-7 paragraphs, 500+ words). Include multiple examples and edge cases.',
  }[preferences.informationLength];
  
  const styleGuidelines: string[] = [];
  
  if (preferences.prefersAnalogyExplanations) {
    styleGuidelines.push('Use real-world analogies and relatable examples');
  }
  
  if (preferences.needsMoreExamples) {
    styleGuidelines.push('Provide 2-3 concrete examples for each concept');
  }
  
  if (preferences.respondsWellToVisuals) {
    styleGuidelines.push('Describe visual representations and diagrams in detail');
  }
  
  if (preferences.topicsStruggledWith.length > 0) {
    styleGuidelines.push(`Be extra careful with these topics: ${preferences.topicsStruggledWith.slice(-3).join(', ')}`);
  }
  
  const moduleTypePreference = preferences.preferredModuleTypes.length > 0
    ? `Prefer these interactive types: ${preferences.preferredModuleTypes.join(', ')}`
    : '';
  
  return {
    contentLengthGuideline,
    styleGuidelines: styleGuidelines.join('. '),
    moduleTypePreference,
  };
};
