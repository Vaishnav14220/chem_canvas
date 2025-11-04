declare module 'molstar/build/viewer/molstar' {
  interface ViewerMethods {
    loadPdb(id: string): Promise<void>;
    loadStructureFromUrl(url: string, format: string, isBinary?: boolean, options?: { label?: string }): Promise<void>;
    dispose(): void;
    handleResize(): void;
  }

  interface ViewerProperties {
    canvas: HTMLCanvasElement;
    plugin: any; // Mol* plugin instance
  }

  export interface Viewer extends ViewerMethods, ViewerProperties {}

  export class Viewer {
    constructor(element: HTMLElement, options?: Record<string, unknown>);
    static create(element: HTMLElement, options?: Record<string, unknown>): Promise<Viewer>;
    loadPdb(id: string): Promise<void>;
    loadStructureFromUrl(url: string, format: string, isBinary?: boolean, options?: { label?: string }): Promise<void>;
    dispose(): void;
    handleResize(): void;
    canvas: HTMLCanvasElement;
    plugin: any; // Mol* plugin instance
  }
}