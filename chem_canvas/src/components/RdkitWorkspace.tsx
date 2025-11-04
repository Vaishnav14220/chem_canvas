import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Beaker, BookOpen, Copy, Eraser, FlaskConical, Loader2, RefreshCw, Search, Star, Wand2 } from 'lucide-react';
import { rdkitService, type RDKitMolecule } from '../services/rdkitService';
import { isGeminiInitialized, resolveMoleculeDescription, type MoleculeResolutionResult } from '../services/geminiService';
import { resolveReactionByName, resolveReactionQuery, type ReactionResolutionResult } from '../services/reactionResolver';
import KekuleReactionWidget from './KekuleReactionWidget';

interface RdkitWorkspaceProps {
  onStatusChange?: (status: 'idle' | 'loading' | 'error') => void;
}

type SubstructureResult = {
  query: string;
  matches: number[][];
  timestamp: number;
};

const SAMPLE_MOLECULES = [
  {
    name: 'Aspirin',
    smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
    note: 'Analgesic benchmark – ester + aromatic ring'
  },
  {
    name: 'Caffeine',
    smiles: 'Cn1cnc2n(C)c(=O)n(C)c(=O)n12',
    note: 'Alkaloid heterocycles with fused rings'
  },
  {
    name: 'L-DOPA',
    smiles: 'C[C@H](O)[C@H](NC(=O)O)Cc1ccc(O)c(O)c1',
    note: 'Chiral amino acid derivative'
  },
  {
    name: 'Taxol (micro)',
    smiles: 'CC1=C2C(=C(C(=O)O1)O)C(=O)OC(CC3=CC(=C(C=C3)O)O)O[C@H]4[C@H]([C@@H]([C@@H]([C@H]4OC(=O)C)OC(=O)C(C)(C)O)OC(=O)C(C)(C)O)C',
    note: 'Large scaffold – good stress test'
  }
];

const SMARTS_LIBRARY = [
  { label: 'Aromatic ring', smarts: 'a1aaaaa1' },
  { label: 'Carbonyl', smarts: '[CX3](=O)[OX1H0-,OX2H1]' },
  { label: 'Basic amine', smarts: '[NX3;H2,H1;!$(NC=O)]' },
  { label: 'Hydrogen bond donor', smarts: '[!$([#6,H0,-,-2,-3])]H' }
];

