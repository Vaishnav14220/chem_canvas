declare module 'frappe-charts/dist/frappe-charts.min.esm' {
  import type { ChartData } from '../components/types/frappe';

  export class Chart {
    constructor(placeholder: HTMLElement | string, options: Record<string, unknown>);
    update(data: ChartData, options?: Record<string, unknown>): void;
    destroy(): void;
  }
}
