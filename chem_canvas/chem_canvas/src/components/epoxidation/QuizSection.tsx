import React, { useMemo, useState } from 'react';
import { Brain, Award, RefreshCw, Shield, Radio, CheckCircle2, AlertCircle, PenTool } from 'lucide-react';
import { useEpoxidation } from './context';

type MultipleChoiceQuestion = {
  id: string;
  kind: 'single' | 'multi';
  prompt: string;
  stem?: string;
  options: string[];
  correct: number[]; // zero-indexed
  explanation: string;
};

type TextQuestion = {
  id: string;
  kind: 'text';
  prompt: string;
  expectedKeywords: string[];
  explanation: string;
};

type QuizQuestion = MultipleChoiceQuestion | TextQuestion;

const quizQuestions: QuizQuestion[] = [
  {
    id: 'orbital-focus',
    kind: 'single',
    prompt: 'Which interaction predominantly stabilises the alkene epoxidation transition state?',
    options: [
      'Donation from alkene π HOMO into peracid σ* (O–O)',
      'Back-donation from peracid lone pair into alkene π*',
      'Electrostatic attraction between peracid carbonyl and solvent'
    ],
    correct: [0],
    explanation:
      'The peracid acts as an electrophile accepting electron density from the alkene π HOMO into its σ* antibond, facilitating concerted O–O cleavage.'
  },
  {
    id: 'kinetic-design',
    kind: 'multi',
    prompt: 'Select all statements consistent with graduate-level kinetic analysis when running m-CPBA epoxidations.',
    options: [
      'Rate is first-order in alkene under typical dilute conditions.',
      'A polarity increase in solvent generally lowers the activation barrier by stabilising the polar transition state.',
      'Excess peracid always accelerates the reaction because it cannot self-decompose.',
      'Temperature elevation must consider peracid decomposition kinetics to avoid runaway.'
    ],
    correct: [0, 1, 3],
    explanation:
      'Literature reports show first-order dependence in both alkene and peracid for many systems. Polar solvents aid charge separation, while excess oxidant can raise hazard due to competing decomposition.'
  },
  {
    id: 'engineering-scenario',
    kind: 'single',
    prompt: 'You must deliver 500 g of epoxide per shift via a flow reactor. Which control action best mitigates thermal runaway risk?',
    stem: 'Assume 1.5× stoichiometric peracid feed and a 20 °C adiabatic temperature rise if cooling fails.',
    options: [
      'Implement feed-forward control tied to inline IR conversion estimates and throttle peracid when conversion exceeds 85%.',
      'Run at ambient temperature and rely solely on passive heat dissipation from tubing.',
      'Increase peracid concentration to shorten residence time and minimise heat accumulation.'
    ],
    correct: [0],
    explanation:
      'Active feedback using inline analytics allows dynamic control of oxidant dosing, preventing heat accumulation that could trigger peracid decomposition.'
  },
  {
    id: 'text-response',
    kind: 'text',
    prompt: 'In 2–3 sentences, justify why cis-alkenes retain stereochemistry after epoxidation and mention one applied context where this matters.',
    expectedKeywords: ['syn', 'concerted', 'application'],
    explanation:
      'A concerted, butterfly-like transition state delivers syn addition, locking substituents on the same face. Highlight an application such as preserving stereochemistry in glycidyl ether synthesis or chiral pharmaceutical intermediates.'
  }
];

const keywordMatches = (text: string, keywords: string[]): number => {
  const normalized = text.toLowerCase();
  return keywords.filter(keyword => normalized.includes(keyword)).length;
};

