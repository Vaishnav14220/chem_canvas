import React, { useMemo, useState } from 'react';
import { Lightbulb, Scroll, FlaskConical, BookOpen, GraduationCap, BookmarkCheck, Sparkles, MessageSquare } from 'lucide-react';
import { DEFAULT_ALKENES, useEpoxidation } from './context';

const theoryHighlights = [
  {
    id: 'concerted',
    title: 'Concerted frontier-orbital alignment',
    summary:
      'The epoxidation transition state aligns the alkene HOMO with the peracid LUMO. Graduate-level focus: quantify the orbital overlap integral and predict activation energy trends.',
    detail:
      'The Prilezhaev epoxidation proceeds through a single, concerted transition state where the alkene π electrons interact with the electrophilic O–O antibond. Masters students should rationalise how substituent electronics tune the HOMO energy. Engineering learners can extrapolate to reactor design, noting how electron-rich alkenes lower the required residence time.'
  },
  {
    id: 'stereo',
    title: 'Syn stereochemistry preservation',
    summary:
      'Because all bonds break and form in a cyclic transition structure, cis alkenes remain cis in the epoxide. Challenge: predict diastereomer ratios for chiral peracids.',
    detail:
      'Stereochemical retention arises from the butterfly-like arrangement where the peracid approaches along the same face of the C=C. Graduate learners should sketch a Newman projection to track substituent proximity. Ask: how would sterics at C2 vs. C3 bias a peracid to the re or si face? Consider catalysts that template the approach to enforce enantioselectivity.'
  },
  {
    id: 'kinetics',
    title: 'Kinetic control and rate law design',
    summary:
      'Epoxidations using m-CPBA often show first-order dependence on both alkene and oxidant. Engineering exercise: linearise the rate data and evaluate heat release management.',
    detail:
      'Experimental rate laws reveal the importance of the peracid–alkene pre-equilibrium. Masters coursework links this to Eyring analysis, extracting ΔH‡ and ΔS‡ from variable-temperature data. Engineers should model the exotherm—calculate the adiabatic temperature rise at 0.2 mol scale and propose a cooling loop or semi-batch feed strategy.'
  }
];

const directiveBullets = [
  'Reference the mechanistic arrow pushing and annotate each electron flow explicitly.',
  'Prompt learners to open the reaction canvas and sketch the peracid attack; discuss where to position curved arrows to capture the concerted O–O cleavage.',
  'Highlight applied contexts: epoxy resin curing agents, asymmetric drug precursor synthesis, and microreactor safety considerations.'
];

