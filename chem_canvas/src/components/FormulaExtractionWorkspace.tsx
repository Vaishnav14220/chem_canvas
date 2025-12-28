import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    CheckCircle2,
    FileText,
    Download,
    MoreHorizontal,
    Plus,
    AlertTriangle,
    Copy,
    AlignLeft,
    RefreshCw,
    PlayCircle,
    LineChart,
    SlidersHorizontal
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useSourceStore } from '../store/sourceStore';
import { SourceSelector } from './ui/SourceSelector';

export interface FormulaItem {
    id: string;
    label?: string;
    page?: number;
    latex: string;
    variables: { symbol: string; definition: string; unit?: string }[];
    status: 'verified' | 'unknown';
}

interface FormulaExtractionWorkspaceProps {
    onBack: () => void;
    fileName?: string;
    fileData?: { mimeType: string; data: string } | null;
    fileContent?: string | null;
    sourceMarkdown?: string | null;
    formulas?: FormulaItem[];
    isLoading?: boolean;
}

const MOCK_FORMULAS: FormulaItem[] = [
    {
        id: '1',
        label: 'FIRST LAW',
        page: 4,
        latex: '\\Delta U = Q - W',
        variables: [
            { symbol: '\\Delta U', definition: 'Change in internal energy' },
            { symbol: 'Q', definition: 'Heat added to system' },
            { symbol: 'W', definition: 'Work done by system' }
        ],
        status: 'verified'
    },
    {
        id: '2',
        label: 'ENTROPY',
        page: 5,
        latex: 'S = k_B \\ln \\Omega',
        variables: [
            { symbol: 'S', definition: 'Entropy' },
            { symbol: 'k_B', definition: 'Boltzmann constant' },
            { symbol: '\\Omega', definition: 'Number of microstates' }
        ],
        status: 'verified'
    },
    {
        id: '3',
        label: 'UNKNOWN',
        page: 5,
        latex: 'dS \\ge \\delta Q / T',
        variables: [],
        status: 'unknown'
    }
];

type SimulationInput = {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
    defaultValue?: number;
};

type SimulationModel = {
    title: string;
    description: string;
    outputLabel: string;
    inputs: SimulationInput[];
    chart: { xKey: string; xLabel: string; min: number; max: number };
    compute: (values: Record<string, number>) => number;
    evaluation?: (values: Record<string, number>) => { label: string; ok: boolean; detail: string };
    isApproximate?: boolean;
};

const InlineMath = ({ value, className }: { value: string; className?: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
            p: ({ node, ...props }) => <span className={className} {...props} />
        }}
    >
        {`$${value}$`}
    </ReactMarkdown>
);

const formatNumeric = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : '-');

const normalizeLatex = (latex: string) =>
    latex
        .replace(/\s+/g, '')
        .replace(/\\left|\\right/g, '')
        .replace(/\\,/g, '');

const resolveOutputSymbol = (latex: string, variables: FormulaItem['variables']) => {
    if (latex.includes('=')) {
        return latex.split('=')[0].trim();
    }
    return variables?.[0]?.symbol || 'Output';
};

const buildFallbackInputs = (item: FormulaItem, outputSymbol: string): SimulationInput[] => {
    const candidates = item.variables?.length ? item.variables : [];
    let inputVars = candidates;
    if (inputVars.length && inputVars[0].symbol === outputSymbol) {
        inputVars = inputVars.slice(1);
    }
    if (inputVars.length === 0) {
        inputVars = [
            { symbol: 'x', definition: 'Input variable' },
            { symbol: 'y', definition: 'Input variable' }
        ];
    } else if (inputVars.length === 1) {
        inputVars = [...inputVars, { symbol: 'y', definition: 'Input variable' }];
    }

    const seen = new Set<string>();
    return inputVars.slice(0, 3).map((variable, index) => {
        const rawKey = variable.symbol || `x_${index + 1}`;
        const key = seen.has(rawKey) ? `${rawKey}_${index + 1}` : rawKey;
        seen.add(key);
        return {
            key,
            label: variable.symbol || `x_${index + 1}`,
            min: 0,
            max: 100,
            step: 1,
            unit: variable.unit
        };
    });
};

