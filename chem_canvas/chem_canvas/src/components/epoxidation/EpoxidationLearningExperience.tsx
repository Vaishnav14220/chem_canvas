import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Compass, FlaskConical, Cpu, CheckCircle2, NotebookPen, RefreshCcw, Home, ArrowLeft } from 'lucide-react';
import TheorySection from './TheorySection';
import SimulationSection from './SimulationSection';
import ExperimentSection from './ExperimentSection';
import QuizSection from './QuizSection';
import {
  EpoxidationContextProvider,
  useEpoxidation,
  formatTimestamp,
  type EpoxidationSectionKey
} from './context';

const navItems: Array<{ path: string; label: string; description: string; icon: React.ReactNode; key: EpoxidationSectionKey }> = [
  {
    path: '/epoxidation/theory',
    label: 'Theory',
    description: 'Frontier orbitals · stereochemistry · graduate briefs',
    icon: <Compass className="h-4 w-4" />,
    key: 'theory'
  },
  {
    path: '/epoxidation/simulation',
    label: 'Simulation',
    description: 'React Mol stereochemistry, kinetics dial-in',
    icon: <Cpu className="h-4 w-4" />,
    key: 'simulation'
  },
  {
    path: '/epoxidation/experiment',
    label: 'Experiment',
    description: 'Virtual lab setup, safety dossier, mechanism sketch',
    icon: <FlaskConical className="h-4 w-4" />,
    key: 'experiment'
  },
  {
    path: '/epoxidation/quiz',
    label: 'Quiz',
    description: 'Advanced assessments · progress tracking',
    icon: <CheckCircle2 className="h-4 w-4" />,
    key: 'quiz'
  }
];

const EpoxidationLearningExperience: React.FC = () => (
  <EpoxidationContextProvider>
    <EpoxidationLayout />
  </EpoxidationContextProvider>
);

const EpoxidationLayout: React.FC = () => {
  const { state, resetExperience } = useEpoxidation();
  const location = useLocation();

  const progress = navItems.map(item => ({
    ...item,
    complete: state.completedSections.includes(item.key)
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Adaptive Chemistry Studio</p>
            <h1 className="text-2xl font-semibold text-emerald-100">Alkene Epoxidation · Masters &amp; Engineering Track</h1>
            <p className="mt-1 text-xs text-slate-400">
              Structured learning path derived from Subject Explorer analytics. Follow the navigation to move from theory to simulation, design, and assessment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/20 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-300/40"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to canvas
            </NavLink>
            <button
              type="button"
              onClick={resetExperience}
              className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/70"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset module
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="w-full shrink-0 space-y-6 rounded-2xl border border-slate-200/10 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/30 lg:w-72">
          <div className="space-y-3">
            {progress.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    'block rounded-xl border px-4 py-3 transition-colors',
                    isActive
                      ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                      : 'border-slate-200/10 bg-slate-950/60 text-slate-200 hover:border-slate-300/30'
                  ].join(' ')
                }
              >
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                  <span className="flex items-center gap-2 text-slate-200">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.complete && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{item.description}</p>
              </NavLink>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <NotebookPen className="h-4 w-4" />
              Journal timeline
            </div>
            <JournalList />
          </section>

          <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Home className="h-4 w-4" />
              Current route
            </div>
            <p className="mt-2 break-words text-[11px] text-slate-400">{location.pathname}</p>
          </section>
        </aside>

        <section className="flex-1 space-y-6">
          <Routes>
            <Route path="/epoxidation/theory" element={<TheorySection />} />
            <Route path="/epoxidation/simulation" element={<SimulationSection />} />
            <Route path="/epoxidation/experiment" element={<ExperimentSection />} />
            <Route path="/epoxidation/quiz" element={<QuizSection />} />
            <Route path="*" element={<Navigate to="/epoxidation/theory" replace />} />
          </Routes>
        </section>
      </main>
    </div>
  );
};

const JournalList: React.FC = () => {
  const { state } = useEpoxidation();

  if (state.journal.length === 0) {
    return <p className="mt-3 text-[11px] text-slate-500">Actions you take will appear here for rapid debrief.</p>;
  }

  return (
    <ul className="mt-3 space-y-2 text-[11px] text-slate-200">
      {state.journal.map(entry => (
        <li key={entry.id} className="rounded-lg border border-slate-200/10 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="uppercase tracking-wide">{entry.scope}</span>
            <span>{formatTimestamp(entry.timestamp)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-200">{entry.summary}</p>
        </li>
      ))}
    </ul>
  );
};

export default EpoxidationLearningExperience;
