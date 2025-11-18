import { extractJsonBlock, generateTextContent, isGeminiInitialized } from './geminiService';
import { fetchMoleculeStructure, searchMolecule } from './pubchemService';
import { resolveReactionQuery } from './reactionResolver';
import { fetchYouTubeVideos } from './youtubeService';
import { analyzePdfTextWithGemini } from './pdfInsightsService';
import { generateReactionSvg } from './nameReactionApi';
import type { AIToolResponse, ReactionComponentSummary } from '../types';

type ToolCallName = 'molecule_viewer' | 'reaction_lookup' | 'video_search' | 'document_insights';

interface ToolCallPlan {
  name: ToolCallName;
  query: string;
  reason?: string;
  confidence?: number;
}

export interface ToolCallContext {
  documentText?: string;
  documentName?: string;
}

interface ToolRouterPayload {
  toolCalls?: Array<{
    name?: string;
    query?: string;
    reason?: string;
    confidence?: number;
  }>;
}

const TOOL_PROMPT = (message: string, options?: { hasDocumentContent?: boolean }) => {
  const docStatus = options?.hasDocumentContent ? 'available' : 'unavailable';
  return [
    'You route chemistry-related user prompts to specialized tools when doing so would provide visual or curated context.',
    'Tools:',
    '1. molecule_viewer – show 3D MolView embeds for molecules or compounds (input: { "query": "<compound name or formula>" }).',
    '2. reaction_lookup – fetch structured reaction SMILES, reactants, products, and mechanism steps (input: { "query": "<reaction name or description>" }).',
    '3. video_search – suggest high-signal YouTube videos for a chemistry topic (input: { "query": "<topic>" }).',
    `4. document_insights – summarize uploaded study documents (input: { "query": "<topic or document hint>" }). Only use when documents are ${docStatus}.`,
    'Return JSON only: {"toolCalls":[{ "name":"molecule_viewer", "query":"...", "reason":"...", "confidence":0-1 }]}',
    'Rules:',
    '- Trigger at most two toolCalls.',
    '- Prefer molecule_viewer for explicit molecule/compound requests.',
    '- Prefer reaction_lookup for named reactions or mechanism questions.',
    '- Only choose document_insights if documents exist and the prompt references notes, docs, or sources.',
    '- If no tool adds value, return {"toolCalls":[]}.',
    '',
    `User message: ${message}`
  ].join('\n');
};

const FALLBACK_RULES: Array<{ name: ToolCallName; regex: RegExp }> = [
  { name: 'molecule_viewer', regex: /\b(molecule|benzene|structure|3d|geometry|ring|aromatic)\b/i },
  { name: 'reaction_lookup', regex: /\b(reaction|mechanism|synthesis|pathway|degradation|rearrangement)\b/i },
  { name: 'video_search', regex: /\b(video|watch|lecture|explain|tutorial)\b/i },
];

const sanitizeQuery = (value?: string): string => value?.trim() ?? '';

const deriveFallbackPlans = (message: string): ToolCallPlan[] => {
  const plans: ToolCallPlan[] = [];
  const lower = message.toLowerCase();
  for (const rule of FALLBACK_RULES) {
    if (rule.regex.test(lower)) {
      plans.push({
        name: rule.name,
        query: message,
        reason: 'Keyword trigger',
        confidence: 0.35
      });
      if (plans.length === 2) break;
    }
  }
  return plans;
};

export const detectToolCalls = async (
  message: string,
  options?: { hasDocumentContent?: boolean }
): Promise<ToolCallPlan[]> => {
  const trimmed = sanitizeQuery(message);
  if (!trimmed) {
    return [];
  }

  if (!isGeminiInitialized()) {
    return deriveFallbackPlans(trimmed);
  }

  try {
    const routerPrompt = TOOL_PROMPT(trimmed, options);
    const raw = await generateTextContent(routerPrompt);
    const jsonPayload = extractJsonBlock(raw);
    const parsed = JSON.parse(jsonPayload) as ToolRouterPayload;
    if (!Array.isArray(parsed?.toolCalls)) {
      return [];
    }

    return parsed.toolCalls
      .map(call => {
        const name = call?.name?.trim() as ToolCallName | undefined;
        const query = sanitizeQuery(call?.query);
        if (!name || !query) {
          return null;
        }
        if (name === 'document_insights' && options?.hasDocumentContent === false) {
          return null;
        }
        return {
          name,
          query,
          reason: call?.reason?.trim(),
          confidence: typeof call?.confidence === 'number' ? call.confidence : undefined
        } as ToolCallPlan;
      })
      .filter((plan): plan is ToolCallPlan => Boolean(plan))
      .slice(0, 2);
  } catch (error) {
    console.warn('⚠️ Tool routing failed, using fallback heuristics:', error);
    return deriveFallbackPlans(trimmed);
  }
};

