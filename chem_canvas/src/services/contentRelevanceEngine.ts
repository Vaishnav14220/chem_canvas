/**
 * Content Relevance Engine
 * Automatically extracts relevant molecules, reactions, and topics from lesson content
 * without requiring user search input
 */

export interface ExtractedMolecule {
  name: string;
  mention: string; // The exact text where it was mentioned
  confidence: number; // 0-1 scale
  lineNumber?: number;
  context?: string; // Surrounding text for reference
}

export interface ExtractedReaction {
  name: string;
  smiles?: string;
  reactants?: string[];
  products?: string[];
  mention: string;
  confidence: number;
  lineNumber?: number;
  context?: string;
}

export interface ExtractedSimulation {
  topic: string;
  type: 'baldwin' | 'orbital' | 'kinetics' | 'thermodynamics' | 'reaction-mechanism';
  confidence: number;
  mention: string;
  lineNumber?: number;
  context?: string;
}

interface ContentAnalysis {
  molecules: ExtractedMolecule[];
  reactions: ExtractedReaction[];
  simulations: ExtractedSimulation[];
  arKeywords: string[];
  primaryTopic?: string;
  keywords: string[];
}

// Common organic chemistry molecules (expanded list)
const COMMON_MOLECULES = [
  // Common functional groups & molecules
  { name: 'benzene', aliases: ['benzene', 'benzyl', 'phenyl', 'C6H6', 'aromatic ring'] },
  { name: 'glucose', aliases: ['glucose', 'dextrose', 'C6H12O6', 'sugar'] },
  { name: 'ethanol', aliases: ['ethanol', 'alcohol', 'C2H5OH', 'ethyl alcohol'] },
  { name: 'acetone', aliases: ['acetone', 'propanone', 'C3H6O', 'ketone'] },
  { name: 'methane', aliases: ['methane', 'CH4', 'natural gas'] },
  { name: 'ethane', aliases: ['ethane', 'C2H6'] },
  { name: 'propane', aliases: ['propane', 'C3H8', 'LPG'] },
  { name: 'butane', aliases: ['butane', 'C4H10'] },
  { name: 'toluene', aliases: ['toluene', 'methylbenzene', 'C7H8'] },
  { name: 'water', aliases: ['water', 'H2O'] },
  { name: 'ammonia', aliases: ['ammonia', 'NH3'] },
  { name: 'acetaldehyde', aliases: ['acetaldehyde', 'ethanal', 'C2H4O'] },
  { name: 'formic acid', aliases: ['formic acid', 'methanoic acid', 'HCOOH'] },
  { name: 'acetic acid', aliases: ['acetic acid', 'ethanoic acid', 'CH3COOH', 'vinegar'] },
  { name: 'formaldehyde', aliases: ['formaldehyde', 'methanal', 'HCHO'] },
  { name: 'aniline', aliases: ['aniline', 'phenylamine', 'C6H5NH2'] },
  { name: 'phenol', aliases: ['phenol', 'hydroxybenzene', 'C6H5OH'] },
  { name: 'styrene', aliases: ['styrene', 'vinyl benzene', 'C8H8'] },
  { name: 'isoprene', aliases: ['isoprene', '2-methyl-1,3-butadiene'] },
  { name: 'glycerol', aliases: ['glycerol', 'glycerin', 'C3H8O3'] },
  { name: 'lactose', aliases: ['lactose', 'milk sugar'] },
  { name: 'sucrose', aliases: ['sucrose', 'table sugar'] },
  { name: 'cholesterol', aliases: ['cholesterol', 'C27H46O'] },
  { name: 'decalin', aliases: ['decalin', 'decahydronaphthalene', 'bicyclo[4.4.0]decane'] },
  { name: 'naphthalene', aliases: ['naphthalene', 'C10H8'] },
  { name: 'anthracene', aliases: ['anthracene', 'C14H10'] },
  { name: 'cyclohexane', aliases: ['cyclohexane', 'C6H12', 'six-membered ring'] },
  { name: 'cyclopentane', aliases: ['cyclopentane', 'C5H10', 'five-membered ring'] },
  { name: 'cyclobutane', aliases: ['cyclobutane', 'C4H8', 'four-membered ring'] },
  { name: 'cyclopropane', aliases: ['cyclopropane', 'C3H6', 'three-membered ring'] },
  { name: 'pyrene', aliases: ['pyrene', 'C16H10', 'polycyclic'] },
  { name: 'quinoline', aliases: ['quinoline', 'C9H7N'] },
  { name: 'indole', aliases: ['indole', 'C8H7N'] },
  { name: 'histamine', aliases: ['histamine', 'C5H9N3'] },
  { name: 'dopamine', aliases: ['dopamine', 'C8H11NO2'] },
  { name: 'serotonin', aliases: ['serotonin', '5-hydroxytryptamine'] },
];

