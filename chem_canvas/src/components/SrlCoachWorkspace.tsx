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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eef2f7]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white border-b border-slate-200 px-4 md:px-6 py-3 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Target className="h-4 w-4 text-[#2c4066]" />
            SRL Coach Workspace
          </h2>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Sparkles className="h-3 w-3 text-[#2c4066]" />
            Guided goal-setting, planning, monitoring, reflection, and help-seeking flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded bg-[#2c4066] px-3 py-2 text-xs font-medium text-white hover:bg-[#34507c] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit SRL Coach
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
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
