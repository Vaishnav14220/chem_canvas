declare global {
  // eslint-disable-next-line no-var
  var process: { env: Record<string, string | undefined> } | undefined;
}

if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {},
    stdout: { write: () => { } },
    stderr: { write: () => { } },
    stdin: {},
  };
}

if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = {
    from: (value: any) => value,
    isBuffer: () => false,
  };
}

export { };
