import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Jmol?: any;
    __jsmolLoaderPromise?: Promise<any>;
  }
}

const JSMOL_SCRIPT_URL = 'https://chemapps.stolaf.edu/jmol/jsmol/JSmol.min.js';
const J2S_PATH = 'https://chemapps.stolaf.edu/jmol/jsmol/j2s';

const DEFAULT_SCRIPT = `
load $caffeine;
wireframe 0.2;
spacefill off;
color atoms cpk;
spin y 5;
`;

const loadJSmol = (): Promise<any> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('JSmol can only run in a browser environment.'));
  }

  if (window.Jmol) {
    return Promise.resolve(window.Jmol);
  }

  if (!window.__jsmolLoaderPromise) {
    window.__jsmolLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = JSMOL_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(window.Jmol);
      script.onerror = () => reject(new Error('Failed to load the JSmol library.'));
      document.head.appendChild(script);
    });
  }

  return window.__jsmolLoaderPromise;
};

interface JSmolViewerProps {
  script: string;
  height?: number;
  backgroundColor?: string;
}

const JSmolViewer: React.FC<JSmolViewerProps> = ({
  script,
  height = 520,
  backgroundColor = '#0f172a',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const startupScriptRef = useRef(script && script.trim() ? script : DEFAULT_SCRIPT);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const runScript = (cmd: string) => {
    if (!cmd || !cmd.trim()) {
      return;
    }
    if (typeof window === 'undefined' || !window.Jmol || !appletRef.current) {
      return;
    }
    window.Jmol.script(appletRef.current, cmd);
  };

  useEffect(() => {
    let isMounted = true;
    let appletId = `jsmolApplet_${Date.now()}`;

    loadJSmol()
      .then((Jmol) => {
        if (!isMounted || !containerRef.current) {
          return;
        }

        if (typeof Jmol.setDocument === 'function') {
          Jmol.setDocument(0);
        }

        const info = {
          width: '100%',
          height: '100%',
          debug: false,
          color: backgroundColor,
          use: 'HTML5',
          j2sPath: J2S_PATH,
          script: startupScriptRef.current || DEFAULT_SCRIPT,
          serverURL: 'https://chemapps.stolaf.edu/jmol/jsmol/php/jsmol.php',
          disableInitialConsole: true,
          disableJ2SLoadMonitor: true,
          addSelectionOptions: true,
        };

        appletRef.current = Jmol.getApplet(appletId, info);
        containerRef.current.innerHTML = Jmol.getAppletHtml(appletRef.current);
        setStatus('ready');
      })
      .catch((err: Error) => {
        if (!isMounted) {
          return;
        }
        setError(err.message || 'Unable to load JSmol.');
        setStatus('error');
      });

    return () => {
      isMounted = false;
      appletRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      appletId = '';
    };
  }, [backgroundColor]);

  useEffect(() => {
    if (status === 'ready') {
      runScript(script);
    }
  }, [script, status]);

  useEffect(() => {
    if (status !== 'ready') {
      startupScriptRef.current = script && script.trim() ? script : DEFAULT_SCRIPT;
    }
  }, [script, status]);

  return (
    <div className="relative rounded-xl border border-slate-700 overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="w-full h-full bg-slate-900" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-slate-200 text-sm">
          Loading JSmol workspace...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-red-200 text-sm px-6 text-center">
          <p className="font-semibold mb-2">JSmol failed to load</p>
          <p className="text-xs opacity-80">{error}</p>
        </div>
      )}
    </div>
  );
};

export default JSmolViewer;
