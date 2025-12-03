declare module 'react-katex' {
  export const InlineMath: React.ComponentType<{ math: string; className?: string }>;
  export const BlockMath: React.ComponentType<{ math: string; className?: string }>;
}