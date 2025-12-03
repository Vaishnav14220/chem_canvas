// Chat Service - Manages AI chat history and messages
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type {
  Chat,
  ChatMessage,
  CreateChat,
  CreateChatMessage,
} from '../../types/database';

// ============================================
// CHATS
// ============================================

/**
 * Get all chats for current user
 */
export const getChats = async (
  options: {
    chatType?: Chat['chatType'];
    workspaceId?: string;
    limit?: number;
    pinnedFirst?: boolean;
  } = {}
): Promise<Chat[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    chatType,
    workspaceId,
    limit: limitCount = 50,
    pinnedFirst = true,
  } = options;

  try {
    const chatsRef = collection(db, 'users', uid, 'chats');
    // Use simple query without compound indexes - filter client-side
    const snapshot = await getDocs(chatsRef);
    let chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Chat[];

    // Filter by chatType client-side
    if (chatType) {
      chats = chats.filter(chat => chat.chatType === chatType);
    }

    // Filter by workspaceId client-side
    if (workspaceId) {
      chats = chats.filter(chat => chat.workspaceId === workspaceId);
    }

    // Sort by updatedAt descending
    chats.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || 0;
      const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });

    // Sort pinned chats first if requested
    if (pinnedFirst) {
      chats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    }

    // Apply limit
    chats = chats.slice(0, limitCount);

    return chats;
  } catch (error) {
    console.error('Error getting chats:', error);
    throw error;
  }
};

/**
 * Get a single chat by ID
 */
export const getChat = async (chatId: string): Promise<Chat | null> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'chats', chatId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Chat;
    }
    return null;
  } catch (error) {
    console.error('Error getting chat:', error);
    throw error;
  }
};

/**
 * Create a new chat
 */
export const createChat = async (chat: CreateChat): Promise<Chat> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const chatsRef = collection(db, 'users', uid, 'chats');
    const now = serverTimestamp();

    // Filter out undefined values - Firestore doesn't accept undefined
    const chatData: Record<string, any> = {
      title: chat.title,
      chatType: chat.chatType,
      messageCount: 0,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    };

    // Only add optional fields if they have defined values
    if (chat.workspaceId !== undefined && chat.workspaceId !== null) {
      chatData.workspaceId = chat.workspaceId;
    }
    if (chat.lastMessage !== undefined && chat.lastMessage !== null) {
      chatData.lastMessage = chat.lastMessage;
    }
    if (chat.model !== undefined && chat.model !== null) {
      chatData.model = chat.model;
    }
    if (chat.tags !== undefined && chat.tags !== null) {
      chatData.tags = chat.tags;
    }

    const docRef = await addDoc(chatsRef, chatData);

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as Chat;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

/**
 * Helper to remove undefined values from an object
 */
const removeUndefined = (obj: Record<string, any>): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
};

/**
 * Update a chat
 */
export const updateChat = async (
  chatId: string,
  updates: Partial<Chat>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'chats', chatId);
    // Filter out undefined values - Firestore doesn't accept undefined
    const cleanUpdates = removeUndefined({
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(docRef, cleanUpdates);
  } catch (error) {
    console.error('Error updating chat:', error);
    throw error;
  }
};

/**
 * Delete a chat and all its messages
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const batch = writeBatch(db);

    // Delete all messages
    const messagesRef = collection(db, 'users', uid, 'chats', chatId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    messagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete the chat
    const chatRef = doc(db, 'users', uid, 'chats', chatId);
    batch.delete(chatRef);

    await batch.commit();
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
};

/**
 * Pin/unpin a chat
 */
export const togglePinChat = async (chatId: string): Promise<void> => {
  const chat = await getChat(chatId);
  if (chat) {
    await updateChat(chatId, { isPinned: !chat.isPinned });
  }
};

/**
 * Rename a chat
 */
export const renameChat = async (chatId: string, newTitle: string): Promise<void> => {
  await updateChat(chatId, { title: newTitle });
};

