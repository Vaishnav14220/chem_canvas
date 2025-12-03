declare module 'frappe-charts' {
  export class Chart {
    constructor(element: HTMLElement, options: any);
    update(data: any, options?: any): void;
    destroy(): void;
  }
}