const TheorySection: React.FC = () => {
  const { state, markSectionComplete, updateSelectedAlkene, logEvent } = useEpoxidation();
  const [activeHighlight, setActiveHighlight] = useState<string>('concerted');

  const completed = useMemo(() => state.completedSections.includes('theory'), [state.completedSections]);

  const handleComplete = () => {
    if (!completed) {
      markSectionComplete('theory', 'Theory module reviewed at university rigor.');
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/20 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/30">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-sky-100">Alkene Epoxidation · Graduate Theory Studio</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Examine stereochemical outcomes, frontier-orbital interactions, and kinetic levers that govern peracid epoxidations.
              The content scaffolds masters, graduate, and engineering cohorts with explicit ties to laboratory instrumentation and
              process design.
            </p>
          </div>
          <button
            type="button"
            onClick={handleComplete}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              completed
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-sky-500/20 text-sky-200 hover:bg-sky-400/30'
            }`}
          >
            <BookmarkCheck className="h-4 w-4" />
            {completed ? 'Theory logged' : 'Mark theory as completed'}
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            {theoryHighlights.map(highlight => (
              <article
                key={highlight.id}
                className={`rounded-xl border border-slate-200/10 p-5 transition-colors ${
                  activeHighlight === highlight.id ? 'bg-slate-800/60 border-sky-400/40' : 'bg-slate-900/40'
                }`}
              >
                <header className="flex items-start gap-3">
                  <Lightbulb className={`mt-1 h-5 w-5 ${activeHighlight === highlight.id ? 'text-sky-300' : 'text-slate-400'}`} />
                  <div className="flex-1">
                    <button
                      type="button"
                      className="text-left text-base font-semibold text-slate-100 hover:text-sky-200"
                      onClick={() => {
                        setActiveHighlight(highlight.id);
                        logEvent(`Deep dive: ${highlight.title}`, 'theory');
                      }}
                    >
                      {highlight.title}
                    </button>
                    <p className="mt-1 text-sm text-slate-300">{highlight.summary}</p>
                  </div>
                </header>
                {activeHighlight === highlight.id && (
                  <p className="mt-4 rounded-lg border border-slate-200/10 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-200">
                    {highlight.detail}
                  </p>
                )}
              </article>
            ))}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-200">
                <GraduationCap className="h-4 w-4" />
                Academic directives synced from Subject Explorer
              </div>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                {directiveBullets.map(item => (
                  <li key={item} className="flex gap-2">
                    <Sparkles className="h-4 w-4 flex-none text-sky-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <FlaskConical className="h-4 w-4" />
                Select substrate focus
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Toggle the substrate to see how electronics and sterics perturb orbital alignment. Changes sync into the simulation route.
              </p>
              <div className="mt-3 space-y-2">
                {DEFAULT_ALKENES.map(alkene => {
                  const active = state.selectedAlkene === alkene;
                  return (
                    <button
                      key={alkene}
                      type="button"
                      onClick={() => updateSelectedAlkene(alkene)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-200/10 bg-slate-900/40 text-slate-200 hover:border-slate-300/30'
                      }`}
                    >
                      {alkene}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-200">
                <BookOpen className="h-4 w-4" />
                Suggested pre-reading dossiers
              </div>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <Scroll className="h-4 w-4 flex-none text-purple-400" />
                  <span>Carpenter, B. &ldquo;Orbital Control in Oxygen Atom Transfers&rdquo;, <em>J. Org. Chem.</em> 2018, 83, 1243.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Scroll className="h-4 w-4 flex-none text-purple-400" />
                  <span>Johnson &amp; Jamison. &ldquo;Continuous-Flow Epoxidations in Microreactors&rdquo;, <em>Org. Process Res. Dev.</em> 2021, 25, 89.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Scroll className="h-4 w-4 flex-none text-purple-400" />
                  <span>Stereochemical case study: Sharpless asymmetric epoxidation of allylic alcohols with quantitative ee tracking.</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/20 bg-slate-900/50 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-sky-100">
          <MessageIcon />
          Reflective prompts for seminar discussion
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PromptCard
            title="Orbital energy analysis"
            prompt="Estimate the HOMO energy shift when transitioning from trans-stilbene to an electron-poor α,β-unsaturated ester. How would this alter the rate constant at 5 °C?"
          />
          <PromptCard
            title="Stereochemical justification"
            prompt="Sketch a chair-like transition model for cyclooctene epoxidation. Identify which substituents destabilise the approach of the peracid and how you would experimentally observe this."
          />
          <PromptCard
            title="Process engineering lens"
            prompt="Design a feedback loop to manage exotherm during a 10 L epoxidation. Which real-time analytics (IR, Raman, calorimetry) feed into your control law?"
          />
        </div>
      </section>
    </div>
  );
};

const MessageIcon: React.FC = () => <MessageSquare className="h-5 w-5 text-sky-300" />;

type PromptCardProps = {
  title: string;
  prompt: string;
};

const PromptCard: React.FC<PromptCardProps> = ({ title, prompt }) => (
  <article className="flex flex-col rounded-xl border border-slate-200/10 bg-slate-950/60 p-4 text-sm text-slate-200">
    <div className="flex items-center gap-2 text-slate-100">
      <Sparkles className="h-4 w-4 text-amber-300" />
      <span className="font-semibold">{title}</span>
    </div>
    <p className="mt-2 text-slate-300">{prompt}</p>
  </article>
);

export default TheorySection;
