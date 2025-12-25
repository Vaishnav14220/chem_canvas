import React, { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle, ArrowRight, RefreshCcw } from 'lucide-react';

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

interface QuizPanelProps {
    quiz: QuizQuestion | null;
    onComplete: (success: boolean) => void;
    onGenerateNew: () => void;
}

export const QuizPanel: React.FC<QuizPanelProps> = ({ quiz, onComplete, onGenerateNew }) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    if (!quiz) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <HelpCircle className="w-12 h-12 mb-2 opacity-50" />
                <p>No active quiz.<br />Ask the tutor to 'Quiz me'!</p>
                <button
                    onClick={onGenerateNew}
                    className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                    Generate Quick Quiz
                </button>
            </div>
        );
    }

    const handleSubmit = () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);
        onComplete(selectedOption === quiz.correctIndex);
    };

    const handleRetry = () => {
        setSelectedOption(null);
        setIsSubmitted(false);
        onGenerateNew();
    };

    return (
        <div className="flex flex-col h-full max-w-md mx-auto p-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                {/* Question Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-2">Quick Check</span>
                    <h3 className="text-lg font-semibold text-slate-800 leading-snug">{quiz.question}</h3>
                </div>

                {/* Options */}
                <div className="p-6 space-y-3 flex-1">
                    {quiz.options.map((option, index) => {
                        let buttonStyle = "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50";
                        let icon = null;

                        if (selectedOption === index) {
                            buttonStyle = "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500";
                        }

                        if (isSubmitted) {
                            if (index === quiz.correctIndex) {
                                buttonStyle = "border-green-500 bg-green-50 text-green-700";
                                icon = <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />;
                            } else if (index === selectedOption && index !== quiz.correctIndex) {
                                buttonStyle = "border-red-300 bg-red-50 text-red-700";
                                icon = <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
                            } else {
                                buttonStyle = "border-slate-100 opacity-50";
                            }
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => !isSubmitted && setSelectedOption(index)}
                                disabled={isSubmitted}
                                className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center justify-between gap-3 ${buttonStyle}`}
                            >
                                <span className="text-sm font-medium">{option}</span>
                                {icon}
                            </button>
                        );
                    })}
                </div>

                {/* Feedback / Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    {!isSubmitted ? (
                        <button
                            onClick={handleSubmit}
                            disabled={selectedOption === null}
                            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Check Answer
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-lg text-sm ${selectedOption === quiz.correctIndex ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                <p className="font-bold mb-1">{selectedOption === quiz.correctIndex ? 'Correct!' : 'Not quite.'}</p>
                                <p>{quiz.explanation}</p>
                            </div>
                            <button
                                onClick={handleRetry}
                                className="w-full py-2 bg-white border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCcw className="w-4 h-4" /> Try Another
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
