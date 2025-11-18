import { fetchCanonicalSmiles } from './pubchemService';
import { generateTextContent, isGeminiInitialized } from './geminiService';
import { fetchStructuredReaction, StructuredReactionPayload } from './structuredReactionService';
import { sanitizeReactionSmilesInput } from '../utils/reactionSanitizer';

export interface ReactionComponentDetails {
  role: 'reactant' | 'product' | 'agent';
  label?: string;
  original?: string;
  smiles?: string | null;
  canonicalSmiles?: string | null;
  notes?: string;
}

export interface ReactionMechanismStage {
  label: string;
  description?: string;
  smiles?: string[];
}

export interface ReactionResolutionResult {
  reactionSmiles: string;
  components: ReactionComponentDetails[];
  usedGemini: boolean;
  confidence?: number;
  notes?: string;
  reactionName?: string;
  conditions?: string[];
  reactionDescription?: string;
  reactionSmilesWithConditions?: string;
  structuredPayload?: StructuredReactionPayload;
  mechanismStages?: ReactionMechanismStage[];
}

const smilesCache = new Map<string, string | null>();

const sanitizeJson = (rawText: string): string => {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return trimmed;
};

const canonicalizeCandidate = async (value?: string | null): Promise<string | null> => {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }

  if (smilesCache.has(candidate)) {
    return smilesCache.get(candidate) ?? null;
  }

  try {
    const canonical = await fetchCanonicalSmiles(candidate);
    smilesCache.set(candidate, canonical);
    return canonical;
  } catch (error) {
    console.warn('⚠️ Failed to canonicalize candidate:', candidate, error);
    smilesCache.set(candidate, null);
    return null;
  }
};

const canonicalizeEntries = async (
  entries: any[] | undefined,
  role: ReactionComponentDetails['role']
): Promise<ReactionComponentDetails[]> => {
  if (!entries || entries.length === 0) {
    return [];
  }

  const results: ReactionComponentDetails[] = [];

  for (const entry of entries) {
    const asString = typeof entry === 'string' ? entry : undefined;
    const label = typeof entry?.label === 'string' ? entry.label.trim() : typeof entry?.name === 'string' ? entry.name.trim() : undefined;
    const formula = typeof entry?.formula === 'string' ? entry.formula.trim() : undefined;
    const explicitSmiles = typeof entry?.smiles === 'string' ? entry.smiles.trim() : undefined;
    const original = typeof entry?.original === 'string' ? entry.original.trim() : asString ?? label ?? formula ?? explicitSmiles ?? '';

    const attemptOrder = [explicitSmiles, label, formula, original].filter((token): token is string => Boolean(token));

    let canonical: string | null = null;
    for (const candidate of attemptOrder) {
      canonical = await canonicalizeCandidate(candidate);
      if (canonical) break;
    }

    const finalSmiles = canonical ?? explicitSmiles ?? (await canonicalizeCandidate(asString)) ?? asString ?? null;

    results.push({
      role,
      label,
      original,
      smiles: finalSmiles,
      canonicalSmiles: canonical,
      notes: finalSmiles ? undefined : 'Unable to resolve SMILES for this component.'
    });
  }

  return results;
};

const composeSmilesFromComponents = (components: ReactionComponentDetails[]): string | null => {
  const reactants = components.filter(component => component.role === 'reactant' && component.smiles).map(component => String(component.smiles));
  const products = components.filter(component => component.role === 'product' && component.smiles).map(component => String(component.smiles));
  const agents = components.filter(component => component.role === 'agent' && component.smiles).map(component => String(component.smiles));

  if (reactants.length === 0 || products.length === 0) {
    return null;
  }

  const reactantPart = reactants.join('.');
  const productPart = products.join('.');
  const agentPart = agents.join('.');

  return agents.length > 0 ? `${reactantPart}>${agentPart}>${productPart}` : `${reactantPart}>>${productPart}`;
};

interface GeminiAttemptResult {
  resolution: ReactionResolutionResult | null;
  missingReactants: boolean;
  missingProducts: boolean;
}

