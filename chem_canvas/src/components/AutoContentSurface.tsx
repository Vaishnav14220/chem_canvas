/**
 * Auto-Content Surface Component
 * Automatically displays relevant molecules, reactions, AR codes, and simulations
 * based on the lesson content without requiring user search
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, Microscope, Zap, Atom, BarChart3, X, AlertCircle } from 'lucide-react';
import { getMoleculeByName, type MoleculeData } from '../services/pubchemService';
import type { 
  ExtractedMolecule, 
  ExtractedReaction, 
  ExtractedSimulation 
} from '../services/contentRelevanceEngine';
import { 
  analyzeContent, 
  getTopMolecules, 
  getTopReactions,
  findRelevantLineNumbers
} from '../services/contentRelevanceEngine';

interface AutoContentSurfaceProps {
  lessonContent: string; // The teach section of the lesson
  lessonTitle: string;
  documentContent: string; // Full document for PDF highlighting
  onMoleculeSelected?: (molecule: MoleculeData) => void;
  onHighlightLines?: (lines: number[]) => void;
  academicLevel?: string;
}

interface MoleculeCard {
  molecule: ExtractedMolecule;
  data?: MoleculeData;
  loading: boolean;
  error?: string;
}

interface ReactionCard {
  reaction: ExtractedReaction;
  expanded: boolean;
}

/**
 * Individual molecule card component
 */
const MoleculeCard: React.FC<{ card: MoleculeCard; onSelect: (data: MoleculeData) => void }> = ({
  card,
  onSelect,
}) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:border-blue-500/50 transition-all group">
    <div className="flex items-start justify-between mb-2">
      <div className="flex-1">
        <h4 className="font-semibold text-blue-200 text-sm">{card.molecule.name}</h4>
        <p className="text-xs text-slate-400">{card.molecule.mention}</p>
      </div>
      <div className="flex items-center gap-1">
        <Microscope className="h-4 w-4 text-blue-400" />
        <span className="text-xs text-blue-300">{Math.round(card.molecule.confidence * 100)}%</span>
      </div>
    </div>

    {card.loading && (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      </div>
    )}

    {card.error && (
      <div className="flex items-start gap-2 py-2 px-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
        <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
        <span>{card.error}</span>
      </div>
    )}

    {card.data && !card.loading && (
      <>
        <p className="text-xs text-slate-300 mb-2">
          <span className="text-slate-400">Formula: </span>
          {card.data.molecularFormula}
        </p>
        <button
          onClick={() => onSelect(card.data!)}
          className="w-full px-2 py-1.5 bg-blue-600/60 hover:bg-blue-600 text-blue-100 text-xs rounded transition-colors"
        >
          Visualize Molecule
        </button>
      </>
    )}
  </div>
);

/**
 * Reaction card component
 */
const ReactionCard: React.FC<{ card: ReactionCard; expanded: boolean; onToggle: () => void }> = ({
  card,
  expanded,
  onToggle,
}) => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden hover:border-purple-500/50 transition-all">
    <button
      onClick={onToggle}
      className="w-full p-3 flex items-start justify-between hover:bg-slate-700/30 transition-colors"
    >
      <div className="flex-1 text-left">
        <h4 className="font-semibold text-purple-200 text-sm capitalize">{card.reaction.name}</h4>
        <p className="text-xs text-slate-400">{card.reaction.mention}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-purple-300">{Math.round(card.reaction.confidence * 100)}%</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-purple-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-purple-400" />
        )}
      </div>
    </button>

    {expanded && card.reaction.context && (
      <div className="px-3 pb-3 pt-0 border-t border-slate-700/30">
        <p className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded italic">
          "{card.reaction.context}"
        </p>
      </div>
    )}
  </div>
);

/**
 * Simulation suggestion card
 */
const SimulationCard: React.FC<{ simulation: ExtractedSimulation }> = ({ simulation }) => {
  const getSimulationInfo = (type: string) => {
    const info: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
      baldwin: {
        icon: <Zap className="h-5 w-5" />,
        color: 'text-yellow-400',
        description: 'Explore ring closure rules and cyclization pathways',
      },
      orbital: {
        icon: <Atom className="h-5 w-5" />,
        color: 'text-cyan-400',
        description: 'Visualize molecular orbitals and frontier orbitals',
      },
      kinetics: {
        icon: <BarChart3 className="h-5 w-5" />,
        color: 'text-green-400',
        description: 'Adjust parameters to observe reaction rate changes',
      },
      thermodynamics: {
        icon: <BarChart3 className="h-5 w-5" />,
        color: 'text-red-400',
        description: 'Understand energy, enthalpy, and equilibrium',
      },
      'reaction-mechanism': {
        icon: <Zap className="h-5 w-5" />,
        color: 'text-purple-400',
        description: 'Step-by-step mechanism visualization',
      },
    };
    return info[type] || info['reaction-mechanism'];
  };

  const info = getSimulationInfo(simulation.type);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:border-green-500/50 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={info.color}>{info.icon}</div>
            <h4 className="font-semibold text-green-200 text-sm capitalize">{simulation.type}</h4>
          </div>
          <p className="text-xs text-slate-400">{info.description}</p>
        </div>
        <span className="text-xs text-green-300">{Math.round(simulation.confidence * 100)}%</span>
      </div>
      <button className="w-full px-2 py-1.5 bg-green-600/60 hover:bg-green-600 text-green-100 text-xs rounded transition-colors">
        Launch Simulation
      </button>
    </div>
  );
};

