
import React from 'react';
import { Role } from '../types';

interface NavbarProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentRole, onRoleChange }) => {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100 w-10 h-10 flex items-center justify-center overflow-hidden">
            <img src="/img/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">Blueprint Generator</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => onRoleChange(Role.ADMIN)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentRole === Role.ADMIN ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Admin
            </button>
            <button 
              onClick={() => onRoleChange(Role.USER)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentRole === Role.USER ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Teacher
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
