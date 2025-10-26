import type { MoleculeData } from './pubchemService';

type AlphaFoldFormat = 'json' | 'pdb' | 'cif';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface AlphaFoldPrediction {
  entryId: string;
  uniprotAccession: string;
  sequence?: string;
  sequenceChecksum?: string;
  sequenceStart?: number;
  sequenceEnd?: number;
  proteinName?: string;
  organism?: string;
  structureVersion?: string;
  releasedAt?: string;
  pdbUrl?: string;
  cifUrl?: string;
  jsonUrl?: string;
  paeUrl?: string;
  confidenceScores?: number[];
  paeMatrix?: number[][];
  metadata?: Record<string, unknown>;
}

export interface AlphaFoldStructure {
  content: string;
  contentType: 'pdb' | 'cif';
  url: string;
  prediction?: AlphaFoldPrediction;
}

export interface AlphaFoldConfidenceSummary {
  averagePlddt: number;
  highConfidenceResidues: number;
  totalResidues: number;
}

export interface AlphaFoldBatchItem {
  uniprotId: string;
  predictions?: AlphaFoldPrediction[];
  structure?: AlphaFoldStructure | null;
  error?: string;
}

export interface AlphaFoldIntegratorOptions {
  cacheTtlMs?: number;
  cacheEnabled?: boolean;
  rateLimitMs?: number;
  fetchImpl?: typeof fetch;
}

const ALPHAFOLD_BASE_URL = 'https://alphafold.ebi.ac.uk/api';
const DEFAULT_CACHE_TTL = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_RATE_LIMIT = 1000;
const RETRY_LIMIT = 3;

const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

const asStringArray = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const parsed: number[] = [];
  for (const item of value) {
    const numeric = typeof item === 'number' ? item : Number.parseFloat(String(item));
    if (Number.isFinite(numeric)) {
      parsed.push(numeric);
    }
  }
  return parsed.length > 0 ? parsed : undefined;
};

const asMatrix = (value: unknown): number[][] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result: number[][] = [];
  for (const row of value) {
    if (!Array.isArray(row)) {
      continue;
    }
    const parsedRow: number[] = [];
    for (const cell of row) {
      const numeric = typeof cell === 'number' ? cell : Number.parseFloat(String(cell));
      if (Number.isFinite(numeric)) {
        parsedRow.push(numeric);
      }
    }
    if (parsedRow.length) {
      result.push(parsedRow);
    }
  }
  return result.length > 0 ? result : undefined;
};

const normalisePrediction = (raw: any): AlphaFoldPrediction | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entryId = String(raw.entryId ?? raw.modelId ?? raw.dbModelId ?? '').trim();
  const uniprotAccession = String(raw.uniprotAccession ?? raw.uniprotId ?? '').trim();
  if (!entryId || !uniprotAccession) {
    return null;
  }

  const pdbUrl = raw.pdbUrl ?? raw.modelUrl ?? raw.structureUrl;
  const cifUrl = raw.cifUrl ?? raw.fullAtomCifUrl ?? raw.bcifUrl;
  const jsonUrl = raw.jsonUrl ?? raw.metadataUrl;
  const paeUrl = raw.paeUrl ?? raw.paeJsonUrl ?? raw.paeFile;

  const sequenceStart = typeof raw.sequenceStart === 'number'
    ? raw.sequenceStart
    : typeof raw.uniprotStart === 'number'
      ? raw.uniprotStart
      : undefined;

  const sequenceEnd = typeof raw.sequenceEnd === 'number'
    ? raw.sequenceEnd
    : typeof raw.uniprotEnd === 'number'
      ? raw.uniprotEnd
      : undefined;

  const confidenceScores = asStringArray(
    raw.confidenceScores ?? raw.plddt ?? raw.plddtScores ?? raw.modelConfidence
  );

  const paeMatrix = asMatrix(raw.paeMatrix ?? raw.pae);

  return {
    entryId,
    uniprotAccession,
    sequence: typeof raw.sequence === 'string' ? raw.sequence : undefined,
    sequenceChecksum: typeof raw.sequenceChecksum === 'string' ? raw.sequenceChecksum : undefined,
    sequenceStart,
    sequenceEnd,
    proteinName: typeof raw.proteinDescription === 'string' ? raw.proteinDescription : raw.title,
    organism: typeof raw.organismScientificName === 'string' ? raw.organismScientificName : raw.organism,
    structureVersion: typeof raw.version === 'string' ? raw.version : undefined,
    releasedAt: typeof raw.modelCreated === 'string' ? raw.modelCreated : raw.updatedAt,
    pdbUrl: typeof pdbUrl === 'string' ? pdbUrl : undefined,
    cifUrl: typeof cifUrl === 'string' ? cifUrl : undefined,
    jsonUrl: typeof jsonUrl === 'string' ? jsonUrl : undefined,
    paeUrl: typeof paeUrl === 'string' ? paeUrl : undefined,
    confidenceScores,
    paeMatrix,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : undefined,
  };
};

export class AlphaFoldIntegrator {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTtlMs: number;
  private readonly cacheEnabled: boolean;
  private readonly rateLimitMs: number;
  private readonly fetchImpl: typeof fetch;
  private lastRequestAt = 0;

  constructor(options: AlphaFoldIntegratorOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL;
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.rateLimitMs = options.rateLimitMs ?? DEFAULT_RATE_LIMIT;
    const fallbackFetch = options.fetchImpl ?? (globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fallbackFetch) {
      throw new Error('Fetch API is not available. Provide a fetch implementation.');
    }
    this.fetchImpl = fallbackFetch;
  }

