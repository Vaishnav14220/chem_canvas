import { searchPubChemReactions, searchReactionsByCompound, searchOrdReactions, searchKeggReactions } from '../services/pubchemService';
import type { PubChemReaction } from '../services/pubchemService';
import type { ReactionDifficulty, ReactionMetadata, ReactionSource } from '../types/reactions';

export interface ReactionDatabaseEntry {
  id: string;
  name: string;
  description: string;
  reactionSmiles: string;
  category: string;
  difficulty: ReactionDifficulty;
  tags: string[];
  source: ReactionSource;
  rid?: number; // PubChem Reaction ID
  referenceId?: string;
  defaultQuery?: string;
  metadata?: ReactionMetadata;
}

// Cache for aggregated reaction suggestions
const reactionSuggestionCache = new Map<string, ReactionDatabaseEntry[]>();
let popularReactionsCache: ReactionDatabaseEntry[] | null = null;
let cacheExpiry = new Date().getTime() + (30 * 60 * 1000); // 30 minutes

type ReactionSearchOutcome = Awaited<ReturnType<typeof searchPubChemReactions>>;

/**
 * Convert PubChem reaction to database entry format
 */
const convertPubChemReactionToEntry = (reaction: PubChemReaction): ReactionDatabaseEntry => {
  const source: ReactionSource = reaction.source ?? 'pubchem';
  const normalizedName = reaction.name?.toLowerCase() ?? '';
  const descriptionText = `${reaction.description ?? ''}`.toLowerCase();

  let category = reaction.categoryHint ?? 'General';
  let difficulty: ReactionDifficulty = reaction.difficultyHint ?? 'intermediate';

  if (!reaction.categoryHint) {
    if (normalizedName.includes('combustion') || normalizedName.includes('burning')) {
      category = 'Combustion';
      difficulty = 'basic';
    } else if (
      normalizedName.includes('acid') ||
      normalizedName.includes('base') ||
      normalizedName.includes('neutralization')
    ) {
      category = 'Acid-Base';
      difficulty = 'basic';
    } else if (
      normalizedName.includes('ester') ||
      normalizedName.includes('amide') ||
      normalizedName.includes('synthesis') ||
      descriptionText.includes('ester')
    ) {
      category = 'Organic Synthesis';
      difficulty = 'intermediate';
    } else if (normalizedName.includes('oxidation') || normalizedName.includes('reduction')) {
      category = 'Redox';
      difficulty = 'intermediate';
    } else if (
      normalizedName.includes('substitution') ||
      normalizedName.includes('addition') ||
      normalizedName.includes('elimination')
    ) {
      category = 'Organic Mechanisms';
      difficulty = 'advanced';
    }
  }

  if (!reaction.difficultyHint) {
    if (category === 'Combustion' || category === 'Acid-Base') {
      difficulty = 'basic';
    } else if (category === 'Organic Mechanisms' || category === 'Aromatic Chemistry') {
      difficulty = 'advanced';
    }
  }

  const tagSet = new Set<string>(reaction.tags ?? []);
  const searchableText = `${normalizedName} ${descriptionText}`;

  const keywordTags: Array<[string, string]> = [
    ['organic', 'organic'],
    ['inorganic', 'inorganic'],
    ['acid', 'acid'],
    ['base', 'base'],
    ['water', 'water'],
    ['alcohol', 'alcohol'],
    ['aldehyde', 'aldehyde'],
    ['ketone', 'ketone'],
    ['ester', 'ester'],
    ['amide', 'amide'],
    ['palladium', 'palladium'],
    ['enzyme', 'enzyme'],
    ['cross-coupling', 'cross-coupling']
  ];

  keywordTags.forEach(([keyword, tag]) => {
    if (searchableText.includes(keyword)) {
      tagSet.add(tag);
    }
  });

  const metadata: ReactionMetadata | undefined = (() => {
    if (!reaction.metadata && !reaction.equation) {
      return undefined;
    }
    return {
      ...(reaction.metadata ?? {}),
      ...(reaction.equation ? { equation: reaction.equation } : {})
    };
  })();

  const reactionSmiles = reaction.smiles && reaction.smiles.trim().length > 0
    ? reaction.smiles
    : reaction.defaultQuery ?? reaction.description ?? reaction.name ?? '';

  const referenceId = reaction.referenceId ?? (reaction.rid ? `${source}_${reaction.rid}` : undefined);
  const sanitizedKey = reactionSmiles
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const entryId = referenceId ?? `${source}_${sanitizedKey || 'reaction'}`;

  return {
    id: entryId,
    name: reaction.name || `Reaction ${reaction.rid ?? ''}`,
    description: reaction.description || `Reaction sourced from ${source}`,
    reactionSmiles,
    category,
    difficulty,
    tags: Array.from(tagSet),
    source,
    rid: reaction.rid,
    referenceId,
    defaultQuery: reaction.defaultQuery,
    metadata
  };
};

