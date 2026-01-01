import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type ChartData, type ChartOptions } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Download } from 'lucide-react';
import { extractJsonBlock, generateTextContent, initializeGeminiWithFirebaseKey, isGeminiInitialized } from '../services/geminiService';

Chart.register(zoomPlugin);

type ChartSample = {
    id: string;
    label: string;
    chartType: ChartType;
    dataMode: 'csv' | 'json';
    payload: string;
};

type ChartType = 'bar' | 'line' | 'scatter' | 'bubble' | 'pie' | 'doughnut' | 'radar' | 'polarArea';
type ChartTypeOption = ChartType | 'auto';

const DEFAULT_CSV = `Label,Jan,Feb,Mar,Apr,May
Sales,12,19,3,5,2
Expenses,8,11,7,6,4`;

const DEFAULT_JSON = `{
  "labels": ["Q1", "Q2", "Q3", "Q4"],
  "datasets": [
    {
      "label": "Revenue",
      "data": [120, 180, 140, 200]
    },
    {
      "label": "Cost",
      "data": [80, 130, 110, 160]
    }
  ]
}`;

const SAMPLE_SCATTER = `x,y
0,0
1,1.2
2,2.1
3,2.7
4,3.6`;

const SAMPLE_BUBBLE = `x,y,r
5,7,8
10,4,6
13,9,10
7,2,5`;

const SAMPLE_PIE = `Label,Value
North,42
South,18
East,25
West,15`;

const SAMPLE_LIBRARY: ChartSample[] = [
    { id: 'bar', label: 'Quarterly bar', chartType: 'bar', dataMode: 'csv', payload: DEFAULT_CSV },
    { id: 'line', label: 'Trend line', chartType: 'line', dataMode: 'csv', payload: DEFAULT_CSV },
    { id: 'scatter', label: 'Scatter points', chartType: 'scatter', dataMode: 'csv', payload: SAMPLE_SCATTER },
    { id: 'bubble', label: 'Bubble size', chartType: 'bubble', dataMode: 'csv', payload: SAMPLE_BUBBLE },
    { id: 'pie', label: 'Regional split', chartType: 'pie', dataMode: 'csv', payload: SAMPLE_PIE }
];

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

type PlotSuggestion = {
    chartType: ChartType;
    dataMode: 'csv' | 'json';
    title?: string;
    reasoning?: string;
};

type FieldMapping = {
    xField?: string;
    yField?: string;
    seriesField?: string;
    sizeField?: string;
};

type TabularData = {
    columns: string[];
    rows: Record<string, string>[];
};

const SUGGESTION_MAX_CHARS = 4200;

const CHART_TYPE_ALIASES: Record<string, ChartType> = {
    bar: 'bar',
    column: 'bar',
    columnchart: 'bar',
    line: 'line',
    lines: 'line',
    scatter: 'scatter',
    bubble: 'bubble',
    pie: 'pie',
    doughnut: 'doughnut',
    donut: 'doughnut',
    radar: 'radar',
    polararea: 'polarArea',
    polar: 'polarArea'
};

const normalizeChartType = (value: unknown): ChartType | null => {
    if (!value) return null;
    const cleaned = String(value).toLowerCase().replace(/[^a-z]/g, '');
    return CHART_TYPE_ALIASES[cleaned] ?? null;
};

const normalizeDataMode = (value: unknown): 'csv' | 'json' | null => {
    if (!value) return null;
    const cleaned = String(value).toLowerCase();
    if (cleaned.includes('json')) return 'json';
    if (cleaned.includes('csv')) return 'csv';
    return null;
};

const buildSuggestionPreview = (input: string) => {
    const trimmed = input.trim();
    if (trimmed.length <= SUGGESTION_MAX_CHARS) {
        return trimmed;
    }
    const head = trimmed.slice(0, 3400);
    const tail = trimmed.slice(-600);
    return `${head}\n...\n${tail}`;
};

const coerceNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const detectDataModeFromInput = (input: string): 'csv' | 'json' | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (trimmed.includes(',') && trimmed.includes('\n')) return 'csv';
    return null;
};

