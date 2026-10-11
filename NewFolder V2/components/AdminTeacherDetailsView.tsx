
import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { 
    Search, User as UserIcon, Building, CreditCard, 
    Phone, Mail, MapPin, IndianRupee, Globe, Landmark, Download,
    Edit2, Trash2, X, Save, Shield
} from 'lucide-react';
import { User, Role } from '../types';
import { getUsers, saveUsers, deleteUser } from '../services/db';
import { getAcademicYearLabel, getCurrentSummativeTermLabel } from '../utils/reportCalculations';

const AdminTeacherDetailsView = () => {
    const [teachers, setTeachers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<Partial<User> | null>(null);

    useEffect(() => {
        loadTeachers();
    }, []);

    const loadTeachers = () => {
        getUsers().then(users => {
            setTeachers(users.filter(u => u.role === Role.USER));
        }).catch(err => {
            console.error("Failed to load teachers:", err);
        });
    };

    const handleEdit = (teacher: User) => {
        setEditingTeacher({ ...teacher });
        setIsEditing(true);
    };

    const handleDelete = (id: string) => {
        Swal.fire({
            title: "Are you sure?",
            text: "This will remove the teacher from both User and Teacher directories!",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Yes, delete teacher"
        }).then((result) => {
            if (result.isConfirmed) {
                deleteUser(id).then(() => {
                    Swal.fire("Deleted", "Teacher removed successfully", "success");
                    loadTeachers();
                });
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTeacher) return;

        try {
            await saveUsers([editingTeacher as User]);
            Swal.fire("Success", "Teacher details updated", "success");
            setIsEditing(false);
            setEditingTeacher(null);
            loadTeachers();
        } catch (err) {
            Swal.fire("Error", "Failed to update details", "error");
        }
    };

    const filteredTeachers = teachers.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.pen?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.schoolName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDownloadPDF = async () => {
        if (!filteredTeachers.length) return;

        const escapeHtml = (value: unknown) => String(value ?? '-').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character] || character);
        const rows = filteredTeachers.map((teacher, index) => `
            <tr>
                <td class="serial">${index + 1}</td>
                <td>${escapeHtml(teacher.pen)}</td>
                <td>${escapeHtml(teacher.name)}</td>
                <td>${escapeHtml(teacher.designation)}</td>
                <td><strong>${escapeHtml(teacher.schoolCode)}</strong><br>${escapeHtml(teacher.schoolName)}</td>
                <td>${escapeHtml(teacher.phoneNumber || teacher.mobile)}</td>
                <td>${escapeHtml(teacher.email)}</td>
            </tr>
        `).join('');
        const now = new Date();
        const examName = `${getCurrentSummativeTermLabel(now)} ${getAcademicYearLabel(now)}`;
        const generatedDate = escapeHtml(now.toLocaleDateString('en-IN'));
        const html = `<!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @page { size: A4 landscape; margin: 12mm; }
                    body { color: #17212b; font-family: 'Times New Roman', 'TAU-Paalai', serif; font-size: 9pt; }
                    .report-header { margin: 0 0 7mm; padding-bottom: 4mm; border-bottom: 1px solid #9aa7b2; text-align: center; }
                    h1 { margin: 0 0 2mm; color: #19344d; font-family: 'TAU-Urai', 'Times New Roman', serif; font-size: 18pt; }
                    .report-meta { display: flex; justify-content: space-between; color: #52616d; font-size: 9pt; }
                    table { width: 100%; table-layout: fixed; border-collapse: collapse; }
                    table.teacher-directory { break-inside: auto !important; page-break-inside: auto !important; }
                    table.teacher-directory tbody { display: table-row-group !important; break-inside: auto !important; page-break-inside: auto !important; }
                    col.serial { width: 5%; }
                    col.pen { width: 9%; }
                    col.name { width: 15%; }
                    col.designation { width: 13%; }
                    col.school { width: 25%; }
                    col.mobile { width: 12%; }
                    col.email { width: 21%; }
                    thead { display: table-header-group; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    th, td { border: 1px solid #aeb8c1; padding: 2.2mm 1.8mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
                    th { background: #23394e; color: white; font-size: 8pt; font-weight: bold; }
                    tbody tr:nth-child(even) { background: #f2f5f7; }
                    td.serial { text-align: center; }
                </style>
            </head>
            <body>
                <header class="report-header">
                    <h1>${escapeHtml(examName)}</h1>
                    <div class="report-meta"><span>Teacher Details</span><span>Generated: ${generatedDate} | Total: ${filteredTeachers.length}</span></div>
                </header>
                <table class="teacher-directory">
                    <colgroup><col class="serial"><col class="pen"><col class="name"><col class="designation"><col class="school"><col class="mobile"><col class="email"></colgroup>
                    <thead><tr><th>Sl. No.</th><th>PEN</th><th>Name</th><th>Designation</th><th>School Code / School Name</th><th>Mobile</th><th>Email</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
            </html>`;

        Swal.fire({
            title: 'Generating PDF...',
            text: 'Preparing the A4 landscape teacher directory.',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const token = localStorage.getItem('blueprint_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            const apiUrl = isLocalhost ? 'http://localhost:5001/api' : `${window.location.origin}/api`;
            const response = await fetch(`${apiUrl}/generate-pdf`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    html,
                    orientation: 'landscape',
                    filename: 'Teacher_Details_Report.pdf',
                    paperCode: 'Teacher Details'
                })
            });

            if (!response.ok) {
                throw new Error(`PDF generation failed: ${response.status} ${await response.text()}`);
            }

            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Teacher_Details_Report.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60000);
            Swal.close();
        } catch (error) {
            console.error('Teacher details PDF generation failed:', error);
            Swal.fire('PDF Export Failed', error instanceof Error ? error.message : 'Failed to generate the report.', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-gray-100 pb-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold text-gray-900 font-display tracking-tight">
                        Teacher Details
                    </h2>
                    <p className="text-gray-500 font-medium italic">
                        Comprehensive directory of teachers and professional data.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 w-full lg:w-80">
                        <input
                            type="text"
                            placeholder="Search by name, PEN, or school..."
                            className="w-full text-sm border border-gray-100 rounded-2xl p-3.5 pl-11 bg-white shadow-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadPDF}
                        disabled={filteredTeachers.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Export the displayed teacher list as an A4 landscape PDF"
                    >
                        <Download size={17} />
                        <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* Edit Form Modal */}
            {isEditing && editingTeacher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Edit Teacher Details</h3>
                                <p className="text-xs text-gray-500 font-medium italic mt-0.5">Updating profile for: {editingTeacher.name}</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Identity */}
                                <div className="space-y-2 lg:col-span-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.name || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">PEN Number</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-blue-600"
                                        value={editingTeacher.pen || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, pen: e.target.value})}
                                    />
                                </div>

                                {/* School Details */}
                                <div className="space-y-2 lg:col-span-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">School Name</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.schoolName || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, schoolName: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">School Code</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.schoolCode || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, schoolCode: e.target.value})}
                                    />
                                </div>

                                {/* Professional Info */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Basic Pay</label>
                                    <input 
                                        type="number"
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.basicPay || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, basicPay: Number(e.target.value)})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Designation</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.designation || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, designation: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Mobile</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.phoneNumber || editingTeacher.mobile || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, phoneNumber: e.target.value, mobile: e.target.value})}
                                    />
                                </div>

                                {/* Bank Details */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Account Number</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-mono font-bold text-gray-700"
                                        value={editingTeacher.bankAccountNumber || editingTeacher.accountNo || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, bankAccountNumber: e.target.value, accountNo: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Name</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.bankName || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, bankName: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank IFSC Code</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-mono font-bold text-blue-600"
                                        value={editingTeacher.bankIfsc || editingTeacher.ifscCode || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, bankIfsc: e.target.value, ifscCode: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Branch</label>
                                    <input 
                                        className="w-full text-sm border border-gray-100 rounded-2xl p-4 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-gray-700"
                                        value={editingTeacher.bankBranch || editingTeacher.branch || ''}
                                        onChange={e => setEditingTeacher({...editingTeacher, bankBranch: e.target.value, branch: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end items-center gap-4 mt-12 pt-8 border-t border-gray-50">
                                <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-2xl font-bold shadow-xl shadow-blue-100 transition-all flex items-center gap-2 active:scale-95">
                                    <Save size={18} />
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Table Container */}
            <div className="ap-card overflow-hidden shadow-sm border border-gray-100">
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse min-w-[1100px] text-[11px]">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 w-[18%]">
                                    Teacher Name (PEN)
                                </th>
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 w-[18%]">
                                    School Name (Code)
                                </th>
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 w-[15%]">
                                    Mobile & Email
                                </th>
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 w-[10%]">
                                    Basic Pay
                                </th>
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 w-[15%]">
                                    Account No & Bank
                                </th>
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 w-[12%]">
                                    IFSC & Branch
                                </th>
                                <th className="p-3 font-black text-[9px] text-gray-400 uppercase tracking-widest border-x border-gray-100 text-right no-print w-[12%]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white text-gray-800">
                            {filteredTeachers.map(t => (
                                <tr key={t.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="p-3 border-x border-gray-50">
                                        <div className="font-bold text-sm text-gray-900 leading-tight">{t.name}</div>
                                        <div className="text-[10px] font-black text-blue-600">({t.pen || 'PENDING'})</div>
                                    </td>
                                    <td className="p-3 border-x border-gray-50">
                                        <div className="font-bold text-gray-800 leading-tight truncate max-w-[180px]" title={t.schoolName}>{t.schoolName || 'Not Set'}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">({t.schoolCode || 'N/A'})</div>
                                    </td>
                                    <td className="p-3 border-x border-gray-50">
                                        <div className="font-bold text-gray-700">{t.phoneNumber || t.mobile || '—'}</div>
                                        <div className="text-[10px] text-gray-400 font-medium lowercase truncate max-w-[140px]">{t.email || '—'}</div>
                                    </td>
                                    <td className="p-3 border-x border-gray-50 font-bold text-gray-900">
                                        {t.basicPay ? `₹${t.basicPay.toLocaleString('en-IN')}` : '—'}
                                    </td>
                                    <td className="p-3 border-x border-gray-50">
                                        <div className="font-mono font-bold text-gray-700 truncate max-w-[140px]">{t.bankAccountNumber || t.accountNo || '—'}</div>
                                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest truncate">{t.bankName || '—'}</div>
                                    </td>
                                    <td className="p-3 border-x border-gray-50">
                                        <div className="font-mono font-bold text-blue-600">{t.bankIfsc || t.ifscCode || '—'}</div>
                                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest truncate">{t.bankBranch || t.branch || '—'}</div>
                                    </td>
                                    <td className="p-3 border-x border-gray-50 text-right no-print">
                                        <div className="flex justify-end gap-1">
                                            <button 
                                                onClick={() => handleEdit(t)} 
                                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                title="Edit Teacher"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(t.id)} 
                                                className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                                                title="Delete Teacher"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredTeachers.length === 0 && (
                    <div className="py-24 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <Search size={32} />
                        </div>
                        <h3 className="font-bold text-gray-900">No teachers found</h3>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your search criteria.</p>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f8fafc;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            ` }} />
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-gray-400 font-medium bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>Showing {filteredTeachers.length} of {teachers.length} registered teachers</span>
                </div>
                <div className="flex items-center gap-2 uppercase tracking-widest font-black opacity-50">
                    <Shield size={12} />
                    <span>Confidential Administration Data</span>
                </div>
            </div>
        </div>
    );
};

export default AdminTeacherDetailsView;
