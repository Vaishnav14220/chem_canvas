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

export interface JSmolViewerInterface {
  evaluate: (expression: string) => any;
  runScript: (cmd: string) => void;
}

interface JSmolViewerProps {
  script: string;
  command?: string; // For executing additional commands without reloading
  height?: number;
  backgroundColor?: string;
  onReady?: (viewer: JSmolViewerInterface) => void;
}

const JSmolViewer: React.FC<JSmolViewerProps> = ({
  script,
  command,
  height = 520,
  backgroundColor = '#0f172a',
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const startupScriptRef = useRef(script && script.trim() ? script : DEFAULT_SCRIPT);
  const lastCommandRef = useRef<string>('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const runScript = (cmd: string) => {
    if (!cmd || !cmd.trim()) {
      console.warn('[JSmol] runScript called with empty command');
      return;
    }
    if (typeof window === 'undefined' || !window.Jmol) {
      console.warn('[JSmol] Jmol not loaded');
      return;
    }
    if (!appletRef.current) {
      console.warn('[JSmol] appletRef.current is null');
      return;
    }
    console.log('[JSmol] Running script:', cmd);
    window.Jmol.script(appletRef.current, cmd);
  };

  const evaluate = (expression: string): any => {
    if (typeof window === 'undefined' || !window.Jmol || !appletRef.current) {
      return null;
    }
    try {
      return window.Jmol.evaluateVar(appletRef.current, expression);
    } catch (err) {
      console.error('JSmol evaluate error:', err);
      return null;
    }
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
          readyFunction: (applet: any) => {
            if (isMounted && onReady) {
              // We need to wait a tick for appletRef to be populated if we used the returned applet, 
              // but here JSmol passes the applet object. 
              // However, `appletRef.current` is set below via `Jmol.getApplet`.
              // The safest way is to wrap the interface methods to use the current ref.
              onReady({
                evaluate,
                runScript
              });
            }
          }
        };

        appletRef.current = Jmol.getApplet(appletId, info);
        containerRef.current.innerHTML = Jmol.getAppletHtml(appletRef.current);
        setStatus('ready');

        // Fallback: call onReady immediately if readyFunction isn't reliable or for initial setup
        if (onReady) {
          onReady({ evaluate, runScript });
        }
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

  // Execute commands separately without re-running the full script
  useEffect(() => {
    if (status === 'ready' && command && command !== lastCommandRef.current) {
      lastCommandRef.current = command;
      runScript(command);
    }
  }, [command, status]);

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