const extractTabularData = (input: string, mode: 'csv' | 'json'): TabularData | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (mode === 'csv') {
        const rows = parseCsvRows(trimmed);
        if (rows.length < 2) return null;
        const columns = rows[0].map((name, index) => name || `Column ${index + 1}`);
        const dataRows = rows.slice(1).map((row) => {
            const entry: Record<string, string> = {};
            columns.forEach((column, index) => {
                entry[column] = row[index] ?? '';
            });
            return entry;
        });
        return { columns, rows: dataRows };
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed) || parsed.length === 0) return null;

        if (Array.isArray(parsed[0])) {
            const rows = parsed as Array<Array<string | number>>;
            const firstRow = rows[0];
            const hasHeader = firstRow.every((cell) => typeof cell === 'string');
            const columns = hasHeader
                ? firstRow.map((cell, index) => String(cell || `Column ${index + 1}`))
                : firstRow.map((_, index) => `Column ${index + 1}`);
            const dataRows = (hasHeader ? rows.slice(1) : rows).map((row) => {
                const entry: Record<string, string> = {};
                columns.forEach((column, index) => {
                    entry[column] = row[index] === undefined ? '' : String(row[index]);
                });
                return entry;
            });
            return { columns, rows: dataRows };
        }

        if (typeof parsed[0] === 'object' && parsed[0] !== null) {
            const columns: string[] = [];
            const seen = new Set<string>();
            parsed.forEach((row: Record<string, unknown>) => {
                Object.keys(row).forEach((key) => {
                    if (!seen.has(key)) {
                        seen.add(key);
                        columns.push(key);
                    }
                });
            });
            const dataRows = (parsed as Record<string, unknown>[]).map((row) => {
                const entry: Record<string, string> = {};
                columns.forEach((column) => {
                    const value = row[column];
                    entry[column] = value === undefined ? '' : String(value);
                });
                return entry;
            });
            return columns.length > 0 ? { columns, rows: dataRows } : null;
        }
    } catch {
        return null;
    }

    return null;
};

const isMostlyNumeric = (rows: Record<string, string>[], field: string) => {
    let total = 0;
    let numeric = 0;
    rows.forEach((row) => {
        const value = row[field];
        if (value === '' || value === undefined) return;
        total += 1;
        if (coerceNumber(value) !== null) {
            numeric += 1;
        }
    });
    return total > 0 && numeric / total >= 0.6;
};

const buildMappedChartData = (
    tabularData: TabularData,
    mapping: FieldMapping,
    chartTypeSelection: ChartTypeOption
): { data: ChartData | null; chartType: ChartType | null } => {
    if (!mapping.xField || !mapping.yField) {
        return { data: null, chartType: null };
    }

    const rows = tabularData.rows;
    if (rows.length === 0) return { data: null, chartType: null };

    const inferredType: ChartType = mapping.sizeField
        ? 'bubble'
        : isMostlyNumeric(rows, mapping.xField) && isMostlyNumeric(rows, mapping.yField)
            ? 'scatter'
            : 'bar';
    const chartType = chartTypeSelection === 'auto' ? inferredType : chartTypeSelection;

    const xField = mapping.xField;
    const yField = mapping.yField;
    const seriesField = mapping.seriesField;
    const sizeField = mapping.sizeField;

    if (chartType === 'scatter' || chartType === 'bubble') {
        const seriesMap = new Map<string, { label: string; data: Array<{ x: number; y: number; r?: number }> }>();
        rows.forEach((row) => {
            const xValue = coerceNumber(row[xField]);
            const yValue = coerceNumber(row[yField]);
            if (xValue === null || yValue === null) return;
            const seriesKey = seriesField ? String(row[seriesField] || 'Series 1') : 'Series 1';
            if (!seriesMap.has(seriesKey)) {
                seriesMap.set(seriesKey, { label: seriesKey, data: [] });
            }
            const entry = seriesMap.get(seriesKey)!;
            if (chartType === 'bubble') {
                const rValue = sizeField ? coerceNumber(row[sizeField]) ?? 6 : 6;
                entry.data.push({ x: xValue, y: yValue, r: rValue });
            } else {
                entry.data.push({ x: xValue, y: yValue });
            }
        });

        const datasets = Array.from(seriesMap.values()).map((dataset, index) => ({
            ...dataset,
            backgroundColor: COLORS[index % COLORS.length],
            borderColor: COLORS[index % COLORS.length]
        }));
        return { data: datasets.length > 0 ? { datasets } : null, chartType };
    }

    if (chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea') {
        const totals = new Map<string, number>();
        rows.forEach((row) => {
            const label = String(row[xField] || '(blank)');
            const value = coerceNumber(row[yField]);
            if (value === null) return;
            totals.set(label, (totals.get(label) || 0) + value);
        });
        const labels = Array.from(totals.keys());
        const values = labels.map((label) => totals.get(label) || 0);
        if (labels.length === 0) return { data: null, chartType };
        return {
            data: {
                labels,
                datasets: [
                    {
                        label: yField,
                        data: values,
                        backgroundColor: labels.map((_, index) => COLORS[index % COLORS.length])
                    }
                ]
            },
            chartType
        };
    }

    const labels: string[] = [];
    const labelIndex = new Map<string, number>();
    rows.forEach((row) => {
        const label = String(row[xField] || '(blank)');
        if (!labelIndex.has(label)) {
            labelIndex.set(label, labels.length);
            labels.push(label);
        }
    });

    const seriesLabels: string[] = seriesField ? [] : ['Series 1'];
    const seriesIndex = new Map<string, number>();
    if (seriesField) {
        rows.forEach((row) => {
            const seriesLabel = String(row[seriesField] || 'Series 1');
            if (!seriesIndex.has(seriesLabel)) {
                seriesIndex.set(seriesLabel, seriesLabels.length);
                seriesLabels.push(seriesLabel);
            }
        });
    } else {
        seriesIndex.set('Series 1', 0);
    }

    const datasets = seriesLabels.map((label, index) => {
        const color = COLORS[index % COLORS.length];
        const base = {
            label,
            data: new Array(labels.length).fill(null) as Array<number | null>,
            borderColor: color,
            backgroundColor: color
        };
        if (chartType === 'line') {
            return { ...base, fill: false };
        }
        if (chartType === 'radar') {
            return { ...base, fill: true };
        }
        return base;
    });

    rows.forEach((row) => {
        const label = String(row[xField] || '(blank)');
        const value = coerceNumber(row[yField]);
        if (value === null) return;
        const labelIdx = labelIndex.get(label);
        if (labelIdx === undefined) return;
        const seriesLabel = seriesField ? String(row[seriesField] || 'Series 1') : 'Series 1';
        const seriesIdx = seriesIndex.get(seriesLabel);
        if (seriesIdx === undefined) return;
        datasets[seriesIdx].data[labelIdx] = value;
    });

    return {
        data: labels.length > 0 ? { labels, datasets } : null,
        chartType
    };
};

