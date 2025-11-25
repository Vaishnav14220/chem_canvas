/**
 * Data Visualization Service - AI-powered chart generation using reaviz
 * Creates beautiful visualizations for research data analysis
 */

import { getGeminiApiKey } from '../firebase/apiKeys';

// ==========================================
// Types
// ==========================================

export type ChartType = 
  | 'bar' 
  | 'line' 
  | 'area' 
  | 'scatter' 
  | 'pie' 
  | 'donut'
  | 'heatmap'
  | 'radialBar'
  | 'funnel'
  | 'treemap'
  | 'sparkline'
  | 'histogram';

export interface DataPoint {
  key: string;
  data: number;
  metadata?: Record<string, unknown>;
}

export interface MultiSeriesDataPoint {
  key: string;
  data: Array<{
    key: string;
    data: number;
  }>;
}

export interface ChartConfig {
  type: ChartType;
  title?: string;
  width?: number;
  height?: number;
  colorScheme?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  animated?: boolean;
  theme?: 'light' | 'dark';
}

export interface VisualizationRequest {
  data: string | DataPoint[] | MultiSeriesDataPoint[] | number[][];
  description?: string;
  suggestedChartType?: ChartType;
  title?: string;
}

export interface VisualizationResult {
  chartType: ChartType;
  chartCode: string;
  processedData: DataPoint[] | MultiSeriesDataPoint[];
  explanation: string;
  config: ChartConfig;
}

// ==========================================
// Color Schemes
// ==========================================

export const COLOR_SCHEMES = {
  cybertron: ['#4C86FF', '#40E5D1', '#9152EE', '#40D3F4', '#00DCC2', '#6C18E8'],
  ocean: ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8', '#03045E', '#023E8A'],
  sunset: ['#FF6B6B', '#FFA500', '#FFD93D', '#6BCB77', '#4D96FF', '#845EC2'],
  forest: ['#2D5016', '#4A7C23', '#76B041', '#A8D06E', '#D4E79E', '#1B3409'],
  galaxy: ['#5D25EE', '#8B5CF6', '#A78BFA', '#C4B5FD', '#EDE9FE', '#3B0764'],
  scientific: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
  earth: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3', '#654321'],
  neon: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0080', '#8000FF'],
};

// ==========================================
// Data Processing Utilities
// ==========================================

/**
 * Parse various data formats into chart-ready format
 */
export function parseDataForChart(
  rawData: string | DataPoint[] | MultiSeriesDataPoint[] | number[][]
): DataPoint[] | MultiSeriesDataPoint[] {
  // Already in correct format
  if (Array.isArray(rawData) && rawData.length > 0) {
    const first = rawData[0];
    if (typeof first === 'object' && 'key' in first && 'data' in first) {
      return rawData as DataPoint[] | MultiSeriesDataPoint[];
    }
    // Array of numbers - convert to DataPoint[]
    if (typeof first === 'number') {
      return (rawData as number[]).map((value, index) => ({
        key: `Point ${index + 1}`,
        data: value
      }));
    }
    // 2D array - convert to DataPoint[] or MultiSeriesDataPoint[]
    if (Array.isArray(first)) {
      const arr = rawData as number[][];
      if (arr[0].length === 2) {
        // [label, value] pairs
        return arr.map((row, index) => ({
          key: String(row[0]) || `Item ${index + 1}`,
          data: Number(row[1]) || 0
        }));
      } else {
        // Multi-series: each row is a series
        return arr.map((row, rowIndex) => ({
          key: `Series ${rowIndex + 1}`,
          data: row.map((val, colIndex) => ({
            key: `Point ${colIndex + 1}`,
            data: Number(val) || 0
          }))
        }));
      }
    }
  }

  // Parse string data (CSV, JSON, etc.)
  if (typeof rawData === 'string') {
    const trimmed = rawData.trim();
    
    // Try JSON first
    try {
      const parsed = JSON.parse(trimmed);
      return parseDataForChart(parsed);
    } catch {
      // Not JSON, try CSV
    }

    // Parse CSV
    const lines = trimmed.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const hasHeader = isNaN(Number(lines[0].split(',')[1]?.trim()));
      const dataLines = hasHeader ? lines.slice(1) : lines;
      
      return dataLines.map((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        return {
          key: parts[0] || `Item ${index + 1}`,
          data: Number(parts[1]) || 0
        };
      });
    }
  }

  return [];
}

