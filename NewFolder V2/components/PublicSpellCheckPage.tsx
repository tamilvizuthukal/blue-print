import React, { useState } from 'react';
import { ChevronLeft, Sun, Moon, Sparkles, Loader2, AlertCircle, HelpCircle, CheckCircle } from 'lucide-react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import { checkConceptualAndSentenceImprovements, ConceptualSuggestion } from '../services/db';

interface PublicSpellCheckPageProps {
    onClose: () => void;
}

const PublicSpellCheckPage: React.FC<PublicSpellCheckPageProps> = ({ onClose }) => {
    const [text, setText] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<ConceptualSuggestion[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    const handleBack = (e: React.SyntheticEvent) => {
        e.preventDefault();
        onClose();
    };

    const handleAIAnalysis = async () => {
        const cleanText = text.replace(/<[^>]*>/g, '').trim(); // Strip HTML tags
        if (!cleanText) {
            setError('தயவுசெய்து பகுப்பாய்வு செய்ய சில உரைகளை உள்ளிடவும்.');
            setSuggestions([]);
            setHasAnalyzed(true);
            return;
        }

        setLoading(true);
        setError(null);
        setSuggestions([]);
        try {
            const response = await checkConceptualAndSentenceImprovements(cleanText);
            if (response && response.suggestions) {
                setSuggestions(response.suggestions);
            } else {
                setSuggestions([]);
            }
            setHasAnalyzed(true);
        } catch (err: any) {
            console.error('Conceptual check error:', err);
            setError(err.message || 'பகுப்பாய்வு செய்வதில் சிக்கல் ஏற்பட்டது. லோக்கல் மாடல் இயங்குகிறதா என சரிபார்க்கவும்.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`h-screen max-h-screen flex flex-col font-sans antialiased overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
            {/* iOS Style Sticky Headerbar */}
            <header className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-sm px-4 py-3 flex items-center justify-between shrink-0 transition-colors duration-200 ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200/80'}`}>
                <button
                    type="button"
                    onClick={handleBack}
                    onTouchEnd={handleBack}
                    className="flex items-center gap-0.5 text-blue-500 hover:text-blue-400 font-semibold text-base active:opacity-60 transition-opacity cursor-pointer touch-manipulation select-none -ml-1"
                    aria-label="Back to Login"
                >
                    <ChevronLeft size={24} strokeWidth={2.5} />
                    <span>Back to Login</span>
                </button>

                <h1 className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Spell Check & AI Analysis
                </h1>

                {/* Right side Theme Switcher */}
                <button
                    type="button"
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-full transition-all cursor-pointer active:scale-90 flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    aria-label="Toggle theme"
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </header>

            {/* Main Content Area - Split Panel Layout */}
            <main className="flex-1 min-h-0 flex flex-col md:flex-row p-2 sm:p-4 md:p-6 gap-4 overflow-hidden w-full max-w-7xl mx-auto h-full">
                
                {/* Left Side: Editor */}
                <div className={`rounded-2xl border shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <SimpleRichTextEditor
                            value={text}
                            onChange={setText}
                            placeholder="வாக்கிய மேம்பாடு மற்றும் கருத்துப்பிழைகளை பகுப்பாய்வு செய்ய இங்கு தமிழ் உரையை உள்ளிடவும்..."
                            hideAIButtons={true}
                            hideFormatButton={true}
                            isDarkMode={isDarkMode}
                            showAIAnalysisButton={true}
                            onAIAnalysis={handleAIAnalysis}
                        />
                    </div>
                </div>

                {/* Right Side: Suggestions / Recommendations Panel */}
                <div className={`rounded-2xl border shadow-sm w-full md:w-[420px] flex flex-col overflow-hidden transition-colors duration-200 shrink-0 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
                }`}>
                    {/* Panel Header */}
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${
                        isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-150 bg-slate-50/50'
                    }`}>
                        <Sparkles size={16} className="text-violet-500" />
                        <h2 className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            பரிந்துரைகள் (AI Analysis Recommendations)
                        </h2>
                    </div>

                    {/* Panel Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {loading && (
                            <div className="h-full flex flex-col items-center justify-center space-y-3 py-10">
                                <Loader2 size={36} className="text-violet-500 animate-spin" />
                                <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    கருத்துப்பிழைகள் மற்றும் வாக்கிய மேம்பாடுகளை லோக்கல் ஓலமா பகுப்பாய்வு செய்கிறது...
                                </p>
                            </div>
                        )}

                        {!loading && error && (
                            <div className={`p-4 rounded-xl border flex gap-3 ${
                                isDarkMode ? 'bg-red-950/20 border-red-900/40 text-red-300' : 'bg-red-50 border-red-100 text-red-700'
                            }`}>
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <div className="text-xs space-y-1">
                                    <p className="font-bold">பகுப்பாய்வு தோல்வி</p>
                                    <p>{error}</p>
                                </div>
                            </div>
                        )}

                        {!loading && !error && !hasAnalyzed && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 py-12 space-y-3">
                                <HelpCircle size={40} className={isDarkMode ? 'text-slate-700' : 'text-slate-350'} />
                                <div className="space-y-1">
                                    <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        பகுப்பாய்வு இன்னும் தொடங்கப்படவில்லை
                                    </p>
                                    <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        டூல்பாரில் உள்ள <strong className="text-violet-500">AI Analysis</strong> பொத்தானை அழுத்தி பரிந்துரைகளைக் காண்க.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!loading && !error && hasAnalyzed && suggestions.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 py-12 space-y-3">
                                <CheckCircle size={40} className="text-emerald-500" />
                                <div className="space-y-1">
                                    <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        பிழைகள் ஏதும் கண்டறியப்படவில்லை
                                    </p>
                                    <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        உள்ளிடப்பட்ட உரை கருத்து மற்றும் வாக்கிய அமைப்பில் மிகச் சரியாக உள்ளது.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!loading && !error && suggestions.length > 0 && (
                            <div className="space-y-3">
                                {suggestions.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                                            isDarkMode 
                                                ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' 
                                                : 'bg-white border-slate-150 hover:border-slate-250'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                                item.type === 'கருத்துப்பிழை'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                    : 'bg-indigo-100 text-indigo-850 dark:bg-indigo-950/60 dark:text-indigo-300'
                                            }`}>
                                                {item.type}
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-xs">
                                            {item.original && (
                                                <div className="space-y-0.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-450'}`}>
                                                        அசல் உரை (Original)
                                                    </span>
                                                    <p className={`font-semibold line-through decoration-red-500/60 px-2 py-1 rounded bg-red-500/5 ${isDarkMode ? 'text-slate-350' : 'text-slate-600'}`}>
                                                        {item.original}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="space-y-0.5">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-450'}`}>
                                                    பரிந்துரை (Suggestion)
                                                </span>
                                                <p className={`font-bold text-emerald-600 dark:text-emerald-450 px-2 py-1 rounded bg-emerald-500/5`}>
                                                    {item.suggestion}
                                                </p>
                                            </div>

                                            {item.explanation && (
                                                <div className="space-y-0.5">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-450'}`}>
                                                        விளக்கம் (Explanation)
                                                    </span>
                                                    <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                                                        {item.explanation}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </main>
            
            {/* Minimal Footer */}
            <footer className={`text-center text-[10px] font-medium py-2 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                &copy; {new Date().getFullYear()} Blueprint Generator System
            </footer>
        </div>
    );
};

export default PublicSpellCheckPage;

