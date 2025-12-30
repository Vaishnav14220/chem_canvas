/**
 * Lab Manual Visualizer - Professional Scientific Visualization Component
 * 
 * Generates interactive HTML-based visualizations:
 * - MathJax for LaTeX formula rendering
 * - SVG for static diagrams
 * - Canvas for interactive simulations
 * - Tables for data presentation
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Play,
    Pause,
    RefreshCw,
    Loader2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Eye,
    Brain,
    Plus,
    Zap,
    Table,
    GitBranch,
    SlidersHorizontal,
    LineChart,
    PlayCircle
} from 'lucide-react';
import { generateTextContent, extractJsonBlock } from '../services/geminiService';

// ============================================================================
// Types
// ============================================================================

interface LabManualVisualizerProps {
    documentText: string;
    topics: { name: string; summary: string }[];
    onClose?: () => void;
}

interface VisualSection {
    id: string;
    title: string;
    type: 'formula' | 'graph' | 'simulation' | 'diagram' | 'table' | 'process';
    content: {
        description: string;
        latex?: string;
        svgDiagram?: string;
        tableData?: { headers: string[]; rows: string[][] };
        simulationConfig?: {
            type: 'oscilloscope' | 'waveform' | 'circuit' | 'titration' | 'generic';
            parameters: { name: string; label: string; min: number; max: number; value: number; unit: string }[];
            formula: string;
            xLabel: string;
            yLabel: string;
        };
        steps?: string[];
    };
}

// ============================================================================
// Simulation Model Types (Ported from FormulaExtractionWorkspace)
// ============================================================================

interface SimulationInput {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
    defaultValue?: number;
}

interface SimulationModel {
    title: string;
    description: string;
    outputLabel: string;
    inputs: SimulationInput[];
    chart: { xKey: string; xLabel: string; min: number; max: number };
    compute: (values: Record<string, number>) => number;
    evaluation?: (values: Record<string, number>) => { label: string; ok: boolean; detail: string };
    isApproximate?: boolean;
    visualization?: { type: 'wave' | 'rotation'; label?: string };
}

// ============================================================================
// Simulation Helper Functions (Ported from FormulaExtractionWorkspace)
// ============================================================================

const formatNumeric = (value: number, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : '-');

const normalizeLatex = (latex: string) =>
    latex
        .replace(/\s+/g, '')
        .replace(/\\left|\\right/g, '')
        .replace(/\\,/g, '');

const resolveOutputSymbol = (latex: string, variables: { symbol: string; definition: string }[]) => {
    if (latex.includes('=')) {
        return latex.split('=')[0].trim();
    }
    return variables?.[0]?.symbol || 'Output';
};

const buildFallbackInputs = (outputSymbol: string, variables: { symbol: string; definition: string; unit?: string }[]): SimulationInput[] => {
    let inputVars = variables?.length ? [...variables] : [];
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

const buildSimulationModelFromLatex = (latex: string, variables: { symbol: string; definition: string; unit?: string }[] = []): SimulationModel => {
    const normalized = normalizeLatex(latex);

    // Energy balance: ΔU = Q - W
    if (normalized.includes('\\DeltaU=Q-W') || normalized.includes('ΔU=Q-W')) {
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

    // Frequency & period: f = 1/T
    if (/f=\\frac{1}{T}|f=1\/T/.test(normalized)) {
        return {
            title: 'Frequency & period',
            description: 'Adjust the period to see how the wave frequency changes.',
            outputLabel: 'f',
            inputs: [
                { key: 'T', label: 'T', min: 0.2, max: 4, step: 0.05, unit: 's', defaultValue: 1 }
            ],
            chart: { xKey: 'T', xLabel: 'T', min: 0.2, max: 4 },
            compute: (values) => 1 / Math.max(values.T ?? 1, 0.1),
            visualization: { type: 'wave', label: 'Signal wave' }
        };
    }

    // Rotational speed: n = (f / z) * 60
    if (/n=.*f.*z.*60/.test(normalized)) {
        return {
            title: 'Rotational speed',
            description: 'See how frequency and tooth count drive rotational speed.',
            outputLabel: 'n',
            inputs: [
                { key: 'f', label: 'f', min: 1, max: 200, step: 1, unit: 'Hz', defaultValue: 20 },
                { key: 'z', label: 'z', min: 1, max: 120, step: 1, defaultValue: 20 }
            ],
            chart: { xKey: 'f', xLabel: 'f', min: 1, max: 200 },
            compute: (values) => ((values.f ?? 1) / Math.max(values.z ?? 1, 1)) * 60,
            visualization: { type: 'rotation', label: 'Rotation' }
        };
    }

    // Signal wave: sin(t) patterns
    if (/sin|\\sin/.test(normalized) && /t/.test(normalized)) {
        return {
            title: 'Signal wave',
            description: 'Adjust amplitude and frequency to shape the waveform.',
            outputLabel: 'v(t)',
            inputs: [
                { key: 'A', label: 'A', min: 0.5, max: 5, step: 0.1, defaultValue: 1 },
                { key: 'f', label: 'f', min: 0.5, max: 6, step: 0.1, unit: 'Hz', defaultValue: 2 }
            ],
            chart: { xKey: 't', xLabel: 't', min: 0, max: 1 },
            compute: (values) => {
                const amplitude = values.A ?? 1;
                const frequency = values.f ?? 1;
                const t = values.t ?? 0;
                return amplitude * Math.sin(2 * Math.PI * frequency * t);
            },
            visualization: { type: 'wave', label: 'Signal wave' }
        };
    }

    // Fallback: generic interactive explorer
    const outputSymbol = resolveOutputSymbol(latex, variables);
    const inputs = buildFallbackInputs(outputSymbol, variables);
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

// ============================================================================
// MathJax Script Loader
// ============================================================================

const useMathJax = () => {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if ((window as any).MathJax) {
            setLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
        script.async = true;
        script.onload = () => {
            setLoaded(true);
        };
        document.head.appendChild(script);

        // MathJax config
        (window as any).MathJax = {
            tex: {
                inlineMath: [['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
            },
            startup: {
                pageReady: () => {
                    return (window as any).MathJax.startup.defaultPageReady();
                }
            }
        };

        return () => {
            // Cleanup if needed
        };
    }, []);

    const typeset = useCallback(() => {
        if ((window as any).MathJax?.typesetPromise) {
            (window as any).MathJax.typesetPromise();
        }
    }, []);

    return { loaded, typeset };
};

// ============================================================================
// Advanced Visualization Components (Ported from FormulaExtractionWorkspace)
// ============================================================================

const WaveVisualization = ({ frequency, label }: { frequency: number; label?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = 260;
        const height = 120;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        let frameId: number;
        const draw = (time: number) => {
            const t = time / 1000;
            const freq = Math.max(frequency, 0.2);
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const cycles = 2;
            for (let x = 0; x <= width; x += 1) {
                const phase = 2 * Math.PI * (cycles * (x / width) + freq * t);
                const y = height / 2 + Math.sin(phase) * (height * 0.32);
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            const dotX = width * 0.75;
            const dotPhase = 2 * Math.PI * (cycles * (dotX / width) + freq * t);
            const dotY = height / 2 + Math.sin(dotPhase) * (height * 0.32);
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fill();

            frameId = requestAnimationFrame(draw);
        };

        frameId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frameId);
    }, [frequency]);

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {label || 'Waveform'}
            </div>
            <div className="mt-2 flex justify-center">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

const RotationVisualization = ({ rpm, label }: { rpm: number; label?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = 220;
        const height = 140;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        let frameId: number;
        const draw = (time: number) => {
            const t = time / 1000;
            const safeRpm = Math.max(rpm, 5);
            const angle = t * (safeRpm / 60) * Math.PI * 2;
            const centerX = width / 2;
            const centerY = height / 2 + 6;
            const radius = 46;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius
            );
            ctx.stroke();

            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
            ctx.fill();

            frameId = requestAnimationFrame(draw);
        };

        frameId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frameId);
    }, [rpm]);

    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {label || 'Rotation'}
            </div>
            <div className="mt-2 flex justify-center">
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

const VisualizationPanelAdvanced = ({
    model,
    values,
    outputValue
}: {
    model: SimulationModel;
    values: Record<string, number>;
    outputValue: number;
}) => {
    if (!model.visualization) return null;
    if (model.visualization.type === 'rotation') {
        return <RotationVisualization rpm={outputValue} label={model.visualization.label} />;
    }
    const frequency =
        (values.f ??
            (values.T ? 1 / Math.max(values.T, 0.1) : undefined) ??
            (values['\\omega'] ? values['\\omega'] / (2 * Math.PI) : undefined) ??
            outputValue) ||
        1;
    return <WaveVisualization frequency={Number(frequency)} label={model.visualization.label} />;
};

const SimulationPanelAdvanced = ({
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
                                    <span className="font-semibold text-slate-700">{input.label}</span>
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
                            <span className="text-sm font-semibold text-slate-700">{model.outputLabel}</span>
                            <span className="text-lg font-semibold text-slate-900">{formatNumeric(outputValue)}</span>
                        </div>
                    </div>
                    <VisualizationPanelAdvanced model={model} values={resolvedValues} outputValue={outputValue} />
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
                                    <span className="text-slate-500">{model.chart.xLabel}</span>
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

// ============================================================================
// Universal Interactive Simulation Component
// Supports: Physics, Chemistry, Biology, Math, Engineering, and any field
// ============================================================================

interface SimulationCanvasProps {
    config: VisualSection['content']['simulationConfig'];
    title: string;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ config, title }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRunning, setIsRunning] = useState(true);
    const [parameters, setParameters] = useState<{ [key: string]: number }>({});
    const animationRef = useRef<number>();
    const timeRef = useRef(0);

    useEffect(() => {
        if (!config) return;
        const params: { [key: string]: number } = {};
        config.parameters.forEach(p => {
            params[p.name] = p.value;
        });
        setParameters(params);
    }, [config]);

    // Universal formula evaluator
    const evaluateFormula = useCallback((x: number, t: number, params: { [key: string]: number }): number => {
        if (!config) return 0;

        // Extract common parameters with defaults
        const a = params['a'] ?? params['amplitude'] ?? params['A'] ?? 1;
        const b = params['b'] ?? params['frequency'] ?? params['rate'] ?? 1;
        const c = params['c'] ?? params['phase'] ?? params['offset'] ?? 0;
        const k = params['k'] ?? params['constant'] ?? params['slope'] ?? 1;
        const n = params['n'] ?? params['exponent'] ?? params['order'] ?? 1;
        const m = params['mass'] ?? params['m'] ?? 1;
        const v = params['velocity'] ?? params['v'] ?? params['speed'] ?? 1;
        const T = params['temperature'] ?? params['T'] ?? 300;
        const P = params['pressure'] ?? params['P'] ?? 1;
        const R = params['resistance'] ?? params['R'] ?? 1;
        const C = params['concentration'] ?? params['C'] ?? 1;

        // Determine visualization type from config or infer from formula
        const simType = config.type || 'generic';
        const formula = config.formula?.toLowerCase() || '';

        // Physics simulations
        if (simType === 'waveform' || simType === 'oscilloscope' || formula.includes('sin') || formula.includes('wave')) {
            // Sine wave: y = A * sin(2πft + φ)
            return a * Math.sin(2 * Math.PI * b * (x + t) + c);
        }

        if (formula.includes('cos')) {
            return a * Math.cos(2 * Math.PI * b * (x + t) + c);
        }

        // Exponential decay (radioactive decay, capacitor discharge, etc.)
        if (formula.includes('exp') || formula.includes('decay') || formula.includes('e^')) {
            return a * Math.exp(-k * x);
        }

        // Exponential growth (population growth, compound interest)
        if (formula.includes('growth')) {
            return a * Math.exp(k * x);
        }

        // Chemistry - Titration curves (S-curve / sigmoid)
        if (simType === 'titration' || formula.includes('titration') || formula.includes('sigmoid')) {
            const midpoint = params['equivalencePoint'] ?? params['midpoint'] ?? 5;
            const steepness = params['steepness'] ?? params['slope'] ?? 2;
            return a * 2 * (1 / (1 + Math.exp(-steepness * (x - midpoint)))) - a;
        }

        // Kinetics - Rate equations
        if (formula.includes('rate') || formula.includes('kinetic')) {
            // First-order kinetics: [A] = [A]₀ * e^(-kt)
            return C * Math.exp(-k * x);
        }

        // Quadratic / Parabola (projectile motion, energy wells)
        if (formula.includes('parabola') || formula.includes('x^2') || formula.includes('quadratic')) {
            return a * x * x + b * x + c;
        }

        // Linear relationship (Ohm's law, Hooke's law)
        if (formula.includes('linear') || formula.includes('ohm') || formula.includes('hooke')) {
            return k * x + c;
        }

        // Inverse relationship (pressure-volume, frequency-wavelength)
        if (formula.includes('inverse') || formula.includes('1/x') || formula.includes('hyperbola')) {
            return a / (x + 0.1) + c; // +0.1 to avoid division by zero
        }

        // Power law (Stefan-Boltzmann, power functions)
        if (formula.includes('power') || formula.includes('x^n')) {
            return a * Math.pow(Math.abs(x) + 0.01, n);
        }

        // Logarithmic (pH, decibels, Richter scale)
        if (formula.includes('log') || formula.includes('ph') || formula.includes('decibel')) {
            return a * Math.log10(Math.abs(x) + 0.01) + c;
        }

        // Natural log
        if (formula.includes('ln')) {
            return a * Math.log(Math.abs(x) + 0.01) + c;
        }

        // Square root
        if (formula.includes('sqrt') || formula.includes('root')) {
            return a * Math.sqrt(Math.abs(x)) + c;
        }

        // Gaussian / Normal distribution (statistics, quantum mechanics)
        if (formula.includes('gaussian') || formula.includes('normal') || formula.includes('bell')) {
            const sigma = params['sigma'] ?? params['std'] ?? 1;
            const mu = params['mu'] ?? params['mean'] ?? 0;
            return a * Math.exp(-Math.pow(x - mu, 2) / (2 * sigma * sigma));
        }

        // Damped oscillation (RLC circuits, springs with friction)
        if (formula.includes('damped') || formula.includes('oscillat')) {
            const damping = params['damping'] ?? params['gamma'] ?? 0.1;
            return a * Math.exp(-damping * x) * Math.cos(2 * Math.PI * b * x + c);
        }

        // Standing wave
        if (formula.includes('standing')) {
            return a * Math.sin(k * x) * Math.cos(2 * Math.PI * b * t);
        }

        // Beats (interference of two frequencies)
        if (formula.includes('beat') || formula.includes('interference')) {
            const f1 = params['f1'] ?? b;
            const f2 = params['f2'] ?? b * 1.1;
            return a * (Math.sin(2 * Math.PI * f1 * (x + t)) + Math.sin(2 * Math.PI * f2 * (x + t)));
        }

        // Electric circuit (RC, RL time constants)
        if (simType === 'circuit' || formula.includes('circuit') || formula.includes('rc') || formula.includes('rl')) {
            const tau = params['tau'] ?? R * (params['capacitance'] ?? 1);
            return a * (1 - Math.exp(-x / tau));
        }

        // Biology - Logistic growth (population dynamics)
        if (formula.includes('logistic') || formula.includes('population')) {
            const K = params['carryingCapacity'] ?? params['K'] ?? 10;
            const r = params['growthRate'] ?? k;
            return K / (1 + ((K - a) / a) * Math.exp(-r * x));
        }

        // Enzyme kinetics (Michaelis-Menten)
        if (formula.includes('michaelis') || formula.includes('enzyme')) {
            const Vmax = params['Vmax'] ?? a;
            const Km = params['Km'] ?? k;
            return (Vmax * x) / (Km + x);
        }

        // Default: Simple sine wave
        return a * Math.sin(2 * Math.PI * b * (x + t) + c);
    }, [config]);

    useEffect(() => {
        if (!config) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;

            // Clear with dark background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            // Draw grid
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.1)';
            ctx.lineWidth = 1;
            const gridSpacingX = width / 10;
            const gridSpacingY = height / 8;

            for (let x = 0; x <= width; x += gridSpacingX) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y += gridSpacingY) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Draw center axes
            ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.moveTo(50, 0);
            ctx.lineTo(50, height);
            ctx.stroke();

            // Calculate x range from parameters or defaults
            const xMin = parameters['xMin'] ?? -5;
            const xMax = parameters['xMax'] ?? 5;
            const xRange = xMax - xMin;

            // Draw curve with gradient
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(0.5, '#8b5cf6');
            gradient.addColorStop(1, '#06b6d4');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#3b82f6';
            ctx.beginPath();

            // Collect y values to calculate scale
            const yValues: number[] = [];
            for (let px = 0; px <= width; px += 2) {
                const x = xMin + (px / width) * xRange;
                const y = evaluateFormula(x, isRunning ? timeRef.current : 0, parameters);
                yValues.push(y);
            }

            const yMin = Math.min(...yValues, -1);
            const yMax = Math.max(...yValues, 1);
            const yRange = Math.max(yMax - yMin, 0.1);
            const yMid = (yMax + yMin) / 2;

            // Draw the curve
            for (let px = 0; px <= width; px++) {
                const x = xMin + (px / width) * xRange;
                const y = evaluateFormula(x, isRunning ? timeRef.current : 0, parameters);

                // Map y to canvas coordinates (inverted, centered)
                const normalizedY = (y - yMid) / (yRange / 2);
                const pixelY = height / 2 - normalizedY * (height / 2 - 30);

                if (px === 0) ctx.moveTo(px, pixelY);
                else ctx.lineTo(px, pixelY);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw axis labels
            ctx.fillStyle = '#94a3b8';
            ctx.font = '12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(config.xLabel || 'x', width / 2, height - 8);
            ctx.save();
            ctx.translate(15, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(config.yLabel || 'y', 0, 0);
            ctx.restore();

            // Draw tick labels
            ctx.fillStyle = '#64748b';
            ctx.font = '10px monospace';
            ctx.fillText(xMin.toFixed(1), 50, height - 25);
            ctx.fillText(xMax.toFixed(1), width - 20, height - 25);
            ctx.textAlign = 'right';
            ctx.fillText(yMax.toFixed(2), 45, 25);
            ctx.fillText(yMin.toFixed(2), 45, height - 30);

            // Update time for animation
            if (isRunning) {
                timeRef.current += 0.02;
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [config, parameters, isRunning, evaluateFormula]);

    if (!config) return null;

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-white font-semibold">{title}</span>
                    <span className="text-xs text-slate-500 font-mono bg-slate-800 px-2 py-0.5 rounded">
                        {config.type?.toUpperCase() || 'SIMULATION'}
                    </span>
                </div>
                <button
                    onClick={() => setIsRunning(!isRunning)}
                    className={`p-2 rounded-lg transition-colors ${isRunning ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                >
                    {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
            </div>

            {/* Formula Display */}
            {config.formula && (
                <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 font-mono text-sm text-cyan-400">
                    y = {config.formula}
                </div>
            )}

            {/* Canvas */}
            <div className="p-3 bg-slate-950">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={300}
                    className="w-full rounded-lg"
                    style={{ imageRendering: 'auto' }}
                />
            </div>

            {/* Controls */}
            <div className="p-4 bg-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Parameters</span>
                    <button
                        onClick={() => {
                            const params: { [key: string]: number } = {};
                            config.parameters.forEach(p => {
                                params[p.name] = p.value;
                            });
                            setParameters(params);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Reset
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {config.parameters.map(param => (
                        <div key={param.name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">{param.label}</span>
                                <span className="text-cyan-400 font-mono">
                                    {(parameters[param.name] ?? param.value).toFixed(2)} {param.unit}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={param.min}
                                max={param.max}
                                step={(param.max - param.min) / 100}
                                value={parameters[param.name] ?? param.value}
                                onChange={(e) => setParameters(prev => ({
                                    ...prev,
                                    [param.name]: parseFloat(e.target.value)
                                }))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Formula Display Component with MathJax
// ============================================================================

interface FormulaDisplayProps {
    latex: string;
    description: string;
    title: string;
}

const FormulaDisplay: React.FC<FormulaDisplayProps> = ({ latex, description, title }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { typeset } = useMathJax();

    // Build simulation model from the latex formula
    const simulationModel = useMemo(() => {
        try {
            return buildSimulationModelFromLatex(latex, []);
        } catch {
            return null;
        }
    }, [latex]);

    // State for simulation values
    const [simulationValues, setSimulationValues] = useState<Record<string, number>>(() =>
        simulationModel ? buildSimulationDefaults(simulationModel) : {}
    );

    // State to show/hide simulation
    const [showSimulation, setShowSimulation] = useState(false);

    useEffect(() => {
        typeset();
    }, [latex, typeset]);

    const handleSimulationChange = useCallback((key: string, value: number) => {
        setSimulationValues(prev => ({ ...prev, [key]: value }));
    }, []);

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-blue-600 px-4 py-2 flex items-center justify-between">
                <h4 className="text-white font-bold">{title}</h4>
                {simulationModel && (
                    <button
                        onClick={() => setShowSimulation(!showSimulation)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium transition-colors"
                    >
                        <PlayCircle className="w-3.5 h-3.5" />
                        {showSimulation ? 'Hide' : 'Simulate'}
                    </button>
                )}
            </div>
            <div className="p-6 space-y-4">
                <p className="text-gray-800">{description}</p>
                <div
                    ref={containerRef}
                    className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center text-lg text-gray-900"
                    dangerouslySetInnerHTML={{ __html: `$$${latex}$$` }}
                />

                {/* Interactive Simulation Panel */}
                {showSimulation && simulationModel && (
                    <SimulationPanelAdvanced
                        model={simulationModel}
                        values={simulationValues}
                        onChange={handleSimulationChange}
                    />
                )}
            </div>
        </div>
    );
};

// ============================================================================
// Table Display Component
// ============================================================================

interface TableDisplayProps {
    title: string;
    headers: string[];
    rows: string[][];
    description?: string;
}

const TableDisplay: React.FC<TableDisplayProps> = ({ title, headers, rows, description }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { typeset } = useMathJax();

    useEffect(() => {
        typeset();
    }, [rows, typeset]);

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-indigo-600 px-4 py-2">
                <h4 className="text-white font-bold flex items-center gap-2">
                    <Table className="w-4 h-4" />
                    {title}
                </h4>
            </div>
            <div className="p-4" ref={containerRef}>
                {description && <p className="text-gray-800 mb-4">{description}</p>}
                <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100">
                                {headers.map((h, i) => (
                                    <th key={i} className="py-2 px-4 border-b border-gray-300 text-left text-sm font-semibold text-gray-900">
                                        <span dangerouslySetInnerHTML={{ __html: h }} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowIdx) => (
                                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="py-2 px-4 border-b border-gray-200 text-sm text-gray-800">
                                            <span dangerouslySetInnerHTML={{ __html: cell }} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Process Steps Component
// ============================================================================

interface ProcessDisplayProps {
    title: string;
    steps: string[];
    description?: string;
}

const ProcessDisplay: React.FC<ProcessDisplayProps> = ({ title, steps, description }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        if (!isAnimating) return;
        const timer = setInterval(() => {
            setActiveStep(prev => (prev + 1) % steps.length);
        }, 2000);
        return () => clearInterval(timer);
    }, [isAnimating, steps.length]);

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-emerald-600 px-4 py-2 flex items-center justify-between">
                <h4 className="text-white font-bold flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    {title}
                </h4>
                <button
                    onClick={() => setIsAnimating(!isAnimating)}
                    className={`p-1 rounded ${isAnimating ? 'bg-white/20' : 'bg-white/10'}`}
                >
                    {isAnimating ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                </button>
            </div>
            <div className="p-4">
                {description && <p className="text-gray-700 mb-4">{description}</p>}
                <div className="space-y-3">
                    {steps.map((step, idx) => (
                        <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 ${idx === activeStep
                                ? 'bg-emerald-50 border-emerald-500 shadow-md'
                                : idx < activeStep
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === activeStep
                                ? 'bg-emerald-500 text-white'
                                : idx < activeStep
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 text-gray-600'
                                }`}>
                                {idx + 1}
                            </div>
                            <p className={`flex-1 ${idx === activeStep ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                {step}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const LabManualVisualizer: React.FC<LabManualVisualizerProps> = ({
    documentText,
    topics,
}) => {
    const [sections, setSections] = useState<VisualSection[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const { loaded: mathJaxLoaded, typeset } = useMathJax();

    // New: State for generated interactive HTML page
    const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'html' | 'sections'>('html');

    useEffect(() => {
        if (mathJaxLoaded) {
            typeset();
        }
    }, [sections, mathJaxLoaded, typeset]);

    // =========================================================================
    // NEW: Generate Complete Interactive HTML Page
    // =========================================================================
    const generateInteractiveHtml = async () => {
        setIsAnalyzing(true);
        setGeneratedHtml(null);
        setSections([]);

        try {
            const htmlPrompt = `Make an interactive HTML page that will explain ALL the topics and formulas in this document in an interactive way.

DOCUMENT CONTENT:
${documentText.slice(0, 60000)}

TOPICS IDENTIFIED:
${topics.map(t => `- ${t.name}: ${t.summary}`).join('\n')}

=== REQUIREMENTS ===

Create a SINGLE self-contained HTML file that includes:

1. **PROFESSIONAL STYLING** (embedded CSS):
   - Modern dark gradient background
   - Clean typography (use Google Fonts via CDN)
   - Responsive grid layout
   - Smooth animations and transitions
   - Glassmorphism card effects

2. **MATHJAX FOR FORMULAS** (include CDN):
   - Render ALL formulas from the document
   - Use proper LaTeX notation
   - Display equations prominently

3. **INTERACTIVE CANVAS ANIMATIONS** for each concept:
   - Animated waveforms for signals (sin waves moving)
   - Rotation animations for rotary encoders
   - Signal flow diagrams with animated pulses
   - Oscilloscope-style displays

4. **PARAMETER CONTROLS** (sliders with real-time updates):
   - Frequency controls (update wave speed)
   - Amplitude controls (update wave height)
   - Phase controls
   - Each slider should immediately update the canvas

5. **SECTION FOR EACH TOPIC**:
   - Title with icon
   - Explanation text
   - Formula display
   - Interactive canvas/simulation
   - Parameter controls

6. **APPARATUS SPECIFICATIONS**:
   - Tables showing device specs
   - Connection diagrams if applicable

=== HTML STRUCTURE ===

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lab Manual Interactive Visualizer</title>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        /* Modern styling */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #e2e8f0;
            min-height: 100vh;
            padding: 2rem;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .card { 
            background: rgba(255,255,255,0.05);
            border-radius: 1rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }
        h1, h2, h3 { color: #f8fafc; }
        canvas { 
            background: #0f172a;
            border-radius: 0.5rem;
            width: 100%;
            max-width: 600px;
        }
        .slider-container { margin: 1rem 0; }
        .slider-label { display: flex; justify-content: space-between; }
        input[type="range"] { 
            width: 100%;
            accent-color: #06b6d4;
        }
        .formula { 
            background: rgba(59, 130, 246, 0.1);
            padding: 1rem;
            border-radius: 0.5rem;
            text-align: center;
            font-size: 1.25rem;
            margin: 1rem 0;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; }
        /* Add more styles */
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 Interactive Lab Manual Visualizer</h1>
        <p>Explore the concepts with interactive simulations</p>
        
        <div class="grid">
            <!-- Generate one card per concept -->
            <div class="card">
                <h2>🌊 Signal Wave</h2>
                <p>Description of the concept</p>
                <div class="formula">$$U(t) = \\hat{U} \\cdot \\sin(2\\pi f t + \\phi)$$</div>
                <canvas id="wave-canvas" width="600" height="200"></canvas>
                <div class="slider-container">
                    <div class="slider-label">
                        <span>Frequency</span>
                        <span id="freq-value">50 Hz</span>
                    </div>
                    <input type="range" id="freq-slider" min="1" max="200" value="50">
                </div>
                <!-- More controls -->
            </div>
            <!-- More cards for other concepts -->
        </div>
    </div>
    
    <script>
        // Animation functions
        const waveCanvas = document.getElementById('wave-canvas');
        const ctx = waveCanvas.getContext('2d');
        let frequency = 50;
        let amplitude = 1;
        let time = 0;
        
        document.getElementById('freq-slider').addEventListener('input', (e) => {
            frequency = e.target.value;
            document.getElementById('freq-value').textContent = frequency + ' Hz';
        });
        
        function drawWave() {
            ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x < waveCanvas.width; x++) {
                const y = waveCanvas.height/2 + Math.sin(x * 0.02 * frequency/50 + time) * 60 * amplitude;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            time += 0.05;
            requestAnimationFrame(drawWave);
        }
        drawWave();
        
        // Add more animation functions for other concepts
    </script>
</body>
</html>
\`\`\`

=== CRITICAL INSTRUCTIONS ===

1. Generate a COMPLETE, valid HTML file - not a snippet
2. Include ALL topics from the document
3. Create WORKING canvas animations with requestAnimationFrame
4. Make sliders actually control the animations
5. Use MathJax CDN for formula rendering
6. Include at least 5-10 interactive sections
7. Extract REAL values from the document for parameters

Return ONLY the complete HTML code, starting with <!DOCTYPE html> and ending with </html>.
Do NOT include markdown code fences - just raw HTML.`;

            setIsAnalyzing(false);
            setIsGenerating(true);

            const response = await generateTextContent(htmlPrompt, {
                model: 'gemini-3-pro-preview',
                applyPreferences: false,
                timeout: 180000, // 3 minutes for HTML generation
            });

            // Extract HTML from response (remove any markdown fences if present)
            let htmlContent = response.trim();
            if (htmlContent.startsWith('```html')) {
                htmlContent = htmlContent.slice(7);
            }
            if (htmlContent.startsWith('```')) {
                htmlContent = htmlContent.slice(3);
            }
            if (htmlContent.endsWith('```')) {
                htmlContent = htmlContent.slice(0, -3);
            }
            htmlContent = htmlContent.trim();

            // Validate it looks like HTML
            if (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html')) {
                setGeneratedHtml(htmlContent);
                console.log('Generated HTML visualization:', htmlContent.slice(0, 500) + '...');
            } else {
                console.error('Generated content does not look like HTML:', htmlContent.slice(0, 200));
                // Try to wrap it
                setGeneratedHtml(`<!DOCTYPE html><html><body><pre>${htmlContent}</pre></body></html>`);
            }

        } catch (error) {
            console.error('HTML generation error:', error);
        } finally {
            setIsAnalyzing(false);
            setIsGenerating(false);
        }
    };

    const generateVisualizations = async () => {
        setIsAnalyzing(true);
        setSections([]); // Clear previous results

        try {
            // =================================================================
            // PHASE 1: COMPREHENSIVE DOCUMENT EXTRACTION
            // =================================================================
            // Extract ALL scientific content from the PDF: formulas, values,
            // apparatus specs, procedures, graphs, and simulations

            const analysisPrompt = `You are an expert scientific document parser with PhD-level knowledge.
Your task is to EXHAUSTIVELY extract EVERY piece of scientific content from this lab manual.

DOCUMENT (PARSE EVERY DETAIL):
${documentText.slice(0, 50000)}

TOPICS IDENTIFIED:
${topics.map(t => `- ${t.name}: ${t.summary}`).join('\n')}

=== COMPREHENSIVE EXTRACTION ===

STEP 1: EXTRACT ALL FORMULAS
- Find EVERY equation, formula, and mathematical relationship in the document
- Extract EXACT numerical values (e.g., "f = 1/T where T = 0.02s gives f = 50 Hz")
- Include units and variable definitions from the document
- Note page/section where each formula appears

STEP 2: EXTRACT ALL APPARATUS/EQUIPMENT
- List EVERY device, instrument, and component mentioned
- Include model numbers (e.g., "Rigol DG 4062", "Owon oscilloscope")
- Include specifications (voltage ranges, frequency limits, resolution)
- Include connection details and configurations

STEP 3: EXTRACT ALL PROCEDURES
- List EVERY experimental step in order
- Include calibration procedures
- Include measurement procedures
- Include data analysis steps

STEP 4: IDENTIFY SIMULATIONS NEEDED
For each concept that can be simulated:
- Define the mathematical model
- Define REALISTIC parameter ranges from the document
- Define x/y axis labels and units

STEP 5: EXTRACT GRAPHS AND DATA
- Identify any graphs, charts, or data plots described
- Extract axis labels, scales, and data points if available
- Identify relationships being demonstrated

OUTPUT FORMAT (Extract as much as possible):
{
    "formulas": [
        {
            "name": "Formula name",
            "latex": "LaTeX equation",
            "variables": [{"symbol": "f", "meaning": "frequency", "unit": "Hz", "typicalValue": 50}],
            "context": "Where/why this formula is used"
        }
    ],
    "apparatus": [
        {
            "name": "Device name",
            "model": "Model number if given",
            "specs": {"voltage": "0-10V", "frequency": "1-100Hz"},
            "role": "What it does in the experiment"
        }
    ],
    "procedures": [
        {"step": 1, "action": "What to do", "details": "How to do it"}
    ],
    "simulationOpportunities": [
        {
            "concept": "What to simulate",
            "formula": "math formula keyword (sin, damped, resonance...)",
            "parameters": [
                {"name": "frequency", "min": 1, "max": 100, "typical": 50, "unit": "Hz"}
            ],
            "xLabel": "Time (ms)",
            "yLabel": "Voltage (V)"
        }
    ],
    "graphs": [
        {"title": "Graph name", "xAxis": "label", "yAxis": "label", "relationship": "description"}
    ],
    "totalConceptsFound": 20
}

CRITICAL: Extract EXACT values from the document. Do not invent values.
Return ONLY valid JSON.`;

            const analysisResponse = await generateTextContent(analysisPrompt, {
                maxOutputTokens: 12000,
                model: 'gemini-3-pro-preview',
                applyPreferences: false,
            });

            let analysisResult;
            try {
                const analysisJson = extractJsonBlock(analysisResponse);
                analysisResult = JSON.parse(analysisJson);
                console.log('Extracted from document:', analysisResult);
            } catch (e) {
                console.log('Analysis parsing failed, using direct generation');
                analysisResult = null;
            }

            // =================================================================
            // PHASE 2: GENERATE COMPREHENSIVE VISUALIZATIONS
            // =================================================================
            setIsAnalyzing(false);
            setIsGenerating(true);

            // Build context from extracted data
            const extractedContext = analysisResult ? `

=== EXTRACTED DOCUMENT DATA ===

FORMULAS FOUND (${analysisResult.formulas?.length || 0}):
${analysisResult.formulas?.map((f: any, i: number) =>
                `${i + 1}. ${f.name}: $${f.latex}$ - ${f.context}`
            ).join('\n') || 'None extracted'}

APPARATUS FOUND (${analysisResult.apparatus?.length || 0}):
${analysisResult.apparatus?.map((a: any) =>
                `- ${a.name} ${a.model ? `(${a.model})` : ''}: ${a.role}`
            ).join('\n') || 'None extracted'}

SIMULATION OPPORTUNITIES (${analysisResult.simulationOpportunities?.length || 0}):
${analysisResult.simulationOpportunities?.map((s: any) =>
                `- ${s.concept}: ${s.formula} with ${s.parameters?.map((p: any) => `${p.name}=${p.typical}${p.unit}`).join(', ')}`
            ).join('\n') || 'None identified'}

PROCEDURES FOUND (${analysisResult.procedures?.length || 0}):
${analysisResult.procedures?.slice(0, 10).map((p: any) => `${p.step}. ${p.action}`).join('\n') || 'None extracted'}

GRAPHS/DATA FOUND (${analysisResult.graphs?.length || 0}):
${analysisResult.graphs?.map((g: any) => `- ${g.title}: ${g.relationship}`).join('\n') || 'None found'}

INSTRUCTION: Generate visualizations for EVERYTHING listed above.
` : '';

            const generationPrompt = `Generate COMPREHENSIVE scientific visualizations for this lab manual.
You must create visualizations for EVERY concept, formula, and apparatus found.

DOCUMENT:
${documentText.slice(0, 40000)}

TOPICS:
${topics.map(t => `- ${t.name}: ${t.summary}`).join('\n')}
${extractedContext}

=== GENERATE THE FOLLOWING SECTIONS ===

Create a JSON array with 15-25 visualization sections covering:

1. ALL FORMULAS (type: "formula") - One section per formula with:
   - Exact LaTeX from the document
   - Conceptual explanation of what it means
   - Real values mentioned in the document

2. ALL SIMULATIONS (type: "simulation") - Interactive for each concept:
   - Parameters with REALISTIC ranges from the document
   - Use semantic parameter names (frequency, amplitude, voltage, not a, b, c)
   - Include formula keyword (sin, cos, damped, exp, linear, quadratic)
   
   Example simulation config:
   {
       "type": "generic",
       "formula": "sin",
       "parameters": [
           { "name": "frequency", "label": "Frequency f", "min": 1, "max": 200, "value": 50, "unit": "Hz" },
           { "name": "amplitude", "label": "Amplitude Û", "min": 0, "max": 10, "value": 5, "unit": "V" },
           { "name": "phase", "label": "Phase φ", "min": 0, "max": 360, "value": 0, "unit": "°" }
       ],
       "xLabel": "Time (ms)",
       "yLabel": "Voltage (V)"
   }

3. APPARATUS TABLES (type: "table") - Specs for each device:
   - Include model numbers, ranges, accuracy
   - Include connection configurations
   
4. PROCEDURES (type: "process") - Step-by-step for each task:
   - Clear actionable steps
   - Include safety/calibration notes

FORMAT FOR EACH SECTION:
{
    "id": "unique-kebab-id",
    "title": "Descriptive Title",
    "type": "formula|simulation|table|process",
    "content": {
        "description": "Detailed scientific explanation",
        "latex": "for formulas only",
        "simulationConfig": { ... for simulations only },
        "tableData": { "headers": [...], "rows": [[...]] for tables only },
        "steps": ["step 1", "step 2"] for processes only
    }
}

REQUIREMENTS:
- Generate at least 15 sections
- Use EXACT values from the document where available
- Every formula should have a simulation if applicable
- Every apparatus should have a specifications table
- Every procedure should be a process section

Return ONLY a valid JSON array.`;

            const response = await generateTextContent(generationPrompt, {
                maxOutputTokens: 16000,
                model: 'gemini-3-pro-preview',
                applyPreferences: false,
            });

            try {
                // First try the standard extraction
                let jsonStr = extractJsonBlock(response);

                // If extractJsonBlock returned the same response (no extraction), 
                // try to manually strip markdown fences
                if (jsonStr === response || jsonStr.startsWith('```')) {
                    let cleaned = response.trim();
                    // Remove various markdown fence patterns
                    cleaned = cleaned.replace(/^```json\s*/i, '');
                    cleaned = cleaned.replace(/^```\s*/i, '');
                    cleaned = cleaned.replace(/\s*```$/i, '');
                    cleaned = cleaned.trim();

                    // Find the JSON array boundaries
                    const startIdx = cleaned.indexOf('[');
                    const endIdx = cleaned.lastIndexOf(']');
                    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                        jsonStr = cleaned.slice(startIdx, endIdx + 1);
                    } else {
                        jsonStr = cleaned;
                    }
                }

                const parsed = JSON.parse(jsonStr) as VisualSection[];
                console.log(`Successfully parsed ${parsed.length} visualization sections`);
                setSections(parsed);
                // Expand all sections by default
                setExpandedSections(new Set(parsed.map(s => s.id)));
            } catch (e) {
                console.error('Failed to parse visualizations:', response.slice(0, 500));
                // Create fallback
                setSections([
                    {
                        id: 'fallback-formula',
                        title: 'Signal Equation',
                        type: 'formula',
                        content: {
                            description: 'The fundamental equation for a sinusoidal signal',
                            latex: 'U(t) = \\hat{U} \\cdot \\sin(2\\pi f t + \\phi)',
                        },
                    },
                    {
                        id: 'fallback-sim',
                        title: 'Oscilloscope Simulation',
                        type: 'simulation',
                        content: {
                            description: 'Interactive waveform visualization',
                            simulationConfig: {
                                type: 'oscilloscope',
                                parameters: [
                                    { name: 'frequency', label: 'Frequency', min: 0.5, max: 10, value: 2, unit: 'Hz' },
                                    { name: 'amplitude', label: 'Amplitude', min: 0.5, max: 5, value: 2, unit: 'V' },
                                ],
                                formula: 'A * sin(2 * PI * f * t)',
                                xLabel: 'Time (s)',
                                yLabel: 'Voltage (V)',
                            },
                        },
                    },
                ]);
            }
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setIsAnalyzing(false);
            setIsGenerating(false);
        }
    };

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header / Toolbar */}
            <div className="flex-none px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        Visual Explainer
                    </h2>
                    <p className="text-sm text-gray-500">AI-generated simulations, formulas, and diagrams based on the manual</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    {(generatedHtml || sections.length > 0) && (
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                            <button
                                onClick={() => setViewMode('html')}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'html'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                📄 HTML View
                            </button>
                            <button
                                onClick={() => setViewMode('sections')}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'sections'
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                📊 Sections
                            </button>
                        </div>
                    )}

                    {/* Status Indicators */}
                    {isAnalyzing && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 text-xs font-medium animate-pulse">
                            <Brain className="w-4 h-4" />
                            Thinking...
                        </div>
                    )}
                    {isGenerating && !isAnalyzing && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-xs font-medium animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating Visuals...
                        </div>
                    )}

                    {/* Generate Interactive HTML Button - PRIMARY */}
                    <button
                        onClick={generateInteractiveHtml}
                        disabled={isGenerating || isAnalyzing}
                        className={`
                            px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2
                            ${isGenerating || isAnalyzing
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg hover:shadow-blue-200'
                            }
                        `}
                    >
                        {isGenerating || isAnalyzing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isAnalyzing ? 'Analyzing...' : 'Generating...'}
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                Generate Interactive HTML
                            </>
                        )}
                    </button>

                    {/* Sections Mode Button - Secondary */}
                    <button
                        onClick={generateVisualizations}
                        disabled={isGenerating || isAnalyzing}
                        className={`
                            px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2
                            ${isGenerating || isAnalyzing
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }
                        `}
                        title="Generate section-based visualizations"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Sections
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                    style={{
                        backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px)`,
                        backgroundSize: '24px 24px'
                    }}
                />

                {/* Generated HTML View (iframe) */}
                {viewMode === 'html' && generatedHtml && (
                    <iframe
                        srcDoc={generatedHtml}
                        className="w-full h-full border-0"
                        title="Interactive Visualization"
                        sandbox="allow-scripts allow-same-origin"
                    />
                )}

                {/* Sections View or Empty State */}
                {(viewMode === 'sections' || (!generatedHtml && sections.length === 0)) && (
                    <div className="h-full overflow-y-auto p-6 space-y-8">
                        {/* Empty State */}
                        {!isGenerating && !isAnalyzing && sections.length === 0 && !generatedHtml && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50">
                                    <Sparkles className="w-10 h-10 text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">No Visualizations Yet</h3>
                                <p className="text-gray-500 max-w-md mb-8">
                                    Click 'Generate Interactive HTML' to create a complete interactive page with all simulations, formulas, and animations.
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={generateInteractiveHtml}
                                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-white font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center gap-2 shadow-lg"
                                    >
                                        <Zap className="w-5 h-5" />
                                        Generate Interactive HTML
                                    </button>
                                    <button
                                        onClick={generateVisualizations}
                                        className="px-6 py-3 bg-white border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-600 font-semibold hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Section Mode
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Loading State - Analyzing */}
                        {isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                                    <div className="relative bg-white p-6 rounded-2xl shadow-xl border border-indigo-100">
                                        <Brain className="w-12 h-12 text-indigo-600 animate-pulse" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Deep Analysis in Progress</h3>
                                <p className="text-gray-500 animate-pulse">Constructing Tree of Thoughts plan...</p>
                            </div>
                        )}

                        {/* Loading State - Generating */}
                        {isGenerating && !isAnalyzing && (
                            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
                                    <div className="relative bg-white p-6 rounded-2xl shadow-xl border border-blue-100">
                                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Generating Visuals</h3>
                                <p className="text-gray-500 animate-pulse">Creating interactive simulations and formulas...</p>
                            </div>
                        )}

                        {/* VISUALIZATION SECTIONS */}
                        {!isGenerating && !isAnalyzing && sections.length > 0 && (
                            <div className="space-y-6">
                                {sections.map((section) => (
                                    <div key={section.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                                        {/* Section Header */}
                                        <button
                                            onClick={() => toggleSection(section.id)}
                                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.type === 'formula' ? 'bg-blue-100 text-blue-600' :
                                                    section.type === 'simulation' ? 'bg-green-100 text-green-600' :
                                                        section.type === 'table' ? 'bg-indigo-100 text-indigo-600' :
                                                            'bg-emerald-100 text-emerald-600'
                                                    }`}>
                                                    {section.type === 'formula' && <Zap className="w-4 h-4" />}
                                                    {section.type === 'simulation' && <Eye className="w-4 h-4" />}
                                                    {section.type === 'table' && <Table className="w-4 h-4" />}
                                                    {section.type === 'process' && <GitBranch className="w-4 h-4" />}
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                                                    <span className="text-xs text-gray-500 capitalize">{section.type}</span>
                                                </div>
                                            </div>
                                            {expandedSections.has(section.id) ? (
                                                <ChevronUp className="w-5 h-5 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-500" />
                                            )}
                                        </button>

                                        {/* Section Content */}
                                        {expandedSections.has(section.id) && (
                                            <div className="p-6 border-t border-gray-100 bg-white">
                                                {/* Content Renderers */}
                                                {section.type === 'formula' && section.content.latex && (
                                                    <FormulaDisplay
                                                        title={section.title}
                                                        latex={section.content.latex}
                                                        description={section.content.description}
                                                    />
                                                )}

                                                {section.type === 'simulation' && section.content.simulationConfig && (
                                                    <SimulationCanvas
                                                        config={section.content.simulationConfig}
                                                        title={section.title}
                                                    />
                                                )}

                                                {section.type === 'table' && section.content.tableData && (
                                                    <TableDisplay
                                                        title={section.title}
                                                        headers={section.content.tableData.headers}
                                                        rows={section.content.tableData.rows}
                                                        description={section.content.description}
                                                    />
                                                )}

                                                {section.type === 'process' && section.content.steps && (
                                                    <ProcessDisplay
                                                        title={section.title}
                                                        steps={section.content.steps}
                                                        description={section.content.description}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LabManualVisualizer;
