import { useMemo } from 'react';
import ArMoleculePreview from './ArMoleculePreview';

const ArMobileView: React.FC = () => {
  const cid = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const pathMatch = window.location.pathname.match(/^\/ar\/([^/]+)/i);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }

    const params = new URLSearchParams(window.location.search);
    const queryCid = params.get('cid');
    return queryCid ? decodeURIComponent(queryCid) : null;
  }, []);

  const resolvedCid = cid ?? '241';

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100">
      <header className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold">ChemCanvas AR Viewer</h1>
          <p className="mt-1 text-xs text-slate-300">
            Move around to explore the molecule. Tap <strong>Start AR</strong> to place it in your environment.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4">
        <ArMoleculePreview initialCid={resolvedCid} mode="mobile" />
      </main>
    </div>
  );
};

export default ArMobileView;
