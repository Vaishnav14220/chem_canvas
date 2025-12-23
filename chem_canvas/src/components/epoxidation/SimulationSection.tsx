import React, { useEffect, useMemo } from 'react';
import { Gauge, Play, Pause, Atom, Activity, Thermometer, Droplets, FlaskConical, GraduationCap, Radar } from 'lucide-react';
import ReactMolReactionViewer from '../ReactMolReactionViewer';
import { useEpoxidation, type ReactionConditions } from './context';

const reactionSmilesBySubstrate: Record<string, string> = {
  'trans-stilbene': 'C1=CC=CC=C1/C=C/C2=CC=CC=C2.OOC(=O)C3=CC=CC=C3>C1=CC=CC=C1/C(OO)/C2=CC=CC=C2>C1OC(c2ccccc2)c3ccccc3O1',
  'cis-2-butene': 'C/C=C\\C.OOC(=O)C1=CC=CC=C1>C/C(OO)/C>C1CO1',
  'allylic alcohol': 'C=CCCO.OOC(=O)C1=CC=CC=C1>C=CCCOO>C1COC1CO',
  'cyclooctene (cis)': 'C1CCC=CCCC1.OOC(=O)C2=CC=CC=C2>C1CCC2OOC2C=CCC1>C1OC2CCCCCC2O1',
  'electron-poor α,β-unsaturated ester': 'CC(=O)OC=CC(=O)OCH3.OOC(=O)C1=CC=CC=C1>CC(=O)OC(OO)C(=O)OCH3>CC(=O)O[C@@H]1COC1C(=O)OCH3'
};

