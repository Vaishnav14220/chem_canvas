declare global {
  interface Window {
    Kekule?: any;
  }
}

const KEKULE_SCRIPT_URL = 'https://unpkg.com/kekule/dist/kekule.min.js';
const KEKULE_THEME_URL = 'https://unpkg.com/kekule/dist/themes/default/kekule.css';

let kekuleLoadPromise: Promise<any> | null = null;

const appendThemeStylesheet = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const existingLink = document.querySelector('link[data-kekule-theme]');
  if (existingLink) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = KEKULE_THEME_URL;
  link.dataset.kekuleTheme = 'true';
  document.head.appendChild(link);
};

export const ensureKekuleLoaded = async (): Promise<any> => {
  if (typeof window === 'undefined') {
    throw new Error('Kekule viewer can only be loaded in a browser environment.');
  }

  if (window.Kekule) {
    return window.Kekule;
  }

  if (!kekuleLoadPromise) {
    appendThemeStylesheet();

    kekuleLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-kekule-script]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (window.Kekule) {
            resolve(window.Kekule);
          } else {
            kekuleLoadPromise = null;
            reject(new Error('Kekule script loaded but global object is unavailable.'));
          }
        });
        existingScript.addEventListener('error', () => {
          kekuleLoadPromise = null;
          reject(new Error('Failed to load Kekule.js script.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = KEKULE_SCRIPT_URL;
      script.async = true;
      script.dataset.kekuleScript = 'true';

      script.onload = () => {
        if (window.Kekule) {
          resolve(window.Kekule);
        } else {
          kekuleLoadPromise = null;
          reject(new Error('Kekule script loaded but global object is unavailable.'));
        }
      };

      script.onerror = () => {
        kekuleLoadPromise = null;
        reject(new Error('Failed to load Kekule.js script.'));
      };

      document.head.appendChild(script);
    });
  }

  return kekuleLoadPromise;
};

export {};