/**
 * Main Auto-Content Surface Component
 */
export const AutoContentSurface: React.FC<AutoContentSurfaceProps> = ({
  lessonContent,
  lessonTitle,
  documentContent,
  onMoleculeSelected,
  onHighlightLines,
  academicLevel = 'university',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [moleculeCards, setMoleculeCards] = useState<MoleculeCard[]>([]);
  const [reactionCards, setReactionCards] = useState<ReactionCard[]>([]);
  const [expandedReactions, setExpandedReactions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Memoize the highlight callback to prevent infinite loops
  const memoizedOnHighlightLines = useCallback(onHighlightLines || (() => {}), [onHighlightLines]);

  // Analyze content on mount
  useEffect(() => {
    const analyzeAndLoadContent = async () => {
      setIsLoading(true);
      try {
        // Analyze the lesson content
        const analysis = analyzeContent(lessonContent);

        // Get top molecules and prepare cards
        const topMolecules = getTopMolecules(lessonContent, 4);
        const initialCards: MoleculeCard[] = topMolecules.map(mol => ({
          molecule: mol,
          loading: true,
          data: undefined,
        }));
        setMoleculeCards(initialCards);

        // Load molecule data from PubChem
        const loadedCards: MoleculeCard[] = await Promise.all(
          initialCards.map(async (card, idx) => {
            try {
              const data = await getMoleculeByName(card.molecule.name);
              return { ...card, data: data || undefined, loading: false };
            } catch (error) {
              return {
                ...card,
                loading: false,
                error: `Could not load ${card.molecule.name}`,
              };
            }
          })
        );
        setMoleculeCards(loadedCards);

        // Get top reactions and prepare cards
        const topReactions = getTopReactions(lessonContent, 3);
        const reactionCardsList: ReactionCard[] = topReactions.map(rxn => ({
          reaction: rxn,
          expanded: false,
        }));
        setReactionCards(reactionCardsList);

        // Find and highlight relevant lines in document
        if (documentContent) {
          const relevantLines = findRelevantLineNumbers(documentContent);
          memoizedOnHighlightLines(relevantLines);
        }
      } catch (error) {
        console.error('[AutoContentSurface] Error analyzing content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    analyzeAndLoadContent();
  }, [lessonContent, documentContent]);

  // Get simulations
  const analysis = useMemo(() => analyzeContent(lessonContent), [lessonContent]);

  const handleMoleculeSelect = (data: MoleculeData) => {
    onMoleculeSelected?.(data);
  };

  const toggleReactionExpand = (reactionName: string) => {
    setExpandedReactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reactionName)) {
        newSet.delete(reactionName);
      } else {
        newSet.add(reactionName);
      }
      return newSet;
    });
  };

  const totalItems = moleculeCards.length + reactionCards.length + analysis.simulations.length;

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Relevant Content</h3>
          <p className="text-xs text-slate-400 mt-0.5">{lessonTitle}</p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
          )}

          {!isLoading && totalItems === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <p>No specific molecules or reactions detected</p>
              <p className="text-xs mt-2">Content will appear as you study</p>
            </div>
          )}

          {/* Molecules Section */}
          {moleculeCards.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-blue-200 uppercase tracking-wide">
                🔬 Molecules ({moleculeCards.length})
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {moleculeCards.map(card => (
                  <MoleculeCard
                    key={card.molecule.name}
                    card={card}
                    onSelect={handleMoleculeSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reactions Section */}
          {reactionCards.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-purple-200 uppercase tracking-wide">
                ⚡ Reactions ({reactionCards.length})
              </h4>
              <div className="space-y-2">
                {reactionCards.map(card => (
                  <ReactionCard
                    key={card.reaction.name}
                    card={card}
                    expanded={expandedReactions.has(card.reaction.name)}
                    onToggle={() => toggleReactionExpand(card.reaction.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Simulations Section */}
          {analysis.simulations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-green-200 uppercase tracking-wide">
                🎮 Simulations ({analysis.simulations.length})
              </h4>
              <div className="space-y-2">
                {analysis.simulations.map((sim, idx) => (
                  <SimulationCard key={`${sim.type}-${idx}`} simulation={sim} />
                ))}
              </div>
            </div>
          )}

          {/* AR Indicators */}
          {analysis.arKeywords.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-cyan-200 mb-2">📱 AR Available</h4>
              <p className="text-xs text-slate-300">
                This lesson includes 3D molecular structures ideal for AR visualization.
              </p>
              <button className="w-full mt-2 px-2 py-1.5 bg-cyan-600/60 hover:bg-cyan-600 text-cyan-100 text-xs rounded transition-colors">
                View in AR
              </button>
            </div>
          )}
        </div>
      )}

      {/* Compact Mode */}
      {!isExpanded && totalItems > 0 && (
        <div className="text-xs text-slate-400 flex items-center gap-2 px-2 py-1 bg-slate-800/30 rounded">
          <span>{totalItems} items ready</span>
        </div>
      )}
    </div>
  );
};

export default AutoContentSurface;