const sanitizeSuggestionJson = (input: string) => {
    let candidate = input.trim();
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        candidate = candidate.slice(firstBrace, lastBrace + 1);
    }

    candidate = candidate.replace(/,\s*([}\]])/g, '$1');
    candidate = candidate.replace(/'([^']*)'/g, (_, value) => `"${value.replace(/"/g, '\\"')}"`);
    candidate = candidate.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
    return candidate;
};

const parseSuggestionFromResponse = (raw: string) => {
    const jsonPayload = extractJsonBlock(raw);
    const candidates = [jsonPayload, sanitizeSuggestionJson(jsonPayload)];

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate) as {
                chartType?: string;
                dataMode?: string;
                title?: string;
                reasoning?: string;
            };
        } catch {
            continue;
        }
    }

    const normalized = sanitizeSuggestionJson(raw);
    try {
        return JSON.parse(normalized) as {
            chartType?: string;
            dataMode?: string;
            title?: string;
            reasoning?: string;
        };
    } catch {
        return null;
    }
};

const extractSuggestionTokens = (raw: string) => {
    const lowered = raw.toLowerCase();
    const chartKeys = Object.keys(CHART_TYPE_ALIASES);
    const chartToken = chartKeys.find((key) => lowered.includes(key));
    const chartType = chartToken ? CHART_TYPE_ALIASES[chartToken] : null;
    const dataMode = lowered.includes('json') ? 'json' : lowered.includes('csv') ? 'csv' : null;
    return { chartType, dataMode };
};

const resolveChartTypeFromCsv = (rows: string[][]): ChartType => {
    if (rows.length === 0) return 'bar';
    const header = rows[0].map((cell) => cell.toLowerCase());
    const hasX = header.includes('x');
    const hasY = header.includes('y');
    const hasR = header.includes('r');

    if (hasX && hasY) return hasR ? 'bubble' : 'scatter';

    const hasLabelValue = header.length === 2 && header[0].includes('label') && header[1].includes('value');
    if (hasLabelValue) return 'pie';

    if (header.length === 2 && rows.length > 2) return 'bar';
    return header.length > 2 ? 'bar' : 'line';
};

const resolveChartTypeFromJson = (input: string): ChartType => {
    try {
        const parsed = JSON.parse(input) as ChartData & { type?: string };
        if (parsed.type && ['bar', 'line', 'scatter', 'bubble', 'pie', 'doughnut', 'radar', 'polarArea'].includes(parsed.type)) {
            return parsed.type as ChartType;
        }

        const datasets = Array.isArray(parsed.datasets) ? parsed.datasets : [];
        const firstDataset = datasets[0];
        const data = firstDataset?.data;
        if (Array.isArray(data) && data.length > 0) {
            const firstPoint = data[0] as { x?: number; y?: number; r?: number };
            if (typeof firstPoint === 'object' && firstPoint !== null && 'x' in firstPoint && 'y' in firstPoint) {
                return 'r' in firstPoint ? 'bubble' : 'scatter';
            }
        }
        if (parsed.labels && datasets.length === 1) return 'bar';
    } catch {
        return 'bar';
    }
    return 'bar';
};

const parseCsvRows = (input: string) =>
    input
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean)
        .map((row) => row.split(',').map((cell) => cell.trim()));

const buildScatterDataset = (rows: string[][], chartType: ChartType) => {
    const header = rows[0].map((cell) => cell.toLowerCase());
    const xIndex = header.indexOf('x');
    const yIndex = header.indexOf('y');
    const rIndex = header.indexOf('r');
    const seriesIndex = header.indexOf('series');

    if (xIndex === -1 || yIndex === -1) return null;

    const grouped: Record<string, { x: number; y: number; r?: number }[]> = {};
    rows.slice(1).forEach((row) => {
        const seriesLabel = seriesIndex >= 0 ? row[seriesIndex] || 'Series 1' : 'Series 1';
        if (!grouped[seriesLabel]) grouped[seriesLabel] = [];
        const point: { x: number; y: number; r?: number } = {
            x: Number(row[xIndex]),
            y: Number(row[yIndex])
        };
        if (chartType === 'bubble' && rIndex >= 0) {
            point.r = Number(row[rIndex]) || 4;
        }
        grouped[seriesLabel].push(point);
    });

    return Object.entries(grouped).map(([label, data], index) => ({
        label,
        data,
        backgroundColor: COLORS[index % COLORS.length]
    }));
};

const buildStandardDataset = (rows: string[][]) => {
    if (rows.length < 2) return null;
    const labels = rows[0].slice(1);
    const datasets = rows.slice(1).map((row, index) => ({
        label: row[0] || `Series ${index + 1}`,
        data: row.slice(1).map((value) => Number(value)),
        backgroundColor: COLORS[index % COLORS.length],
        borderColor: COLORS[index % COLORS.length],
        fill: false
    }));
    return { labels, datasets };
};

const buildPieDataset = (rows: string[][]) => {
    if (rows.length < 2) return null;
    const labels = rows.slice(1).map((row) => row[0]);
    const data = rows.slice(1).map((row) => Number(row[1]));
    return {
        labels,
        datasets: [
            {
                label: 'Values',
                data,
                backgroundColor: labels.map((_, index) => COLORS[index % COLORS.length])
            }
        ]
    };
};

interface ChartJsDataPlotterProps {
    onBack?: () => void;
    initialTitle?: string;
}

export const ChartJsDataPlotter: React.FC<ChartJsDataPlotterProps> = ({ onBack, initialTitle }) => {
    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const defaultTitle = initialTitle || 'Data Plotter';
    const [chartTypeSelection, setChartTypeSelection] = useState<ChartTypeOption>('auto');
    const [dataMode, setDataMode] = useState<'csv' | 'json'>('csv');
    const [draftDataInput, setDraftDataInput] = useState<string>(DEFAULT_CSV);
    const [appliedChartType, setAppliedChartType] = useState<ChartType>('bar');
    const [appliedDataMode, setAppliedDataMode] = useState<'csv' | 'json'>('csv');
    const [appliedDataInput, setAppliedDataInput] = useState<string>('');
    const [chartTitle, setChartTitle] = useState<string>(defaultTitle);
    const [showLegend, setShowLegend] = useState(true);
    const [showTooltip, setShowTooltip] = useState(true);
    const [enableZoom, setEnableZoom] = useState(true);
    const [hasPlotted, setHasPlotted] = useState(false);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [plotSuggestion, setPlotSuggestion] = useState<PlotSuggestion | null>(null);
    const [plotSuggestionError, setPlotSuggestionError] = useState<string | null>(null);
    const [isSuggestingPlot, setIsSuggestingPlot] = useState(false);
    const [autoPlotSuggestion, setAutoPlotSuggestion] = useState(true);
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});

    const parseResult = useMemo(() => {
        if (!appliedDataInput.trim()) {
            return { data: null, error: null };
        }
        try {
            if (appliedDataMode === 'json') {
                const parsed = JSON.parse(appliedDataInput);
                if (Array.isArray(parsed)) {
                    return {
                        data: {
                            datasets: [
                                {
                                    label: 'Series',
                                    data: parsed
                                }
                            ]
                        } as ChartData,
                        error: null
                    };
                }
                return { data: parsed as ChartData, error: null };
            }

            const rows = parseCsvRows(appliedDataInput);
            if (rows.length === 0) return { data: null, error: null };

            if (appliedChartType === 'scatter' || appliedChartType === 'bubble') {
                const scatterDatasets = buildScatterDataset(rows, appliedChartType);
                if (scatterDatasets) {
                    return { data: { datasets: scatterDatasets } as ChartData, error: null };
                }
            }

            if (appliedChartType === 'pie' || appliedChartType === 'doughnut' || appliedChartType === 'polarArea') {
                const pieData = buildPieDataset(rows);
                if (!pieData) throw new Error('Pie data needs two columns: label, value');
                return { data: pieData as ChartData, error: null };
            }

            const standard = buildStandardDataset(rows);
            if (!standard) throw new Error('CSV needs a header row with labels and data rows');
            return { data: standard as ChartData, error: null };
        } catch (error) {
            return {
                data: null,
                error: error instanceof Error ? error.message : 'Unable to parse data input.'
            };
        }
    }, [appliedChartType, appliedDataInput, appliedDataMode]);

    const tabularData = useMemo(() => extractTabularData(draftDataInput, dataMode), [draftDataInput, dataMode]);
    const mappingActive = Boolean(
        fieldMapping.xField || fieldMapping.yField || fieldMapping.seriesField || fieldMapping.sizeField
    );
    const mappedPlot = useMemo(() => {
        if (!tabularData || !mappingActive) return null;
        return buildMappedChartData(tabularData, fieldMapping, chartTypeSelection);
    }, [tabularData, mappingActive, fieldMapping, chartTypeSelection]);

    const parsedData = mappingActive ? mappedPlot?.data ?? null : parseResult.data;
    const parseError = mappingActive ? null : parseResult.error;
    const resolvedChartType = mappingActive && mappedPlot?.chartType ? mappedPlot.chartType : appliedChartType;
    const emptyStateMessage = mappingActive
        ? 'Drag a field into Columns and Rows to plot.'
        : hasPlotted
            ? 'No chart data to display.'
            : 'Load data and click Plot to render a chart.';
    const canSuggestPlot = Boolean(uploadedFileName && !uploadedImageUrl && draftDataInput.trim());

    const chartOptions = useMemo(() => {
        const options: ChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
                legend: { display: showLegend },
                tooltip: { enabled: showTooltip },
                title: {
                    display: Boolean(chartTitle),
                    text: chartTitle
                },
                zoom: enableZoom
                    ? {
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'xy'
                        },
                        pan: {
                            enabled: true,
                            mode: 'xy'
                        }
                    }
                    : undefined
            }
        };

        return options;
    }, [chartTitle, enableZoom, showLegend, showTooltip]);

    useEffect(() => {
        const canvas = chartRef.current;
        if (!canvas || !parsedData) {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
            return;
        }

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        chartInstanceRef.current = new Chart(canvas, {
            type: resolvedChartType,
            data: parsedData,
            options: chartOptions
        });
    }, [chartOptions, parsedData, resolvedChartType]);

    useEffect(() => () => {
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
    }, []);

    useEffect(() => {
        const detected = detectDataModeFromInput(draftDataInput);
        if (detected && detected !== dataMode) {
            setDataMode(detected);
        }
    }, [draftDataInput, dataMode]);

    const handleSampleLoad = (sample: ChartSample) => {
        setChartTypeSelection(sample.chartType);
        setDataMode(sample.dataMode);
        setDraftDataInput(sample.payload);
        setFieldMapping({});
    };

    const handleResetZoom = () => {
        chartInstanceRef.current?.resetZoom();
    };

    const handleDownload = () => {
        if (!chartInstanceRef.current) return;
        const url = chartInstanceRef.current.toBase64Image();
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chart.png';
        link.click();
    };

    const handlePlot = () => {
        const trimmedInput = draftDataInput.trim();
        const detectedMode = detectDataModeFromInput(trimmedInput);
        const effectiveMode = detectedMode ?? dataMode;
        if (detectedMode && detectedMode !== dataMode) {
            setDataMode(detectedMode);
        }
        const resolvedType =
            chartTypeSelection === 'auto'
                ? effectiveMode === 'json'
                    ? resolveChartTypeFromJson(trimmedInput)
                    : resolveChartTypeFromCsv(parseCsvRows(trimmedInput))
                : chartTypeSelection;

        setAppliedChartType(resolvedType);
        setAppliedDataMode(effectiveMode);
        setAppliedDataInput(draftDataInput);
        setHasPlotted(true);
    };

    const handleFieldDrop = (target: keyof FieldMapping, field: string) => {
        setFieldMapping((prev) => ({
            ...prev,
            [target]: field
        }));
    };

    const handleFieldClear = (target: keyof FieldMapping) => {
        setFieldMapping((prev) => ({
            ...prev,
            [target]: undefined
        }));
    };

    const applySuggestedPlot = (suggestion: PlotSuggestion, shouldPlot: boolean) => {
        setChartTypeSelection(suggestion.chartType);
        setDataMode(suggestion.dataMode);
        if (suggestion.title && (!chartTitle.trim() || chartTitle === defaultTitle)) {
            setChartTitle(suggestion.title);
        }
        if (shouldPlot) {
            setAppliedChartType(suggestion.chartType);
            setAppliedDataMode(suggestion.dataMode);
            setAppliedDataInput(draftDataInput);
            setHasPlotted(true);
        }
    };

    const requestPlotSuggestion = async () => {
        if (!draftDataInput.trim()) {
            setPlotSuggestionError('Upload a CSV or JSON file first.');
            return;
        }

        setIsSuggestingPlot(true);
        setPlotSuggestionError(null);
        try {
            if (!isGeminiInitialized()) {
                await initializeGeminiWithFirebaseKey();
            }

            const detectedMode = detectDataModeFromInput(draftDataInput);
            const effectiveMode = detectedMode ?? dataMode;
            if (detectedMode && detectedMode !== dataMode) {
                setDataMode(detectedMode);
            }
            const preview = buildSuggestionPreview(draftDataInput);
            const prompt = `You are a data visualization assistant. Review the uploaded dataset preview and suggest the best Chart.js chart type.
