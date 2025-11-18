import { useEffect, useRef } from 'react';
import type { ChartData } from './types/frappe';
import { Chart } from 'frappe-charts';

type ChartInstance = {
  update: (data: ChartData, options?: Record<string, unknown>) => void;
  destroy: () => void;
};

export interface FrappeChartProps {
  data: ChartData;
  type?: 'line' | 'bar' | 'scatter' | 'percentage';
  height?: number;
  colors?: string[];
  axisOptions?: Record<string, unknown>;
  lineOptions?: Record<string, unknown>;
  barOptions?: Record<string, unknown>;
  tooltipOptions?: Record<string, unknown>;
  valuesOverPoints?: number;
  animate?: boolean;
}

const FrappeChartComponent: React.FC<FrappeChartProps> = ({
  data,
  type = 'line',
  height = 260,
  colors,
  axisOptions,
  lineOptions,
  barOptions,
  tooltipOptions,
  valuesOverPoints,
  animate = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const latestDataRef = useRef<ChartData>(data);

  useEffect(() => {
    latestDataRef.current = data;
    if (chartRef.current) {
      chartRef.current.update(data, { animate });
    }
  }, [data, animate]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    chartRef.current?.destroy();

    chartRef.current = new Chart(containerRef.current, {
      data: latestDataRef.current,
      type,
      height,
      colors,
      axisOptions,
      lineOptions,
      barOptions,
      tooltipOptions,
      valuesOverPoints,
      animate,
      isNavigable: true
    }) as ChartInstance;

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [type, height, colors, axisOptions, lineOptions, barOptions, tooltipOptions, valuesOverPoints, animate]);

  return <div ref={containerRef} className="frappe-chart-container" />;
};

export default FrappeChartComponent;