const QuizSection: React.FC = () => {
  const { state, recordQuizResults, markSectionComplete } = useEpoxidation();
  const existingResults = state.quizResults;

  const [selected, setSelected] = useState<Record<string, number[]>>(() => {
    if (!existingResults) {
      return {};
    }
    return existingResults.detail.reduce<Record<string, number[]>>((acc, detail) => {
      acc[detail.id] = detail.chosen;
      return acc;
    }, {});
  });
  const [textResponses, setTextResponses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (!existingResults) {
      return initial;
    }
    const textEntry = existingResults.detail.find(item => item.id === 'text-response' && item.response);
    if (textEntry && textEntry.response) {
      initial['text-response'] = textEntry.response;
    }
    return initial;
  });
  const [submitted, setSubmitted] = useState<boolean>(Boolean(existingResults));

  const resultsSummary = useMemo(() => {
    if (!existingResults) {
      return null;
    }
    return {
      score: `${existingResults.correct}/${existingResults.total}`,
      timestamp: existingResults.timestamp
    };
  }, [existingResults]);

  const toggleOption = (question: MultipleChoiceQuestion, optionIndex: number) => {
    setSelected(prev => {
      const next = prev[question.id] ? [...prev[question.id]] : [];
      if (question.kind === 'single') {
        return { ...prev, [question.id]: [optionIndex] };
      }
      if (next.includes(optionIndex)) {
        return { ...prev, [question.id]: next.filter(value => value !== optionIndex) };
      }
      next.push(optionIndex);
      return { ...prev, [question.id]: next };
    });
  };

  const handleTextChange = (questionId: string, value: string) => {
    setTextResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    let correct = 0;
    const detail: Array<{ id: string; prompt: string; chosen: number[]; correct: number[]; response?: string }> = [];

    quizQuestions.forEach(question => {
      if (question.kind === 'text') {
        const response = textResponses[question.id] ?? '';
        const matches = keywordMatches(response, question.expectedKeywords);
        const isCorrect = matches >= Math.max(2, question.expectedKeywords.length - 1);
        if (isCorrect) {
          correct += 1;
        }
        detail.push({ id: question.id, prompt: question.prompt, chosen: [], correct: [], response });
        return;
      }

      const chosen = selected[question.id] ?? [];
      const sortedChosen = [...chosen].sort();
      const sortedCorrect = [...question.correct].sort();
      const isCorrect = sortedChosen.length === sortedCorrect.length && sortedChosen.every((value, index) => value === sortedCorrect[index]);
      if (isCorrect) {
        correct += 1;
      }
      detail.push({ id: question.id, prompt: question.prompt, chosen: sortedChosen, correct: sortedCorrect });
    });

    const results = {
      correct,
      total: quizQuestions.length,
      timestamp: Date.now(),
      detail
    };

    recordQuizResults(results);
    markSectionComplete('quiz', `Quiz completed with ${correct}/${quizQuestions.length} correct.`);
    setSubmitted(true);
  };

  const handleRetake = () => {
    setSelected({});
    setTextResponses({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/20 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/30">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-sky-100">Graduate Challenge · Epoxidation Mastery Quiz</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Blend mechanistic insight, kinetic reasoning, and process safety judgement. Some prompts expect multiple correct choices—highlighted in
              the instructions beneath each question.
            </p>
          </div>
          {submitted && resultsSummary && (
            <div className="flex items-center gap-3 rounded-full border border-slate-200/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100">
              <Award className="h-5 w-5 text-amber-300" />
              Score: {resultsSummary.score}
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {quizQuestions.map(question => (
            <QuestionCard
              key={question.id}
              question={question}
              selected={selected[question.id] ?? []}
              response={textResponses[question.id] ?? ''}
              submitted={submitted}
              toggleOption={toggleOption}
              onTextChange={handleTextChange}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/10 pt-4">
            {!submitted ? (
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
              >
                <Brain className="h-4 w-4" />
                Submit answers
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/20 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-300/40"
              >
                <RefreshCw className="h-4 w-4" />
                Retake quiz
              </button>
            )}
            <span className="text-xs text-slate-400">
              Questions emphasise syn stereochemistry, kinetic levers, and pilot-plant safety.
            </span>
          </div>
        </form>
      </section>
    </div>
  );
};

type QuestionCardProps = {
  question: QuizQuestion;
  selected: number[];
  response: string;
  submitted: boolean;
  toggleOption: (question: MultipleChoiceQuestion, optionIndex: number) => void;
  onTextChange: (questionId: string, value: string) => void;
};

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selected,
  response,
  submitted,
  toggleOption,
  onTextChange
}) => {
  const isMulti = question.kind === 'multi';
  const isText = question.kind === 'text';

  return (
    <article className="rounded-xl border border-slate-200/10 bg-slate-950/70 p-5 text-sm text-slate-200">
      <header className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-800/70 text-slate-100">
          {question.kind === 'text' ? <PenTool className="h-4 w-4" /> : question.kind === 'multi' ? <Shield className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
        </span>
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-slate-100">{question.prompt}</p>
          {'stem' in question && question.stem && (
            <p className="text-xs text-slate-400">{question.stem}</p>
          )}
          {!isText && (
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              {isMulti ? 'Select all that apply' : 'Select one option'}
            </p>
          )}
        </div>
      </header>

      {!isText ? (
        <ul className="mt-4 space-y-3 text-sm">
          {question.options.map((option, index) => {
            const active = selected.includes(index);
            const wasCorrect = submitted && question.correct.includes(index);
            const wasIncorrect = submitted && active && !question.correct.includes(index);
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => toggleOption(question as MultipleChoiceQuestion, index)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    wasCorrect
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                      : wasIncorrect
                        ? 'border-rose-400/40 bg-rose-500/15 text-rose-100'
                        : active
                          ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                          : 'border-slate-200/10 bg-slate-900/50 text-slate-200 hover:border-slate-300/30'
                  }`}
                  disabled={submitted}
                >
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-current">
                    {active ? <CheckCircle2 className="h-3 w-3" /> : null}
                  </span>
                  <span>{option}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4">
          <textarea
            value={response}
            onChange={event => onTextChange(question.id, event.target.value)}
            disabled={submitted}
            placeholder="Explain the syn addition and cite an application (e.g., epoxy resin design, API intermediate)."
            className="min-h-[140px] w-full rounded-lg border border-slate-200/20 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
          />
        </div>
      )}

      {submitted && (
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-300">
          <AlertCircle className="h-4 w-4 text-amber-300" />
          {question.explanation}
        </p>
      )}
    </article>
  );
};

export default QuizSection;