const normalizeMechanismStages = (value: any): ReactionMechanismStage[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const label = typeof entry?.label === 'string' ? entry.label.trim() : `Stage ${index + 1}`;
      const description = typeof entry?.description === 'string' ? entry.description.trim() : undefined;
      const smiles = Array.isArray(entry?.smiles)
        ? entry.smiles
            .map((token: any) => (typeof token === 'string' ? token.trim() : ''))
            .filter(Boolean)
        : [];

      if (!label && smiles.length === 0) {
        return null;
      }

      return {
        label: label || `Stage ${index + 1}`,
        description,
        smiles,
      } as ReactionMechanismStage;
    })
    .filter((stage): stage is ReactionMechanismStage => Boolean(stage));
};

const buildGeminiReactionPrompt = (
  input: string,
  options: { mode: 'description' | 'name'; enforceFull?: boolean }
): string => {
  const enforceLines = options.enforceFull
    ? [
        '- If any side of the reaction is missing, infer the most representative textbook example and include typical reactants, reagents, catalysts, and products.',
        '- Never leave reactants or products empty; provide best-effort SMILES even when you must make a reasonable assumption.'
      ]
    : [];

  if (options.mode === 'description') {
    return [
      'You are an expert synthetic chemist. Convert the user\'s request into a complete reaction represented as reaction SMILES together with structured component lists.',
      'Return ONLY valid JSON with this shape:',
      '{',
      '  "reactionSmiles": "reactantPart>agentPart>productPart",',
      '  "reactants": [{ "label": "optional name", "smiles": "SMILES" }],',
      '  "agents": [{ "label": "optional", "smiles": "optional" }],',
      '  "products": [{ "label": "optional", "smiles": "SMILES" }],',
      '  "mechanismStages": [',
      '    { "label": "Stage 1", "description": "optional", "smiles": ["SMILES1", "SMILES2"] }',
      '  ],',
      '  "confidence": 0.0-1.0,',
      '  "notes": "optional"',
      '}',
      'Rules:',
      '- If the user only mentions the product or asks what will form, infer the most likely reactants and reagents that produce it.',
      '- If no agents are needed, use an empty array and format reactionSmiles as reactants>>products.',
      '- ALWAYS provide at least one reactant and one product when chemically meaningful.',
      '- Populate "mechanismStages" with 2-4 chronological stages (start, key intermediates, end). Each stage must include SMILES strings for the species present. Reagents/catalysts should appear in their own stage when they drive the transformation.',
      ...enforceLines,
      '- Do not add commentary outside the JSON.',
      '',
      `Reaction description: ${input}`
    ].join('\n');
  }

  return [
    'You are an expert synthetic chemist. Given the name or class of a reaction, propose a representative transformation and express it as reaction SMILES with structured component lists.',
    'Return ONLY valid JSON with this shape:',
    '{',
    '  "reactionSmiles": "reactantPart>agentPart>productPart",',
    '  "reactants": [{ "label": "name", "smiles": "optional SMILES", "notes": "optional" }],',
    '  "agents": [{ "label": "optional", "smiles": "optional", "notes": "optional" }],',
    '  "products": [{ "label": "name", "smiles": "optional SMILES", "notes": "optional" }],',
    '  "mechanismStages": [',
    '    { "label": "Stage 1", "description": "optional", "smiles": ["SMILES1", "SMILES2"] }',
    '  ],',
    '  "confidence": 0.0-1.0,',
    '  "notes": "optional assumptions or variants"',
    '}',
    'Guidelines:',
    '- Choose a canonical textbook example if multiple variants exist.',
    '- Include catalysts, solvents, or reagents in the agents list when essential.',
    '- Provide SMILES when known; leave as null only if genuinely unknown.',
    '- If the user focuses on products, deduce the typical reactants and reagents used to obtain them.',
    '- ALWAYS include both reactants and products in the structured output.',
    '- Populate "mechanismStages" with chronological stages (minimum start/end). Each stage should list the SMILES present during that step.',
    ...enforceLines,
    '- Do not output commentary outside of the JSON.',
    '',
    `Reaction name: ${input}`
  ].join('\n');
};

const normalizePlainReaction = (input: string): string | null => {
  let working = input.trim();
  if (!working) {
    return null;
  }

  const hasArrow = /[>→⇌↔=]/.test(working);
  if (!hasArrow) {
    return null;
  }

  working = working
    .replace(/⇌|↔/g, '>>')
    .replace(/→|⇒|=>|->/g, '>')
    .replace(/\s*\+\s*/g, '.')
    .replace(/\s+/g, '');

  const arrowCount = (working.match(/>/g) ?? []).length;
  if (arrowCount === 1) {
    working = working.replace('>', '>>');
  }

  return working.includes('>') ? working : null;
};

