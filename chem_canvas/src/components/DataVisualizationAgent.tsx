/**
 * DataVisualizationAgent - AI-powered data visualization component
 * Uses reaviz for beautiful, interactive charts
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import {
  BarChart3,
  LineChart,
  PieChart,
  ScatterChart,
  Send,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Code,
  Eye,
  FileSpreadsheet,
  Upload
} from 'lucide-react';

// Reaviz imports
import {
  BarChart,
  BarSeries,
  Bar,
  GridlineSeries,
  Gridline,
  LinearXAxis,
  LinearYAxis,
  LinearXAxisTickSeries,
  LinearXAxisTickLabel,
  LinearYAxisTickSeries,
  LinearYAxisTickLabel
} from 'reaviz';
import {
  LineChart as ReavizLineChart,
  LineSeries,
  PointSeries
} from 'reaviz';
import {
  AreaChart,
  AreaSeries,
  Area,
  Line,
  Gradient,
  GradientStop
} from 'reaviz';
import {
  PieChart as ReavizPieChart,
  PieArcSeries,
  PieArc,
  PieArcLabel
} from 'reaviz';
import {
  ScatterPlot,
  ScatterSeries,
  ScatterPoint
} from 'reaviz';

import {
  visualizationAgentChat,
  generateVisualization,
  parseDataForChart,
  suggestChartType,
  VisualizationAgentMessage,
  VisualizationResult,
  ChartType,
  DataPoint,
  COLOR_SCHEMES
} from '../services/dataVisualizationService';

// ==========================================
// Types
// ==========================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  visualization?: VisualizationResult;
  timestamp: Date;
}

interface DataVisualizationAgentProps {
  onClose?: () => void;
  initialData?: string;
  theme?: 'light' | 'dark';
}

// ==========================================
// Chart Renderer Component
// ==========================================

interface ChartRendererProps {
  visualization: VisualizationResult;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
}

const ChartRenderer: React.FC<ChartRendererProps> = ({
  visualization,
  width = 450,
  height = 300,
  theme = 'dark'
}) => {
  const { chartType, processedData, config } = visualization;
  const data = processedData as DataPoint[];
  const gridColor = theme === 'dark' ? '#7E7E8F75' : '#E5E5E5';
  const textColor = theme === 'dark' ? '#fff' : '#333';

  const commonAxisProps = {
    yAxis: (
      <LinearYAxis
        axisLine={null}
        tickSeries={
          <LinearYAxisTickSeries
            line={null}
            label={<LinearYAxisTickLabel fill={textColor} />}
          />
        }
      />
    ),
    xAxis: (
      <LinearXAxis
        type="category"
        tickSeries={
          <LinearXAxisTickSeries
            label={<LinearXAxisTickLabel fill={textColor} rotation={-45} />}
          />
        }
      />
    ),
    gridlines: <GridlineSeries line={<Gridline strokeColor={gridColor} />} />
  };

  switch (chartType) {
    case 'bar':
      return (
        <BarChart
          width={width}
          height={height}
          data={data}
          {...commonAxisProps}
          series={
            <BarSeries
              colorScheme={COLOR_SCHEMES.cybertron}
              bar={<Bar gradient={null} glow={{ blur: 15, opacity: 0.5 }} />}
            />
          }
        />
      );

    case 'line':
      return (
        <ReavizLineChart
          width={width}
          height={height}
          data={data}
          {...commonAxisProps}
          xAxis={<LinearXAxis type="category" />}
          series={
            <LineSeries
              colorScheme={['#4C86FF']}
              symbols={<PointSeries show={true} />}
            />
          }
        />
      );

    case 'area':
      return (
        <AreaChart
          width={width}
          height={height}
          data={data}
          {...commonAxisProps}
          xAxis={<LinearXAxis type="category" />}
          series={
            <AreaSeries
              colorScheme={['#4C86FF']}
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
        />
      );

    case 'scatter':
      return (
        <ScatterPlot
          width={width}
          height={height}
          data={data}
          {...commonAxisProps}
          xAxis={<LinearXAxis type="category" />}
          series={
            <ScatterSeries
              point={
                <ScatterPoint
                  color="#4C86FF"
                  size={8}
                  glow={{ color: '#4C86FF70', blur: 12 }}
                />
              }
            />
          }
        />
      );

    case 'pie':
    case 'donut':
      return (
        <ReavizPieChart
          width={width}
          height={height}
          data={data}
          series={
            <PieArcSeries
              doughnut={chartType === 'donut'}
              colorScheme={COLOR_SCHEMES.cybertron}
              arc={<PieArc />}
              label={<PieArcLabel fill={textColor} />}
            />
          }
        />
      );

    default:
      return (
        <BarChart
          width={width}
          height={height}
          data={data}
          {...commonAxisProps}
          series={
            <BarSeries
              colorScheme={COLOR_SCHEMES.cybertron}
              bar={<Bar gradient={null} />}
            />
          }
        />
      );
  }
};

// ==========================================
// Main Component
// ==========================================

const DataVisualizationAgent: React.FC<DataVisualizationAgentProps> = ({
  onClose,
  initialData,
  theme = 'dark'
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCode, setShowCode] = useState<string | null>(null);
  const [selectedChartType, setSelectedChartType] = useState<ChartType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Process initial data if provided
  useEffect(() => {
    if (initialData) {
      handleSendMessage(`Please visualize this data:\n${initialData}`);
    }
  }, []);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert messages to agent format
      const history: VisualizationAgentMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
        visualization: m.visualization
      }));

      const response = await visualizationAgentChat(text, history);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        visualization: response.visualization,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const message = `Please analyze and visualize this ${file.name.endsWith('.csv') ? 'CSV' : 'data'} file:\n\n${text}`;
      handleSendMessage(message);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const handleQuickVisualize = async (type: ChartType) => {
    setSelectedChartType(type);
    handleSendMessage(`Create a ${type} chart. I'll provide the data.`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const downloadChart = (visualization: VisualizationResult) => {
    const blob = new Blob([visualization.chartCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${visualization.chartType}-chart.tsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartTypeIcons: Record<string, React.ReactNode> = {
    bar: <BarChart3 className="w-4 h-4" />,
    line: <LineChart className="w-4 h-4" />,
    area: <LineChart className="w-4 h-4" />,
    scatter: <ScatterChart className="w-4 h-4" />,
    pie: <PieChart className="w-4 h-4" />,
    donut: <PieChart className="w-4 h-4" />
  };

  return (
    <Card className="h-full flex flex-col bg-gray-900 border-gray-700">
      <CardHeader className="pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Data Visualization Agent</CardTitle>
              <CardDescription className="text-gray-400">
                AI-powered charts with reaviz
              </CardDescription>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => handleQuickVisualize('bar')}
          >
            <BarChart3 className="w-3 h-3 mr-1" />
            Bar Chart
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => handleQuickVisualize('line')}
          >
            <LineChart className="w-3 h-3 mr-1" />
            Line Chart
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => handleQuickVisualize('pie')}
          >
            <PieChart className="w-3 h-3 mr-1" />
            Pie Chart
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3 h-3 mr-1" />
            Upload Data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="mb-2">Welcome to the Data Visualization Agent!</p>
                <p className="text-sm">
                  Share your data (CSV, JSON, or describe it) and I'll create beautiful charts.
                </p>
                <div className="mt-4 text-xs text-gray-600">
                  Try: "Create a bar chart with: Product A 120, Product B 85, Product C 200"
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Visualization */}
                  {message.visualization && (
                    <div className="mt-3 bg-gray-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                          {chartTypeIcons[message.visualization.chartType] || <BarChart3 className="w-4 h-4" />}
                          <span className="ml-1 capitalize">{message.visualization.chartType} Chart</span>
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setShowCode(
                              showCode === message.id ? null : message.id
                            )}
                          >
                            {showCode === message.id ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <Code className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => copyCode(message.visualization!.chartCode)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => downloadChart(message.visualization!)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Chart or Code View */}
                      {showCode === message.id ? (
                        <pre className="bg-gray-950 rounded p-3 text-xs overflow-x-auto max-h-[300px] overflow-y-auto">
                          <code className="text-green-400">
                            {message.visualization.chartCode}
                          </code>
                        </pre>
                      ) : (
                        <div className="bg-gray-950/50 rounded p-2 flex justify-center">
                          <ChartRenderer
                            visualization={message.visualization}
                            width={400}
                            height={280}
                            theme={theme}
                          />
                        </div>
                      )}

                      {/* Explanation */}
                      {message.visualization.explanation && (
                        <p className="text-xs text-gray-400 mt-2">
                          {message.visualization.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-xs opacity-50 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-sm text-gray-400">Creating visualization...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Describe your data or paste CSV/JSON..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 px-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tip: Paste data like "Product A, 100 | Product B, 200" or upload a CSV file
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataVisualizationAgent;
