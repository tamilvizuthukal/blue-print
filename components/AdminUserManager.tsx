
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    Trash2, Plus, Edit2, Eye, EyeOff, Shield, ShieldOff
} from 'lucide-react';
import {
    User, Role
} from '../types';
import {
    getUsers, saveUsers, deleteUser
} from '../services/db';

import { TableRowSkeleton } from './LoadingSkeleton';

const AdminUserManager = () => {
    const [userList, setUserList] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<Partial<User>>({
        username: '',
        password: '',
        name: '',
        email: '',
        pen: '',
        schoolName: '',
        schoolCode: '',
        basicPay: 0,
        role: Role.USER,
        status: 'active'
    });

    useEffect(() => {
        setLoading(true);
        getUsers().then(users => {
            setUserList(users);
            setLoading(false);
        }).catch(err => {
            console.error("Fetch users error:", err);
            setLoading(false);
        });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.username || !formData.name || !formData.role) {
            return Swal.fire("Required", "Please fill required fields", "warning");
        }

        let userToSave: User;
        if (editingUser) {
            const updateData = { ...formData };
            if (!updateData.password || updateData.password.trim() === '') {
                delete updateData.password;
            }
            userToSave = { ...editingUser, ...updateData } as User;
        } else {
            if (userList.find(u => u.username === formData.username)) {
                return Swal.fire("Error", "Username already exists", "error");
            }
            if (!formData.password) {
                return Swal.fire("Required", "Password is required for new users", "warning");
            }
            userToSave = {
                ...formData as User,
                id: Math.random().toString(36).substr(2, 9),
                status: formData.status || 'active'
            };
        }

        saveUsers([userToSave]).then(() => {
            Swal.fire({
                title: "Success!",
                text: editingUser 
                    ? "User updated successfully!" 
                    : "User created successfully!",
                icon: "success",
                confirmButtonColor: "#2563eb"
            });
            getUsers().then(setUserList);
            setIsFormOpen(false);
            setEditingUser(null);
            setFormData({ username: '', password: '', name: '', email: '', pen: '', schoolName: '', schoolCode: '', basicPay: 0, role: Role.USER, status: 'active' });
        }).catch(err => {
            console.error("Save users error:", err);
            Swal.fire("Error", "Failed to save user.", "error");
            getUsers().then(setUserList);
        });
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setFormData({ ...user, password: '', status: user.status || 'active' });
        setIsFormOpen(true);
    };

    const toggleStatus = (user: User) => {
        const newStatus: 'active' | 'blocked' = user.status === 'blocked' ? 'active' : 'blocked';
        const updatedUser = { ...user, status: newStatus };
        
        saveUsers([updatedUser]).then(() => {
            Swal.fire({
                title: "Updated!",
                text: `User is now ${newStatus}.`,
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });
            getUsers().then(setUserList);
        }).catch(err => {
            console.error("Toggle status error:", err);
            Swal.fire("Error", "Failed to update status.", "error");
        });
    };

    const handleDelete = (id: string) => {
        Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, delete it!",
            cancelButtonText: "Cancel"
        }).then((result) => {
            if (result.isConfirmed) {
                deleteUser(id).then(() => {
                    Swal.fire({
                        title: "Deleted!",
                        text: "User has been removed from system.",
                        icon: "success",
                        confirmButtonColor: "#2563eb"
                    });
                    getUsers().then(setUserList);
                }).catch(err => {
                    console.error("Delete user error:", err);
                    Swal.fire("Error", "Failed to delete user.", "error");
                    getUsers().then(setUserList);
                });
            }
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-0">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 font-display tracking-tight">User Management</h2>
                    <p className="text-gray-500 mt-1 font-medium italic">Control access and roles for the blueprint system.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setFormData({ username: '', password: '', name: '', email: '', pen: '', schoolName: '', schoolCode: '', basicPay: 0, role: Role.USER });
                        setIsFormOpen(true);
                    }}
                    className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Create New User</span>
                </button>
            </div>

            {isFormOpen && (
                <div className="ap-card border-blue-100 p-0 overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-6 bg-gradient-to-r from-blue-50/50 to-white border-b border-blue-50 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-blue-700 font-display flex items-center gap-2">
                            {editingUser ? <Edit2 size={20} /> : <Plus size={20} />}
                            {editingUser ? 'Edit User Details' : 'Configure New User'}
                        </h3>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name *</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">PEN Number (Optional)</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-blue-600"
                                    value={formData.pen || ''}
                                    onChange={e => setFormData({ ...formData, pen: e.target.value })}
                                    placeholder="Enter PEN number"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-medium text-gray-600"
                                    type="email"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">School Name</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                    value={formData.schoolName || ''}
                                    onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                                    placeholder="Enter school name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">School Code</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                    value={formData.schoolCode || ''}
                                    onChange={e => setFormData({ ...formData, schoolCode: e.target.value })}
                                    placeholder="Enter school code"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Basic Pay</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                    type="number"
                                    value={formData.basicPay || ''}
                                    onChange={e => setFormData({ ...formData, basicPay: Number(e.target.value) })}
                                    placeholder="Enter basic pay"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Username *</label>
                                <input
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-mono font-bold text-gray-700 disabled:opacity-50"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    required
                                    disabled={!!editingUser}
                                    placeholder="unique_username"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                    Password {editingUser ? '(Empty to keep current)' : '*'}
                                </label>
                                <div className="relative">
                                    <input
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 pr-12 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-mono"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password || ''}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-blue-500 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Access Role *</label>
                                <select
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700 cursor-pointer appearance-none"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                                >
                                    <option value={Role.ADMIN}>Administrator (Full Access)</option>
                                    <option value={Role.USER}>Standard User (Teacher)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Status *</label>
                                <select
                                    className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700 cursor-pointer appearance-none"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'blocked' })}
                                >
                                    <option value="active">Active (Full Access)</option>
                                    <option value="blocked">Blocked (No Access)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end items-center gap-4 mt-10 pt-6 border-t border-gray-50">
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="px-6 py-2.5 text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-2xl font-bold shadow-xl shadow-blue-100 transition-all text-sm flex items-center gap-2 active:scale-95"
                            >
                                {editingUser ? 'Update Profile' : 'Create Account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="ap-card overflow-hidden">
                {loading ? (
                    <div className="p-6">
                        <TableRowSkeleton columns={5} rows={8} />
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-50">
                                        <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-widest">User Details</th>
                                        <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-widest">Username</th>
                                        <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-widest">Role</th>
                                        <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {userList.map(u => (
                                        <tr key={u.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-100 group-hover:scale-110 transition-transform">
                                                        {u.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 font-display">{u.name}</div>
                                                        <div className="text-[11px] text-gray-400 font-medium italic">{u.email || 'No email associated'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5 text-gray-600 font-mono text-xs font-bold">{u.username}</td>
                                            <td className="p-5">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${u.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${u.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {u.status || 'active'}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex justify-end gap-2">
                                                    {u.username !== 'admin' && (
                                                        <button 
                                                            onClick={() => toggleStatus(u)} 
                                                            className={`p-2 rounded-xl transition-all ${u.status === 'blocked' ? 'text-green-400 hover:text-green-600 hover:bg-green-50' : 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'}`} 
                                                            title={u.status === 'blocked' ? "Activate User" : "Block User"}
                                                        >
                                                            {u.status === 'blocked' ? <Shield size={18} /> : <ShieldOff size={18} />}
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleEdit(u)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit User">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    {u.username !== 'admin' && (
                                                        <button onClick={() => handleDelete(u.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete User">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-50">
                            {userList.map(u => (
                                <div key={u.id} className="p-5 space-y-4 hover:bg-blue-50/20 transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 font-display">{u.name}</div>
                                                <div className="text-[11px] text-gray-400">{u.email || 'No email provided'}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${u.role === Role.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                {u.role}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${u.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.status || 'active'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <div className="text-gray-600">
                                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-0.5">Username</span>
                                            <span className="font-mono text-sm font-bold text-gray-500">{u.username}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {u.username !== 'admin' && (
                                                <button 
                                                    onClick={() => toggleStatus(u)} 
                                                    className={`p-2.5 rounded-xl ${u.status === 'blocked' ? 'text-green-500 bg-green-50' : 'text-orange-500 bg-orange-50'}`}
                                                >
                                                    {u.status === 'blocked' ? <Shield size={18} /> : <ShieldOff size={18} />}
                                                </button>
                                            )}
                                            <button onClick={() => handleEdit(u)} className="p-2.5 text-blue-500 bg-blue-50 rounded-xl">
                                                <Edit2 size={18} />
                                            </button>
                                            {u.username !== 'admin' && (
                                                <button onClick={() => handleDelete(u.id)} className="p-2.5 text-red-500 bg-red-50 rounded-xl">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {userList.length === 0 && !isFormOpen && (
                <div className="py-20 text-center ap-card border-dashed border-2 flex flex-col items-center gap-4">
                    <p className="text-gray-400 font-medium italic">No users registered in the system.</p>
                </div>
            )}
        </div>
    );
};

export default AdminUserManager;
