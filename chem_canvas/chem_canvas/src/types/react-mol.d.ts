declare module 'react-mol' {
  import * as React from 'react';

  type MolProps = React.PropsWithChildren<{
    angle?: number;
    double?: boolean;
    color?: string;
    index?: number;
  }>;

  export const Mol: React.ForwardRefExoticComponent<MolProps>;
  export const C: typeof Mol;
  export const O: typeof Mol;
  export const N: typeof Mol;
  export const H: typeof Mol;
}