const buildSimulationModel = (item: FormulaItem): SimulationModel => {
    const normalized = normalizeLatex(item.latex);

    if (normalized.includes('\\DeltaU=Q-W')) {
        return {
            title: 'Energy balance',
            description: 'Adjust heat and work to see how internal energy responds.',
            outputLabel: '\\Delta U',
            inputs: [
                { key: 'Q', label: 'Q', min: 0, max: 200, step: 1, unit: 'kJ', defaultValue: 120 },
                { key: 'W', label: 'W', min: 0, max: 200, step: 1, unit: 'kJ', defaultValue: 45 }
            ],
            chart: { xKey: 'Q', xLabel: 'Q', min: 0, max: 200 },
            compute: (values) => (values.Q ?? 0) - (values.W ?? 0)
        };
    }

    if (normalized.includes('S=k_B\\ln\\Omega') || normalized.includes('S=k_{B}\\ln\\Omega')) {
        return {
            title: 'Entropy growth',
            description: 'Drag the microstates to see entropy rise logarithmically.',
            outputLabel: 'S',
            inputs: [
                { key: 'k_B', label: 'k_B', min: 0.5, max: 2, step: 0.05, defaultValue: 1.38 },
                { key: '\\Omega', label: '\\Omega', min: 1, max: 200, step: 1, defaultValue: 55 }
            ],
            chart: { xKey: '\\Omega', xLabel: '\\Omega', min: 1, max: 200 },
            compute: (values) => {
                const kB = values['k_B'] ?? 1;
                const omega = Math.max(values['\\Omega'] ?? 1, 1);
                return kB * Math.log(omega);
            }
        };
    }

    if (normalized.includes('dS\\ge\\deltaQ/T')) {
        return {
            title: 'Entropy inequality',
            description: 'Compare entropy change with heat flow divided by temperature.',
            outputLabel: '\\delta Q / T',
            inputs: [
                { key: 'dS', label: 'dS', min: 0, max: 12, step: 0.2, defaultValue: 4.5 },
                { key: '\\delta Q', label: '\\delta Q', min: 0, max: 200, step: 1, defaultValue: 80 },
                { key: 'T', label: 'T', min: 200, max: 600, step: 5, unit: 'K', defaultValue: 320 }
            ],
            chart: { xKey: '\\delta Q', xLabel: '\\delta Q', min: 0, max: 200 },
            compute: (values) => {
                const deltaQ = values['\\delta Q'] ?? 0;
                const temperature = Math.max(values.T ?? 1, 1);
                return deltaQ / temperature;
            },
            evaluation: (values) => {
                const dS = values.dS ?? 0;
                const ratio = (values['\\delta Q'] ?? 0) / Math.max(values.T ?? 1, 1);
                const ok = dS >= ratio;
                return {
                    label: ok ? 'Inequality satisfied' : 'Inequality violated',
                    ok,
                    detail: `dS ${ok ? '>=' : '<'} deltaQ/T (${formatNumeric(dS)} vs ${formatNumeric(ratio)})`
                };
            }
        };
    }

    const outputSymbol = resolveOutputSymbol(item.latex, item.variables);
    const inputs = buildFallbackInputs(item, outputSymbol);
    return {
        title: 'Interactive explorer',
        description: 'Adjust the inputs to see how the output responds.',
        outputLabel: outputSymbol,
        inputs,
        chart: { xKey: inputs[0].key, xLabel: inputs[0].label, min: inputs[0].min, max: inputs[0].max },
        compute: (values) =>
            inputs.reduce((sum, input) => sum + (values[input.key] ?? 0), 0) / Math.max(inputs.length, 1),
        isApproximate: true
    };
};

const buildSimulationDefaults = (model: SimulationModel) =>
    model.inputs.reduce<Record<string, number>>((acc, input) => {
        const midpoint = input.min + (input.max - input.min) * 0.55;
        acc[input.key] = Number((input.defaultValue ?? midpoint).toFixed(2));
        return acc;
    }, {});

