import React, { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, Shuffle, Link } from 'lucide-react';
import { MatchingActivity as MatchingActivityType, MatchingPair } from '../types/tutorTypes';

interface MatchingActivityProps {
    activity: MatchingActivityType;
    onComplete: (success: boolean) => void;
}

export const MatchingActivity: React.FC<MatchingActivityProps> = ({ activity, onComplete }) => {
    const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
    const [matches, setMatches] = useState<Record<string, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<Record<string, boolean>>({});

    // Shuffle the right side for the exercise
    const shuffledRight = useMemo(() => {
        return [...activity.pairs].sort(() => Math.random() - 0.5).map(p => p.right);
    }, [activity.pairs]);

    const handleLeftClick = (id: string) => {
        if (isSubmitted || matches[id]) return;
        setSelectedLeft(id);
    };

    const handleRightClick = (right: string) => {
        if (isSubmitted || !selectedLeft || Object.values(matches).includes(right)) return;
        setMatches(prev => ({ ...prev, [selectedLeft]: right }));
        setSelectedLeft(null);
    };

    const handleSubmit = () => {
        const newResults: Record<string, boolean> = {};
        let allCorrect = true;

        activity.pairs.forEach(pair => {
            const isCorrect = matches[pair.id] === pair.right;
            newResults[pair.id] = isCorrect;
            if (!isCorrect) allCorrect = false;
        });

        setResults(newResults);
        setIsSubmitted(true);
        onComplete(allCorrect);
    };

    const allMatched = Object.keys(matches).length === activity.pairs.length;

    return (
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Link className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">{activity.title || 'Match the Following'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-2">
                    {activity.pairs.map((pair) => (
                        <button
                            key={pair.id}
                            onClick={() => handleLeftClick(pair.id)}
                            disabled={isSubmitted || !!matches[pair.id]}
                            className={`w-full p-3 rounded-lg border-2 text-left text-sm font-medium transition-all ${selectedLeft === pair.id
                                    ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500'
                                    : matches[pair.id]
                                        ? isSubmitted
                                            ? results[pair.id]
                                                ? 'border-green-400 bg-green-50 text-green-700'
                                                : 'border-red-400 bg-red-50 text-red-700'
                                            : 'border-purple-300 bg-purple-50 text-purple-700'
                                        : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                                }`}
                        >
                            {pair.left}
                            {matches[pair.id] && (
                                <span className="ml-2 text-xs opacity-60">→ {matches[pair.id]}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                    {shuffledRight.map((right, idx) => {
                        const isUsed = Object.values(matches).includes(right);
                        return (
                            <button
                                key={idx}
                                onClick={() => handleRightClick(right)}
                                disabled={isSubmitted || isUsed || !selectedLeft}
                                className={`w-full p-3 rounded-lg border-2 text-left text-sm font-medium transition-all ${isUsed
                                        ? 'border-slate-200 bg-slate-50 text-slate-400 opacity-50'
                                        : selectedLeft
                                            ? 'border-purple-300 bg-purple-50 hover:border-purple-500 cursor-pointer'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                            >
                                {right}
                            </button>
                        );
                    })}
                </div>
            </div>

            {isSubmitted && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${Object.values(results).every(r => r) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                    {Object.values(results).every(r => r)
                        ? <><CheckCircle2 className="w-5 h-5" /> <span className="font-medium">All matched correctly!</span></>
                        : <><XCircle className="w-5 h-5" /> <span className="font-medium">Some matches are incorrect. Review the highlighted items.</span></>
                    }
                </div>
            )}

            {!isSubmitted && (
                <button
                    onClick={handleSubmit}
                    disabled={!allMatched}
                    className="mt-4 w-full py-2.5 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Check Matches
                </button>
            )}
        </div>
    );
};
