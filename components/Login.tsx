import React, { useState, useEffect } from 'react';
import { UserCircle, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { User } from '../types';
import { login, getPublicSettings } from '../services/db';

const Login = ({ onLogin, onSpellCheckClick }: { onLogin: (user: User) => void; onSpellCheckClick: () => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [enableSpellCheck, setEnableSpellCheck] = useState(true);

    useEffect(() => {
        getPublicSettings().then(res => {
            if (res && typeof res.enablePublicSpellCheck === 'boolean') {
                setEnableSpellCheck(res.enablePublicSpellCheck);
            }
        }).catch(() => {});
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const result = await login(username, password);
            if (result.success && result.user) {
                if (result.user.status === 'blocked') {
                    setError('Your account is blocked. Please contact the administrator.');
                } else {
                    onLogin(result.user);
                }
            } else {
                setError(result.error || 'Invalid credentials');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Database connection failed.');
        }
    };

    const handleSpellCheck = (e: React.SyntheticEvent) => {
        e.preventDefault();
        onSpellCheckClick();
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50/50 to-slate-100 p-4 sm:p-6 relative overflow-hidden">
            {/* Top Navigation Bar with Spell Check button */}
            {enableSpellCheck && (
                <div className="w-full max-w-5xl flex justify-end items-center p-3 sm:p-6 absolute top-0 left-0 right-0 z-20 mx-auto pointer-events-none">
                    <button
                        type="button"
                        onClick={handleSpellCheck}
                        onTouchEnd={handleSpellCheck}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-indigo-600 shadow-sm hover:shadow-md transition-all cursor-pointer font-bold text-xs active:scale-95 touch-manipulation select-none backdrop-blur-md pointer-events-auto"
                        aria-label="Open Spell Check"
                    >
                        <Sparkles size={14} className="text-indigo-500 shrink-0" />
                        <span>Spell Check</span>
                    </button>
                </div>
            )}

            {/* Main Login Card Form Container */}
            <div className="bg-white/95 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md border border-white/80 z-10 my-auto">
                <div className="text-center mb-6 sm:mb-8">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md overflow-hidden border border-gray-100">
                        <img src="/img/logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">
                        Blueprint Generator
                    </h1>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">Quality Question Paper System</p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded-xl text-xs sm:text-sm font-semibold">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">Username</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <UserCircle size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Enter username"
                                className="block w-full pl-10 pr-3 py-2.5 sm:py-3 rounded-xl border-gray-200 border bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter password"
                                className="block w-full pl-10 pr-12 py-2.5 sm:py-3 rounded-xl border-gray-200 border bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 focus:outline-none transition-colors touch-manipulation"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.01] transition-all text-sm active:scale-95 cursor-pointer"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