// ============================================
// CHAT MESSAGES
// ============================================

/**
 * Get all messages in a chat
 */
export const getChatMessages = async (
  chatId: string,
  options: { limit?: number; beforeTimestamp?: Timestamp } = {}
): Promise<ChatMessage[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const { limit: limitCount = 100 } = options;

  try {
    const messagesRef = collection(db, 'users', uid, 'chats', chatId, 'messages');
    // Simple query without orderBy to avoid index requirements
    const snapshot = await getDocs(messagesRef);
    let messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatMessage[];

    // Sort by timestamp client-side
    messages.sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
      const bTime = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
      return aTime - bTime;
    });

    // Apply limit
    messages = messages.slice(0, limitCount);

    return messages;
  } catch (error) {
    console.error('Error getting chat messages:', error);
    throw error;
  }
};

/**
 * Add a message to a chat
 */
export const addChatMessage = async (
  chatId: string,
  message: CreateChatMessage
): Promise<ChatMessage> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const messagesRef = collection(db, 'users', uid, 'chats', chatId, 'messages');
    const now = serverTimestamp();

    // Build message data, filtering undefined values
    const messageData: Record<string, any> = {
      role: message.role,
      content: message.content,
      timestamp: now,
    };
    if (message.toolCalls !== undefined && message.toolCalls !== null) {
      messageData.toolCalls = message.toolCalls;
    }
    if (message.attachments !== undefined && message.attachments !== null) {
      messageData.attachments = message.attachments;
    }

    const docRef = await addDoc(messagesRef, messageData);

    // Update chat metadata
    const chat = await getChat(chatId);
    await updateChat(chatId, {
      messageCount: (chat?.messageCount || 0) + 1,
      lastMessage: message.content.substring(0, 100),
    });

    const newDoc = await getDoc(docRef);
    return { id: newDoc.id, ...newDoc.data() } as ChatMessage;
  } catch (error) {
    console.error('Error adding chat message:', error);
    throw error;
  }
};

/**
 * Add a user message and assistant response together
 */
export const addChatExchange = async (
  chatId: string,
  userMessage: string,
  assistantMessage: string,
  metadata?: {
    toolCalls?: ChatMessage['toolCalls'];
    attachments?: ChatMessage['attachments'];
  }
): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const batch = writeBatch(db);
    const messagesRef = collection(db, 'users', uid, 'chats', chatId, 'messages');
    const now = serverTimestamp();

    // Add user message
    const userMsgRef = doc(messagesRef);
    batch.set(userMsgRef, {
      role: 'user',
      content: userMessage,
      timestamp: now,
      attachments: metadata?.attachments || [],
    });

    // Add assistant message
    const assistantMsgRef = doc(messagesRef);
    batch.set(assistantMsgRef, {
      role: 'assistant',
      content: assistantMessage,
      timestamp: now,
      toolCalls: metadata?.toolCalls || [],
    });

    // Update chat metadata
    const chatRef = doc(db, 'users', uid, 'chats', chatId);
    const chat = await getChat(chatId);
    batch.update(chatRef, {
      messageCount: (chat?.messageCount || 0) + 2,
      lastMessage: assistantMessage.substring(0, 100),
      updatedAt: now,
    });

    await batch.commit();

    const [userDoc, assistantDoc] = await Promise.all([
      getDoc(userMsgRef),
      getDoc(assistantMsgRef),
    ]);

    return {
      userMsg: { id: userDoc.id, ...userDoc.data() } as ChatMessage,
      assistantMsg: { id: assistantDoc.id, ...assistantDoc.data() } as ChatMessage,
    };
  } catch (error) {
    console.error('Error adding chat exchange:', error);
    throw error;
  }
};

/**
 * Delete a message
 */
