export type ReactionDifficulty = 'basic' | 'intermediate' | 'advanced';

export type ReactionSource = 'pubchem' | 'ord' | 'kegg' | 'local' | 'compound';

export interface ReactionMetadata {
  conditions?: string[];
  yield?: number;
  enzyme?: string;
  solvent?: string;
  temperature?: string;
  reactionType?: string;
  dataset?: string;
  sourceUrl?: string;
  matchedCompound?: string;
  notes?: string;
  [key: string]: unknown;
}
