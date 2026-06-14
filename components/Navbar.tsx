
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
          <div className="bg-indigo-600 p-2 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">Blueprint Pro</span>
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