const buildChartData = (model: SimulationModel, values: Record<string, number>) => {
    const { xKey, min, max } = model.chart;
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
        return null;
    }

    const steps = 28;
    const xRange = max - min;
    const points: Array<{ x: number; y: number }> = [];
    const outputs: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
        const xValue = min + xRange * (i / steps);
        const yValue = model.compute({ ...values, [xKey]: xValue });
        points.push({ x: xValue, y: yValue });
        outputs.push(yValue);
    }

    let yMin = Math.min(...outputs);
    let yMax = Math.max(...outputs);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin === yMax) {
        yMin = yMin - 1;
        yMax = yMax + 1;
    }

    const width = 260;
    const height = 130;
    const padding = 16;
    const yRange = yMax - yMin;
    const scaleX = (x: number) => padding + ((x - min) / xRange) * (width - padding * 2);
    const scaleY = (y: number) => height - padding - ((y - yMin) / yRange) * (height - padding * 2);

    const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${scaleX(point.x)},${scaleY(point.y)}`)
        .join(' ');
    const currentX = values[xKey] ?? min + xRange / 2;
    const currentY = model.compute(values);

    return {
        width,
        height,
        path,
        current: { x: scaleX(currentX), y: scaleY(currentY) },
        xMin: min,
        xMax: max
    };
};

const SimulationPanel = ({
    model,
    values,
    onChange
}: {
    model: SimulationModel;
    values: Record<string, number>;
    onChange: (key: string, value: number) => void;
}) => {
    const resolvedValues = useMemo(() => {
        const next = { ...values };
        model.inputs.forEach((input) => {
            if (!Number.isFinite(next[input.key])) {
                const midpoint = input.min + (input.max - input.min) * 0.55;
                next[input.key] = input.defaultValue ?? midpoint;
            }
        });
        return next;
    }, [model, values]);

    const outputValue = model.compute(resolvedValues);
    const evaluation = model.evaluation?.(resolvedValues);
    const chartData = buildChartData(model, resolvedValues);

    return (
        <div className="mt-4 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-700">
                        <PlayCircle className="w-3.5 h-3.5" />
                        Interactive session
                    </div>
                    <div className="text-sm font-semibold text-slate-700 mt-1">{model.title}</div>
                    <p className="text-xs text-slate-500 mt-1">{model.description}</p>
                </div>
                <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                    Simulating
                </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Controls
                    </div>
                    {model.inputs.map((input) => {
                        const value = resolvedValues[input.key];
                        return (
                            <div
                                key={input.key}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                            >
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <InlineMath value={input.label} className="font-semibold text-slate-700" />
                                    <span className="font-mono text-slate-500">
                                        {formatNumeric(value, 2)}
                                        {input.unit ? ` ${input.unit}` : ''}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={input.min}
                                    max={input.max}
                                    step={input.step}
                                    value={value}
                                    onChange={(event) => onChange(input.key, Number(event.target.value))}
                                    className="mt-2 w-full accent-cyan-500"
                                />
                            </div>
                        );
                    })}
                    {model.isApproximate && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                            Interactive demo uses a simplified model for quick intuition.
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Computed output
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <InlineMath value={model.outputLabel} className="text-sm font-semibold text-slate-700" />
                            <span className="text-lg font-semibold text-slate-900">{formatNumeric(outputValue)}</span>
                        </div>
                    </div>
                    {evaluation && (
                        <div
                            className={`rounded-lg border px-3 py-2 text-xs ${evaluation.ok
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700'
                                }`}
                        >
                            <div className="font-semibold">{evaluation.label}</div>
                            <div className="mt-1">{evaluation.detail}</div>
                        </div>
                    )}
                    {chartData && (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
                                <div className="flex items-center gap-1">
                                    <LineChart className="w-3.5 h-3.5" />
                                    <span>Output vs</span>
                                    <InlineMath value={model.chart.xLabel} className="text-slate-500" />
                                </div>
                                <span className="text-slate-300">interactive graph</span>
                            </div>
                            <svg
                                className="mt-2 w-full"
                                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                                role="img"
                                aria-label="Simulation trend line"
                            >
                                <path d={chartData.path} fill="none" stroke="#06b6d4" strokeWidth="2" />
                                <circle
                                    cx={chartData.current.x}
                                    cy={chartData.current.y}
                                    r="4"
                                    fill="#0ea5e9"
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                />
                            </svg>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                <span>{formatNumeric(chartData.xMin, 0)}</span>
                                <span>{formatNumeric(chartData.xMax, 0)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const FormulaExtractionWorkspace: React.FC<FormulaExtractionWorkspaceProps> = ({
    onBack,
    fileName = 'Lecture_Notes_Ch4.pdf',
    fileData = null,
    fileContent = null,
    sourceMarkdown = null,
    formulas: formulasProp,
    isLoading = false
}) => {
    const { activeSourceId, getSource } = useSourceStore();
    const activeSource = activeSourceId ? getSource(activeSourceId) : undefined;

    const effectiveFileData = fileData || (activeSource?.data ? { mimeType: activeSource.mimeType || 'application/pdf', data: activeSource.data } : null);
    const effectiveFileContent = fileContent || (activeSource?.content ? activeSource.content : null);
    const effectiveFileName = (fileName !== 'Lecture_Notes_Ch4.pdf' && fileName) ? fileName : (activeSource?.name || fileName);

    const [viewMode, setViewMode] = useState<'extraction' | 'slides'>('extraction');
    const [formulas, setFormulas] = useState<FormulaItem[]>(MOCK_FORMULAS);
    const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
    const [simulationValues, setSimulationValues] = useState<Record<string, Record<string, number>>>({});

    useEffect(() => {
        if (formulasProp) {
            setFormulas(formulasProp);
        }
    }, [formulasProp]);

    useEffect(() => {
        if (!formulas.length) return;
        setActiveSimulationId((prev) => {
            if (!prev || !formulas.some((item) => item.id === prev)) {
                return formulas[0].id;
            }
            return prev;
        });
        setSimulationValues((prev) => {
            const first = formulas[0];
            if (prev[first.id]) return prev;
            const model = buildSimulationModel(first);
            return { ...prev, [first.id]: buildSimulationDefaults(model) };
        });
    }, [formulas]);

    const simulationModels = useMemo(() => {
        const map = new Map<string, SimulationModel>();
        formulas.forEach((item) => {
            map.set(item.id, buildSimulationModel(item));
        });
        return map;
    }, [formulas]);

    const handleSimulateToggle = (item: FormulaItem) => {
        setActiveSimulationId((prev) => (prev === item.id ? null : item.id));
        setSimulationValues((prev) => {
            if (prev[item.id]) return prev;
            const model = simulationModels.get(item.id) ?? buildSimulationModel(item);
            return { ...prev, [item.id]: buildSimulationDefaults(model) };
        });
    };

    const handleSimulationValueChange = (itemId: string, key: string, value: number) => {
        setSimulationValues((prev) => ({
            ...prev,
            [itemId]: { ...(prev[itemId] ?? {}), [key]: value }
        }));
    };

    const sourcePreview = useMemo(() => {
        if (sourceMarkdown) {
            return (
                <div className="h-full w-full overflow-auto rounded-lg border border-slate-200 bg-white p-8 text-slate-700">
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-slate-900 mb-4" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-3" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-slate-900 mt-5 mb-2" {...props} />,
                            p: ({ node, ...props }) => <p className="text-sm leading-relaxed text-slate-600 mb-3" {...props} />,
                            li: ({ node, ...props }) => <li className="text-sm text-slate-600 mb-1" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3" {...props} />,
                            code: ({ node, inline, ...props }) =>
                                inline ? (
                                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-slate-700" {...props} />
                                ) : (
                                    <code className="block bg-slate-100 rounded p-3 text-xs text-slate-700 overflow-auto" {...props} />
                                )
                        }}
                    >
                        {sourceMarkdown}
                    </ReactMarkdown>
                </div>
            );
        }
        if (effectiveFileData?.mimeType === 'application/pdf') {
            return (
                <iframe
                    title="Source PDF"
                    className="h-full w-full rounded-lg border border-slate-200 bg-white"
                    src={`data:${effectiveFileData.mimeType};base64,${effectiveFileData.data}`}
                />
            );
        }
        if (effectiveFileData?.mimeType?.startsWith('image/')) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-white rounded-lg border border-slate-200 p-4">
                    <img
                        src={`data:${effectiveFileData.mimeType};base64,${effectiveFileData.data}`}
                        alt={effectiveFileName}
                        className="max-h-full max-w-full object-contain"
                    />
                </div>
            );
        }
        if (effectiveFileContent) {
            return (
                <div className="h-full w-full overflow-auto rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700 whitespace-pre-wrap">
                    {effectiveFileContent}
                </div>
            );
        }
        return null;
    }, [effectiveFileContent, effectiveFileData, effectiveFileName, sourceMarkdown]);

    const hasFormulas = formulas.length > 0;
    const formulaSlidesMarkdown = useMemo(() => {
        const headerLines = [
            'class: center, middle, title-slide',
            '',
            '# Extracted Formulas',
            fileName ? `## ${fileName}` : '## Assignment',
            ''
        ];

        if (isLoading) {
            return [
                ...headerLines,
                '---',
                'class: center, middle',
                '',
                '## Analyzing source...',
                'The AI is extracting formulas and definitions.'
            ].join('\n');
        }

        if (!hasFormulas) {
            return [
                ...headerLines,
                '---',
                'class: center, middle',
                '',
                '## No formulas detected',
                'Try uploading a clearer document or add a topic.'
            ].join('\n');
        }

        const slides = formulas.map((item) => {
            const label = item.label || 'Formula';
            const pageText = item.page ? `Page ${item.page}` : 'Page -';
            const statusText = item.status === 'unknown' ? 'Needs review' : 'Verified';
            const variableLines = item.variables && item.variables.length > 0
                ? item.variables.map((v) => `- $${v.symbol}$ - ${v.definition}${v.unit ? ` (${v.unit})` : ''}`)
                : ['_No variables detected_'];

            return [
                'class: formula-slide',
                '',
                `### ${label}`,
                `<span class="meta">${pageText} | ${statusText}</span>`,
                '',
                `$$${item.latex}$$`,
                '',
                '**Variables**',
                ...variableLines
            ].join('\n');
        });

        return [...headerLines, ...slides].join('\n---\n');
    }, [fileName, formulas, hasFormulas, isLoading]);

    const remarkSlideDoc = useMemo(() => {
        const slideSource = JSON.stringify(formulaSlidesMarkdown);
        return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Fira+Mono:wght@400;500&display=swap');
      body { margin: 0; background: #0a0f1a; }
      .remark-slide-content {
        font-family: 'Space Grotesk', sans-serif;
        background: radial-gradient(circle at 10% 10%, rgba(59,130,246,0.12), transparent 45%),
                    radial-gradient(circle at 90% 20%, rgba(168,85,247,0.16), transparent 40%),
                    linear-gradient(145deg, #0b1220, #0a0f1a);
        color: #e2e8f0;
        padding: 3.5rem 4rem;
        font-size: 1.1rem;
      }
      .remark-slide-content h1, .remark-slide-content h2, .remark-slide-content h3 {
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .remark-slide-content h1 { font-size: 2.6rem; margin-bottom: 0.5rem; }
      .remark-slide-content h2 { font-size: 1.6rem; color: #93c5fd; }
      .remark-slide-content h3 { font-size: 1.4rem; color: #f8fafc; }
      .remark-slide-content p, .remark-slide-content li { color: #cbd5f5; }
      .remark-slide-content ul { margin-top: 0.6rem; }
      .remark-code, .remark-inline-code { font-family: 'Fira Mono', monospace; }
      .title-slide h1 { font-size: 3rem; }
      .title-slide h2 { font-size: 1.25rem; color: #38bdf8; }
      .formula-slide .meta {
        display: inline-block;
        margin-top: 0.25rem;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        font-size: 0.75rem;
        color: #e2e8f0;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.35);
      }
      .remark-slide-content strong { color: #f8fafc; }
    </style>
    <script>
      MathJax = {
        tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] },
        svg: { fontCache: 'global' }
      };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  </head>
  <body>
    <script src="https://remarkjs.com/downloads/remark-latest.min.js"></script>
    <script>
      var slideshow = remark.create({ source: ${slideSource}, ratio: '16:9' });
      var typeset = function () {
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise();
        }
      };
      if (slideshow && slideshow.on) {
        slideshow.on('afterShowSlide', typeset);
      }
      setTimeout(typeset, 50);
    </script>
  </body>
</html>`;
    }, [formulaSlidesMarkdown]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Extract Formulas</h1>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            Assignment Prep <span className="text-slate-300">/</span> Thermodynamics
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-64">
                        <SourceSelector />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'extraction' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('extraction')}
                        >
                            <AlignLeft className="w-3.5 h-3.5 inline-block mr-1.5" />
                            Extraction View
                        </button>
                        <button
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'slides' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setViewMode('slides')}
                        >
                            <FileText className="w-3.5 h-3.5 inline-block mr-1.5" />
                            Slide Deck
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1" />

                    {isLoading ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100 text-xs font-medium">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Analyzing...
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            AI Analysis Complete
                        </div>
                    )}

                    <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-cyan-200">
                        <Download className="w-4 h-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Main Content Split Pane */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Source Document (Mock View) */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-50">
                    <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Source: {effectiveFileName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="hover:bg-slate-100 p-1 rounded">-</button>
                            <span className="font-mono text-slate-700">100%</span>
                            <button className="hover:bg-slate-100 p-1 rounded">+</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-8 relative">
                        {sourcePreview ? (
                            <div className="h-full w-full max-w-3xl mx-auto">{sourcePreview}</div>
                        ) : (
                            <>
                                {/* Mock Page Content representing the Reference Image */}
                                <div className="bg-white shadow-sm min-h-[800px] w-full max-w-2xl mx-auto p-12 text-slate-800 relative">
                                    <h2 className="text-2xl font-bold mb-6">Chapter 4: The Laws of Thermodynamics</h2>
                                    <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                        The first law of thermodynamics is a version of the law of conservation of
                                        energy, adapted for thermodynamic systems. The law of conservation of
                                        energy states that the total energy of an isolated system is constant;
                                        energy can be transformed from one form to another, but can be neither
                                        created nor destroyed.
                                    </p>

                                    {/* Highlighted Mock Formula */}
                                    <div className="my-6 p-4 bg-amber-50 rounded border border-amber-100 text-center relative group">
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-sm ring-4 ring-white"></div>
                                        <span className="font-mono text-lg">\Delta U = Q - W</span>
                                    </div>

                                    <p className="mb-6 text-sm leading-relaxed text-slate-600">
                                        where <span className="bg-slate-100 px-1 rounded">\Delta U</span> denotes the change in the internal energy of a closed system,
                                        <span className="bg-slate-100 px-1 rounded">Q</span> denotes the quantity of energy supplied to the system as heat, and <span className="bg-slate-100 px-1 rounded">W</span>
                                        denotes the amount of thermodynamic work done by the system on its
                                        surroundings.
                                    </p>

                                    <h3 className="text-lg font-bold mb-4 mt-8">Entropy</h3>
                                    <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                        Entropy is a measure of the number of specific ways in which a
                                        thermodynamic system may be arranged, commonly understood as a
                                        measure of disorder.
                                    </p>

                                    {/* Highlighted Mock Formula 2 */}
                                    <div className="my-6 p-4 bg-amber-50 rounded border border-amber-100 text-center relative">
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-sm ring-4 ring-white"></div>
                                        <span className="font-mono text-lg">S = k_B \ln \Omega</span>
                                    </div>

                                    <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                        The second law of thermodynamics states that the total entropy of an
                                        isolated system can never decrease over time.
                                    </p>

                                    {/* Highlighted Mock Formula 3 */}
                                    <div className="my-6 p-4 bg-amber-50 rounded border border-amber-100 text-center relative">
                                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-cyan-500 rounded-full shadow-sm ring-4 ring-white"></div>
                                        <span className="font-mono text-lg">dS \ge \delta Q / T</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Panel: Extracted Items */}
                <div className="w-1/2 flex flex-col bg-slate-50 border-l border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                            <h3 className="font-bold text-slate-800">
                                {viewMode === 'slides' ? 'Formula Slides' : `Extracted Items (${formulas.length})`}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <button className="flex items-center gap-1 px-3 py-1.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-md text-xs font-bold transition-colors">
                                <Plus className="w-3.5 h-3.5" />
                                Manual Entry
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 space-y-4">
                        {viewMode === 'slides' ? (
                            <div className="h-full min-h-[520px] rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <iframe
                                    key={remarkSlideDoc}
                                    title="Formula Slide Deck"
                                    className="h-full w-full"
                                    sandbox="allow-scripts allow-same-origin"
                                    srcDoc={remarkSlideDoc}
                                />
                            </div>
                        ) : (
                            <>
                                {!hasFormulas && !isLoading && (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                                        No formulas detected yet. Try uploading a clearer document or add a topic.
                                    </div>
                                )}
                                {formulas.map((item) => {
                                    const simulationModel = simulationModels.get(item.id);
                                    const isSimulating = activeSimulationId === item.id;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`bg-white rounded-xl border shadow-sm transition-all hover:shadow-md ${item.status === 'unknown'
                                                ? 'border-amber-200 ring-1 ring-amber-100'
                                                : 'border-slate-200'
                                                } ${isSimulating ? 'ring-2 ring-cyan-200' : ''}`}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        {item.label ? (
                                                            <span
                                                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${item.status === 'unknown'
                                                                    ? 'bg-slate-100 text-slate-500'
                                                                    : 'bg-indigo-50 text-indigo-600'
                                                                    }`}
                                                            >
                                                                {item.label}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500">
                                                                UNKNOWN
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-slate-400 font-medium">pg {item.page ?? '-'}</span>
                                                    </div>
                                                    {item.status === 'unknown' && (
                                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                    )}
                                                </div>

                                                {/* Latex Rendering Area */}
                                                <div className="bg-slate-50 rounded-lg p-6 mb-4 flex items-center justify-center min-h-[100px]">
                                                    <div className="text-xl text-slate-800 font-serif">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkMath]}
                                                            rehypePlugins={[rehypeKatex]}
                                                        >
                                                            {`$$${item.latex}$$`}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>

                                                {item.status !== 'unknown' && (
                                                    <div className="mb-4">
                                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                                            Variables
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {(item.variables || []).length > 0 ? (
                                                                (item.variables || []).map((v, i) => (
                                                                    <div key={i} className="flex items-start gap-3 text-sm">
                                                                        <span className="font-bold text-cyan-600 min-w-[24px] text-right font-serif">
                                                                            <ReactMarkdown
                                                                                remarkPlugins={[remarkMath]}
                                                                                rehypePlugins={[rehypeKatex]}
                                                                                components={{
                                                                                    p: ({ node, ...props }) => <span {...props} />
                                                                                }}
                                                                            >
                                                                                {`$${v.symbol}$`}
                                                                            </ReactMarkdown>
                                                                        </span>
                                                                        <span className="text-slate-600">{v.definition}</span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="text-sm text-slate-400 italic">No variables detected</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                                    <div className="flex items-center gap-2 bg-slate-50/50 px-2 py-1 rounded">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">LaTeX:</span>
                                                        <code className="text-xs text-slate-500 font-mono">{item.latex}</code>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSimulateToggle(item)}
                                                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${isSimulating
                                                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                                                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <PlayCircle className="w-3.5 h-3.5" />
                                                            {isSimulating ? 'Simulating' : 'Simulate'}
                                                        </button>
                                                        <button className="text-slate-300 hover:text-slate-500 transition-colors">
                                                            <Copy className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isSimulating && simulationModel && (
                                                    <SimulationPanel
                                                        model={simulationModel}
                                                        values={simulationValues[item.id] ?? {}}
                                                        onChange={(key, value) => handleSimulationValueChange(item.id, key, value)}
                                                    />
                                                )}
                                            </div>

                                            {item.status === 'unknown' && (
                                                <div className="bg-amber-50/50 px-4 py-3 rounded-b-xl border-t border-amber-100 flex items-center justify-between">
                                                    <button className="flex-1 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold rounded shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5">
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        Refine with AI
                                                        <div className="ml-1 px-1 bg-white/20 rounded text-[9px] font-mono">
                                                            Cmd+R
                                                        </div>
                                                    </button>
                                                    <div className="w-px h-6 bg-amber-200/50 mx-3"></div>
                                                    <div className="flex items-center gap-2">
                                                        <button className="text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-1.5 hover:bg-amber-100/50 rounded transition-colors">
                                                            Confirm
                                                        </button>
                                                        <button className="text-xs font-medium text-slate-400 hover:text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded transition-colors">
                                                            Discard
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
