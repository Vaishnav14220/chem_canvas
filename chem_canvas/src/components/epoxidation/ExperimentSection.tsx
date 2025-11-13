import React, { useMemo, useState } from 'react';
import { ClipboardCheck, ShieldAlert, Eraser, Check, AlertTriangle, TestTubes, PlusCircle, NotebookPen, Beaker, FlaskConical, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { EpoxidationSectionKey, SAFETY_FLAGS, useEpoxidation, type EpoxidationContextValue } from './context';

const quenchStrategies = [
  'Sodium sulfite quench · 0 °C, slow addition',
  'Catalytic base quench (NaHCO₃) with gas trap',
  'Solid-supported sulfide cartridge inline (flow setup)'
];

const ExperimentSection: React.FC = () => {
  const {
    state: { experiment, reactionConditions, selectedAlkene },
    toggleSafetyChecklist,
    updateReactionConditions,
    appendExperimentNote,
    setMechanismSubmission,
    markSectionComplete,
    logEvent
  } = useEpoxidation();

  const [noteDraft, setNoteDraft] = useState('');
  const [mechanismDraft, setMechanismDraft] = useState(experiment.submittedMechanism ?? '');

  const readiness = useMemo(() => Math.min(100, Math.max(0, experiment.readinessScore)), [experiment.readinessScore]);
  const readinessColour = readiness >= 85 ? 'text-emerald-300' : readiness >= 70 ? 'text-amber-300' : 'text-rose-300';

  const handleNoteSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    appendExperimentNote(noteDraft);
    setNoteDraft('');
  };

  const handleMechanismSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMechanismSubmission(mechanismDraft);
    markSectionComplete('experiment', 'Experiment dossier prepared with mechanism submission.');
  };

  const handlePreset = (preset: EpoxidationSectionKey) => {
    if (preset === 'experiment') {
      updateReactionConditions({ atmosphere: 'oxygen' });
      logEvent('Atmosphere switched to oxygen-rich to support kinetic run.', 'experiment');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/20 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/30">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-amber-100">Virtual Experiment Planner</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Assemble a research-grade experiment dossier covering safety, instrumentation, and mechanistic expectations. Graduate learners should
              justify reagent choices quantitatively, while engineers translate constraints into process parameters.
            </p>
          </div>
          <div className="rounded-full border border-slate-200/10 bg-slate-950/70 px-4 py-2 text-xs text-slate-300">
            Focusing on <span className="font-semibold text-slate-100">{selectedAlkene}</span> using {reactionConditions.oxidant} in {reactionConditions.solvent}.
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="space-y-6">
            <SafetyPanel
              readiness={readiness}
              readinessColour={readinessColour}
              experiment={experiment}
              toggleSafetyChecklist={toggleSafetyChecklist}
            />

            <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                <Layers className="h-4 w-4" />
                Reaction setup controls
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-xs text-slate-300">
                  <span className="flex items-center gap-2 text-slate-100">
                    <Beaker className="h-4 w-4 text-emerald-300" />
                    Solvent selection
                  </span>
                  <select
                    value={reactionConditions.solvent}
                    onChange={event => updateReactionConditions({ solvent: event.target.value as any })}
                    className="w-full rounded-lg border border-slate-200/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="dichloromethane">Dichloromethane (polar aprotic)</option>
                    <option value="acetone">Acetone (moderate polarity)</option>
                    <option value="toluene">Toluene (non-polar)</option>
                  </select>
                </label>

                <label className="space-y-2 text-xs text-slate-300">
                  <span className="flex items-center gap-2 text-slate-100">
                    <FlaskConical className="h-4 w-4 text-rose-300" />
                    Oxidant selection
                  </span>
                  <select
                    value={reactionConditions.oxidant}
                    onChange={event => updateReactionConditions({ oxidant: event.target.value as any })}
                    className="w-full rounded-lg border border-slate-200/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="m-CPBA">m-CPBA (benchmark)</option>
                    <option value="peracetic acid">Peracetic acid (moderate)</option>
                    <option value="DMDO">DMDO (high reactivity)</option>
                  </select>
                </label>

                <label className="space-y-2 text-xs text-slate-300">
                  <span className="flex items-center gap-2 text-slate-100">
                    <Sparkles className="h-4 w-4 text-indigo-300" />
                    Atmosphere
                  </span>
                  <select
                    value={reactionConditions.atmosphere}
                    onChange={event => updateReactionConditions({ atmosphere: event.target.value as any })}
                    className="w-full rounded-lg border border-slate-200/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="air">Air (bench-top)</option>
                    <option value="oxygen">Oxygen supply (kinetic study)</option>
                    <option value="inert">Nitrogen or argon (sensitive substrates)</option>
                  </select>
                </label>

                <label className="space-y-2 text-xs text-slate-300">
                  <span className="flex items-center gap-2 text-slate-100">
                    <TestTubes className="h-4 w-4 text-amber-300" />
                    Quench plan
                  </span>
                  <select
                    className="w-full rounded-lg border border-slate-200/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                    defaultValue=""
                    onChange={event => {
                      const strategy = event.target.value;
                      if (!strategy) {
                        return;
                      }
                      logEvent(`Quench strategy chosen: ${strategy}`, 'experiment');
                      appendExperimentNote(`Quench plan: ${strategy}`);
                      event.target.selectedIndex = 0;
                    }}
                  >
                    <option value="" disabled>
                      Select quench strategy
                    </option>
                    {quenchStrategies.map(strategy => (
                      <option key={strategy} value={strategy}>
                        {strategy}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-200">
                <NotebookPen className="h-4 w-4" />
                Seminar notes / observations
              </h2>
              <form onSubmit={handleNoteSubmit} className="mt-3 space-y-3">
                <textarea
                  value={noteDraft}
                  onChange={event => setNoteDraft(event.target.value)}
                  placeholder="Document observations, scaling concerns, spectroscopic checkpoints..."
                  className="min-h-[120px] w-full rounded-lg border border-slate-200/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-500/30"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add note to lab journal
                </button>
              </form>

              {experiment.notes.length > 0 && (
                <div className="mt-4 space-y-3 text-xs text-slate-300">
                  {experiment.notes.map((note, index) => (
                    <div key={`${note}-${index}`} className="rounded-lg border border-slate-200/10 bg-slate-900/60 p-3">
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <ClipboardCheck className="h-4 w-4" />
                Mechanism submission (arrow pushing narrative)
              </h2>
              <form onSubmit={handleMechanismSubmit} className="mt-3 space-y-3">
                <textarea
                  value={mechanismDraft}
                  onChange={event => setMechanismDraft(event.target.value)}
                  placeholder="Describe the concerted mechanism: arrow from π bond to electrophilic O, peracid O–O cleavage, proton transfer..."
                  className="min-h-[160px] w-full rounded-lg border border-slate-200/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
                >
                  <Check className="h-4 w-4" />
                  Submit mechanism for tutor review
                </button>
                {experiment.submittedMechanism && (
                  <p className="text-[11px] text-slate-400">
                    Previous submission stored · edit to update.
                  </p>
                )}
              </form>
            </section>

            <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5 text-xs text-slate-300">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-200">
                <AlertTriangle className="h-4 w-4" />
                Risk assessment cues
              </h2>
              <ul className="mt-3 space-y-2">
                <li>Run DSC or ARC screens for exotherm if scale ≥ 0.1 mol. Document heat removal capacity.</li>
                <li>m-CPBA safety: track cumulative peracid inventory, ensure buffers and quench tanks labelled.</li>
                <li>Engineering route: design interlocks on pumps to prevent peracid starvation (avoid hot spots).</li>
              </ul>
              <button
                type="button"
                onClick={() => handlePreset('experiment')}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200/20 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-slate-300/40"
              >
                <ShieldCheck className="h-3 w-3" />
                Apply oxygenation preset
              </button>
            </section>

            {experiment.submittedMechanism && (
              <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5 text-xs text-slate-300">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-200">
                  <Sparkles className="h-4 w-4" />
                  Latest submission snapshot
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-slate-200">{experiment.submittedMechanism}</p>
                <p className="mt-3 text-[11px] text-slate-400">
                  Mentor tip: replicate this arrow pushing on the reaction canvas or ChemDoodle sketcher for peer review.
                </p>
              </section>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
};

type SafetyPanelProps = {
  readiness: number;
  readinessColour: string;
  experiment: EpoxidationContextValue['state']['experiment'];
  toggleSafetyChecklist: (flag: (typeof SAFETY_FLAGS)[number]) => void;
};

const SafetyPanel: React.FC<SafetyPanelProps> = ({ readiness, readinessColour, experiment, toggleSafetyChecklist }) => (
  <section className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5">
    <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-300" />
        Safety &amp; compliance checklist
      </div>
      <div className={`text-xs ${readinessColour}`}>Readiness score: {readiness}</div>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {SAFETY_FLAGS.map(flag => {
        const checked = experiment.safetyChecklist[flag];
        return (
          <button
            key={flag}
            type="button"
            onClick={() => toggleSafetyChecklist(flag)}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              checked
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-200/10 bg-slate-900/50 text-slate-300 hover:border-slate-300/30'
            }`}
          >
            <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-current">
              {checked ? <Check className="h-3 w-3" /> : <Eraser className="h-3 w-3 opacity-60" />}
            </span>
            <span className="capitalize">{flag.replace(/([A-Z])/g, ' $1')}</span>
          </button>
        );
      })}
    </div>
  </section>
);

export default ExperimentSection;
