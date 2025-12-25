declare module 'fengari' {
  export const lua: any;
  export const lauxlib: any;
  export const lualib: any;
  export function to_luastring(value: string): any;
  export function to_jsstring(value: any): string;
}

declare module 'fengari/src/lua' {
  const lua: any;
  export = lua;
}

declare module 'fengari/src/lauxlib' {
  const lauxlib: any;
  export = lauxlib;
}

declare module 'fengari/src/defs' {
  export const to_luastring: any;
  export const to_jsstring: any;
}

declare module 'fengari/src/lbaselib' {
  const lbaselib: any;
  export = lbaselib;
}

declare module 'fengari/src/lmathlib' {
  const lmathlib: any;
  export = lmathlib;
}
