import React, { useState } from 'react';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import SimpleRichTextEditor from './SimpleRichTextEditor';

interface PublicSpellCheckPageProps {
    onClose: () => void;
}

const PublicSpellCheckPage: React.FC<PublicSpellCheckPageProps> = ({ onClose }) => {
    const [text, setText] = useState('');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50 flex flex-col p-4 md:p-8 font-sans">
            {/* Header / Navigation */}
            <div className="max-w-5xl mx-auto w-full flex items-center justify-between mb-6 flex-shrink-0">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm transition-all cursor-pointer font-bold text-xs active:scale-95"
                >
                    <ArrowLeft size={16} />
                    <span>பின்செல் (Back to Login)</span>
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <h1 className="text-lg font-black text-slate-800">
                        AI தமிழ் பிழை திருத்தி (Spell Check)
                    </h1>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-5xl mx-auto w-full flex-grow flex flex-col justify-center items-stretch gap-6">
                {/* Info Card */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 flex items-start gap-4 shadow-xl shadow-indigo-100/10">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 flex-shrink-0">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900">Tamil Proofreading & Sentence Improvement</h3>
                        <p className="text-xs text-slate-500 font-bold mt-1 leading-relaxed">
                            கீழே உள்ள எடிட்டரில் உங்கள் தமிழ் உரையை உள்ளிட்டு, டூல்பாரில் உள்ள <strong className="text-violet-600 font-black">AI பிழை திருத்து</strong> பொத்தானைப் பயன்படுத்தி எழுத்துப் பிழைகளையும், <strong className="text-indigo-600 font-black">AI வாக்கிய மேம்பாடு</strong> பொத்தானைப் பயன்படுத்தி உரை அமைப்பையும் மேம்படுத்தலாம்.
                        </p>
                    </div>
                </div>

                {/* Editor Container Card */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 md:p-8 flex-grow flex flex-col gap-4 relative overflow-hidden min-h-[450px]">
                    <div className="flex-grow flex flex-col justify-stretch">
                        <SimpleRichTextEditor
                            value={text}
                            onChange={setText}
                            placeholder="சரிபார்க்க வேண்டிய தமிழ் உரையை இங்கே எழுதவும் அல்லது நகலெடுத்து ஒட்டவும் (Type or paste Tamil text here to proofread)..."
                        />
                    </div>
                </div>
            </div>
            
            {/* Footer */}
            <div className="text-center text-[10px] font-bold text-slate-400 mt-6 flex-shrink-0">
                &copy; 2026 Blueprint Generator. Powered by local Ollama AI Engine.
            </div>
        </div>
    );
};

export default PublicSpellCheckPage;