/**
 * Suggest the best chart type based on data characteristics
 */
export function suggestChartType(
  data: DataPoint[] | MultiSeriesDataPoint[],
  description?: string
): ChartType {
  const descLower = description?.toLowerCase() || '';
  
  // Check description hints first
  if (descLower.includes('trend') || descLower.includes('time') || descLower.includes('over time')) {
    return 'line';
  }
  if (descLower.includes('distribution') || descLower.includes('frequency')) {
    return 'histogram';
  }
  if (descLower.includes('proportion') || descLower.includes('percentage') || descLower.includes('share')) {
    return 'pie';
  }
  if (descLower.includes('comparison') || descLower.includes('compare')) {
    return 'bar';
  }
  if (descLower.includes('correlation') || descLower.includes('scatter') || descLower.includes('relationship')) {
    return 'scatter';
  }
  if (descLower.includes('heatmap') || descLower.includes('matrix')) {
    return 'heatmap';
  }
  if (descLower.includes('funnel') || descLower.includes('conversion')) {
    return 'funnel';
  }
  if (descLower.includes('hierarchy') || descLower.includes('breakdown')) {
    return 'treemap';
  }

  // Analyze data characteristics
  if (data.length === 0) return 'bar';
  
  const first = data[0];
  const isMultiSeries = Array.isArray((first as MultiSeriesDataPoint).data);
  
  if (isMultiSeries) {
    return 'bar'; // Grouped/stacked bar for multi-series
  }
  
  // Single series analysis
  const numPoints = data.length;
  
  if (numPoints <= 6) {
    // Small dataset - pie or donut works well
    const total = (data as DataPoint[]).reduce((sum, d) => sum + d.data, 0);
    const allPositive = (data as DataPoint[]).every(d => d.data >= 0);
    if (allPositive && total > 0) {
      return numPoints <= 4 ? 'pie' : 'donut';
    }
  }
  
  if (numPoints > 50) {
    // Large dataset - line or area for trends
    return 'area';
  }
  
  // Default to bar chart
  return 'bar';
}

// ==========================================
// Chart Code Generation
// ==========================================

/**
 * Generate React component code for the chart
 */
