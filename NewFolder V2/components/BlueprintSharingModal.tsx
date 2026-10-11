import React, { useState, useEffect } from 'react';
import { X, Users, Share2, Check, Trash2, Loader2 } from 'lucide-react';
import { User, Blueprint } from '../types';
import { getUsers, shareBlueprint, removeShare, getSharedWithUsers } from '../services/db';

interface BlueprintSharingModalProps {
    blueprint: Blueprint;
    currentUserId: string;
    onClose: () => void;
    onShareComplete: () => void;
}

const BlueprintSharingModal: React.FC<BlueprintSharingModalProps> = ({
    blueprint,
    currentUserId,
    onClose,
    onShareComplete
}) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [sharedUsers, setSharedUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const [users, shared] = await Promise.all([
                getUsers(),
                getSharedWithUsers(blueprint.id)
            ]);
            
            // Filter out current user and admin users
            const availableUsers = users.filter(u => u.id !== currentUserId && u.role !== 'ADMIN');
            setAllUsers(availableUsers);
            setSharedUsers(shared);
        } catch (err) {
            console.error('Error loading users:', err);
            setMessage({ type: 'error', text: 'Failed to load users' });
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!selectedUserId) {
            setMessage({ type: 'error', text: 'Please select a user to share with' });
            return;
        }

        try {
            const success = await shareBlueprint(blueprint.id, currentUserId, selectedUserId);

            if (success) {
                setMessage({ type: 'success', text: 'Blueprint shared successfully!' });
                setSelectedUserId('');
                loadUsers();
                onShareComplete();

                // Clear message after 2 seconds
                setTimeout(() => setMessage(null), 2000);
            } else {
                setMessage({ type: 'error', text: 'Failed to share. Already shared or blueprint not found.' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'An error occurred during sharing.' });
        }
    };

    const handleRemoveShare = async (userId: string) => {
        try {
            const success = await removeShare(blueprint.id, userId);

            if (success) {
                setMessage({ type: 'success', text: 'Share access removed successfully!' });
                loadUsers();
                onShareComplete();

                setTimeout(() => setMessage(null), 2000);
            } else {
                setMessage({ type: 'error', text: 'Failed to remove share access.' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'An error occurred while removing access.' });
        }
    };

    const filteredUsers = allUsers.filter(u =>
        !sharedUsers.some(su => su.id === u.id) &&
        (u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Share2 size={28} />
                        <div>
                            <h2 className="text-2xl font-bold">Share Blueprint</h2>
                            <p className="text-blue-100 text-sm mt-1">
                                {blueprint.questionPaperTypeName} - {blueprint.examTerm}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                        {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                        <span className="text-sm font-medium">{message.text}</span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Share New User Section */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Users size={20} className="text-blue-600" />
                            Share with New User / புதிய பயனருடன் பகிர
                        </h3>

                        {/* Search Input */}
                        <input
                            type="text"
                            placeholder="Search users by name or username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />

                        {/* User Selection */}
                        <div className="flex gap-2">
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                <option value="">-- Select a user --</option>
                                {filteredUsers.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} (@{user.username})
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleShare}
                                disabled={!selectedUserId}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2 font-medium"
                            >
                                <Share2 size={18} />
                                Share
                            </button>
                        </div>

                        {filteredUsers.length === 0 && (
                            <p className="text-sm text-gray-500 mt-2 italic">
                                {searchTerm ? 'No users found matching your search.' : 'All available users have access to this blueprint.'}
                            </p>
                        )}
                    </div>

                    {/* Currently Shared Users Section */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Check size={20} className="text-green-600" />
                            Shared With / தற்போது பகிரப்பட்டது ({sharedUsers.length})
                        </h3>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                                <p className="text-gray-500 text-sm">Loading shared users...</p>
                            </div>
                        ) : sharedUsers.length === 0 ? (
                            <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                                <Users size={48} className="mx-auto text-gray-300 mb-2" />
                                <p className="text-gray-500">This blueprint hasn't been shared with anyone yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sharedUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center hover:shadow-md transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                                                {user.name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-800">{user.name || user.username}</p>
                                                <p className="text-sm text-gray-500">@{user.username}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveShare(user.id)}
                                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition flex items-center gap-1 text-sm"
                                            title="Remove access"
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlueprintSharingModal;