Return ONLY a JSON object with keys: chartType, dataMode, title, reasoning.
Allowed chartType values: bar, line, scatter, bubble, pie, doughnut, radar, polarArea.
dataMode must be "csv" or "json".
Keep reasoning under 20 words.

File name: ${uploadedFileName ?? 'unknown'}
Detected mode: ${effectiveMode}
Dataset preview:
${preview}`;

            const response = await generateTextContent(prompt, {
                model: 'gemini-3-pro-preview',
                maxOutputTokens: 240,
                applyPreferences: false
            });
            const parsed = parseSuggestionFromResponse(response);
            const tokens = parsed ? null : extractSuggestionTokens(response);

            const fallbackType =
                effectiveMode === 'json'
                    ? resolveChartTypeFromJson(draftDataInput)
                    : resolveChartTypeFromCsv(parseCsvRows(draftDataInput));
            const normalizedChartType =
                (parsed ? normalizeChartType(parsed.chartType) : tokens?.chartType) ?? fallbackType;
            const normalizedDataMode =
                (parsed ? normalizeDataMode(parsed.dataMode) : tokens?.dataMode) ?? effectiveMode;
            const suggestion: PlotSuggestion = {
                chartType: normalizedChartType,
                dataMode: normalizedDataMode,
                title: typeof parsed?.title === 'string' ? parsed.title.trim() : undefined,
                reasoning: typeof parsed?.reasoning === 'string' ? parsed.reasoning.trim() : undefined
            };

            setPlotSuggestion(suggestion);
            if (autoPlotSuggestion) {
                applySuggestedPlot(suggestion, true);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to get a Gemini suggestion.';
            console.error('Gemini plot suggestion failed:', error);
            setPlotSuggestionError(message);
        } finally {
            setIsSuggestingPlot(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadedFileName(file.name);
        setPlotSuggestion(null);
        setPlotSuggestionError(null);

        if (file.type.startsWith('image/')) {
            if (uploadedImageUrl) {
                URL.revokeObjectURL(uploadedImageUrl);
            }
            const previewUrl = URL.createObjectURL(file);
            setUploadedImageUrl(previewUrl);
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            const extension = file.name.split('.').pop()?.toLowerCase();
            setDraftDataInput(text);
            setDataMode(extension === 'json' ? 'json' : 'csv');
            if (uploadedImageUrl) {
                URL.revokeObjectURL(uploadedImageUrl);
            }
            setUploadedImageUrl(null);
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        if (!tabularData) {
            if (mappingActive) {
                setFieldMapping({});
            }
            return;
        }
        setFieldMapping((prev) => {
            const sanitize = (field?: string) => (field && tabularData.columns.includes(field) ? field : undefined);
            const next = {
                xField: sanitize(prev.xField),
                yField: sanitize(prev.yField),
                seriesField: sanitize(prev.seriesField),
                sizeField: sanitize(prev.sizeField)
            };
            const unchanged =
                prev.xField === next.xField &&
                prev.yField === next.yField &&
                prev.seriesField === next.seriesField &&
                prev.sizeField === next.sizeField;
            return unchanged ? prev : next;
        });
    }, [tabularData, mappingActive]);

    useEffect(() => {
        return () => {
            if (uploadedImageUrl) {
                URL.revokeObjectURL(uploadedImageUrl);
            }
        };
    }, [uploadedImageUrl]);

    return (
        <div className="flex h-full w-full flex-col bg-slate-50">
            <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Data Plotter</h2>
                    <p className="text-sm text-slate-500">Chart.js workspace for quick plotting and exports.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleResetZoom}
                        className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                        Reset zoom
                    </button>
                    <button
                        onClick={handleDownload}
                        className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export PNG
                    </button>
                    {onBack ? (
                        <button
                            onClick={onBack}
                            className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                            Back to Study Tools
                        </button>
                    ) : null}
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-[45%] min-w-[380px] max-w-[520px] border-r border-slate-200 bg-white p-6 overflow-y-auto">
                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chart title</label>
                            <input
                                value={chartTitle}
                                onChange={(event) => setChartTitle(event.target.value)}
                                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chart type</label>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {(['auto', 'bar', 'line', 'scatter', 'bubble', 'pie', 'doughnut', 'radar', 'polarArea'] as ChartTypeOption[]).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setChartTypeSelection(type)}
                                        className={`px-3 py-2 text-xs rounded-lg border ${chartTypeSelection === type ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Auto selects a chart based on your data shape and columns.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sample datasets</label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {SAMPLE_LIBRARY.map((sample) => (
                                    <button
                                        key={sample.id}
                                        onClick={() => handleSampleLoad(sample)}
                                        className="px-3 py-1.5 text-xs rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
                                    >
                                        {sample.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upload data or image</label>
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="file"
                                    accept=".csv,.txt,.json,image/*"
                                    onChange={handleFileUpload}
                                    className="text-xs text-slate-600"
                                />
                            </div>
                            {uploadedFileName ? (
                                <p className="mt-2 text-xs text-slate-500">Loaded: {uploadedFileName}</p>
                            ) : null}
                            {uploadedImageUrl ? (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                                    <img src={uploadedImageUrl} alt="Uploaded preview" className="w-full rounded-md object-contain max-h-40" />
                                    <p className="mt-2 text-[11px] text-slate-500">
                                        Image loaded for reference. Enter data below to plot it.
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        {tabularData ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Field mapping</div>
                                    <p className="text-[11px] text-slate-500">Drag fields into Columns and Rows to plot instantly.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {tabularData.columns.map((column) => (
                                        <button
                                            key={column}
                                            type="button"
                                            draggable
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData('text/plain', column);
                                                event.dataTransfer.effectAllowed = 'move';
                                            }}
                                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                                        >
                                            {column}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Columns (X / Labels)', key: 'xField' as const },
                                        { label: 'Rows (Y / Values)', key: 'yField' as const },
                                        { label: 'Series (optional)', key: 'seriesField' as const },
                                        { label: 'Size (bubble)', key: 'sizeField' as const }
                                    ].map(({ label, key }) => {
                                        const value = fieldMapping[key];
                                        return (
                                            <div
                                                key={label}
                                                onDragOver={(event) => event.preventDefault()}
                                                onDrop={(event) => {
                                                    event.preventDefault();
                                                    const field = event.dataTransfer.getData('text/plain');
                                                    if (field) {
                                                        handleFieldDrop(key, field);
                                                    }
                                                }}
                                                className={`min-h-[58px] rounded-lg border border-dashed px-3 py-2 text-[11px] ${value ? 'border-emerald-300 bg-white text-slate-700' : 'border-slate-200 bg-white text-slate-400'}`}
                                            >
                                                <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
                                                {value ? (
                                                    <div className="mt-1 flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-slate-700">{value}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFieldClear(key)}
                                                            className="text-[10px] text-slate-400 hover:text-slate-600"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 text-[11px] text-slate-400">Drop a field here</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {mappingActive && !mappedPlot?.data ? (
                                    <div className="text-[11px] text-slate-400">Assign both Columns and Rows to render a chart.</div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gemini plot suggestion</div>
                                    <p className="text-[11px] text-slate-500">Uses Gemini 3 Pro Preview on the uploaded file.</p>
                                </div>
                                <button
                                    onClick={requestPlotSuggestion}
                                    disabled={!canSuggestPlot || isSuggestingPlot}
                                    className={`px-3 py-2 text-xs font-semibold rounded-lg border ${canSuggestPlot && !isSuggestingPlot ? 'border-emerald-500 text-emerald-700 bg-white hover:bg-emerald-50' : 'border-slate-200 text-slate-400 bg-white'}`}
                                >
                                    {isSuggestingPlot ? 'Analyzing...' : 'Suggest plot'}
                                </button>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={autoPlotSuggestion}
                                    onChange={(event) => setAutoPlotSuggestion(event.target.checked)}
                                />
                                Auto-plot suggestion
                            </label>
                            {!canSuggestPlot ? (
                                <div className="text-[11px] text-slate-400">Upload a CSV or JSON file to enable Gemini suggestions.</div>
                            ) : null}
                            {plotSuggestion ? (
                                <div className="rounded-lg border border-emerald-200 bg-white p-3">
                                    <div className="text-xs font-semibold text-emerald-700">Suggested plot</div>
                                    <div className="mt-1 text-xs text-slate-600">
                                        Type: <span className="font-semibold">{plotSuggestion.chartType}</span> / Mode: {plotSuggestion.dataMode.toUpperCase()}
                                    </div>
                                    {plotSuggestion.title ? (
                                        <div className="mt-1 text-[11px] text-slate-500">Title: {plotSuggestion.title}</div>
                                    ) : null}
                                    {plotSuggestion.reasoning ? (
                                        <div className="mt-1 text-[11px] text-slate-500">{plotSuggestion.reasoning}</div>
                                    ) : null}
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => applySuggestedPlot(plotSuggestion, false)}
                                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={() => applySuggestedPlot(plotSuggestion, true)}
                                            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                                        >
                                            Plot suggestion
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                            {plotSuggestionError ? (
                                <div className="text-xs text-rose-600">{plotSuggestionError}</div>
                            ) : null}
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data input</label>
                            <div className="mt-2 flex items-center gap-2">
                                {(['csv', 'json'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setDataMode(mode)}
                                        className={`px-3 py-1.5 text-xs rounded-full border ${dataMode === mode ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {mode.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={draftDataInput}
                                onChange={(event) => setDraftDataInput(event.target.value)}
                                className="mt-3 w-full min-h-[180px] rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700"
                            />
                            {parseError ? (
                                <div className="mt-2 text-xs text-rose-600">{parseError}</div>
                            ) : null}
                            <button
                                onClick={handlePlot}
                                disabled={mappingActive}
                                className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold ${mappingActive ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                            >
                                {mappingActive ? 'Mapping active' : 'Plot data'}
                            </button>
                            {mappingActive ? (
                                <div className="mt-2 text-[11px] text-slate-400">Clear mapping to use manual plotting.</div>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={showLegend}
                                    onChange={(event) => setShowLegend(event.target.checked)}
                                />
                                Show legend
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={showTooltip}
                                    onChange={(event) => setShowTooltip(event.target.checked)}
                                />
                                Show tooltips
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={enableZoom}
                                    onChange={(event) => setEnableZoom(event.target.checked)}
                                />
                                Enable zoom + pan
                            </label>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dependencies used</div>
                            <ul className="mt-2 text-xs text-slate-600 space-y-1">
                                <li>Chart.js (core rendering)</li>
                                <li>chartjs-plugin-zoom (zoom + pan)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 bg-white p-6">
                        <div className="h-full rounded-2xl border border-slate-200 bg-white p-4">
                            {parsedData ? (
                                <div className="h-full">
                                    <canvas ref={chartRef} className="h-full w-full" />
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-sm text-slate-500">
                                    {emptyStateMessage}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChartJsDataPlotter;