export function generateChartCode(
  chartType: ChartType,
  data: DataPoint[] | MultiSeriesDataPoint[],
  config: ChartConfig
): string {
  const { width = 500, height = 350, colorScheme = 'cybertron', theme = 'dark' } = config;
  const dataJson = JSON.stringify(data, null, 2);
  
  const baseImports = `import React from 'react';`;
  
  switch (chartType) {
    case 'bar':
      return `${baseImports}
import { BarChart, BarSeries, Bar, LinearXAxis, LinearYAxis, GridlineSeries, Gridline } from 'reaviz';

const data = ${dataJson};

export const DataBarChart = () => (
  <BarChart
    width={${width}}
    height={${height}}
    data={data}
    series={
      <BarSeries
        colorScheme="${colorScheme}"
        bar={<Bar gradient={null} />}
      />
    }
    gridlines={<GridlineSeries line={<Gridline strokeColor="${theme === 'dark' ? '#7E7E8F75' : '#E5E5E5'}" />} />}
  />
);`;

    case 'line':
      return `${baseImports}
import { LineChart, LineSeries, LinearXAxis, LinearYAxis, GridlineSeries, Gridline, PointSeries } from 'reaviz';

const data = ${dataJson};

export const DataLineChart = () => (
  <LineChart
    width={${width}}
    height={${height}}
    data={data}
    series={
      <LineSeries
        colorScheme={["#4C86FF"]}
        symbols={<PointSeries show={true} />}
      />
    }
    gridlines={<GridlineSeries line={<Gridline strokeColor="${theme === 'dark' ? '#7E7E8F75' : '#E5E5E5'}" />} />}
  />
);`;

    case 'area':
      return `${baseImports}
import { AreaChart, AreaSeries, Area, Line, Gradient, GradientStop, GridlineSeries, Gridline } from 'reaviz';

const data = ${dataJson};

export const DataAreaChart = () => (
  <AreaChart
    width={${width}}
    height={${height}}
    data={data}
    series={
      <AreaSeries
        colorScheme={["#4C86FF"]}
        area={
          <Area
            gradient={
              <Gradient
                stops={[
                  <GradientStop offset="0%" stopOpacity={0.4} key="start" />,
                  <GradientStop offset="100%" stopOpacity={0.1} key="end" />
                ]}
              />
            }
          />
        }
        line={<Line strokeWidth={2} />}
      />
    }
    gridlines={<GridlineSeries line={<Gridline strokeColor="${theme === 'dark' ? '#7E7E8F75' : '#E5E5E5'}" />} />}
  />
);`;

    case 'scatter':
      return `${baseImports}
import { ScatterPlot, ScatterSeries, ScatterPoint, GridlineSeries, Gridline } from 'reaviz';

const data = ${dataJson};

export const DataScatterPlot = () => (
  <ScatterPlot
    width={${width}}
    height={${height}}
    data={data}
    series={
      <ScatterSeries
        point={
          <ScatterPoint
            color="#4C86FF"
            size={6}
            glow={{ color: '#4C86FF70', blur: 12 }}
          />
        }
      />
    }
    gridlines={<GridlineSeries line={<Gridline strokeColor="${theme === 'dark' ? '#7E7E8F75' : '#E5E5E5'}" />} />}
  />
);`;

    case 'pie':
      return `${baseImports}
import { PieChart, PieArcSeries, PieArc, PieArcLabel } from 'reaviz';

const data = ${dataJson};

export const DataPieChart = () => (
  <PieChart
    width={${width}}
    height={${height}}
    data={data}
    series={
      <PieArcSeries
        colorScheme="${colorScheme}"
        arc={<PieArc />}
        label={<PieArcLabel />}
      />
    }
  />
);`;

    case 'donut':
      return `${baseImports}
import { PieChart, PieArcSeries, PieArc, PieArcLabel } from 'reaviz';

const data = ${dataJson};

export const DataDonutChart = () => (
  <PieChart
    width={${width}}
    height={${height}}
    data={data}
    series={
      <PieArcSeries
        doughnut={true}
        colorScheme="${colorScheme}"
        arc={<PieArc />}
        label={<PieArcLabel />}
      />
    }
  />
);`;

    case 'heatmap':
      return `${baseImports}
import { Heatmap, HeatmapSeries, HeatmapCell } from 'reaviz';

const data = ${dataJson};

export const DataHeatmap = () => (
  <Heatmap
    width={${width}}
    height={${height}}
    data={data}
    series={<HeatmapSeries colorScheme="OrRd" />}
  />
);`;

    case 'radialBar':
      return `${baseImports}
import { RadialBarChart, RadialBarSeries, RadialBar } from 'reaviz';

const data = ${dataJson};

export const DataRadialBarChart = () => (
  <RadialBarChart
    width={${width}}
    height={${height}}
    data={data}
    innerRadius={50}
    series={
      <RadialBarSeries
        colorScheme="${colorScheme}"
        bar={<RadialBar />}
      />
    }
  />
);`;

    case 'funnel':
      return `${baseImports}
import { FunnelChart, FunnelSeries, FunnelArc } from 'reaviz';

const data = ${dataJson};

export const DataFunnelChart = () => (
  <FunnelChart
    width={${width}}
    height={${height}}
    data={data}
    series={
      <FunnelSeries
        colorScheme="${colorScheme}"
        arc={<FunnelArc />}
      />
    }
  />
);`;

    case 'treemap':
      return `${baseImports}
import { TreeMap, TreeMapSeries, TreeMapRect } from 'reaviz';

const data = ${dataJson};

export const DataTreeMap = () => (
  <TreeMap
    width={${width}}
    height={${height}}
    data={data}
    series={
      <TreeMapSeries
        colorScheme="${colorScheme}"
        rect={<TreeMapRect />}
      />
    }
  />
);`;

    case 'sparkline':
      return `${baseImports}
import { SparklineChart } from 'reaviz';

const data = ${dataJson};

export const DataSparkline = () => (
  <SparklineChart
    width={${width}}
    height={${height}}
    data={data}
  />
);`;

    case 'histogram':
      return `${baseImports}
import { HistogramBarChart, HistogramBarSeries, LinearXAxis, LinearYAxis } from 'reaviz';

const data = ${dataJson};

export const DataHistogram = () => (
  <HistogramBarChart
    width={${width}}
    height={${height}}
    data={data}
    xAxis={<LinearXAxis type="value" />}
    series={<HistogramBarSeries binSize={1} />}
  />
);`;

    default:
      return generateChartCode('bar', data, config);
  }
}