/**
 * Check if cache is expired
 */
const isCacheExpired = (): boolean => {
  return new Date().getTime() > cacheExpiry;
};

/**
 * Reset cache expiry
 */
const resetCacheExpiry = (): void => {
  cacheExpiry = new Date().getTime() + (30 * 60 * 1000); // 30 minutes
};

// Fallback local reactions for when PubChem is unavailable
const FALLBACK_REACTIONS: ReactionDatabaseEntry[] = [
  // Basic Reactions
  {
    id: 'combustion_methane',
    name: 'Methane Combustion',
    description: 'Complete combustion of methane',
    reactionSmiles: 'C.O=O>>O=C.O',
    category: 'Combustion',
    difficulty: 'basic',
    tags: ['combustion', 'hydrocarbon', 'energy', 'methane'],
    source: 'local'
  },
  {
    id: 'water_formation',
    name: 'Water Formation',
    description: 'Formation of water from hydrogen and oxygen',
    reactionSmiles: '[H][H].[O]=[O]>>O',
    category: 'Synthesis',
    difficulty: 'basic',
    tags: ['water', 'hydrogen', 'oxygen', 'synthesis'],
    source: 'local'
  },
  {
    id: 'acid_base_naoh_hcl',
    name: 'Neutralization: HCl + NaOH',
    description: 'Acid-base neutralization reaction',
    reactionSmiles: 'Cl.[Na+].[OH-]>>[Na+].[Cl-].O',
    category: 'Acid-Base',
    difficulty: 'basic',
    tags: ['neutralization', 'acid', 'base', 'salt'],
    source: 'local'
  },
  {
    id: 'esterification',
    name: 'Esterification',
    description: 'Formation of ester from carboxylic acid and alcohol',
    reactionSmiles: 'CC(=O)O.CCO>>CC(=O)OCC.O',
    category: 'Organic Synthesis',
    difficulty: 'intermediate',
    tags: ['ester', 'carboxylic acid', 'alcohol', 'organic'],
    source: 'local'
  },
  {
    id: 'saponification',
    name: 'Saponification',
    description: 'Hydrolysis of ester to form soap',
    reactionSmiles: 'CCCCCCCC(=O)OCC.CC(=O)O>>CCCCCCCC(=O)O.CC(=O)OCC',
    category: 'Organic Synthesis',
    difficulty: 'intermediate',
    tags: ['soap', 'ester', 'hydrolysis', 'fatty acid'],
    source: 'local'
  },
  {
    id: 'nucleophilic_substitution',
    name: 'SN2 Reaction',
    description: 'Nucleophilic substitution with alkyl halide',
    reactionSmiles: 'CCCl.CC[O-]>>CCO.CCCl',
    category: 'Organic Mechanisms',
    difficulty: 'intermediate',
    tags: ['sn2', 'nucleophilic', 'alkyl halide', 'alcohol'],
    source: 'local'
  },
  {
    id: 'electrophilic_aromatic',
    name: 'Electrophilic Aromatic Substitution',
    description: 'Nitration of benzene',
    reactionSmiles: 'c1ccccc1.O=[N+](=O)[O-]>>c1ccccc1[N+](=O)[O-]',
    category: 'Aromatic Chemistry',
    difficulty: 'advanced',
    tags: ['aromatic', 'electrophilic', 'nitration', 'benzene'],
    source: 'local'
  },
  {
    id: 'aldol_condensation',
    name: 'Aldol Condensation',
    description: 'Base-catalyzed aldol condensation',
    reactionSmiles: 'CC(=O)C.CC(=O)C>>CC(=O)C=CC(=O)C.O',
    category: 'Carbonyl Chemistry',
    difficulty: 'advanced',
    tags: ['aldol', 'condensation', 'carbonyl', 'organic'],
    source: 'local'
  },
  {
    id: 'grignard_reaction',
    name: 'Grignard Reaction',
    description: 'Grignard reagent with carbonyl compound',
    reactionSmiles: 'CC[Mg]Br.CC(=O)C>>CC(C)(C)O.[Mg]Br',
    category: 'Organometallic',
    difficulty: 'advanced',
    tags: ['grignard', 'organometallic', 'carbonyl', 'alcohol'],
    source: 'local'
  },
  {
    id: 'diels_alder',
    name: 'Diels-Alder Reaction',
    description: 'Cycloaddition of diene and dienophile',
    reactionSmiles: 'C=CC=C.C=C[C]=C>>C1C=CC=CC1',
    category: 'Pericyclic',
    difficulty: 'advanced',
    tags: ['diels-alder', 'cycloaddition', 'pericyclic', 'diene'],
    source: 'local'
  },
  {
    id: 'wittig_reaction',
    name: 'Wittig Reaction',
    description: 'Olefin formation from aldehyde and ylide',
    reactionSmiles: 'CC=O.CP(=O)(C)C>>CC=C.O=P(C)(C)C',
    category: 'Organophosphorus',
    difficulty: 'advanced',
    tags: ['wittig', 'olefin', 'aldehyde', 'ylide'],
    source: 'local'
  },
  {
    id: 'friedel_crafts',
    name: 'Friedel-Crafts Acylation',
    description: 'Electrophilic aromatic substitution with acyl chloride',
    reactionSmiles: 'c1ccccc1.CC(=O)Cl>>c1ccccc1C(=O)C.O',
    category: 'Aromatic Chemistry',
    difficulty: 'advanced',
    tags: ['friedel-crafts', 'acylation', 'aromatic', 'electrophilic'],
    source: 'local'
  },
  {
    id: 'reduction_ketone',
    name: 'Ketone Reduction',
    description: 'Reduction of ketone to secondary alcohol',
    reactionSmiles: 'CC(=O)C.[H][H]>>CC(O)C',
    category: 'Reduction',
    difficulty: 'intermediate',
    tags: ['reduction', 'ketone', 'alcohol', 'hydride'],
    source: 'local'
  },
  {
    id: 'oxidation_alcohol',
    name: 'Alcohol Oxidation',
    description: 'Oxidation of primary alcohol to aldehyde',
    reactionSmiles: 'CCO.O=O>>CC=O.O',
    category: 'Oxidation',
    difficulty: 'intermediate',
    tags: ['oxidation', 'alcohol', 'aldehyde', 'chromium'],
    source: 'local'
  },
  {
    id: 'hydrolysis_nitrile',
    name: 'Nitrile Hydrolysis',
    description: 'Hydrolysis of nitrile to carboxylic acid',
    reactionSmiles: 'CC#N.O.O>>CC(=O)O.N',
    category: 'Functional Group',
    difficulty: 'intermediate',
    tags: ['hydrolysis', 'nitrile', 'carboxylic acid', 'amide'],
    source: 'local'
  }
];