  private getCache<T>(key: string): T | null {
    if (!this.cacheEnabled) {
      return null;
    }
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCache<T>(key: string, value: T): void {
    if (!this.cacheEnabled) {
      return;
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.rateLimitMs) {
      await wait(this.rateLimitMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
      try {
        await this.throttle();
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: 'application/json',
          },
        });
        if (response.ok) {
          return (await response.json()) as T;
        }
        if (response.status === 429 && attempt < RETRY_LIMIT - 1) {
          await wait(this.rateLimitMs * (attempt + 1));
          continue;
        }
        const detail = await response.text();
        throw new Error(`AlphaFold request failed (${response.status}): ${detail || response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError ?? new Error('AlphaFold request failed');
  }

  private async fetchText(url: string): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt += 1) {
      try {
        await this.throttle();
        const response = await this.fetchImpl(url);
        if (response.ok) {
          return await response.text();
        }
        if (response.status === 429 && attempt < RETRY_LIMIT - 1) {
          await wait(this.rateLimitMs * (attempt + 1));
          continue;
        }
        const detail = await response.text();
        throw new Error(`AlphaFold download failed (${response.status}): ${detail || response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError ?? new Error('AlphaFold download failed');
  }

  private predictionCacheKey(uniprotId: string, format: AlphaFoldFormat): string {
    return `alphafold:${format}:${uniprotId.toUpperCase()}`;
  }

  async fetchPredictions(uniprotId: string): Promise<AlphaFoldPrediction[]> {
    const key = this.predictionCacheKey(uniprotId, 'json');
    const cached = this.getCache<AlphaFoldPrediction[]>(key);
    if (cached) {
      return cached;
    }
    const payload = await this.fetchJson<unknown>(`${ALPHAFOLD_BASE_URL}/prediction/${encodeURIComponent(uniprotId)}`);
    const records = Array.isArray(payload)
      ? payload
      : payload
        ? [payload]
        : [];
    const predictions: AlphaFoldPrediction[] = [];
    for (const record of records) {
      const normalised = normalisePrediction(record);
      if (normalised) {
        predictions.push(normalised);
      }
    }
    this.setCache(key, predictions);
    return predictions;
  }

  async fetchStructure(uniprotId: string, format: 'pdb' | 'cif' = 'pdb'): Promise<AlphaFoldStructure | null> {
    const key = this.predictionCacheKey(uniprotId, format);
    const cached = this.getCache<AlphaFoldStructure>(key);
    if (cached) {
      return cached;
    }
    const predictions = await this.fetchPredictions(uniprotId);
    const primary = predictions[0];
    if (!primary) {
      return null;
    }
    const targetUrl = format === 'cif' ? primary.cifUrl : primary.pdbUrl ?? primary.cifUrl;
    if (!targetUrl) {
      return null;
    }
    const content = await this.fetchText(targetUrl);
    const structure: AlphaFoldStructure = {
      content,
      contentType: targetUrl.toLowerCase().endsWith('.cif') ? 'cif' : 'pdb',
      url: targetUrl,
      prediction: primary,
    };
    this.setCache(key, structure);
    return structure;
  }

  async getConfidenceSummary(uniprotId: string): Promise<AlphaFoldConfidenceSummary | null> {
    const predictions = await this.fetchPredictions(uniprotId);
    const primary = predictions[0];
    if (!primary) {
      return null;
    }
    const scores = primary.confidenceScores;
    if (!scores || scores.length === 0) {
      return null;
    }
    const total = scores.reduce((acc, value) => acc + value, 0);
    const averagePlddt = total / scores.length;
    const highConfidenceResidues = scores.filter((value) => value >= 90).length;
    return {
      averagePlddt,
      highConfidenceResidues,
      totalResidues: scores.length,
    };
  }

  async batchFetch(uniprotIds: string[], format: AlphaFoldFormat = 'json'): Promise<AlphaFoldBatchItem[]> {
    const results: AlphaFoldBatchItem[] = [];
    for (const uniprotId of uniprotIds) {
      const entry: AlphaFoldBatchItem = { uniprotId };
      try {
        if (format === 'json') {
          entry.predictions = await this.fetchPredictions(uniprotId);
        } else {
          entry.structure = await this.fetchStructure(uniprotId, format);
          if (!entry.structure) {
            entry.error = 'Structure not available';
          }
        }
      } catch (error) {
        entry.error = error instanceof Error ? error.message : String(error);
      }
      results.push(entry);
    }
    return results;
  }

  async toMoleculeData(uniprotId: string): Promise<MoleculeData | null> {
    const structure = await this.fetchStructure(uniprotId, 'pdb');
    if (!structure || !structure.prediction) {
      return null;
    }
    const { prediction } = structure;
    const cidCandidate = Number.parseInt(prediction.uniprotAccession, 36);
    const cid = Number.isFinite(cidCandidate) ? cidCandidate : Date.now();
    return {
      name: prediction.proteinName ?? uniprotId,
      cid,
      molecularFormula: 'Protein',
      molecularWeight: 0,
      svgUrl: '',
      smiles: '',
      sdfData: undefined,
      sdf3DData: undefined,
      displayName: `${prediction.proteinName ?? uniprotId} (AlphaFold)`,
      role: 'protein',
      source: 'alphafold',
      sourceQuery: uniprotId,
      pdbUrl: structure.url,
      organism: prediction.organism,
    };
  }
}

export const alphaFoldIntegrator = new AlphaFoldIntegrator();
