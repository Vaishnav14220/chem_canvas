// Database Service - Main Entry Point
// Re-exports all database services for easy imports

export * from './userService';
export * from './workspaceService';
export * from './chatService';
export * from './documentService';
export * from './moleculeService';
export * from './simulationService';
export * from './studyService';
export * from './fileService';
export * from './activityService';
export * from './templateService';

// Export the main db instance for direct access if needed
export { db, auth, storage } from '../../firebase/config';