const buildMoleculeResponse = async (plan: ToolCallPlan): Promise<AIToolResponse | null> => {
  const query = sanitizeQuery(plan.query);
  if (!query) {
    return null;
  }

  try {
    const cid = await searchMolecule(query);
    const molecule = cid ? await fetchMoleculeStructure(cid) : null;
    const embedUrl = cid
      ? `https://embed.molview.org/v1/?mode=balls&cid=${cid}`
      : `https://embed.molview.org/v1/?mode=balls&q=${encodeURIComponent(query)}`;

    const highlight =
      typeof molecule?.analysis === 'string'
        ? molecule.analysis
        : undefined;

    return {
      id: `molecule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'molecule',
      title: molecule?.displayName ?? molecule?.name ?? query,
      summary: plan.reason ?? 'Interactive 3D molecule preview',
      embedUrl,
      formula: molecule?.molecularFormula,
      molecularWeight: molecule?.molecularWeight,
      smiles: molecule?.smiles,
      cid: molecule?.cid ?? cid ?? undefined,
      query,
      highlights: highlight ? [highlight] : undefined
    };
  } catch (error) {
    console.warn('⚠️ Molecule lookup failed:', error);
    return null;
  }
};

const buildReactionResponse = async (plan: ToolCallPlan): Promise<AIToolResponse | null> => {
  const query = sanitizeQuery(plan.query);
  if (!query) {
    return null;
  }

  try {
    const resolution = await resolveReactionQuery(query);
    if (!resolution) {
      return null;
    }

    const components: ReactionComponentSummary[] = (resolution.components ?? []).map(component => ({
      role: component.role,
      label: component.label ?? component.original,
      smiles: component.smiles ?? component.canonicalSmiles ?? null,
      notes: component.notes
    }));

    let reactionSvg: string | undefined;
    const svgLookupName = resolution.reactionName ?? query;
    if (svgLookupName) {
      try {
        const svgContent = await generateReactionSvg(svgLookupName);
        if (svgContent?.includes('<svg')) {
          reactionSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
        }
      } catch (svgError) {
        console.warn('HF reaction SVG fetch failed:', svgError);
      }
    }

    return {
      id: `reaction-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'reaction',
      title: resolution.reactionName ?? `Reaction insight`,
      summary: plan.reason ?? resolution.reactionDescription ?? 'Structured reaction overview',
      reactionSmiles: resolution.reactionSmiles,
      components,
      mechanismStages: resolution.mechanismStages?.map(stage => ({
        label: stage.label,
        description: stage.description,
        smiles: stage.smiles
      })),
      notes: resolution.notes,
      query,
      reactionSvg
    };
  } catch (error) {
    console.warn('⚠️ Reaction resolver failed:', error);
    return null;
  }
};

const buildVideoResponse = async (plan: ToolCallPlan): Promise<AIToolResponse | null> => {
  const query = sanitizeQuery(plan.query);
  if (!query) {
    return null;
  }

  try {
    const videos = await fetchYouTubeVideos({ query, maxResults: 3 });
    if (!videos.length) {
      return null;
    }

    return {
      id: `video-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'video',
      title: `Video picks for ${query}`,
      summary: plan.reason ?? 'High-signal tutorials pulled from YouTube',
      query,
      videos: videos.map(video => ({
        id: video.id,
        title: video.title,
        url: video.url,
        channelTitle: video.channelTitle,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        description: video.description
      }))
    };
  } catch (error) {
    console.warn('⚠️ Video search failed:', error);
    return null;
  }
};

const buildDocumentResponse = async (
  plan: ToolCallPlan,
  context?: ToolCallContext
): Promise<AIToolResponse | null> => {
  if (!context?.documentText) {
    return null;
  }

  try {
    const insights = await analyzePdfTextWithGemini(
      context.documentName ?? 'Uploaded sources',
      context.documentText
    );

    return {
      id: `document-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'document',
      title: context.documentName ?? 'Document insights',
      summary: insights.summary,
      keyTopics: insights.keyTopics,
      essentialConcepts: insights.essentialConcepts,
      videoQueries: insights.videoQueries,
      sourceName: context.documentName
    };
  } catch (error) {
    console.warn('⚠️ Document insight generation failed:', error);
    return null;
  }
};

export const executeToolCalls = async (
  plans: ToolCallPlan[],
  context?: ToolCallContext
): Promise<AIToolResponse[]> => {
  if (!plans.length) {
    return [];
  }

  const limitedPlans = plans.slice(0, 2);
  const results: AIToolResponse[] = [];

  for (const plan of limitedPlans) {
    try {
      let response: AIToolResponse | null = null;
      switch (plan.name) {
        case 'molecule_viewer':
          response = await buildMoleculeResponse(plan);
          break;
        case 'reaction_lookup':
          response = await buildReactionResponse(plan);
          break;
        case 'video_search':
          response = await buildVideoResponse(plan);
          break;
        case 'document_insights':
          response = await buildDocumentResponse(plan, context);
          break;
      }

      if (response) {
        results.push(response);
      }
    } catch (error) {
      console.warn('⚠️ Tool execution error:', error);
    }
  }

  return results;
};