// Common reaction types and keywords
const REACTION_KEYWORDS = [
  { name: 'addition', keywords: ['addition', 'add across', 'electrophilic addition', 'nucleophilic addition'] },
  { name: 'elimination', keywords: ['elimination', 'E1', 'E2', 'dehydration', 'loss of', 'removing'] },
  { name: 'substitution', keywords: ['substitution', 'SN1', 'SN2', 'nucleophilic substitution', 'leaving group'] },
  { name: 'oxidation', keywords: ['oxidation', 'oxidize', 'oxidizing agent', 'loses electrons', 'loses hydrogen'] },
  { name: 'reduction', keywords: ['reduction', 'reduce', 'reducing agent', 'gains electrons', 'gains hydrogen'] },
  { name: 'esterification', keywords: ['esterification', 'ester formation', 'alcohol', 'carboxylic acid'] },
  { name: 'hydrolysis', keywords: ['hydrolysis', 'hydrolyze', 'water', 'breaking bonds'] },
  { name: 'aldol', keywords: ['aldol', 'aldol condensation', 'enolate'] },
  { name: 'friedel-crafts', keywords: ['friedel-crafts', 'FC reaction', 'electrophilic aromatic', 'benzene alkylation'] },
  { name: 'grignard', keywords: ['grignard', 'RMgX', 'organometallic', 'carbon nucleophile'] },
  { name: 'diels-alder', keywords: ['diels-alder', '4π+2π', 'diene', 'dienophile', 'cycloaddition'] },
  { name: 'wittig', keywords: ['wittig', 'phosphonium', 'ylide', 'C=O to C=C'] },
  { name: 'baldwin', keywords: ['baldwin', 'baldwin rule', '6-endo-dig', '5-exo-dig', 'cyclization', 'ring closure'] },
  { name: 'claisen', keywords: ['claisen', 'ester condensation', 'β-keto ester'] },
  { name: 'michael', keywords: ['michael', 'michael addition', 'conjugate addition', 'enolate'] },
  { name: 'heck', keywords: ['heck', 'heck reaction', 'palladium', 'alkene coupling'] },
  { name: 'cross-coupling', keywords: ['cross-coupling', 'coupling reaction', 'palladium', 'organometallic'] },
  { name: 'photochemical', keywords: ['photochemical', 'photolysis', 'light', 'photon', 'irradiation'] },
  { name: 'free-radical', keywords: ['free radical', 'radical', 'chain reaction', 'initiation', 'propagation', 'termination'] },
];

// Topic keywords for simulation detection
const SIMULATION_TOPICS = [
  { topic: 'baldwin', keywords: ['baldwin', 'cyclization', '6-endo-dig', '5-exo-dig', 'ring closure'] },
  { topic: 'orbital', keywords: ['orbital', 'MO', 'HOMO', 'LUMO', 'frontier orbital', 'Woodward-Hoffmann'] },
  { topic: 'kinetics', keywords: ['kinetics', 'rate', 'rate constant', 'activation energy', 'half-life', 'concentration'] },
  { topic: 'thermodynamics', keywords: ['thermodynamics', 'enthalpy', 'entropy', 'Gibbs', 'ΔH', 'ΔS', 'ΔG', 'equilibrium'] },
  { topic: 'reaction-mechanism', keywords: ['mechanism', 'elementary step', 'transition state', 'intermediate', 'rate-determining'] },
];

/**
 * Extract molecules mentioned in the text
 */
export function extractMolecules(text: string): ExtractedMolecule[] {
  const molecules: ExtractedMolecule[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineNum) => {
    COMMON_MOLECULES.forEach(mol => {
      mol.aliases.forEach(alias => {
        const regex = new RegExp(`\\b${alias}\\b`, 'gi');
        let match;

        while ((match = regex.exec(line)) !== null) {
          const confidence = alias === mol.name ? 0.95 : 0.75;
          
          // Check if already extracted at this line
          const exists = molecules.some(
            m => m.name === mol.name && m.lineNumber === lineNum
          );

          if (!exists) {
            molecules.push({
              name: mol.name,
              mention: match[0],
              confidence,
              lineNumber: lineNum,
              context: line.substring(Math.max(0, match.index - 40), Math.min(line.length, match.index + alias.length + 40)),
            });
          }
        }
      });
    });
  });

  // Sort by confidence descending, then by appearance
  return molecules
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
    })
    .slice(0, 10); // Return top 10
}

/**
 * Extract reactions mentioned in the text
 */
export function extractReactions(text: string): ExtractedReaction[] {
  const reactions: ExtractedReaction[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineNum) => {
    REACTION_KEYWORDS.forEach(rxn => {
      rxn.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        let match;

        while ((match = regex.exec(line)) !== null) {
          const confidence = keyword === rxn.name ? 0.95 : 0.75;

          // Check if already extracted at this line
          const exists = reactions.some(
            r => r.name === rxn.name && r.lineNumber === lineNum
          );

          if (!exists) {
            reactions.push({
              name: rxn.name,
              mention: match[0],
              confidence,
              lineNumber: lineNum,
              context: line.substring(Math.max(0, match.index - 40), Math.min(line.length, match.index + keyword.length + 40)),
            });
          }
        }
      });
    });
  });

  return reactions
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
    })
    .slice(0, 8); // Return top 8
}

