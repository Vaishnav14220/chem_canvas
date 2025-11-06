import { BookOpen, ArrowLeft, Sparkles } from 'lucide-react';
import StudyTools from './StudyTools';
import type { AIInteraction, InteractionMode } from '../types';
import type { UserProfile } from '../firebase/auth';

interface StudyToolsWorkspaceProps {
  interactions: AIInteraction[];
  onSendMessage: (message: string, options?: { mode?: InteractionMode }) => Promise<void>;
  isLoading: boolean;
  onClose: () => void;
  documentName?: string;
  onOpenDocument?: () => void;
  user?: UserProfile | null;
  sourceContent: string;
  sourceName: string;
  selectedTool?: 'audio' | 'video' | 'mindmap' | 'reports' | 'flashcards' | 'quiz' | 'notes' | 'documents' | 'designer' | 'chat' | 'tests';
}

const StudyToolsWorkspace: React.FC<StudyToolsWorkspaceProps> = ({
  onClose,
  sourceContent,
  sourceName,
  selectedTool = 'mindmap'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 shadow-lg">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="h-4 w-4 text-blue-300" />
            Study Tools Workspace
          </h2>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Sparkles className="h-3 w-3 text-blue-300" />
            Generate flashcards, quizzes, mind maps, reports, and manage your study materials.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Study Tools
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <StudyTools
          isOpen={true}
          onClose={onClose}
          sourceContent={sourceContent}
          sourceName={sourceName}
          toolType={selectedTool}
          embedded={true}
        />
      </div>
    </div>
  );
};

export default StudyToolsWorkspace;
