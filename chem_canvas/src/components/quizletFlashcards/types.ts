import type { CSSProperties, ReactElement } from 'react';

export interface FlashcardFace {
  html: ReactElement;
  style?: CSSProperties;
}

export interface IFlashcard {
  className?: string;
  style?: CSSProperties;
  front: FlashcardFace;
  back: FlashcardFace;
}

export type FlipState = 'front' | 'back';

// right-to-left, left-to-right, top-to-bottom, bottom-to-top
export type FlipDirection = 'rtl' | 'ltr' | 'tb' | 'bt';
