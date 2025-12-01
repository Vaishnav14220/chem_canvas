// Study Service - Manages study materials (flashcards, notes, quizzes)
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type {
  StudyMaterial,
  CreateStudyMaterial,
  UpdateStudyMaterial,
  SpaceRepetitionData,
} from '../../types/database';

// ============================================
// STUDY MATERIALS
// ============================================

/**
 * Get all study materials for current user
 */
export const getStudyMaterials = async (
  options: {
    type?: StudyMaterial['type'];
    subject?: string;
    topic?: string;
    limit?: number;
    orderByField?: 'createdAt' | 'updatedAt' | 'masteryLevel' | 'lastReviewed';
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<StudyMaterial[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    type,
    subject,
    limit: limitCount = 100,
    orderByField = 'updatedAt',
    orderDirection = 'desc',
  } = options;

  try {
    const materialsRef = collection(db, 'users', uid, 'studyMaterials');
    let q = query(
      materialsRef,
      orderBy(orderByField, orderDirection),
      limit(limitCount)
    );

    if (type) {
      q = query(
        materialsRef,
        where('type', '==', type),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    if (subject) {
      q = query(
        materialsRef,
        where('subject', '==', subject),
        orderBy(orderByField, orderDirection),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as StudyMaterial[];
  } catch (error) {
    console.error('Error getting study materials:', error);
    throw error;
  }
};

/**
 * Get a single study material by ID
 */
export const getStudyMaterial = async (materialId: string): Promise<StudyMaterial | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'studyMaterials', materialId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as StudyMaterial;
    }
    return null;
  } catch (error) {
    console.error('Error getting study material:', error);
    throw error;
  }
};

/**
 * Create a new study material
 */
export const createStudyMaterial = async (
  material: CreateStudyMaterial
): Promise<StudyMaterial> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const materialsRef = collection(db, 'users', uid, 'studyMaterials');
    const now = serverTimestamp();

    const docRef = await addDoc(materialsRef, {
      ...material,
      masteryLevel: material.masteryLevel || 0,
      tags: material.tags || [],
      createdAt: now,
      updatedAt: now,
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as StudyMaterial;
  } catch (error) {
    console.error('Error creating study material:', error);
    throw error;
  }
};

/**
 * Update a study material
 */
export const updateStudyMaterial = async (
  materialId: string,
  updates: UpdateStudyMaterial
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'studyMaterials', materialId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating study material:', error);
    throw error;
  }
};

/**
 * Delete a study material
 */
export const deleteStudyMaterial = async (materialId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'studyMaterials', materialId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting study material:', error);
    throw error;
  }
};

// ============================================
// FLASHCARDS
// ============================================

/**
 * Create a flashcard
 */
export const createFlashcard = async (params: {
  title: string;
  front: string;
  back: string;
  subject?: string;
  topic?: string;
  tags?: string[];
}): Promise<StudyMaterial> => {
  return createStudyMaterial({
    type: 'flashcard',
    title: params.title,
    content: {
      front: params.front,
      back: params.back,
    },
    subject: params.subject,
    topic: params.topic,
    tags: params.tags || [],
    masteryLevel: 0,
  });
};

/**
 * Get all flashcards
 */
export const getFlashcards = async (
  options: { subject?: string; topic?: string } = {}
): Promise<StudyMaterial[]> => {
  return getStudyMaterials({ type: 'flashcard', ...options });
};

/**
 * Get flashcards due for review (spaced repetition)
 */
export const getDueFlashcards = async (): Promise<StudyMaterial[]> => {
  const flashcards = await getFlashcards();
  const now = Timestamp.now();

  return flashcards.filter(card => {
    if (!card.spaceRepetition?.nextReview) return true; // Never reviewed
    return card.spaceRepetition.nextReview.toMillis() <= now.toMillis();
  });
};

// ============================================
// SPACED REPETITION
// ============================================

/**
 * Record review result and update spaced repetition data
 * Uses SM-2 algorithm variant
 */
export const recordReview = async (
  materialId: string,
  quality: 0 | 1 | 2 | 3 | 4 | 5 // 0 = complete failure, 5 = perfect
): Promise<void> => {
  const material = await getStudyMaterial(materialId);
  if (!material) throw new Error('Material not found');

  const sr = material.spaceRepetition || {
    nextReview: Timestamp.now(),
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
  };

  let { interval, easeFactor, repetitions } = sr;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    // Incorrect response
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate next review date
  const nextReview = Timestamp.fromMillis(
    Date.now() + interval * 24 * 60 * 60 * 1000
  );

  // Update mastery level (0-100)
  const masteryLevel = Math.min(100, Math.round((quality / 5) * 20 + (material.masteryLevel || 0) * 0.8));

  await updateStudyMaterial(materialId, {
    lastReviewed: Timestamp.now(),
    masteryLevel,
    spaceRepetition: {
      nextReview,
      interval,
      easeFactor,
      repetitions,
    },
  });
};

// ============================================
// NOTES
// ============================================

/**
 * Create a note
 */