const SimulationSection: React.FC = () => {
  const { state, updateSimulation, updateReactionConditions, markSectionComplete } = useEpoxidation();
  const { simulation, reactionConditions, selectedAlkene } = state;

  const reactionSmiles = useMemo(
    () => reactionSmilesBySubstrate[selectedAlkene] ?? reactionSmilesBySubstrate['trans-stilbene'],
    [selectedAlkene]
  );

  useEffect(() => {
    if (!simulation.isRunning) {
      return undefined;
    }

    if (simulation.progress >= 100) {
      updateSimulation({ isRunning: false }, {
        log: 'Simulation wrapped: epoxide prediction stabilised at 100% conversion.',
        section: 'simulation'
      });
      markSectionComplete('simulation', 'Simulation completed with predicted epoxide yield plateau.');
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const increment = simulation.peracidStrength === 'strong' ? 18 : simulation.peracidStrength === 'moderate' ? 12 : 8;
      const temperatureBoost = Math.max(0, (simulation.temperatureC - 5) / 5) * 3;
      const nextProgress = Math.min(100, simulation.progress + increment + temperatureBoost);
      const insight =
        nextProgress >= 100
          ? 'Transition state collapsed → epoxide formed with full stereoretention.'
          : nextProgress >= 60
            ? 'Orbital overlap maximised; peroxide O–O bond elongates as π electrons flow.'
            : 'Initiating peroxide approach; solvent polarity stabilises the charge-separated transition state.';

      updateSimulation({
        progress: nextProgress,
        latestInsight: insight
      });

      if (nextProgress >= 100) {
        updateSimulation({ isRunning: false }, {
          log: 'Simulation completed: flux analysis predicts 94% isolated epoxide.',
          section: 'simulation'
        });
        markSectionComplete('simulation', 'Simulation reached completion with actionable insights.');
      }
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [simulation, updateSimulation, markSectionComplete]);

  const estimatedBarrier = useMemo(() => {
    const strengthAdjustment = simulation.peracidStrength === 'strong' ? 3 : simulation.peracidStrength === 'weak' ? -1 : 0;
    const polarityAdjustment = (1 - simulation.solventPolarity) * 4;
    return (21 - strengthAdjustment + polarityAdjustment).toFixed(1);
  }, [simulation.peracidStrength, simulation.solventPolarity]);

  const handleStart = () => {
    if (simulation.isRunning) {
      return;
    }
    const resetProgress = simulation.progress >= 100 ? 0 : simulation.progress;
    updateSimulation(
      {
        isRunning: true,
        progress: resetProgress,
        latestInsight: 'Initialising epoxidation trajectory with constrained peracid approach.'
      },
      {
        log: `Simulation launched for ${selectedAlkene} at ${reactionConditions.temperatureC} °C.`,
        section: 'simulation'
      }
    );
  };

  const handlePause = () => {
    if (!simulation.isRunning) {
      return;
    }
    updateSimulation({ isRunning: false }, { log: 'Simulation paused for manual inspection.', section: 'simulation' });
  };

  const handleTemperatureChange = (value: number) => {
    updateSimulation({ temperatureC: value }, { log: `Temperature toggled to ${value} °C.`, section: 'simulation' });
    updateReactionConditions({ temperatureC: value });
  };

  const handlePolarityChange = (value: number) => {
    const normalized = Math.round(value) / 100;
    updateSimulation(
      { solventPolarity: normalized },
      { log: `Dielectric constant proxy set to ${normalized.toFixed(2)}.`, section: 'simulation' }
    );
  };

  const handlePeracidChange = (strength: 'weak' | 'moderate' | 'strong') => {
    updateSimulation({ peracidStrength: strength }, { log: `Peracid strength dialed to ${strength}.`, section: 'simulation' });
    const oxidant: ReactionConditions['oxidant'] =
      strength === 'strong' ? 'DMDO' : strength === 'moderate' ? 'm-CPBA' : 'peracetic acid';
    updateReactionConditions({ oxidant });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/20 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/30">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-emerald-100">Orbital Simulation Lab</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Follow the concerted epoxidation trajectory with tunable substrate, solvent polarity, and peracid strength. Graduate learners can
              relate progression to calculated ΔG‡, while engineers can map conversion to residence time in flow reactors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
            >
              <Play className="h-4 w-4" />
              Run simulation
            </button>
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center gap-2 rounded-full bg-slate-700/30 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600/40"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[3fr,2fr]">
          <div className="rounded-xl border border-slate-200/10 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <Atom className="h-4 w-4" />
              React Mol stereochemical visualisation
            </div>
            <div className="mt-4">
              <ReactMolReactionViewer reactionSmiles={reactionSmiles} resolution={null} />
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Visual: rough molecular fragments constructed from the reaction SMILES. Encourage learners to rotate models and inspect which face of the
              alkene is attacked—syncing with the stereochemical directives from the theory track.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                <Gauge className="h-4 w-4" />
                Simulation progress
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-800/60">
                <div
                  className="h-full rounded-full bg-emerald-500/80 transition-all"
                  style={{ width: `${simulation.progress}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                <span>{simulation.progress.toFixed(0)}% conversion predicted</span>
                <span>{simulation.latestInsight ?? 'Awaiting run...'}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4 space-y-4">
              <ControlRow
                icon={<Thermometer className="h-4 w-4 text-amber-300" />}
                title="Temperature control"
                detail={`${simulation.temperatureC} °C · mirrored in experiment setup.`}
              >
                <input
                  type="range"
                  min={-20}
                  max={40}
                  step={5}
                  value={simulation.temperatureC}
                  onChange={event => handleTemperatureChange(Number(event.target.value))}
                  className="w-full"
                />
              </ControlRow>

              <ControlRow
                icon={<Droplets className="h-4 w-4 text-sky-300" />}
                title="Solvent polarity (dielectric proxy)"
                detail={`εr ≈ ${(simulation.solventPolarity * 40).toFixed(1)}`}
              >
                <input
                  type="range"
                  min={30}
                  max={95}
                  value={Math.round(simulation.solventPolarity * 100)}
                  onChange={event => handlePolarityChange(Number(event.target.value))}
                  className="w-full"
                />
              </ControlRow>

              <ControlRow
                icon={<FlaskConical className="h-4 w-4 text-rose-300" />}
                title="Peracid strength"
                detail={`Current oxidant: ${reactionConditions.oxidant}`}
              >
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(['weak', 'moderate', 'strong'] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => handlePeracidChange(level)}
                      className={`rounded-md border px-2 py-1 capitalize transition-colors ${
                        simulation.peracidStrength === level
                          ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                          : 'border-slate-200/10 bg-slate-900/40 text-slate-200 hover:border-slate-300/30'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </ControlRow>
            </div>

            <div className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
                <Activity className="h-4 w-4" />
                Real-time kinetic briefing
              </div>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                <li>Residence time heuristic: {(2 + simulation.progress / 20).toFixed(1)} min for 90% conversion in flow.</li>
                <li>Estimated ΔG‡: {estimatedBarrier} kcal·mol⁻¹ (qualitative).</li>
                <li>Safety note: maintain {reactionConditions.temperatureC <= 5 ? 'ice bath' : 'active cooling'} when peracid strength ≥ moderate.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/20 bg-slate-900/50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-sky-100">
          <GraduationCap className="h-5 w-5 text-sky-300" />
          Mentor guidance for seminar facilitation
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <InsightCard
            title="Quantify the rate impact"
            body="Ask learners to convert the simulated conversion curve into a first-order rate constant and compare with literature values for their chosen substrate."
          />
          <InsightCard
            title="Orbital annotation"
            body="Prompt students to screenshot the React Mol view, annotate the interacting orbitals, and upload to the experiment tab for peer review."
          />
          <InsightCard
            title="Process engineering reflection"
            body="Engineering track: tune the polarity slider and temperature to achieve 85% conversion under 3 min. Discuss equipment needed to maintain those settings safely."
          />
        </div>
      </section>
    </div>
  );
};

type ControlRowProps = {
  icon: React.ReactNode;
  title: string;
  detail: string;
  children: React.ReactNode;
};

const ControlRow: React.FC<ControlRowProps> = ({ icon, title, detail, children }) => (
  <div className="space-y-3 rounded-lg border border-slate-200/10 bg-slate-900/40 p-3 text-xs text-slate-300">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/60 text-slate-200">
          {icon}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <span className="text-[11px] text-slate-400">{detail}</span>
    </div>
    {children}
  </div>
);

type InsightCardProps = {
  title: string;
  body: string;
};

const InsightCard: React.FC<InsightCardProps> = ({ title, body }) => (
  <article className="rounded-xl border border-slate-200/10 bg-slate-950/60 p-4 text-sm text-slate-200">
    <div className="flex items-center gap-2 text-slate-100">
      <Radar className="h-4 w-4 text-emerald-300" />
      <span className="font-semibold">{title}</span>
    </div>
    <p className="mt-2 text-slate-300">{body}</p>
  </article>
);

export default SimulationSection;