export const searchReactions = async (query: string, limit: number = 10): Promise<ReactionDatabaseEntry[]> => {
  if (!query.trim()) {
    return await getPopularReactions(limit);
  }

  if (!isCacheExpired() && reactionSuggestionCache.has(query)) {
    return reactionSuggestionCache.get(query)!;
  }

  try {
    const fetchLimit = Math.max(limit * 2, 12);
    const [pubchemOutcome, ordOutcome, keggOutcome] = await Promise.allSettled([
      searchPubChemReactions(query, fetchLimit),
      searchOrdReactions(query, fetchLimit),
      searchKeggReactions(query, fetchLimit)
    ]);

    const aggregated: ReactionDatabaseEntry[] = [];

    const absorb = (outcome: PromiseSettledResult<unknown>) => {
      if (outcome.status !== 'fulfilled') {
        return;
      }
      const value = outcome.value as ReactionSearchOutcome | undefined;
      if (value?.reactions?.length) {
        aggregated.push(...value.reactions.map(convertPubChemReactionToEntry));
      }
    };

    absorb(pubchemOutcome);
    absorb(ordOutcome);
    absorb(keggOutcome);

    if (aggregated.length === 0) {
      const compoundResult = await searchReactionsByCompound(query, fetchLimit);
      aggregated.push(...compoundResult.reactions.map(convertPubChemReactionToEntry));
    }

    const dedupe = new Map<string, ReactionDatabaseEntry>();

    const selectPreferred = (existing: ReactionDatabaseEntry, incoming: ReactionDatabaseEntry): ReactionDatabaseEntry => {
      const existingScore = existing.metadata ? 1 : 0;
      const incomingScore = incoming.metadata ? 1 : 0;
      return incomingScore > existingScore ? incoming : existing;
    };

    aggregated.forEach(entry => {
      const keyBase = entry.reactionSmiles && entry.reactionSmiles.trim().length > 0
        ? entry.reactionSmiles.toLowerCase()
        : entry.name.toLowerCase();
      const key = `${entry.source}:${keyBase}`;

      if (!keyBase) {
        return;
      }

      const prior = dedupe.get(key);
      if (prior) {
        dedupe.set(key, selectPreferred(prior, entry));
      } else {
        dedupe.set(key, entry);
      }
    });

    let uniqueResults = Array.from(dedupe.values());

    if (uniqueResults.length < limit) {
      const fallbackMatches = FALLBACK_REACTIONS.filter(reaction =>
        reaction.name.toLowerCase().includes(query.toLowerCase()) ||
        reaction.description.toLowerCase().includes(query.toLowerCase()) ||
        reaction.category.toLowerCase().includes(query.toLowerCase()) ||
        reaction.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );

      fallbackMatches.forEach(reaction => {
        const key = `${reaction.source}:${reaction.reactionSmiles.toLowerCase()}`;
        if (!dedupe.has(key)) {
          uniqueResults.push(reaction);
        }
      });
    }

    if (uniqueResults.length > 0) {
      reactionSuggestionCache.set(query, uniqueResults);
      resetCacheExpiry();
    }

    return uniqueResults.slice(0, limit);
  } catch (error) {
    console.warn('All database searches failed, using fallback:', error);
  }

  return FALLBACK_REACTIONS.filter(reaction =>
    reaction.name.toLowerCase().includes(query.toLowerCase()) ||
    reaction.description.toLowerCase().includes(query.toLowerCase()) ||
    reaction.category.toLowerCase().includes(query.toLowerCase()) ||
    reaction.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, limit);
};