/**
 * Extract simulation topics that would benefit from interactive visualization
 */
export function extractSimulations(text: string): ExtractedSimulation[] {
  const simulations: ExtractedSimulation[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineNum) => {
    SIMULATION_TOPICS.forEach(sim => {
      sim.keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        let match;

        while ((match = regex.exec(line)) !== null) {
          const confidence = keyword === sim.topic ? 0.95 : 0.75;

          simulations.push({
            topic: sim.topic,
            type: sim.topic as any,
            confidence,
            mention: match[0],
            lineNumber: lineNum,
            context: line.substring(Math.max(0, match.index - 40), Math.min(line.length, match.index + keyword.length + 40)),
          });
        }
      });
    });
  });

  // Deduplicate and sort
  const unique = Array.from(
    new Map(simulations.map(s => [`${s.topic}-${s.lineNumber}`, s])).values()
  );

  return unique
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
    })
    .slice(0, 3); // Return top 3
}

/**
 * Extract AR-relevant keywords (structures, molecules, reactions that benefit from 3D visualization)
 */
export function extractARKeywords(text: string): string[] {
  const arKeywords: string[] = [
    'structure', 'molecular geometry', '3D', '3D structure', 'stereochemistry',
    'stereoisomer', 'optical isomer', 'enantiomer', 'diastereomer', 'conformation',
    'chair conformation', 'axial', 'equatorial', 'staggered', 'eclipsed', 'gauche'
  ];

  const found: string[] = [];

  arKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    if (regex.test(text)) {
      found.push(keyword);
    }
  });

  return found;
}

/**
 * Identify the primary topic/focus of the content
 */
export function identifyPrimaryTopic(text: string): string {
  const topics = extractSimulations(text);
  if (topics.length > 0) {
    return topics[0].topic;
  }

  const reactions = extractReactions(text);
  if (reactions.length > 0) {
    return reactions[0].name;
  }

  return 'general-chemistry';
}

/**
 * Extract all keywords from content for general topic identification
 */
export function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();

  // Extract simulation keywords
  SIMULATION_TOPICS.forEach(sim => {
    sim.keywords.forEach(kw => {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
        keywords.add(kw);
      }
    });
  });

  // Extract reaction keywords
  REACTION_KEYWORDS.forEach(rxn => {
    rxn.keywords.forEach(kw => {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
        keywords.add(kw);
      }
    });
  });

  return Array.from(keywords);
}

/**
 * Main analysis function - performs complete content analysis
 */
export function analyzeContent(text: string): ContentAnalysis {
  return {
    molecules: extractMolecules(text),
    reactions: extractReactions(text),
    simulations: extractSimulations(text),
    arKeywords: extractARKeywords(text),
    primaryTopic: identifyPrimaryTopic(text),
    keywords: extractKeywords(text),
  };
}

/**
 * Get the top N molecules by confidence
 */
export function getTopMolecules(text: string, limit: number = 5): ExtractedMolecule[] {
  return extractMolecules(text).slice(0, limit);
}

/**
 * Get the top N reactions by confidence
 */
export function getTopReactions(text: string, limit: number = 3): ExtractedReaction[] {
  return extractReactions(text).slice(0, limit);
}

/**
 * Check if content mentions a specific molecule
 */
export function hasMolecule(text: string, moleculeName: string): boolean {
  const molecules = extractMolecules(text);
  return molecules.some(m => m.name.toLowerCase() === moleculeName.toLowerCase());
}

/**
 * Check if content mentions a specific reaction type
 */
export function hasReaction(text: string, reactionName: string): boolean {
  const reactions = extractReactions(text);
  return reactions.some(r => r.name.toLowerCase() === reactionName.toLowerCase());
}

/**
 * Check if content would benefit from AR visualization
 */
export function requiresAR(text: string): boolean {
  return extractARKeywords(text).length > 0;
}

/**
 * Find line numbers for highlighting in PDF
 */
export function findRelevantLineNumbers(text: string): number[] {
  const analysis = analyzeContent(text);
  const lineNumbers = new Set<number>();

  // Add lines from molecules, reactions, and simulations
  analysis.molecules.forEach(m => m.lineNumber && lineNumbers.add(m.lineNumber));
  analysis.reactions.forEach(r => r.lineNumber && lineNumbers.add(r.lineNumber));
  analysis.simulations.forEach(s => s.lineNumber && lineNumbers.add(s.lineNumber));

  return Array.from(lineNumbers).sort((a, b) => a - b);
}
