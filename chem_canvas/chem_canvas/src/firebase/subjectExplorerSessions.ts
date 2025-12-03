import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './config';

export interface SubjectExplorerSessionRecord {
  id: string;
  documentId: string;
  documentName: string;
  documentContent: string;
  stage: string;
  academicLevel?: string;
  topics?: any[];
  selectedTopic?: any | null;
  assessmentType?: string | null;
  currentModule?: any | null;
  knowledgeGapReport?: any | null;
  learningContent?: string;
  lessonBites?: any[];
  sessionSummaryPlan?: any | null;
  currentBiteIndex?: number;
  biteChoiceResponses?: Record<string, number>;
  biteTextInputs?: Record<string, string>;
  biteTextSubmissions?: Record<string, string>;
  completedBites?: string[];
  xpScore?: number;
  streakCount?: number;
  hearts?: number;
  tutorModules?: any[];
  currentTutorModuleIndex?: number;
  quickChecks?: any[];
  learningSections?: any[];
  journeySummary?: any | null;
  currentLearningStep?: number;
  completedLearningSteps?: number[];
  quizResponses?: Record<string, number>;
  userProgress?: Array<{ success: boolean; moduleType: string }>;
  conceptHighlights?: string[];
  userNotes?: Array<{ topicId: string; note: string }>;
  fillBlanksAnswers?: string[];
  selectedOptions?: string[];
  shortAnswerText?: string;
  matchPairsAnswers?: Array<[string, string]>;
  attemptCount?: number;
  showHint?: boolean;
  currentHint?: string;
  wrongAnswers?: number[];
  biteFeedback?: string | null;
  sessionStartTime?: number;
  readingStartTime?: number;
  currentSessionData?: any;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export type SubjectExplorerSessionPayload = Omit<SubjectExplorerSessionRecord, 'id' | 'createdAt' | 'updatedAt'>;

const sessionsCollection = (userId: string) => collection(db, 'subjectExplorerSessions', userId, 'sessions');

export const saveSubjectExplorerSession = async (
  userId: string,
  sessionId: string,
  payload: SubjectExplorerSessionPayload
): Promise<void> => {
  const sessionRef = doc(sessionsCollection(userId), sessionId);
  const base: Record<string, unknown> = {
    ...payload,
    updatedAt: serverTimestamp(),
  };

  const snapshot = await getDoc(sessionRef);
  if (!snapshot.exists()) {
    base.createdAt = serverTimestamp();
  }

  await setDoc(sessionRef, base, { merge: true });
};

export const getSubjectExplorerSessions = async (userId: string): Promise<SubjectExplorerSessionRecord[]> => {
  const sessionsQuery = query(sessionsCollection(userId), orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(sessionsQuery);

  return snapshot.docs.map(docSnap => {
    const data = docSnap.data() as Record<string, any>;
    return {
      id: docSnap.id,
      documentId: data.documentId ?? '',
      documentName: data.documentName ?? 'Untitled Document',
      documentContent: data.documentContent ?? '',
      stage: data.stage ?? 'upload',
      academicLevel: data.academicLevel ?? '',
      topics: data.topics ?? [],
      selectedTopic: data.selectedTopic ?? null,
      assessmentType: data.assessmentType ?? null,
      currentModule: data.currentModule ?? null,
      knowledgeGapReport: data.knowledgeGapReport ?? null,
      learningContent: data.learningContent ?? '',
      lessonBites: data.lessonBites ?? [],
      sessionSummaryPlan: data.sessionSummaryPlan ?? null,
      currentBiteIndex: data.currentBiteIndex ?? 0,
      biteChoiceResponses: data.biteChoiceResponses ?? {},
      biteTextInputs: data.biteTextInputs ?? {},
      biteTextSubmissions: data.biteTextSubmissions ?? {},
      completedBites: data.completedBites ?? [],
      xpScore: data.xpScore ?? 0,
      streakCount: data.streakCount ?? 0,
      hearts: data.hearts ?? 5,
      tutorModules: data.tutorModules ?? [],
      currentTutorModuleIndex: data.currentTutorModuleIndex ?? 0,
      quickChecks: data.quickChecks ?? [],
      learningSections: data.learningSections ?? [],
      journeySummary: data.journeySummary ?? null,
      currentLearningStep: data.currentLearningStep ?? 0,
      completedLearningSteps: data.completedLearningSteps ?? [],
      quizResponses: data.quizResponses ?? {},
      userProgress: data.userProgress ?? [],
      conceptHighlights: data.conceptHighlights ?? [],
      userNotes: data.userNotes ?? [],
      fillBlanksAnswers: data.fillBlanksAnswers ?? [],
      selectedOptions: data.selectedOptions ?? [],
      shortAnswerText: data.shortAnswerText ?? '',
      matchPairsAnswers: data.matchPairsAnswers ?? [],
      attemptCount: data.attemptCount ?? 0,
      showHint: data.showHint ?? false,
      currentHint: data.currentHint ?? '',
      wrongAnswers: data.wrongAnswers ?? [],
      biteFeedback: data.biteFeedback ?? null,
      sessionStartTime: data.sessionStartTime ?? null,
      readingStartTime: data.readingStartTime ?? null,
      currentSessionData: data.currentSessionData ?? null,
      createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : null,
      updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate() : null,
    } satisfies SubjectExplorerSessionRecord;
  });
};

export const getSubjectExplorerSession = async (
  userId: string,
  sessionId: string
): Promise<SubjectExplorerSessionRecord | null> => {
  const sessionRef = doc(sessionsCollection(userId), sessionId);
  const snapshot = await getDoc(sessionRef);
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Record<string, any>;
  return {
    id: snapshot.id,
    documentId: data.documentId ?? '',
    documentName: data.documentName ?? 'Untitled Document',
    documentContent: data.documentContent ?? '',
    stage: data.stage ?? 'upload',
    academicLevel: data.academicLevel ?? '',
    topics: data.topics ?? [],
    selectedTopic: data.selectedTopic ?? null,
    assessmentType: data.assessmentType ?? null,
    currentModule: data.currentModule ?? null,
    knowledgeGapReport: data.knowledgeGapReport ?? null,
    learningContent: data.learningContent ?? '',
    lessonBites: data.lessonBites ?? [],
    sessionSummaryPlan: data.sessionSummaryPlan ?? null,
    currentBiteIndex: data.currentBiteIndex ?? 0,
    biteChoiceResponses: data.biteChoiceResponses ?? {},
    biteTextInputs: data.biteTextInputs ?? {},
    biteTextSubmissions: data.biteTextSubmissions ?? {},
    completedBites: data.completedBites ?? [],
    xpScore: data.xpScore ?? 0,
    streakCount: data.streakCount ?? 0,
    hearts: data.hearts ?? 5,
    tutorModules: data.tutorModules ?? [],
    currentTutorModuleIndex: data.currentTutorModuleIndex ?? 0,
    quickChecks: data.quickChecks ?? [],
    learningSections: data.learningSections ?? [],
    journeySummary: data.journeySummary ?? null,
    currentLearningStep: data.currentLearningStep ?? 0,
    completedLearningSteps: data.completedLearningSteps ?? [],
    quizResponses: data.quizResponses ?? {},
    userProgress: data.userProgress ?? [],
    conceptHighlights: data.conceptHighlights ?? [],
    userNotes: data.userNotes ?? [],
    fillBlanksAnswers: data.fillBlanksAnswers ?? [],
    selectedOptions: data.selectedOptions ?? [],
    shortAnswerText: data.shortAnswerText ?? '',
    matchPairsAnswers: data.matchPairsAnswers ?? [],
    attemptCount: data.attemptCount ?? 0,
    showHint: data.showHint ?? false,
    currentHint: data.currentHint ?? '',
    wrongAnswers: data.wrongAnswers ?? [],
    biteFeedback: data.biteFeedback ?? null,
    sessionStartTime: data.sessionStartTime ?? null,
    readingStartTime: data.readingStartTime ?? null,
    currentSessionData: data.currentSessionData ?? null,
    createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : null,
    updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate() : null,
  } satisfies SubjectExplorerSessionRecord;
};

export const deleteSubjectExplorerSession = async (userId: string, sessionId: string): Promise<void> => {
  const sessionRef = doc(sessionsCollection(userId), sessionId);
  await deleteDoc(sessionRef);
};
