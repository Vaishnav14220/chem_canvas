import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dna, ArrowLeft, Loader2, ExternalLink, Download, BarChart2, Share2, Layers, Eye, EyeOff, AlertCircle } from 'lucide-react';
import {
  alphaFoldIntegrator,
  type AlphaFoldPrediction,
  type AlphaFoldBatchItem,
  type AlphaFoldConfidenceSummary,
} from '../services/alphafoldIntegrator';
import PDBViewer3D from './PDBViewer3D';

interface AlphaFoldWorkspaceProps {
  onClose: () => void;
}

type PendingState = 'idle' | 'loading' | 'batch';

const formatDate = (value?: string) => {
  if (!value) {
    return 'Not provided';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

const averageConfidence = (scores?: number[]) => {
  if (!scores || scores.length === 0) {
    return null;
  }
  const total = scores.reduce((acc, value) => acc + value, 0);
  return total / scores.length;
};

const clampPercentage = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

const parseBatchInput = (value: string) => {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => entry.toUpperCase());
};

const chunkSequence = (sequence?: string, chunkSize = 60): string[] => {
  if (!sequence) {
    return [];
  }
  const chunks: string[] = [];
  for (let index = 0; index < sequence.length; index += chunkSize) {
    chunks.push(sequence.slice(index, index + chunkSize));
  }
  return chunks;
};

const DEFAULT_UNIPROT = 'P69905'; // Hemoglobin subunit alpha (common starter example)

const AlphaFoldWorkspace = ({ onClose }: AlphaFoldWorkspaceProps) => {
  const [uniprotId, setUniprotId] = useState('');
  const [predictions, setPredictions] = useState<AlphaFoldPrediction[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<AlphaFoldPrediction | null>(null);
  const [confidenceSummary, setConfidenceSummary] = useState<AlphaFoldConfidenceSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingState, setPendingState] = useState<PendingState>('idle');
  const [batchInput, setBatchInput] = useState('');
  const [batchResults, setBatchResults] = useState<AlphaFoldBatchItem[]>([]);
  const [showStructureViewer, setShowStructureViewer] = useState(true);
  const [showAlphaFoldEmbed, setShowAlphaFoldEmbed] = useState(true);
  const [paeMatrix, setPaeMatrix] = useState<number[][] | null>(null);
  const [isLoadingPae, setIsLoadingPae] = useState(false);
  const [paeError, setPaeError] = useState<string | null>(null);
  const hasPrefetchedRef = useRef(false);
  const paeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedAverageConfidence = useMemo(() => averageConfidence(selectedPrediction?.confidenceScores), [selectedPrediction]);
  const selectedCoverage = useMemo(() => {
    if (!selectedPrediction) {
      return null;
    }
    const start = typeof selectedPrediction.sequenceStart === 'number' ? selectedPrediction.sequenceStart : undefined;
    const end = typeof selectedPrediction.sequenceEnd === 'number' ? selectedPrediction.sequenceEnd : undefined;
    if (!start || !end || end < start) {
      return null;
    }
    return `${start}-${end}`;
  }, [selectedPrediction]);

  const loadPredictions = useCallback(async (accession: string) => {
    const trimmed = accession.trim();
    if (!trimmed) {
      setErrorMessage('Enter a UniProt accession to continue.');
      return;
    }

    const normalized = trimmed.toUpperCase();
    setPendingState('loading');
    setStatusMessage(null);
    setErrorMessage(null);
  setShowStructureViewer(true);
  setShowAlphaFoldEmbed(true);
    setPaeMatrix(null);
    setPaeError(null);

    try {
      const records = await alphaFoldIntegrator.fetchPredictions(normalized);
      setUniprotId(normalized);
      setPredictions(records);
      if (!records.length) {
        setSelectedPrediction(null);
        setConfidenceSummary(null);
        setStatusMessage(`No AlphaFold entries found for ${normalized}.`);
        return;
      }
      setSelectedPrediction(records[0]);
      const summary = await alphaFoldIntegrator.getConfidenceSummary(normalized);
      setConfidenceSummary(summary);
      setStatusMessage(`Loaded ${records.length} AlphaFold entr${records.length === 1 ? 'y' : 'ies'} for ${normalized}.`);
    } catch (error) {
      console.error('AlphaFold fetch failed', error);
      setErrorMessage('Unable to retrieve predictions right now. Please try again shortly.');
    } finally {
      setPendingState('idle');
    }
  }, []);

  const handleLoadPrediction = () => {
    void loadPredictions(uniprotId);
  };

  useEffect(() => {
    if (hasPrefetchedRef.current) {
      return;
    }

    hasPrefetchedRef.current = true;
    void loadPredictions(DEFAULT_UNIPROT);
  }, [loadPredictions]);

  const handleSelectPrediction = async (prediction: AlphaFoldPrediction) => {
    setSelectedPrediction(prediction);
    setStatusMessage(null);
    setErrorMessage(null);
  setShowStructureViewer(true);
  setShowAlphaFoldEmbed(true);
    setPaeMatrix(null);
    setPaeError(null);

    try {
      const summary = await alphaFoldIntegrator.getConfidenceSummary(prediction.uniprotAccession);
      setConfidenceSummary(summary);
    } catch (error) {
      console.warn('Confidence summary unavailable', error);
      setConfidenceSummary(null);
    }
  };

  const handleBatchLookup = async () => {
    const ids = parseBatchInput(batchInput);
    if (!ids.length) {
      setErrorMessage('Add at least one UniProt accession for batch processing.');
      return;
    }

    setPendingState('batch');
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const results = await alphaFoldIntegrator.batchFetch(ids, 'json');
      setBatchResults(results);
      setStatusMessage(`Processed ${results.length} accession${results.length === 1 ? '' : 's'}.`);
    } catch (error) {
      console.error('Batch lookup failed', error);
      setErrorMessage('Batch lookup failed. Check the accessions and try again.');
    } finally {
      setPendingState('idle');
    }
  };

  useEffect(() => {
    if (!selectedPrediction?.paeUrl) {
      setPaeMatrix(null);
      setIsLoadingPae(false);
      setPaeError(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingPae(true);
    setPaeError(null);

    fetch(selectedPrediction.paeUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`AlphaFold PAE request failed (${response.status})`);
        }
        const payload = await response.json();
        const matrix = Array.isArray(payload?.predicted_aligned_error)
          ? payload.predicted_aligned_error
          : Array.isArray(payload?.pae)
            ? payload.pae
            : null;
        if (!matrix || !Array.isArray(matrix[0])) {
          throw new Error('PAE matrix unavailable for this entry.');
        }
        if (!isCancelled) {
          setPaeMatrix(matrix as number[][]);
        }
      })
      .catch((error) => {
        console.warn('PAE fetch failed', error);
        if (!isCancelled) {
          setPaeMatrix(null);
          setPaeError('Unable to load the predicted aligned error matrix for this entry.');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPae(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedPrediction?.paeUrl]);

  useEffect(() => {
    if (!paeMatrix || !paeCanvasRef.current) {
      return;
    }

    const canvas = paeCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const size = paeMatrix.length;
    const maxValue = 30;
    const scale = Math.max(1, Math.floor(320 / size));
    canvas.width = size * scale;
    canvas.height = size * scale;

    const colorForValue = (value: number) => {
      const clamped = Math.max(0, Math.min(maxValue, value));
      const hue = 220 - (clamped / maxValue) * 220; // blue (low) -> red (high)
      return `hsl(${hue}, 90%, 55%)`;
    };

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        context.fillStyle = colorForValue(paeMatrix[y][x]);
        context.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [paeMatrix]);

  const alphaFoldEntryUrl = useMemo(() => {
    if (!selectedPrediction?.uniprotAccession) {
      return null;
    }
    return `https://alphafold.ebi.ac.uk/entry/${selectedPrediction.uniprotAccession}?embedded=true`;
  }, [selectedPrediction]);

  const sequenceChunks = useMemo(() => chunkSequence(selectedPrediction?.sequence), [selectedPrediction?.sequence]);

  const maxPae = useMemo(() => {
    if (!paeMatrix) {
      return null;
    }
    let max = 0;
    for (const row of paeMatrix) {
      for (const value of row) {
        if (value > max) {
          max = value;
        }
      }
    }
    return max;
  }, [paeMatrix]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600/90">
            <Dna className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">AlphaFold Explorer</h2>
            <p className="text-xs text-slate-400">Query UniProt accessions and explore AlphaFold insights without leaving the workspace.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">UniProt accession</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  value={uniprotId}
                  onChange={(event) => setUniprotId(event.target.value.toUpperCase())}
                  placeholder="E.g. P05067"
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleLoadPrediction}
                  disabled={pendingState !== 'idle'}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-70"
                >
                  {pendingState === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  Load
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Tip: any valid UniProt accession will stream the latest AlphaFold model metadata and associated download links.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">Available predictions</span>
                <span className="text-xs text-slate-400">{predictions.length || 'None'}</span>
              </div>
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                {predictions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/40 px-3 py-6 text-center text-xs text-slate-500">
                    Load an accession to list AlphaFold entries.
                  </div>
                ) : (
                  predictions.map((prediction) => {
                    const mean = averageConfidence(prediction.confidenceScores);
                    const isActive = selectedPrediction?.entryId === prediction.entryId;
                    return (
                      <button
                        type="button"
                        key={`${prediction.entryId}-${prediction.structureVersion ?? 'default'}`}
                        onClick={() => handleSelectPrediction(prediction)}
                        className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'border-blue-500/70 bg-slate-800/80'
                            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">{prediction.proteinName ?? prediction.entryId}</p>
                            <p className="text-xs text-slate-400">{prediction.organism ?? 'Organism not listed'}</p>
                          </div>
                          <div className="text-right text-[11px] leading-5 text-slate-400">
                            <div>{prediction.entryId}</div>
                            {prediction.structureVersion && <div>v{prediction.structureVersion}</div>}
                            <div>{formatDate(prediction.releasedAt)}</div>
                          </div>
                        </div>
                        {typeof mean === 'number' && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Average pLDDT</span>
                              <span>{mean.toFixed(1)}</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${clampPercentage(mean)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-300" />
                <span className="text-sm font-semibold text-slate-100">Batch accession lookup</span>
              </div>
              <textarea
                value={batchInput}
                onChange={(event) => setBatchInput(event.target.value)}
                placeholder="Paste multiple UniProt IDs separated by spaces or new lines"
                rows={4}
                className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={handleBatchLookup}
                  disabled={pendingState !== 'idle'}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500 hover:text-blue-200 disabled:opacity-70"
                >
                  {pendingState === 'batch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  Run batch
                </button>
                <span className="text-[11px] text-slate-500">JSON metadata only · preserves caching</span>
              </div>
              {batchResults.length > 0 && (
                <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                  {batchResults.map((item) => (
                    <div
                      key={item.uniprotId}
                      className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-100">{item.uniprotId}</span>
                        <span className="text-slate-400">
                          {item.error
                            ? `Error: ${item.error}`
                            : item.predictions?.length
                              ? `${item.predictions.length} prediction${item.predictions.length === 1 ? '' : 's'}`
                              : item.structure
                                ? `${item.structure.contentType.toUpperCase()} ready`
                                : 'No data returned'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {selectedPrediction ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{selectedPrediction.proteinName ?? 'AlphaFold model'}</h3>
                      <p className="text-xs text-slate-400">{selectedPrediction.organism ?? 'Organism not provided'}</p>
                    </div>
                    <div className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-right text-[11px] text-blue-200">
                      <div className="font-semibold">{selectedPrediction.uniprotAccession}</div>
                      <div>{selectedPrediction.entryId}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-slate-300 md:grid-cols-2">
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="text-slate-500">Sequence coverage</div>
                      <div className="text-sm text-slate-100">{selectedCoverage ?? 'Not reported'}</div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="text-slate-500">Structure version</div>
                      <div className="text-sm text-slate-100">{selectedPrediction.structureVersion ?? 'Latest'}</div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="text-slate-500">Release date</div>
                      <div className="text-sm text-slate-100">{formatDate(selectedPrediction.releasedAt)}</div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <div className="text-slate-500">Sequence checksum</div>
                      <div className="text-sm text-slate-100 break-all">{selectedPrediction.sequenceChecksum ?? 'Not available'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <BarChart2 className="h-4 w-4 text-blue-300" />
                      Model confidence
                    </div>
                    <div className="mt-3 space-y-3">
                      {(selectedAverageConfidence ?? null) !== null ? (
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Average pLDDT</span>
                            <span>{selectedAverageConfidence?.toFixed(1)}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${clampPercentage(selectedAverageConfidence)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Per-residue confidence scores are not available for this entry.</p>
                      )}

                      {confidenceSummary && (
                        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                          <div>
                            <div className="text-slate-500">Avg pLDDT</div>
                            <div className="text-sm text-slate-100">{confidenceSummary.averagePlddt.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">High-confidence residues</div>
                            <div className="text-sm text-slate-100">{confidenceSummary.highConfidenceResidues}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Residue count</div>
                            <div className="text-sm text-slate-100">{confidenceSummary.totalResidues}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-semibold text-slate-100">Amino acid sequence</div>
                    {sequenceChunks.length > 0 ? (
                      <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-slate-950/60 p-3 text-xs font-mono leading-5 text-slate-200">
                        {sequenceChunks.map((line, index) => (
                          <span key={`${line}-${index}`} className="block">
                            <span className="pr-2 text-slate-500">{String(index * 60 + 1).padStart(4, ' ')}:</span>
                            {line}
                          </span>
                        ))}
                      </pre>
                    ) : (
                      <p className="mt-3 text-xs text-slate-400">Sequence data is not available for this prediction.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-100">Structure assets</span>
                    <a
                      href={`https://alphafold.ebi.ac.uk/entry/${selectedPrediction.uniprotAccession}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-blue-200 hover:text-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open official entry
                    </a>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {selectedPrediction.pdbUrl && (
                      <a
                        href={selectedPrediction.pdbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500 hover:text-blue-200"
                      >
                        <Download className="h-4 w-4" />
                        Download PDB
                      </a>
                    )}
                    {selectedPrediction.cifUrl && (
                      <a
                        href={selectedPrediction.cifUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500 hover:text-blue-200"
                      >
                        <Download className="h-4 w-4" />
                        Download CIF
                      </a>
                    )}
                    {selectedPrediction.jsonUrl && (
                      <a
                        href={selectedPrediction.jsonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500 hover:text-blue-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Metadata JSON
                      </a>
                    )}
                    {selectedPrediction.paeUrl && (
                      <a
                        href={selectedPrediction.paeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500 hover:text-blue-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Download PAE JSON
                      </a>
                    )}
                  </div>
                </div>

                {selectedPrediction?.pdbUrl && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">Interactive 3D viewer</h3>
                        <p className="text-xs text-slate-400">Three.js powered structure visualization.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStructureViewer((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                      >
                        {showStructureViewer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showStructureViewer ? 'Hide viewer' : 'Show viewer'}
                      </button>
                    </div>
                    {showStructureViewer && (
                      <div className="w-full">
                        <PDBViewer3D pdbUrl={selectedPrediction.pdbUrl} />
                      </div>
                    )}
                  </div>
                )}

                {alphaFoldEntryUrl && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">AlphaFold web embed</h3>
                        <p className="text-xs text-slate-400">Official AlphaFold entry rendered inline.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://alphafold.ebi.ac.uk/entry/${selectedPrediction.uniprotAccession}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-200 hover:text-blue-100"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open tab
                        </a>
                        <button
                          type="button"
                          onClick={() => setShowAlphaFoldEmbed((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                        >
                          {showAlphaFoldEmbed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showAlphaFoldEmbed ? 'Hide embed' : 'Show embed'}
                        </button>
                      </div>
                    </div>
                    {showAlphaFoldEmbed && (
                      <div className="aspect-[16/9] w-full">
                        <iframe
                          key={alphaFoldEntryUrl}
                          src={alphaFoldEntryUrl}
                          title="Embedded AlphaFold entry"
                          className="h-full w-full border-0"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}

                {(selectedPrediction.paeUrl || paeMatrix || isLoadingPae || paeError) && (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <Layers className="h-4 w-4 text-blue-300" />
                      Predicted aligned error (Å)
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Lower values indicate higher positional confidence for residue pairs.
                    </p>
                    {isLoadingPae ? (
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading PAE matrix…
                      </div>
                    ) : paeError ? (
                      <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-100">
                        <AlertCircle className="h-4 w-4" />
                        {paeError}
                      </div>
                    ) : paeMatrix ? (
                      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
                        <canvas
                          ref={paeCanvasRef}
                          className="w-full max-w-xl rounded-md border border-slate-800 bg-slate-950"
                        />
                        <div className="space-y-2 text-xs text-slate-300">
                          <p>
                            Each pixel captures the expected error when aligning residue <span className="font-semibold">i</span> to
                            residue <span className="font-semibold">j</span>.
                          </p>
                          {maxPae !== null && (
                            <p>
                              <span className="font-semibold text-slate-100">Maximum observed error: </span>
                              {maxPae.toFixed(2)} Å
                            </p>
                          )}
                          <div>
                            <p className="font-semibold text-slate-100">Legend</p>
                            <p className="text-slate-400">Blue = high confidence, Red = low confidence (0 → 30 Å).</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                        A PAE matrix is not available for this entry.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 text-sm text-slate-500">
                Load an accession and select a prediction to inspect AlphaFold metadata.
              </div>
            )}

            {(statusMessage || errorMessage) && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  errorMessage
                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : 'border-blue-500/40 bg-blue-500/10 text-blue-100'
                } lg:col-span-2`}
              >
                {errorMessage ?? statusMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlphaFoldWorkspace;