const splitSection = (section: string): string[] => {
  if (!section) {
    return [];
  }

  return section
    .split('.')
    .map(token => token.trim())
    .filter(token => token.length > 0);
};

const parseBySmiles = async (
  candidate: string,
  options: { usedGemini: boolean; confidence?: number; notes?: string }
): Promise<ReactionResolutionResult | null> => {
  const normalized = candidate.replace(/\s+/g, '');
  const parts = normalized.split('>');
  if (parts.length < 2) {
    return null;
  }

  let reactantSection = parts[0] ?? '';
  let agentSection = '';
  let productSection = '';

  if (parts.length === 2) {
    productSection = parts[1] ?? '';
  } else {
    agentSection = parts[1] ?? '';
    productSection = parts.slice(2).join('>');
  }

  const components: ReactionComponentDetails[] = [
    ...(await canonicalizeEntries(splitSection(reactantSection), 'reactant')),
    ...(await canonicalizeEntries(splitSection(agentSection), 'agent')),
    ...(await canonicalizeEntries(splitSection(productSection), 'product'))
  ];

  const reactionSmiles = composeSmilesFromComponents(components);
  if (!reactionSmiles) {
    return null;
  }

  return {
    reactionSmiles,
    components,
    usedGemini: options.usedGemini,
    confidence: options.confidence,
    notes: options.notes
  };
};

const interpretGeminiPayload = async (
  parsed: any,
  options: { usedGemini: boolean }
): Promise<GeminiAttemptResult> => {
  const reactantEntries = Array.isArray(parsed?.reactants) ? parsed.reactants : [];
  const agentEntries = Array.isArray(parsed?.agents) ? parsed.agents : [];
  const productEntries = Array.isArray(parsed?.products) ? parsed.products : [];
  const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : undefined;
  const notes = typeof parsed?.notes === 'string' ? parsed.notes : undefined;
  const mechanismStages = normalizeMechanismStages(parsed?.mechanismStages);

  const components: ReactionComponentDetails[] = [
    ...(await canonicalizeEntries(reactantEntries, 'reactant')),
    ...(await canonicalizeEntries(agentEntries, 'agent')),
    ...(await canonicalizeEntries(productEntries, 'product'))
  ];

  const hasReactants = components.some(component => component.role === 'reactant' && component.smiles);
  const hasProducts = components.some(component => component.role === 'product' && component.smiles);

  const reactionFromComponents = composeSmilesFromComponents(components);
  if (reactionFromComponents) {
    return {
      resolution: {
        reactionSmiles: reactionFromComponents,
        components,
        usedGemini: options.usedGemini,
        confidence,
        notes,
        mechanismStages: mechanismStages.length > 0 ? mechanismStages : undefined
      },
      missingReactants: !hasReactants,
      missingProducts: !hasProducts
    };
  }

  const fallbackCandidate = typeof parsed?.reactionSmiles === 'string' ? parsed.reactionSmiles.trim() : '';
  if (fallbackCandidate) {
    const fallback = await parseBySmiles(fallbackCandidate, {
      usedGemini: options.usedGemini,
      confidence,
      notes
    });

    if (fallback) {
      return {
        resolution: {
          ...fallback,
          mechanismStages: mechanismStages.length > 0 ? mechanismStages : fallback.mechanismStages
        },
        missingReactants: false,
        missingProducts: false
      };
    }
  }

  return {
    resolution: null,
    missingReactants: !hasReactants,
    missingProducts: !hasProducts
  };
};