const formatNumber = (value?: number, digits = 2) =>
  (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—');

const RdkitWorkspace: React.FC<RdkitWorkspaceProps> = ({ onStatusChange }) => {
  const [inputValue, setInputValue] = useState('CCO');
  const [rdkitReady, setRdkitReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [moleculeData, setMoleculeData] = useState<RDKitMolecule | null>(null);
  const [substructureInput, setSubstructureInput] = useState('');
  const [substructureHistory, setSubstructureHistory] = useState<SubstructureResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [geminiResolution, setGeminiResolution] = useState<MoleculeResolutionResult | null>(null);
  const [reactionPrompt, setReactionPrompt] = useState('');
  const [reactionSvg, setReactionSvg] = useState<string | null>(null);
  const [reactionResolution, setReactionResolution] = useState<ReactionResolutionResult | null>(null);
  const moleculeRef = useRef<RDKitMolecule | null>(null);
  const geminiReady = isGeminiInitialized();

  const properties = moleculeData?.properties;

  useEffect(() => {
    let isMounted = true;
    rdkitService
      .initialize()
      .then(() => {
        if (isMounted) {
          setRdkitReady(true);
          handleParse(inputValue, { skipStatus: true }).catch((initError) => {
            console.warn('Initial RDKit parse failed:', initError);
          });
        }
      })
      .catch((initError) => {
        console.error('RDKit failed to initialise inside workspace:', initError);
        setError('RDKit-JS failed to initialise. Check console for details.');
      });

    return () => {
      isMounted = false;
      if (moleculeRef.current) {
        rdkitService.disposeMolecule(moleculeRef.current.mol);
        moleculeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setWorkspaceStatus = (status: 'idle' | 'loading' | 'error') => {
    onStatusChange?.(status);
  };

  const clearCurrentMolecule = () => {
    if (moleculeRef.current) {
      rdkitService.disposeMolecule(moleculeRef.current.mol);
      moleculeRef.current = null;
    }
    setMoleculeData(null);
    setSvg(null);
    setGeminiResolution(null);
  };

  const handleParse = async (smiles: string, options?: { skipStatus?: boolean }) => {
    const trimmed = smiles.trim();
    if (!trimmed) {
      setError('Provide a SMILES string to analyse.');
      return;
    }

    setError(null);
    setBusy(true);
    if (!options?.skipStatus) {
      setWorkspaceStatus('loading');
    }

    try {
      if (!rdkitService.isReady()) {
        await rdkitService.initialize();
        setRdkitReady(true);
      }

      const parsed = await rdkitService.parseMolecule(trimmed);
      if (!parsed) {
        throw new Error('RDKit could not parse the provided SMILES.');
      }

      const svgMarkup = await rdkitService.getSVG(parsed.mol, 420, 320);
      if (!svgMarkup) {
        throw new Error('Failed to render RDKit SVG output.');
      }

      clearCurrentMolecule();
      moleculeRef.current = parsed;
      setMoleculeData(parsed);
      setSvg(svgMarkup);
      setWorkspaceStatus('idle');
    } catch (parseError: any) {
      console.error('SMILES parsing error:', parseError);
      setError(parseError?.message || 'Unable to parse molecule.');
      clearCurrentMolecule();
      setWorkspaceStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const handleGeminiResolve = async () => {
    const query = descriptionInput.trim();
    if (!query) {
      setError('Provide a molecule name or description to interpret.');
      return;
    }

    setError(null);
    setBusy(true);
    setWorkspaceStatus('loading');

    try {
      if (!isGeminiInitialized()) {
        throw new Error('Configure your Gemini API key in Settings to enable name lookup.');
      }

      const resolution = await resolveMoleculeDescription(query);
      const smilesToParse = resolution.canonicalSmiles ?? resolution.smiles;
      if (!smilesToParse) {
        throw new Error('Gemini did not supply a SMILES string. Try refining the description.');
      }

      setInputValue(smilesToParse);
      await handleParse(smilesToParse);
      setGeminiResolution(resolution);
      setWorkspaceStatus('idle');
    } catch (resolutionError: any) {
      console.error('Gemini molecule resolution failed:', resolutionError);
      setError(resolutionError?.message || 'Gemini could not resolve that molecule.');
      setGeminiResolution(null);
      setWorkspaceStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const handleResolveReactionPrompt = async () => {
    const query = reactionPrompt.trim();
    if (!query) {
      setError('Provide a reaction description, name, or reaction SMILES to interpret.');
      return;
    }

    setError(null);
    setBusy(true);
    setWorkspaceStatus('loading');

    try {
      let resolution: ReactionResolutionResult | null = null;
      let primaryError: unknown = null;

      try {
        resolution = await resolveReactionQuery(query);
      } catch (error) {
        primaryError = error;
      }

      if (!resolution && geminiReady) {
        try {
          resolution = await resolveReactionByName(query);
        } catch (fallbackError) {
          if (!primaryError) {
            primaryError = fallbackError;
          }
        }
      }

      if (!resolution) {
        if (primaryError instanceof Error) {
          throw primaryError;
        }
        throw new Error(
          'Unable to interpret that reaction. Provide SMILES or configure Gemini for natural-language prompts.'
        );
      }

      if (!resolution.reactionSmiles) {
        throw new Error('Gemini did not return reaction SMILES. Try refining the prompt with reactants and products.');
      }

      if (!rdkitService.isReady()) {
        await rdkitService.initialize();
      }

      const visualization = await rdkitService.getReactionSVG(resolution.reactionSmiles, {
        components: resolution.components ?? []
      });

      const svgMarkup = visualization.previewSvg ?? visualization.reactionSvg ?? null;
      if (!svgMarkup) {
        throw new Error('Unable to render the reaction diagram with RDKit.');
      }

      setReactionSvg(svgMarkup);
      setReactionResolution(resolution);
      setWorkspaceStatus('idle');
    } catch (reactionError: any) {
      console.error('Reaction prompt interpretation failed:', reactionError);
      setReactionSvg(null);
      setReactionResolution(null);
      setError(
        reactionError?.message ||
          'Failed to interpret the reaction. Include reactants, reagents, and products or provide reaction SMILES.'
      );
      setWorkspaceStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const handleSubstructureSearch = async (smarts: string) => {
    const query = smarts.trim();
    if (!query || !moleculeRef.current) return;

    setBusy(true);
    try {
      const matches = await rdkitService.findSubstructureMatches(moleculeRef.current.mol, query);
      setSubstructureHistory((prev) => [
        { query, matches, timestamp: Date.now() },
        ...prev.slice(0, 4)
      ]);
      setError(null);
    } catch (subError: any) {
      console.error('Substructure search failed:', subError);
      setError(subError?.message || 'Substructure search failed.');
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const descriptorCards = useMemo(() => {
    if (!properties) return [];
    return [
      {
        label: 'Formula',
        value: properties.formula,
        icon: FlaskConical
      },
      {
        label: 'Exact Mass',
        value: formatNumber(properties.molecularWeight, 4),
        icon: Beaker
      },
      {
        label: 'cLogP',
        value: formatNumber(properties.logP, 2),
        icon: Star
      },
      {
        label: 'TPSA',
        value: formatNumber(properties.tpsa, 1) + ' Å²',
        icon: Search
      },
      {
        label: 'H-Bond Donors',
        value: properties.hbd?.toString() ?? '—',
        icon: Beaker
      },
      {
        label: 'H-Bond Acceptors',
        value: properties.hba?.toString() ?? '—',
        icon: Beaker
      },
      {
        label: 'Rotatable Bonds',
        value: properties.rotatableBonds?.toString() ?? '—',
        icon: RefreshCw
      }
    ];
  }, [properties]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-950">
      <aside className="w-full max-w-md border-r border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">SMILES Workspace</h2>
            <p className="text-xs text-slate-400">
              Paste a SMILES string, pick a template, or describe a molecule to generate descriptors.
            </p>
          </div>
          {!rdkitReady ? (
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading RDKit
            </span>
          ) : moleculeData ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
              onClick={() => {
                clearCurrentMolecule();
                setSubstructureHistory([]);
                setInputValue('');
              }}
            >
              <Eraser className="h-3.5 w-3.5" />
              Reset
            </button>
          ) : null}
        </div>

        <div className="mt-6 space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            SMILES input
          </label>
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            rows={4}
            spellCheck={false}
            className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="e.g. CC(=O)OC1=CC=CC=C1C(=O)O"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleParse(inputValue)}
              disabled={!rdkitReady || busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Analyse
            </button>
            <button
              onClick={() => copyToClipboard(inputValue)}
              className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Describe a molecule
          </label>
          <textarea
            value={descriptionInput}
            onChange={(event) => setDescriptionInput(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="e.g. Name a medicine, biomolecule, or reaction participant..."
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleGeminiResolve}
              disabled={busy || !descriptionInput.trim() || !geminiReady}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900"
              title={geminiReady ? undefined : 'Add your Gemini API key in Settings to enable this feature.'}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Interpret with Gemini
            </button>
            <button
              onClick={() => {
                setDescriptionInput('');
                setGeminiResolution(null);
              }}
              className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>
          {!geminiReady && (
            <p className="text-[11px] text-amber-300">
              Configure your Gemini API key in Settings to convert plain language into SMILES automatically.
            </p>
          )}
          {geminiResolution && (
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-emerald-200">
                  {geminiResolution.name || 'Resolved molecule'}
                </span>
                {typeof geminiResolution.confidence === 'number' && (
                  <span className="text-[11px] text-emerald-300">
                    {Math.round(geminiResolution.confidence * 100)}% certainty
                  </span>
                )}
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-emerald-200">
                {geminiResolution.canonicalSmiles ?? geminiResolution.smiles}
              </p>
              {geminiResolution.synonyms.length > 0 && (
                <p className="mt-2 text-[11px] text-emerald-300">
                  Synonyms: {geminiResolution.synonyms.slice(0, 4).join(', ')}
                  {geminiResolution.synonyms.length > 4 && ' …'}
                </p>
              )}
              {geminiResolution.notes && (
                <p className="mt-2 text-[11px] text-emerald-300">{geminiResolution.notes}</p>
              )}
              <p className="mt-2 text-[10px] uppercase tracking-wide text-emerald-400">
                Source: {geminiResolution.source === 'pubchem' ? 'Gemini + PubChem canonicalization' : 'Gemini heuristic'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reaction prompt
          </h3>
          <p className="text-[11px] text-slate-500">
            Describe reactants/products or provide a named transformation to draw the reaction.
          </p>
          <textarea
            value={reactionPrompt}
            onChange={(event) => setReactionPrompt(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="e.g. Aldol condensation of acetone with benzaldehyde"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleResolveReactionPrompt}
              disabled={busy || !reactionPrompt.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900"
              title={
                geminiReady
                  ? undefined
                  : 'SMILES-only prompts work offline; configure Gemini for natural-language reactions.'
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Interpret Reaction
            </button>
            <button
              onClick={() => {
                setReactionPrompt('');
                setReactionSvg(null);
                setReactionResolution(null);
              }}
              className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>
          {!geminiReady && (
            <p className="text-[11px] text-amber-300">
              Configure your Gemini API key to interpret reaction names or plain-language prompts.
            </p>
          )}
        </div>

        <div className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Quick templates
          </h3>
          <div className="mt-3 space-y-3">
            {SAMPLE_MOLECULES.map((sample) => (
              <button
                key={sample.name}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-left transition hover:border-blue-500/60 hover:bg-slate-900/80"
                onClick={() => {
                  setInputValue(sample.smiles);
                  void handleParse(sample.smiles);
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{sample.name}</p>
                  <span className="text-[11px] text-slate-500">Load</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{sample.note}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-1 gap-4 border-b border-slate-800 bg-slate-950/80 p-6 md:grid-cols-3">
          {descriptorCards.length > 0 ? (
            descriptorCards.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3 text-sm text-slate-200"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  {label}
                </div>
                <p className="mt-2 text-base font-semibold text-white">{value}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
              Load a molecule to see RDKit descriptors and 2D depictions.
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60">
              <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">2D depiction</h3>
                  <p className="text-xs text-slate-400">Generated by RDKit using set_new_coords()</p>
                </div>
                {svg && (
                  <button
                    onClick={() => copyToClipboard(svg)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
                  >
                    <Copy className="h-3 w-3" />
                    Copy SVG
                  </button>
                )}
              </header>
              <div className="flex min-h-[320px] items-center justify-center bg-slate-950/60 p-6">
                {svg ? (
                  <div
                    className="max-h-[320px] w-full max-w-[480px]"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <FlaskConical className="h-8 w-8" />
                    <p className="text-sm">No molecule loaded yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60">
              <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Format conversion</h3>
                  <p className="text-xs text-slate-400">
                    Canonical strings generated via RDKit descriptors.
                  </p>
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-4 p-4 text-sm text-slate-200">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Canonical SMILES</p>
                  <div className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                    <code className="flex-1 break-all text-xs text-slate-100">
                      {properties?.smiles ?? '—'}
                    </code>
                    <button
                      onClick={() => copyToClipboard(properties?.smiles)}
                      className="text-[11px] text-blue-300 hover:text-blue-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">InChI</p>
                  <div className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                    <code className="flex-1 break-all text-xs text-slate-100">
                      {properties?.inchi ?? '—'}
                    </code>
                    <button
                      onClick={() => copyToClipboard(properties?.inchi)}
                      className="text-[11px] text-blue-300 hover:text-blue-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-slate-500">InChI Key</p>
                  <div className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2">
                    <code className="flex-1 break-all text-xs text-slate-100">
                      {properties?.inchikey ?? '—'}
                    </code>
                    <button
                      onClick={() => copyToClipboard(properties?.inchikey)}
                      className="text-[11px] text-blue-300 hover:text-blue-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60">
            <header className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Substructure explorer</h3>
                <p className="text-xs text-slate-400">
                  Provide SMARTS patterns to identify matching atom indices.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SMARTS_LIBRARY.map((item) => (
                  <button
                    key={item.smarts}
                    className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] text-slate-300 hover:border-blue-500/50 hover:text-white"
                    onClick={() => {
                      setSubstructureInput(item.smarts);
                      void handleSubstructureSearch(item.smarts);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </header>
            <div className="space-y-4 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  value={substructureInput}
                  onChange={(event) => setSubstructureInput(event.target.value)}
                  placeholder="SMARTS pattern e.g. c1ccccc1"
                  className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  onClick={() => handleSubstructureSearch(substructureInput)}
                  disabled={!moleculeData || !substructureInput.trim() || busy}
                  className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-teal-900"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>

              {substructureHistory.length > 0 ? (
                <div className="space-y-3">
                  {substructureHistory.map((result) => (
                    <div
                      key={result.timestamp}
                      className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>SMARTS: <code className="text-blue-300">{result.query}</code></span>
                        <span>{result.matches.length} match{result.matches.length === 1 ? '' : 'es'}</span>
                      </div>
                      {result.matches.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-slate-300">
                          {result.matches.slice(0, 5).map((match, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span>Atoms: [{match.join(', ')}]</span>
                              <button
                                onClick={() => copyToClipboard(match.join(','))}
                                className="text-[11px] text-blue-300 hover:text-blue-200"
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                          {result.matches.length > 5 && (
                            <p className="text-[11px] text-slate-500">
                              +{result.matches.length - 5} more matches omitted for brevity.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No atoms matched this pattern.</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Run a SMARTS query to populate match history.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60">
            <header className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Reaction preview (RDKit SVG)</h3>
                <p className="text-xs text-slate-400">
                  Gemini-assisted interpretation rendered through RDKit.
                </p>
              </div>
              {reactionResolution?.reactionSmiles && (
                <button
                  onClick={() => copyToClipboard(reactionResolution.reactionSmiles)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  Copy SMILES
                </button>
              )}
            </header>
            <div className="space-y-4 p-4">
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 p-6">
                {reactionSvg ? (
                  <div
                    className="w-full max-w-[640px]"
                    dangerouslySetInnerHTML={{ __html: reactionSvg }}
                  />
                ) : (
                  <div className="text-center text-sm text-slate-500">
                    <p>No reaction rendered yet.</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Try prompts such as "Claisen condensation of ethyl acetate" or "CCO.CCO&gt;&gt;CCOC(=O)CCO".
                    </p>
                  </div>
                )}
              </div>

              {reactionResolution && (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-300">
                  <div className="flex flex-wrap items-center gap-2 text-slate-400">
                    <span className="font-semibold text-slate-200">Reaction SMILES:</span>
                    <code className="break-all text-emerald-300">{reactionResolution.reactionSmiles}</code>
                  </div>
                  {typeof reactionResolution.confidence === 'number' && (
                    <p className="text-slate-400">
                      Confidence: {(reactionResolution.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                  {reactionResolution.notes && (
                    <p className="text-slate-400">{reactionResolution.notes}</p>
                  )}
                  {reactionResolution.components.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-slate-400">Components:</p>
                      <ul className="space-y-1">
                        {reactionResolution.components.map((component, index) => (
                          <li key={`${component.role}-${index}`} className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                              {component.role}
                            </span>
                            {component.label && (
                              <span className="text-slate-200">{component.label}</span>
                            )}
                            {component.smiles ? (
                              <code className="text-[11px] text-emerald-300">{component.smiles}</code>
                            ) : (
                              <span className="text-[11px] text-rose-300">SMILES not resolved</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60">
            <header className="flex flex-col gap-2 border-b border-slate-800 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Kekule.js Reaction Widget</h3>
                <p className="text-xs text-slate-400">
                  Interactive reaction viewer using Kekule.js widget - zoom, rotate, and explore.
                </p>
              </div>
            </header>
            <div className="p-4">
              {reactionResolution?.reactionSmiles ? (
                <KekuleReactionWidget
                  reactionSmiles={reactionResolution.reactionSmiles}
                  height={400}
                />
              ) : (
                <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 p-6">
                  <div className="text-center text-sm text-slate-500">
                    <p>No reaction available for Kekule widget.</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Enter a reaction prompt above to see it displayed in the Kekule.js widget.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300">
              <BookOpen className="h-4 w-4" />
              <span className="font-semibold uppercase tracking-wide">Docs snapshot</span>
            </div>
            <p className="mt-2">
              RDKit-JS powers this workspace. Review the{' '}
              <a
                href="https://docs.rdkitjs.com/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-300 hover:text-blue-200"
              >
                RDKit docs
              </a>{' '}
              for supported APIs and advanced workflows, or explore live examples at{' '}
              <a
                href="https://www.rdkitjs.com/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-300 hover:text-blue-200"
              >
                rdkitjs.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RdkitWorkspace;
