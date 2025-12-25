import React, { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { FillBlankQuestion } from '../types/tutorTypes';

interface FillBlankActivityProps {
    activity: FillBlankQuestion;
    onComplete: (success: boolean) => void;
}

export const FillBlankActivity: React.FC<FillBlankActivityProps> = ({ activity, onComplete }) => {
    const [userAnswers, setUserAnswers] = useState<string[]>(activity.blanks.map(() => ''));
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    // Split sentence by _____ to create parts
    const parts = activity.sentence.split('_____');

    const handleSubmit = () => {
        const correct = userAnswers.every((answer, idx) =>
            answer.toLowerCase().trim() === activity.blanks[idx].toLowerCase().trim()
        );
        setIsCorrect(correct);
        setIsSubmitted(true);
        onComplete(correct);
    };

    return (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Fill in the Blank</span>
            </div>

            <div className="text-lg text-slate-700 leading-relaxed flex flex-wrap items-center gap-1">
                {parts.map((part, idx) => (
                    <React.Fragment key={idx}>
                        <span>{part}</span>
                        {idx < parts.length - 1 && (
                            <input
                                type="text"
                                value={userAnswers[idx]}
                                onChange={(e) => {
                                    const newAnswers = [...userAnswers];
                                    newAnswers[idx] = e.target.value;
                                    setUserAnswers(newAnswers);
                                }}
                                disabled={isSubmitted}
                                className={`inline-block w-32 px-2 py-1 mx-1 border-b-2 text-center font-medium focus:outline-none transition-colors ${isSubmitted
                                        ? isCorrect
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-red-400 bg-red-50 text-red-700'
                                        : 'border-amber-400 bg-amber-50 focus:border-amber-600'
                                    }`}
                                placeholder="..."
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {activity.hint && !isSubmitted && (
                <p className="mt-3 text-xs text-slate-400 italic">💡 Hint: {activity.hint}</p>
            )}

            {isSubmitted && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <span className="font-medium">{isCorrect ? 'Correct!' : `The answer is: ${activity.blanks.join(', ')}`}</span>
                </div>
            )}

            {!isSubmitted && (
                <button
                    onClick={handleSubmit}
                    disabled={userAnswers.some(a => !a.trim())}
                    className="mt-4 w-full py-2.5 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Check Answer
                </button>
            )}
        </div>
    );
};
