/**
 * Create Case Button Component
 * 
 * Allows users to create a public donation case after completing their escape plan
 */

import React, { useState } from 'react';
import { useCustodialWallet } from '../lib/useCustodialWallet';
import { Heart, Loader2, X, Users } from 'lucide-react';

interface CreateCaseButtonProps {
    escapePlan?: {
        freedomGoal?: {
            targetAmount: number;
        };
        riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };
}

export const CreateCaseButton: React.FC<CreateCaseButtonProps> = ({ escapePlan }) => {
    const { createCase, caseInfo, loading } = useCustodialWallet();

    const [showModal, setShowModal] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [story, setStory] = useState('');
    const [isPublic, setIsPublic] = useState(true);

    const handleCreateCase = async () => {
        if (!displayName.trim() || !story.trim()) {
            alert('Please fill in all fields');
            return;
        }

        const caseId = await createCase({
            displayName: displayName.trim(),
            story: story.trim(),
            goalAmount: escapePlan?.freedomGoal?.targetAmount || 500,
            urgencyLevel: escapePlan?.riskLevel || 'MEDIUM',
            isPublic
        });

        if (caseId) {
            alert(`✅ Case created successfully! ID: ${caseId}`);
            setShowModal(false);
            setDisplayName('');
            setStory('');
        }
    };

    // If case already exists, show status
    if (caseInfo) {
        return (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-white font-semibold">Angels Pool Active</p>
                        <p className="text-xs text-purple-400">{caseInfo.displayName}</p>
                    </div>
                </div>
                <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-purple-400 font-semibold">{caseInfo.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(caseInfo.progress, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-2">
                        <span className="text-xs text-gray-400">${caseInfo.currentAmount.toFixed(2)}</span>
                        <span className="text-xs text-gray-400">${caseInfo.goalAmount.toFixed(2)}</span>
                    </div>
                </div>
                <button
                    onClick={() => {
                        const url = `${window.location.origin}/donate`;
                        navigator.clipboard.writeText(url);
                        alert('Donation link copied to clipboard!');
                    }}
                    className="w-full mt-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition"
                >
                    Share Donation Link
                </button>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-lg"
            >
                <Users className="w-5 h-5" />
                Create Angels Pool
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 rounded-3xl p-6 w-full max-w-md border border-neutral-700 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Heart className="w-5 h-5 text-purple-500" />
                                Create Angels Pool
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-white"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-sm">
                                <p className="text-purple-400 font-medium mb-1">💜 What is this?</p>
                                <p className="text-gray-400 text-xs">
                                    Create a public donation pool where anonymous "Angels" can contribute to your freedom goal.
                                    Your identity remains protected.
                                </p>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 block mb-2">Display Name (Public)</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="e.g., María, Case #123"
                                    className="w-full bg-black border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 block mb-2">Your Story (Brief, Anonymized)</label>
                                <textarea
                                    value={story}
                                    onChange={e => setStory(e.target.value)}
                                    placeholder="e.g., Mother of 2 seeking to escape domestic violence..."
                                    rows={4}
                                    className="w-full bg-black border border-neutral-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 outline-none resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-neutral-800 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="isPublic"
                                    checked={isPublic}
                                    onChange={e => setIsPublic(e.target.checked)}
                                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                                />
                                <label htmlFor="isPublic" className="text-sm text-gray-300">
                                    Make this case public (visible on /donate page)
                                </label>
                            </div>

                            <div className="bg-neutral-800 rounded-xl p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Goal Amount</p>
                                <p className="text-2xl font-bold text-white">
                                    ${escapePlan?.freedomGoal?.targetAmount || 500}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">From your escape plan</p>
                            </div>

                            <button
                                onClick={handleCreateCase}
                                disabled={loading || !displayName.trim() || !story.trim()}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Heart className="w-5 h-5" />
                                        Create Pool
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CreateCaseButton;
