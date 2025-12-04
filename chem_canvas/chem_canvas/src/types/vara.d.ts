declare module 'vara' {
  interface VaraTextOptions {
    text: string;
    fontSize?: number;
    strokeWidth?: number;
    color?: string;
    duration?: number;
    textAlign?: 'left' | 'center' | 'right';
    x?: number;
    y?: number;
    fromCurrentPosition?: { x: boolean; y: boolean };
    autoAnimation?: boolean;
    queued?: boolean;
    delay?: number;
    letterSpacing?: number;
  }

  interface VaraOptions {
    strokeWidth?: number;
    color?: string;
    fontSize?: number;
    textAlign?: 'left' | 'center' | 'right';
    autoAnimation?: boolean;
    queued?: boolean;
    delay?: number;
    letterSpacing?: number;
  }

  class Vara {
    constructor(
      element: string | HTMLElement,
      fontSource: string,
      textObjects: VaraTextOptions[],
      options?: VaraOptions
    );

    ready(callback: () => void): void;
    animationEnd(callback: (i: number, o: any) => void): void;
    get(id: string | number): any;
    draw(id: string | number, duration?: number): void;
    erase(id: string | number): void;
    playAll(): void;
    pauseAll(): void;
  }

  export = Vara;
}