export const deleteChatMessage = async (
  chatId: string,
  messageId: string
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const docRef = doc(db, 'users', uid, 'chats', chatId, 'messages', messageId);
    await deleteDoc(docRef);

    // Update message count
    const chat = await getChat(chatId);
    if (chat && chat.messageCount > 0) {
      await updateChat(chatId, { messageCount: chat.messageCount - 1 });
    }
  } catch (error) {
    console.error('Error deleting chat message:', error);
    throw error;
  }
};

/**
 * Clear all messages in a chat
 */
export const clearChatMessages = async (chatId: string): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const batch = writeBatch(db);
    const messagesRef = collection(db, 'users', uid, 'chats', chatId, 'messages');
    const snapshot = await getDocs(messagesRef);

    snapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Reset message count
    const chatRef = doc(db, 'users', uid, 'chats', chatId);
    batch.update(chatRef, {
      messageCount: 0,
      lastMessage: null,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    console.error('Error clearing chat messages:', error);
    throw error;
  }
};

// ============================================
// REAL-TIME LISTENERS
// ============================================

/**
 * Subscribe to chat list changes
 */
export const subscribeToChats = (
  onUpdate: (chats: Chat[]) => void,
  options: { chatType?: Chat['chatType']; limit?: number } = {}
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const { chatType, limit: limitCount = 50 } = options;

  const chatsRef = collection(db, 'users', uid, 'chats');
  // Simple query without compound indexes
  const q = query(chatsRef);

  return onSnapshot(q, (snapshot) => {
    let chats = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Chat[];

    // Filter by chatType client-side
    if (chatType) {
      chats = chats.filter(chat => chat.chatType === chatType);
    }

    // Sort by updatedAt descending client-side
    chats.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || 0;
      const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });

    // Apply limit
    chats = chats.slice(0, limitCount);

    onUpdate(chats);
  });
};

/**
 * Subscribe to messages in a chat
 */
export const subscribeToChatMessages = (
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void
): Unsubscribe => {
  const uid = getCurrentUserId();
  if (!uid) {
    onUpdate([]);
    return () => {};
  }

  const messagesRef = collection(db, 'users', uid, 'chats', chatId, 'messages');
  // Simple query without orderBy to avoid index requirements
  const q = query(messagesRef);

  return onSnapshot(q, (snapshot) => {
    let messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatMessage[];

    // Sort by timestamp client-side
    messages.sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() || a.timestamp?.seconds * 1000 || 0;
      const bTime = b.timestamp?.toMillis?.() || b.timestamp?.seconds * 1000 || 0;
      return aTime - bTime;
    });

    onUpdate(messages);
  });
};

// ============================================
// SEARCH & EXPORT
// ============================================

/**
 * Search chats by title or content
 */
export const searchChats = async (searchQuery: string): Promise<Chat[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    // Get all chats and filter client-side (Firestore doesn't support full-text search)
    const allChats = await getChats({ limit: 200 });
    const query = searchQuery.toLowerCase();

    return allChats.filter(chat =>
      chat.title.toLowerCase().includes(query) ||
      chat.lastMessage?.toLowerCase().includes(query) ||
      chat.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  } catch (error) {
    console.error('Error searching chats:', error);
    throw error;
  }
};

/**
 * Export chat as JSON
 */
export const exportChat = async (chatId: string): Promise<{
  chat: Chat;
  messages: ChatMessage[];
}> => {
  const [chat, messages] = await Promise.all([
    getChat(chatId),
    getChatMessages(chatId, { limit: 1000 }),
  ]);

  if (!chat) throw new Error('Chat not found');

  return { chat, messages };
};

/**
 * Export chat as Markdown
 */
export const exportChatAsMarkdown = async (chatId: string): Promise<string> => {
  const { chat, messages } = await exportChat(chatId);

  let markdown = `# ${chat.title}\n\n`;
  markdown += `Created: ${chat.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}\n`;
  markdown += `Type: ${chat.chatType}\n\n---\n\n`;

  for (const msg of messages) {
    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
    markdown += `${role}:\n\n${msg.content}\n\n---\n\n`;
  }

  return markdown;
};
