import React, { useState } from 'react';
import { ChevronLeft, Sun, Moon } from 'lucide-react';
import SimpleRichTextEditor from './SimpleRichTextEditor';

interface PublicSpellCheckPageProps {
    onClose: () => void;
}

const PublicSpellCheckPage: React.FC<PublicSpellCheckPageProps> = ({ onClose }) => {
    const [text, setText] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);

    const handleBack = (e: React.SyntheticEvent) => {
        e.preventDefault();
        onClose();
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
                    <span>Back</span>
                </button>

                <h1 className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Spell Check
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

            {/* Main Content Area - Full Height Container */}
            <main className="flex-1 flex flex-col p-2 sm:p-4 md:p-6 overflow-hidden max-w-6xl w-full mx-auto h-full">
                <div className={`rounded-2xl border shadow-sm flex-1 flex flex-col overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <SimpleRichTextEditor
                            value={text}
                            onChange={setText}
                            placeholder="Type or paste Tamil text here to proofread..."
                            hideAIButtons={true}
                            hideFormatButton={true}
                            isDarkMode={isDarkMode}
                        />
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
