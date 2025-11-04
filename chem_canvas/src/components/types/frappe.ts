export interface ChartDataset {
  name: string;
  values: number[];
  chartType?: 'line' | 'bar' | 'scatter';
  color?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}
