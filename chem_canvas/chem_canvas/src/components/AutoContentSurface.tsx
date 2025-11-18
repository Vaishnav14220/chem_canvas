/**
 * Auto-Content Surface Component
 * Automatically displays relevant molecules, reactions, AR codes, and simulations
 * based on the lesson content without requiring user search
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, Microscope, Zap, Atom, BarChart3, X, AlertCircle, ExternalLink, Youtube, Globe } from 'lucide-react';
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
import { fetchContextualResources, fetchMolecularVisualizationPlan, selectTopYouTubeVideos, type ContextualResourceRecommendation } from '../services/geminiService';
import { fetchYouTubeVideos, type YouTubeVideo } from '../services/youtubeService';
import JSmolViewer from './JSmolViewer';

interface AutoContentSurfaceProps {
  lessonContent: string; // The teach section of the lesson
  lessonTitle: string;
  documentContent: string; // Full document for PDF highlighting
  onMoleculeSelected?: (molecule: MoleculeData) => void;
  onHighlightLines?: (lines: number[]) => void;
  academicLevel?: string;
  onChemistryContextUpdate?: (context: ChemistryContextSnapshot | null) => void;
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

export interface ChemistryContextSnapshot {
  molecules: ExtractedMolecule[];
  reactions: ExtractedReaction[];
  simulations: ExtractedSimulation[];
  arKeywords: string[];
  jsmolPlan?: {
    title: string;
    description: string;
    script: string;
  } | null;
  youtubeVideos: YouTubeVideo[];
  resources: ContextualResourceRecommendation[];
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
  onChemistryContextUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [moleculeCards, setMoleculeCards] = useState<MoleculeCard[]>([]);
  const [reactionCards, setReactionCards] = useState<ReactionCard[]>([]);
  const [expandedReactions, setExpandedReactions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [resourceCards, setResourceCards] = useState<ContextualResourceRecommendation[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [moleculeVisualization, setMoleculeVisualization] = useState<{
    title: string;
    description: string;
    script: string;
  } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [youtubeVideos, setYouTubeVideos] = useState<YouTubeVideo[]>([]);
  const [youtubeLoading, setYouTubeLoading] = useState(false);
  const [youtubeError, setYouTubeError] = useState<string | null>(null);

  // Memoize the highlight callback to prevent infinite loops
  const memoizedOnHighlightLines = useCallback(onHighlightLines || (() => {}), [onHighlightLines]);

  // Analyze content on mount
  useEffect(() => {
    const analyzeAndLoadContent = async () => {
      setIsLoading(true);
      setMoleculeVisualization(null);
      setViewerError(null);
      setYouTubeVideos([]);
      setYouTubeError(null);
      setResourceCards([]);
      setResourceError(null);
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

        setViewerLoading(true);
        setYouTubeLoading(true);
        setResourceLoading(true);

        const viewerPromise = (async () => {
          if (topMolecules.length === 0) {
            setViewerLoading(false);
            return;
          }
          try {
            const plan = await fetchMolecularVisualizationPlan({
              topic: lessonTitle,
              candidateMolecules: topMolecules.map((mol) => mol.name),
              lessonContent,
            });
            if (plan) {
              setMoleculeVisualization({
                title: plan.title,
                description: plan.description,
                script: plan.script,
              });
            } else {
              setMoleculeVisualization(null);
            }
          } catch (error) {
            console.error('[AutoContentSurface] Failed to fetch molecule visualization plan:', error);
            setViewerError('Unable to build the 3D molecule right now.');
          } finally {
            setViewerLoading(false);
          }
        })();

        const youtubePromise = (async () => {
          try {
            const videos = await fetchYouTubeVideos({
              query: `${lessonTitle} chemistry explainer`,
              maxResults: 10,
            });
            let topVideos = videos;
            if (videos.length > 3) {
              try {
                const rankedIds = await selectTopYouTubeVideos({
                  topic: lessonTitle,
                  lessonContent,
                  videos,
                  count: 3,
                });
                if (rankedIds && rankedIds.length) {
                  const rankedMap = new Map(videos.map((video) => [video.id, video]));
                  topVideos = rankedIds
                    .map((id) => rankedMap.get(id))
                    .filter((video): video is typeof videos[number] => Boolean(video));
                  const seen = new Set(topVideos.map((video) => video.id));
                  for (const video of videos) {
                    if (topVideos.length >= 3) break;
                    if (!seen.has(video.id)) {
                      topVideos.push(video);
                      seen.add(video.id);
                    }
                  }
                } else {
                  topVideos = videos.slice(0, 3);
                }
              } catch (rankingError) {
                console.warn('[AutoContentSurface] Unable to rank YouTube videos via Gemini:', rankingError);
                topVideos = videos.slice(0, 3);
              }
            } else {
              topVideos = videos.slice(0, 3);
            }
            setYouTubeVideos(topVideos);
          } catch (error) {
            console.error('[AutoContentSurface] Failed to fetch YouTube videos:', error);
            setYouTubeError('Unable to reach YouTube at the moment.');
          } finally {
            setYouTubeLoading(false);
          }
        })();

        const resourcePromise = (async () => {
          try {
            const resources = await fetchContextualResources({
              topic: lessonTitle,
              lessonContent,
              documentContent,
              academicLevel,
              maxItems: 3,
            });
            const filteredResources = resources.filter(
              (resource) => (resource.type || '').toLowerCase() !== 'youtube'
            );
            setResourceCards(filteredResources);
          } catch (error) {
            console.error('[AutoContentSurface] Failed to fetch contextual resources:', error);
            setResourceError('Unable to fetch curated resources right now.');
          } finally {
            setResourceLoading(false);
          }
        })();

        await Promise.all([viewerPromise, youtubePromise, resourcePromise]);
      } catch (error) {
        console.error('[AutoContentSurface] Error analyzing content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    analyzeAndLoadContent();
  }, [lessonContent, documentContent, lessonTitle, academicLevel, memoizedOnHighlightLines]);

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

  const totalItems =
    moleculeCards.length +
    reactionCards.length +
    analysis.simulations.length +
    resourceCards.length +
    youtubeVideos.length;

  const getResourceVisuals = (type: string | undefined) => {
    const normalized = (type || 'other').toLowerCase();
    switch (normalized) {
      case 'youtube':
      case 'video':
        return {
          icon: <Youtube className="h-3.5 w-3.5" />,
          label: 'YouTube',
          badgeClass: 'bg-red-500/20 text-red-100 border border-red-500/30',
        };
      case 'article':
      case 'reference':
        return {
          icon: <Globe className="h-3.5 w-3.5" />,
          label: 'Reference',
          badgeClass: 'bg-blue-500/20 text-blue-100 border border-blue-500/30',
        };
      case 'simulation':
      case 'tool':
        return {
          icon: <Zap className="h-3.5 w-3.5" />,
          label: 'Interactive',
          badgeClass: 'bg-green-500/20 text-green-100 border border-green-500/30',
        };
      default:
        return {
          icon: <Globe className="h-3.5 w-3.5" />,
          label: 'Resource',
          badgeClass: 'bg-slate-500/20 text-slate-100 border border-slate-500/30',
        };
    }
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  useEffect(() => {
    if (!onChemistryContextUpdate) return;
    const context: ChemistryContextSnapshot = {
      molecules: analysis.molecules,
      reactions: analysis.reactions,
      simulations: analysis.simulations,
      arKeywords: analysis.arKeywords,
      jsmolPlan: moleculeVisualization,
      youtubeVideos,
      resources: resourceCards,
    };
    onChemistryContextUpdate(context);
  }, [
    analysis,
    moleculeVisualization,
    youtubeVideos,
    resourceCards,
    onChemistryContextUpdate,
  ]);

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

          {/* 3D Molecular Spotlight */}
          {(viewerLoading || moleculeVisualization || viewerError) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-pink-200 uppercase tracking-wide">🧪 Molecular Spotlight</h4>
                {moleculeVisualization?.title && (
                  <span className="text-[11px] text-slate-400">{moleculeVisualization.title}</span>
                )}
              </div>
              {viewerLoading && (
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2 text-pink-300" />
                  Preparing interactive molecule...
                </div>
              )}
              {!viewerLoading && viewerError && (
                <div className="rounded-xl border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-xs text-pink-100">
                  {viewerError}
                </div>
              )}
              {!viewerLoading && moleculeVisualization && (
                <div className="space-y-2">
                  <JSmolViewer script={moleculeVisualization.script} height={260} backgroundColor="#020617" />
                  {moleculeVisualization.description && (
                    <p className="text-xs text-slate-400">{moleculeVisualization.description}</p>
                  )}
                </div>
              )}
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

          {/* Verified YouTube Videos */}
          {(youtubeLoading || youtubeVideos.length > 0 || youtubeError) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-red-200 uppercase tracking-wide">
                🎬 Verified YouTube
              </h4>
              {youtubeLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={`yt-skeleton-${idx}`}
                      className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 animate-pulse"
                    >
                      <div className="h-16 w-28 rounded bg-slate-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-800 rounded w-3/4" />
                        <div className="h-3 bg-slate-800 rounded w-1/3" />
                        <div className="h-3 bg-slate-800 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!youtubeLoading && youtubeError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {youtubeError}
                </div>
              )}
              {!youtubeLoading && youtubeVideos.length > 0 && (
                <div className="space-y-2">
                  {youtubeVideos.map((video) => (
                    <a
                      key={video.id}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 hover:border-red-400/60 transition-colors"
                    >
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="h-16 w-28 rounded object-cover flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-16 w-28 rounded bg-slate-800 flex items-center justify-center text-slate-500 text-xs">
                          No preview
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{video.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {video.channelTitle} · {new Date(video.publishedAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {video.description}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contextual Resources */}
          {(resourceLoading || resourceCards.length > 0 || resourceError) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wide">
                🌐 Curated Resources
              </h4>
              {resourceLoading && (
                <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-amber-300" />
                  Gathering study links...
                </div>
              )}
              {!resourceLoading && resourceError && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {resourceError}
                </div>
              )}
              {!resourceLoading && !resourceError && resourceCards.length === 0 && (
                <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
                  We’ll surface YouTube videos and references once more context is available.
                </div>
              )}
              {!resourceLoading && resourceCards.length > 0 && (
                <div className="space-y-2">
                  {resourceCards.map((resource, index) => {
                    const visuals = getResourceVisuals(resource.type);
                    const hostname = getHostname(resource.url);
                    return (
                      <a
                        key={`${resource.title}-${index}`}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 hover:border-amber-400/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{resource.title}</p>
                            <p className="text-xs text-slate-400 mt-1">{resource.reason || resource.description}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${visuals.badgeClass}`}>
                            {visuals.icon}
                            {visuals.label}
                          </span>
                          {resource.author && <span className="text-slate-500">by {resource.author}</span>}
                          <span className="text-slate-500 truncate">{hostname}</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
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