export const createNote = async (params: {
  title: string;
  text: string;
  subject?: string;
  topic?: string;
  tags?: string[];
}): Promise<StudyMaterial> => {
  return createStudyMaterial({
    type: 'note',
    title: params.title,
    content: {
      text: params.text,
    },
    subject: params.subject,
    topic: params.topic,
    tags: params.tags || [],
    masteryLevel: 0,
  });
};

/**
 * Get all notes
 */
export const getNotes = async (
  options: { subject?: string; topic?: string } = {}
): Promise<StudyMaterial[]> => {
  return getStudyMaterials({ type: 'note', ...options });
};

// ============================================
// QUIZZES
// ============================================

/**
 * Create a quiz
 */
export const createQuiz = async (params: {
  title: string;
  questions: StudyMaterial['content']['questions'];
  subject?: string;
  topic?: string;
  tags?: string[];
}): Promise<StudyMaterial> => {
  return createStudyMaterial({
    type: 'quiz',
    title: params.title,
    content: {
      questions: params.questions,
    },
    subject: params.subject,
    topic: params.topic,
    tags: params.tags || [],
    masteryLevel: 0,
  });
};

/**
 * Get all quizzes
 */
export const getQuizzes = async (
  options: { subject?: string; topic?: string } = {}
): Promise<StudyMaterial[]> => {
  return getStudyMaterials({ type: 'quiz', ...options });
};

/**
 * Record quiz attempt
 */
export const recordQuizAttempt = async (
  materialId: string,
  score: number, // 0-100
  answers: Record<string, string | string[]>
): Promise<void> => {
  const material = await getStudyMaterial(materialId);
  if (!material) throw new Error('Material not found');

  // Update mastery based on score
  const currentMastery = material.masteryLevel || 0;
  const newMastery = Math.round((currentMastery * 0.7) + (score * 0.3));

  await updateStudyMaterial(materialId, {
    lastReviewed: Timestamp.now(),
    masteryLevel: newMastery,
  });
};

// ============================================
// SUMMARIES
// ============================================

/**
 * Create a summary
 */
export const createSummary = async (params: {
  title: string;
  summary: string;
  keyPoints: string[];
  subject?: string;
  topic?: string;
  tags?: string[];
}): Promise<StudyMaterial> => {
  return createStudyMaterial({
    type: 'summary',
    title: params.title,
    content: {
      summary: params.summary,
      keyPoints: params.keyPoints,
    },
    subject: params.subject,
    topic: params.topic,
    tags: params.tags || [],
    masteryLevel: 0,
  });
};

/**
 * Get all summaries
 */
export const getSummaries = async (
  options: { subject?: string; topic?: string } = {}
): Promise<StudyMaterial[]> => {
  return getStudyMaterials({ type: 'summary', ...options });
};

// ============================================
// STATISTICS & PROGRESS
// ============================================

/**
 * Get study statistics
 */
export const getStudyStats = async (): Promise<{
  totalMaterials: number;
  byType: Record<string, number>;
  averageMastery: number;
  dueForReview: number;
  masteredCount: number;
}> => {
  const materials = await getStudyMaterials({ limit: 1000 });
  const now = Timestamp.now();

  const byType: Record<string, number> = {};
  let totalMastery = 0;
  let dueForReview = 0;
  let masteredCount = 0;

  materials.forEach(m => {
    byType[m.type] = (byType[m.type] || 0) + 1;
    totalMastery += m.masteryLevel || 0;
    
    if (m.masteryLevel >= 80) masteredCount++;
    
    if (m.spaceRepetition?.nextReview) {
      if (m.spaceRepetition.nextReview.toMillis() <= now.toMillis()) {
        dueForReview++;
      }
    } else {
      dueForReview++; // Never reviewed
    }
  });

  return {
    totalMaterials: materials.length,
    byType,
    averageMastery: materials.length > 0 ? Math.round(totalMastery / materials.length) : 0,
    dueForReview,
    masteredCount,
  };
};

/**
 * Get subjects with material counts
 */
export const getSubjects = async (): Promise<Array<{ subject: string; count: number }>> => {
  const materials = await getStudyMaterials({ limit: 1000 });
  const subjectMap: Record<string, number> = {};

  materials.forEach(m => {
    if (m.subject) {
      subjectMap[m.subject] = (subjectMap[m.subject] || 0) + 1;
    }
  });

  return Object.entries(subjectMap)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Get topics for a subject
 */
export const getTopics = async (subject: string): Promise<Array<{ topic: string; count: number }>> => {
  const materials = await getStudyMaterials({ subject, limit: 500 });
  const topicMap: Record<string, number> = {};

  materials.forEach(m => {
    if (m.topic) {
      topicMap[m.topic] = (topicMap[m.topic] || 0) + 1;
    }
  });

  return Object.entries(topicMap)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to study materials
 */
export const subscribeToStudyMaterials = (
  onUpdate: (materials: StudyMaterial[]) => void,
  options: { type?: StudyMaterial['type']; limit?: number } = {}
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const { type, limit: limitCount = 100 } = options;

  const materialsRef = collection(db, 'users', uid, 'studyMaterials');
  let q = query(
    materialsRef,
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  );

  if (type) {
    q = query(
      materialsRef,
      where('type', '==', type),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
  }

  return onSnapshot(q, (snapshot) => {
    const materials = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as StudyMaterial[];
    onUpdate(materials);
  });
};