const interpretStructuredReactionPayload = async (
  payload: StructuredReactionPayload
): Promise<ReactionResolutionResult | null> => {
  if (!payload) {
    return null;
  }

  const rawPrimary = typeof payload['reaction smiles'] === 'string' ? payload['reaction smiles'].trim() : '';
  const rawWithConditions = typeof payload['reaction smiles with conditions'] === 'string'
    ? payload['reaction smiles with conditions'].trim()
    : '';

  const candidateSmiles =
    sanitizeReactionSmilesInput(rawPrimary) ??
    sanitizeReactionSmilesInput(rawWithConditions) ??
    rawPrimary ??
    rawWithConditions;

  if (!candidateSmiles || !candidateSmiles.trim()) {
    return null;
  }

  const description = typeof payload['Reaction Description'] === 'string'
    ? payload['Reaction Description'].trim()
    : undefined;

  const resolution = await parseBySmiles(candidateSmiles.trim(), {
    usedGemini: true,
    notes: description
  });

  if (!resolution) {
    return null;
  }

  const conditions = Array.isArray(payload.condition)
    ? payload.condition
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .filter(value => value.length > 0)
    : [];

  const reactionName = typeof payload['reaction name '] === 'string'
    ? payload['reaction name '].trim()
    : undefined;

  const reactionSmilesWithConditions = rawWithConditions
    ? (sanitizeReactionSmilesInput(rawWithConditions) ?? rawWithConditions).trim()
    : undefined;

  return {
    ...resolution,
    reactionName,
    reactionDescription: description,
    reactionSmilesWithConditions,
    conditions: conditions.length > 0 ? conditions : undefined,
    structuredPayload: payload
  };
};

const requestReactionViaGemini = async (
  input: string,
  options: { mode: 'description' | 'name'; enforceFull?: boolean }
): Promise<GeminiAttemptResult> => {
  try {
    const structuredPayload = await fetchStructuredReaction(input, { mode: options.mode });
    const structuredResult = await interpretStructuredReactionPayload(structuredPayload);
    if (structuredResult) {
      return {
        resolution: structuredResult,
        missingReactants: false,
        missingProducts: false
      };
    }
  } catch (error) {
    console.warn('Structured Gemini reaction attempt failed, falling back to legacy prompt:', error);
  }

  const prompt = buildGeminiReactionPrompt(input, options);
  const aiResponse = await generateTextContent(prompt);
  const jsonPayload = sanitizeJson(aiResponse);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse Gemini reaction response:', error, jsonPayload);
    throw new Error('Gemini could not provide a structured reaction. Please try refining your request.');
  }

  return interpretGeminiPayload(parsed, { usedGemini: true });
};

export const resolveReactionQuery = async (input: string): Promise<ReactionResolutionResult | null> => {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please provide a reaction to analyze.');
  }

  const heuristic = normalizePlainReaction(trimmed);
  if (heuristic) {
    const resolved = await parseBySmiles(heuristic, { usedGemini: false });
    if (resolved) {
      return resolved;
    }
  }

  if (!isGeminiInitialized()) {
    const directAttempt = await parseBySmiles(trimmed, { usedGemini: false });
    if (directAttempt) {
      return directAttempt;
    }

    throw new Error('Unable to interpret the reaction. Provide SMILES or configure Gemini in settings.');
  }

  const firstAttempt = await requestReactionViaGemini(trimmed, { mode: 'description' });
  if (firstAttempt.resolution) {
    return firstAttempt.resolution;
  }

  if (firstAttempt.missingReactants || firstAttempt.missingProducts) {
    const secondAttempt = await requestReactionViaGemini(trimmed, {
      mode: 'description',
      enforceFull: true
    });

    if (secondAttempt.resolution) {
      return secondAttempt.resolution;
    }

    if (secondAttempt.missingReactants || secondAttempt.missingProducts) {
      throw new Error(
        'Gemini could not infer a complete reaction. Try providing more detail about the reactants, reagents, or expected products.'
      );
    }
  }

  throw new Error('Gemini was unable to determine a valid reaction from that description.');
};
export const resolveReactionByName = async (reactionName: string): Promise<ReactionResolutionResult> => {
  const trimmed = reactionName.trim();
  if (!trimmed) {
    throw new Error('Provide a reaction name to analyze.');
  }

  if (!isGeminiInitialized()) {
    throw new Error('Configure your Gemini API key in settings to resolve reaction names automatically.');
  }

  const firstAttempt = await requestReactionViaGemini(trimmed, { mode: 'name' });
  if (firstAttempt.resolution) {
    return firstAttempt.resolution;
  }

  if (firstAttempt.missingReactants || firstAttempt.missingProducts) {
    const secondAttempt = await requestReactionViaGemini(trimmed, {
      mode: 'name',
      enforceFull: true
    });

    if (secondAttempt.resolution) {
      return secondAttempt.resolution;
    }

    if (secondAttempt.missingReactants || secondAttempt.missingProducts) {
      throw new Error(
        'Gemini could not determine a complete reaction for that name. Try providing a specific variant or listing the reagents.'
      );
    }
  }

  throw new Error('Unable to derive a representative reaction from that name. Try specifying typical reactants or products.');
};
