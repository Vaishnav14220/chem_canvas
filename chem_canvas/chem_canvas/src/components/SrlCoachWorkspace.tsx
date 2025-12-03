import { Target, ArrowLeft, Sparkles } from 'lucide-react';
import SrlCoach from './SrlCoach';
import type { AIInteraction, InteractionMode } from '../types';
import type { UserProfile } from '../firebase/auth';

interface SrlCoachWorkspaceProps {
  interactions: AIInteraction[];
  onSendMessage: (message: string, options?: { mode?: InteractionMode }) => Promise<void>;
  isLoading: boolean;
  onClose: () => void;
  documentName?: string;
  onOpenDocument?: () => void;
  user?: UserProfile | null;
}

const SrlCoachWorkspace: React.FC<SrlCoachWorkspaceProps> = ({
  interactions,
  onSendMessage,
  isLoading,
  onClose,
  documentName,
  onOpenDocument,
  user
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 shadow-lg">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Target className="h-4 w-4 text-blue-300" />
            SRL Coach Workspace
          </h2>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Sparkles className="h-3 w-3 text-blue-300" />
            Guided goal-setting, planning, monitoring, reflection, and help-seeking flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit SRL Coach
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-4 md:px-6 md:py-6">
        <SrlCoach
          onSendMessage={onSendMessage}
          interactions={interactions}
          isLoading={isLoading}
          documentName={documentName}
          onOpenDocument={onOpenDocument}
          user={user}
        />
      </div>
    </div>
  );
};

export default SrlCoachWorkspace;