// ==========================================
// AI-Powered Visualization
// ==========================================

/**
 * Use AI to analyze data and suggest the best visualization
 */
export async function analyzeDataWithAI(
  request: VisualizationRequest
): Promise<{
  suggestedType: ChartType;
  explanation: string;
  insights: string[];
  processedData: DataPoint[];
}> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('No API key available');
  }

  const dataString = typeof request.data === 'string' 
    ? request.data 
    : JSON.stringify(request.data);

  const prompt = `You are a data visualization expert. Analyze the following data and provide visualization recommendations.

DATA:
${dataString}

DESCRIPTION: ${request.description || 'No description provided'}

Please respond in JSON format with:
1. "suggestedType": The best chart type from: bar, line, area, scatter, pie, donut, heatmap, radialBar, funnel, treemap, sparkline, histogram
2. "explanation": Why this chart type is best for this data (1-2 sentences)
3. "insights": Array of 2-3 key insights from the data
4. "processedData": The data formatted as an array of {key: string, data: number} objects

Respond ONLY with valid JSON, no markdown or extra text.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestedType: parsed.suggestedType || 'bar',
        explanation: parsed.explanation || 'Bar chart provides clear comparison.',
        insights: parsed.insights || [],
        processedData: parsed.processedData || parseDataForChart(request.data) as DataPoint[]
      };
    }
  } catch (error) {
    console.warn('AI analysis failed, using fallback:', error);
  }

  // Fallback to local analysis
  const processedData = parseDataForChart(request.data) as DataPoint[];
  return {
    suggestedType: suggestChartType(processedData, request.description),
    explanation: 'Chart type suggested based on data characteristics.',
    insights: ['Data visualization generated successfully.'],
    processedData
  };
}

/**
 * Generate a complete visualization from raw data
 */
export async function generateVisualization(
  request: VisualizationRequest
): Promise<VisualizationResult> {
  // Parse the data
  const processedData = parseDataForChart(request.data);
  
  // Determine chart type
  let chartType = request.suggestedChartType;
  let explanation = '';
  
  if (!chartType) {
    try {
      const aiAnalysis = await analyzeDataWithAI(request);
      chartType = aiAnalysis.suggestedType;
      explanation = aiAnalysis.explanation + '\n\nKey Insights:\n' + 
        aiAnalysis.insights.map(i => `• ${i}`).join('\n');
    } catch {
      chartType = suggestChartType(processedData, request.description);
      explanation = 'Chart type selected based on data analysis.';
    }
  } else {
    explanation = `Using requested ${chartType} chart.`;
  }

  // Generate config
  const config: ChartConfig = {
    type: chartType,
    title: request.title,
    width: 500,
    height: 350,
    colorScheme: 'cybertron',
    showLegend: true,
    showGrid: true,
    animated: true,
    theme: 'dark'
  };

  // Generate chart code
  const chartCode = generateChartCode(chartType, processedData, config);

  return {
    chartType,
    chartCode,
    processedData,
    explanation,
    config
  };
}

// ==========================================
// Visualization Agent
// ==========================================

export interface VisualizationAgentMessage {
  role: 'user' | 'assistant';
  content: string;
  visualization?: VisualizationResult;
}

/**
 * Data Visualization Agent - processes user requests and generates charts
 */
export async function visualizationAgentChat(
  userMessage: string,
  conversationHistory: VisualizationAgentMessage[] = []
): Promise<VisualizationAgentMessage> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('No API key available');
  }

  // Build conversation context
  const messages = conversationHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));

  const systemPrompt = `You are a Data Visualization Agent. Your role is to:
1. Help users create beautiful data visualizations using reaviz charts
2. Analyze data and suggest the best chart types
3. Explain insights from the visualizations
4. Help refine and customize charts

Available chart types: bar, line, area, scatter, pie, donut, heatmap, radialBar, funnel, treemap, sparkline, histogram

When the user provides data or asks for a visualization:
1. Identify the data from their message (CSV, JSON, or described data)
2. Respond with a JSON block containing:
   - "action": "create_visualization"
   - "data": the extracted data as an array
   - "chartType": recommended chart type
   - "title": suggested title
   - "description": brief description of the visualization
   - "explanation": why this visualization is appropriate

If they want to refine an existing chart, respond with:
   - "action": "modify_visualization"
   - "changes": description of changes to make

For general questions, just respond conversationally.

Always be helpful and explain your visualization choices.`;

  messages.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000,
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Check if response contains a visualization action
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*"action"[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const action = JSON.parse(jsonStr);
        
        if (action.action === 'create_visualization' && action.data) {
          const visualization = await generateVisualization({
            data: action.data,
            suggestedChartType: action.chartType,
            title: action.title,
            description: action.description
          });
          
          return {
            role: 'assistant',
            content: action.explanation || `Created a ${visualization.chartType} chart: ${action.title || 'Data Visualization'}`,
            visualization
          };
        }
      } catch (parseError) {
        console.warn('Could not parse visualization action:', parseError);
      }
    }

    // Return as regular text response
    return {
      role: 'assistant',
      content: text
    };
  } catch (error) {
    console.error('Visualization agent error:', error);
    return {
      role: 'assistant',
      content: `I encountered an error while processing your request. Please try again or provide the data in a clearer format.`
    };
  }
}

// ==========================================
// Quick Chart Generation Functions
// ==========================================

/**
 * Quick bar chart from simple data
 */
export function createBarChart(
  data: Array<{ label: string; value: number }>,
  options: Partial<ChartConfig> = {}
): VisualizationResult {
  const processed: DataPoint[] = data.map(d => ({ key: d.label, data: d.value }));
  const config: ChartConfig = { type: 'bar', ...options };
  return {
    chartType: 'bar',
    chartCode: generateChartCode('bar', processed, config),
    processedData: processed,
    explanation: 'Bar chart for comparing values across categories.',
    config
  };
}

/**
 * Quick line chart for time series
 */
export function createLineChart(
  data: Array<{ label: string; value: number }>,
  options: Partial<ChartConfig> = {}
): VisualizationResult {
  const processed: DataPoint[] = data.map(d => ({ key: d.label, data: d.value }));
  const config: ChartConfig = { type: 'line', ...options };
  return {
    chartType: 'line',
    chartCode: generateChartCode('line', processed, config),
    processedData: processed,
    explanation: 'Line chart for showing trends over time.',
    config
  };
}

/**
 * Quick pie chart for proportions
 */
export function createPieChart(
  data: Array<{ label: string; value: number }>,
  options: Partial<ChartConfig> = {}
): VisualizationResult {
  const processed: DataPoint[] = data.map(d => ({ key: d.label, data: d.value }));
  const config: ChartConfig = { type: 'pie', ...options };
  return {
    chartType: 'pie',
    chartCode: generateChartCode('pie', processed, config),
    processedData: processed,
    explanation: 'Pie chart for showing proportions of a whole.',
    config
  };
}

export default {
  parseDataForChart,
  suggestChartType,
  generateChartCode,
  generateVisualization,
  analyzeDataWithAI,
  visualizationAgentChat,
  createBarChart,
  createLineChart,
  createPieChart,
  COLOR_SCHEMES
};