export const getReactionSuggestions = async (input: string, limit: number = 8): Promise<ReactionDatabaseEntry[]> => {
  return await searchReactions(input, limit);
};

export const getPopularReactions = async (limit: number = 10): Promise<ReactionDatabaseEntry[]> => {
  if (!isCacheExpired() && popularReactionsCache) {
    return popularReactionsCache.slice(0, limit);
  }

  try {
    const ordResult = await searchOrdReactions('', limit);
    const ordEntries = ordResult.reactions.map(convertPubChemReactionToEntry);

    const merged = new Map<string, ReactionDatabaseEntry>();
    [...ordEntries, ...FALLBACK_REACTIONS].forEach(entry => {
      const key = entry.reactionSmiles && entry.reactionSmiles.trim().length > 0
        ? `${entry.source}:${entry.reactionSmiles.toLowerCase()}`
        : `${entry.source}:${entry.name.toLowerCase()}`;
      if (!merged.has(key)) {
        merged.set(key, entry);
      }
    });

    popularReactionsCache = Array.from(merged.values());
    resetCacheExpiry();
    return popularReactionsCache.slice(0, limit);
  } catch (error) {
    console.warn('Unable to load ORD popular reactions, using fallback:', error);
    popularReactionsCache = FALLBACK_REACTIONS;
    return FALLBACK_REACTIONS.slice(0, limit);
  }
};

export const getReactionsByCategory = async (category: string): Promise<ReactionDatabaseEntry[]> => {
  return await searchReactions(category, 20);
};

export const getReactionsByDifficulty = async (difficulty: ReactionDifficulty): Promise<ReactionDatabaseEntry[]> => {
  const allReactions = await getPopularReactions(50);
  return allReactions.filter(reaction => reaction.difficulty === difficulty);
};

export const getReactionById = async (id: string): Promise<ReactionDatabaseEntry | undefined> => {
  const localReaction = FALLBACK_REACTIONS.find(r => r.id === id);
  if (localReaction) {
    return localReaction;
  }

  // TODO: Implement remote lookups for PubChem/ORD IDs when available
  return undefined;
};

export const getAllCategories = async (): Promise<string[]> => {
  const reactions = await getPopularReactions(50);
  const categories = [...new Set(reactions.map(reaction => reaction.category))];
  return categories.sort();
};

// Legacy synchronous functions for backward compatibility
export const getReactionSuggestionsSync = (input: string, limit: number = 8): ReactionDatabaseEntry[] => {
  return [];
};

export const searchReactionsSync = (query: string): ReactionDatabaseEntry[] => {
  if (!query.trim()) {
    return FALLBACK_REACTIONS.slice(0, 8);
  }

  return FALLBACK_REACTIONS.filter(reaction =>
    reaction.name.toLowerCase().includes(query.toLowerCase()) ||
    reaction.description.toLowerCase().includes(query.toLowerCase()) ||
    reaction.category.toLowerCase().includes(query.toLowerCase()) ||
    reaction.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 8);
};

// Export legacy database for backward compatibility
export const REACTION_DATABASE = FALLBACK_REACTIONS;