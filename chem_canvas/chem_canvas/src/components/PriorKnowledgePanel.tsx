import type { AssessmentMode, PriorKnowledgeSnapshot } from '../types/srlCoach';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, Target, ClipboardList, PenTool } from 'lucide-react';

interface PriorKnowledgePanelProps {
  selectedMode: AssessmentMode | null;
  onSelectMode: (mode: AssessmentMode) => void | Promise<void>;
  onGenerateGoalBuddy: () => void;
  snapshots: PriorKnowledgeSnapshot[];
  isBusy: boolean;
}

const MODE_CONFIG: Record<
  AssessmentMode,
  { label: string; description: string; icon: LucideIcon }
> = {
  quiz: {
    label: 'Adaptive Quiz',
    description: 'Answer 5 rapid-fire questions to gauge current mastery.',
    icon: ClipboardList
  },
  flashcards: {
    label: 'Flash Card Sprint',
    description: 'Flip through key concepts using spaced repetition prompts.',
    icon: Target
  },
  sketch: {
    label: 'Interactive Sketch',
    description: 'Sketch molecules or reactions to surface conceptual gaps.',
    icon: PenTool
  }
};

const PriorKnowledgePanel = ({
  selectedMode,
  onSelectMode,
  onGenerateGoalBuddy,
  snapshots,
  isBusy
}: PriorKnowledgePanelProps) => {
  const latestSnapshot = snapshots[0];

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-900/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Baseline Check-in</p>
          <h3 className="text-sm font-semibold text-amber-100">Discover what you already know</h3>
        </div>
        <Sparkles size={20} className="text-amber-300" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(MODE_CONFIG) as AssessmentMode[]).map((mode) => {
          const config = MODE_CONFIG[mode];
          const Icon = config.icon;
          const isActive = selectedMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => void onSelectMode(mode)}
              className={`flex flex-col items-start rounded-xl border p-3 transition ${
                isActive
                  ? 'border-amber-400 bg-amber-500/20 text-amber-100 shadow-sm'
                  : 'border-amber-500/20 bg-transparent text-amber-200/80 hover:border-amber-400/60 hover:bg-amber-500/10'
              }`}
              disabled={isBusy}
            >
              <Icon size={18} className="mb-2 text-amber-300" />
              <span className="text-sm font-semibold">{config.label}</span>
              <span className="mt-1 text-xs text-amber-100/80 text-left">{config.description}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col text-xs text-amber-200/90">
          <span>
            {selectedMode
              ? `Launching a ${MODE_CONFIG[selectedMode].label.toLowerCase()} baseline now...`
              : 'Pick a quick activity to calibrate your starting point.'}
          </span>
          {isBusy ? (
            <span className="text-amber-100/80">Running quick assessment...</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onGenerateGoalBuddy}
          className="inline-flex items-center rounded-lg border border-blue-400/70 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-100 transition hover:bg-blue-500/20"
        >
          Goal Buddy Insight
        </button>
      </div>

      {latestSnapshot ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-amber-200">
            <span>Latest Insight</span>
            <span>{new Date(latestSnapshot.completedAt).toLocaleString()}</span>
          </div>
          <div className="mt-2 text-sm text-amber-50">
            {latestSnapshot.summary || 'No summary captured yet. Run an assessment to generate one.'}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Strengths</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-100/80">
                {(latestSnapshot.strengths && latestSnapshot.strengths.length > 0
                  ? latestSnapshot.strengths
                  : ['Watch for consistent successes to populate here.']
                ).map((item, index) => (
                  <li key={`${latestSnapshot.id}-strength-${index}`} className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Growth Targets</p>
              <ul className="mt-1 space-y-1 text-xs text-amber-100/80">
                {(latestSnapshot.improvements && latestSnapshot.improvements.length > 0
                  ? latestSnapshot.improvements
                  : ['Opportunities will surface once you complete an assessment.']
                ).map((item, index) => (
                  <li key={`${latestSnapshot.id}-improve-${index}`} className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {latestSnapshot.aiRecommendation && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
              <p className="font-semibold uppercase tracking-wide text-amber-200">Coach Recommendation</p>
              <p className="mt-1">{latestSnapshot.aiRecommendation}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-900/5 p-4 text-xs text-amber-200/80">
          No baseline data yet. Select an assessment mode to jump in and unlock AI-personalized goal drafts.
        </div>
      )}
    </div>
  );
};

export default PriorKnowledgePanel;
