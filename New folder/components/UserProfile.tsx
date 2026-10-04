import React, { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
    User as UserIcon, Mail, Phone, MapPin, Building,
    School, CreditCard, Landmark, Save, ArrowLeft,
    CheckCircle, AlertCircle, Loader2, Calendar, Briefcase, IndianRupee, LayoutDashboard
} from 'lucide-react';
import { User, SchoolType, District } from '@/types';
import { updateUserProfile } from '@/services/db';

interface UserProfileProps {
    user: User;
    onBack: () => void;
    onUpdate: (user: User) => void;
}

const KERALA_ADMIN_STRUCTURE: Record<string, Record<string, string[]>> = {
    "Thiruvananthapuram": {
        "Thiruvananthapuram": ["Thiruvananthapuram North", "Thiruvananthapuram South", "Balaramapuram"],
        "Attingal": ["Attingal", "Kilimanoor", "Palode", "Varkala"],
        "Neyyattinkara": ["Neyyattinkara", "Parassala", "Kattakada", "Nedumangad"]
    },
    "Kollam": {
        "Kollam": ["Kollam", "Chathannur", "Kundara"],
        "Kottarakkara": ["Kottarakkara", "Veliyam", "Chadayamangalam", "Sasthamcotta"],
        "Punalur": ["Punalur", "Anchal", "Chavara", "Karunagappally"]
    },
    "Pathanamthitta": {
        "Pathanamthitta": ["Pathanamthitta", "Konni", "Kozhencherry", "Ranni"],
        "Thiruvalla": ["Thiruvalla", "Mallappally", "Adoor", "Pullad"]
    },
    "Alappuzha": {
        "Alappuzha": ["Alappuzha", "Ambalappuzha", "Kuttanad"],
        "Mavelikkara": ["Mavelikkara", "Haripad", "Kayamkulam"],
        "Cherthala": ["Cherthala", "Thuravoor"],
        "Chengannur": ["Chengannur", "Veliyanad"]
    },
    "Kottayam": {
        "Kottayam": ["Kottayam East", "Kottayam West", "Changanassery", "Ettumanoor", "Pampady"],
        "Pala": ["Pala", "Kuravilangad", "Erattupetta"],
        "Kanjirappally": ["Kanjirappally", "Vaikom", "Kaduthuruthy"]
    },
    "Idukki": {
        "Thodupuzha": ["Thodupuzha", "Adimaly", "Munnar"],
        "Kattappana": ["Kattappana", "Nedumkandam", "Peermade"]
    },
    "Ernakulam": {
        "Ernakulam": ["Ernakulam", "Mattancherry", "Vypeen"],
        "Muvattupuzha": ["Muvattupuzha", "Koothattukulam", "Piravom"],
        "Kothamangalam": ["Kothamangalam", "Kuruppampady"],
        "Aluva": ["Aluva", "Angamaly", "North Paravur", "Perumbavoor"]
    },
    "Thrissur": {
        "Thrissur": ["Thrissur East", "Thrissur West", "Cherpu", "Mullassery"],
        "Chavakkad": ["Chavakkad", "Kunnamkulam", "Guruvayur"],
        "Irinjalakuda": ["Irinjalakuda", "Chalakudy", "Kodungallur", "Mala"],
        "Wadakkanchery": ["Wadakkanchery", "Pazhayannur"]
    },
    "Palakkad": {
        "Palakkad": ["Palakkad", "Alathur", "Chittur", "Koyalmannam"],
        "Ottappalam": ["Ottappalam", "Pattambi", "Shornur", "Thrithala"],
        "Mannarkkad": ["Mannarkkad", "Agali", "Cherpulassery"]
    },
    "Malappuram": {
        "Malappuram": ["Malappuram", "Areekode", "Kondotty", "Mankada"],
        "Tirur": ["Tirur", "Kuttippuram", "Tanur", "Vengara"],
        "Wandoor": ["Wandoor", "Nilambur", "Melattur"],
        "Tirurangadi": ["Tirurangadi", "Parappanangadi"]
    },
    "Kozhikode": {
        "Kozhikode": ["Kozhikode City", "Kunnamangalam", "Faroke", "Mukkom"],
        "Vadakara": ["Vadakara", "Chorode", "Nadapuram", "Perambra"],
        "Thamarassery": ["Thamarassery", "Koduvally", "Balussery", "Koyilandy"]
    },
    "Wayanad": {
        "Wayanad": ["Kalpetta", "Mananthavady", "Sulthan Bathery"]
    },
    "Kannur": {
        "Kannur": ["Kannur", "Madayi", "Pappinisseri", "Taliparamba"],
        "Thalassery": ["Thalassery North", "Thalassery South", "Iritty", "Mattannur", "Panoor"],
        "Payyannur": ["Payyannur", "Cheruvathur"]
    },
    "Kasaragod": {
        "Kasaragod": ["Kasaragod", "Kumbla", "Manjeshwaram"],
        "Kanhangad": ["Hosdurg", "Bekal", "Nileshwaram"]
    }
};

const KERALA_REVENUE_DISTRICTS = Object.keys(KERALA_ADMIN_STRUCTURE) as District[];

const calculateExperience = (joinDate: string): string => {
    if (!joinDate) return "Join date required";
    const join = new Date(joinDate);
    const today = new Date();

    if (join > today) return "Future join date";

    let years = today.getFullYear() - join.getFullYear();
    let months = today.getMonth() - join.getMonth();
    let days = today.getDate() - join.getDate();

    if (days < 0) {
        months -= 1;
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += lastMonth.getDate();
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

    return parts.length > 0 ? parts.join(', ') : "Joined today";
};

const calculateKERRetirement = (dobValue: string, scheme: 'Statutory' | 'NPS'): string => {
    if (!dobValue) return "";
    const dob = new Date(dobValue);
    const birthYear = dob.getFullYear();
    const birthMonth = dob.getMonth();
    const birthDate = dob.getDate();

    // Age 56 for Statutory, 60 for NPS (KER/KSR Rules)
    const retirementAge = scheme === 'Statutory' ? 56 : 60;
    let retirementYear = birthYear + retirementAge;

    // KSR Rule: If birth date is the 1st of the month, retirement is the last day of the PREVIOUS month
    // Otherwise, it's the last day of the birth month
    if (birthDate === 1) {
        const retirementDate = new Date(retirementYear, birthMonth, 0); // Last day of previous month
        return retirementDate.toISOString().split('T')[0];
    } else {
        const retirementDate = new Date(retirementYear, birthMonth + 1, 0); // Last day of birth month
        return retirementDate.toISOString().split('T')[0];
    }
};

const UserProfile: React.FC<UserProfileProps> = ({ user, onBack, onUpdate }) => {
    const [formData, setFormData] = useState<Partial<User>>(() => {
        const { ...rest } = user;
        const initialJoin = rest.joinDate || '';
        const defaultScheme = initialJoin && new Date(initialJoin) < new Date('2013-04-01') ? 'Statutory' : 'NPS';
        
        return {
            ...rest,
            pensionScheme: rest.pensionScheme || defaultScheme || 'Statutory'
        };
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Keep formData in sync with user prop updates (e.g. from server response)
    useEffect(() => {
        if (!loading) {
            setFormData(prev => ({ ...prev, ...user }));
        }
    }, [user, loading]);

    // Auto-calculate retirement and experience when relevant fields change
    useEffect(() => {
        if (formData.dob && formData.pensionScheme) {
            const retDate = calculateKERRetirement(formData.dob, formData.pensionScheme as 'Statutory' | 'NPS');
            if (retDate !== formData.retirementDate) {
                setFormData(prev => ({ ...prev, retirementDate: retDate }));
            }
        }
    }, [formData.dob, formData.pensionScheme]);

    // Handle initial pension scheme setting based on join date if not already set
    useEffect(() => {
        if (!user.pensionScheme && formData.joinDate) {
            const join = new Date(formData.joinDate);
            const threshold = new Date('2013-04-01');
            const scheme = join < threshold ? 'Statutory' : 'NPS';
            setFormData(prev => ({ ...prev, pensionScheme: scheme }));
        }
    }, [formData.joinDate, user.pensionScheme]);

    const exp = useMemo(() => calculateExperience(formData.joinDate || ''), [formData.joinDate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear success message on any change
        if (success) setSuccess(false);
    };

    const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const district = e.target.value as District;
        if (!district) {
            setFormData(prev => ({ ...prev, district: undefined, educationalDistrict: undefined, subdistrict: undefined }));
            return;
        }

        const eduDistricts = Object.keys(KERALA_ADMIN_STRUCTURE[district]);
        const firstEduDistrict = eduDistricts[0];
        const firstSubDistrict = KERALA_ADMIN_STRUCTURE[district][firstEduDistrict][0];

        setFormData(prev => ({
            ...prev,
            district,
            educationalDistrict: firstEduDistrict,
            subdistrict: firstSubDistrict
        }));
    };

    const handleEducationalDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const eduDistrict = e.target.value;
        const district = formData.district as District;
        const subdistricts = KERALA_ADMIN_STRUCTURE[district][eduDistrict];

        setFormData(prev => ({
            ...prev,
            educationalDistrict: eduDistrict,
            subdistrict: subdistricts[0]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const updatedUser = await updateUserProfile(formData as User);
            onUpdate(updatedUser);
            Swal.fire({
                title: "Success!",
                text: "Profile updated successfully!",
                icon: "success",
                confirmButtonColor: "#4f46e5"
            });
        } catch (err: any) {
            Swal.fire("Error", err.message || 'Failed to update profile', "error");
        } finally {
            setLoading(false);
        }
    };

    const districts = KERALA_REVENUE_DISTRICTS;

    return (
        <div className="profile-container px-6 py-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 pb-6 border-bottom border-[#e2e8f0]">
                    <div className="flex flex-col">
                        <button
                            onClick={onBack}
                            className="profile-back-btn flex items-center gap-2 mb-4"
                        >
                            <ArrowLeft size={20} />
                            <span>Back to Dashboard</span>
                        </button>
                        <h1 className="profile-title">Profile Settings</h1>
                        <p className="profile-subtitle">Manage your personal and professional information</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="profile-form">
                    {/* Personal Details */}
                    <div className="profile-section">
                        <div className="section-header">
                            <UserIcon className="section-icon" />
                            <h2>Personal Information</h2>
                        </div>
                        <div className="profile-grid">
                            <div className="form-group">
                                <label>Full Name</label>
                                <div className="input-with-icon">
                                    <UserIcon size={18} />
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name || ''}
                                        onChange={handleChange}
                                        placeholder="Your full name"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <div className="input-with-icon">
                                    <Mail size={18} />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email || ''}
                                        onChange={handleChange}
                                        placeholder="email@example.com"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Phone Number *</label>
                                <div className="input-with-icon">
                                    <Phone size={18} />
                                    <input
                                        type="tel"
                                        name="phoneNumber"
                                        value={formData.phoneNumber || ''}
                                        onChange={handleChange}
                                        placeholder="10-digit mobile number"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Date of Birth *</label>
                                <div className="input-with-icon">
                                    <Calendar size={18} />
                                    <input
                                        type="date"
                                        name="dob"
                                        value={formData.dob || ''}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Professional Details */}
                    <div className="profile-section">
                        <div className="section-header">
                            <Briefcase className="section-icon" />
                            <h2>Professional Details</h2>
                        </div>
                        <div className="profile-grid">
                            <div className="form-group">
                                <label>Employee ID (Staff ID)</label>
                                <div className="input-with-icon">
                                    <CreditCard size={18} />
                                    <input
                                        type="text"
                                        name="staffId"
                                        value={formData.staffId || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. EMP12345"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>PEN (Permanent Employee Number) *</label>
                                <div className="input-with-icon">
                                    <CreditCard size={18} />
                                    <input
                                        type="text"
                                        name="pen"
                                        className="uppercase-input"
                                        value={formData.pen || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 123456"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Designation *</label>
                                <div className="input-with-icon">
                                    <LayoutDashboard size={18} />
                                    <input
                                        type="text"
                                        name="designation"
                                        value={formData.designation || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. HST Physical Science"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Joining Date</label>
                                <div className="input-with-icon">
                                    <Calendar size={18} />
                                    <input
                                        type="date"
                                        name="joinDate"
                                        value={formData.joinDate || ''}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <span className="field-hint">Experience: {exp}</span>
                            </div>
                            <div className="form-group">
                                <label>Pension Scheme</label>
                                <div className="input-with-icon">
                                    <CreditCard size={18} />
                                    <select
                                        name="pensionScheme"
                                        value={formData.pensionScheme || 'Statutory'}
                                        onChange={handleChange}
                                    >
                                        <option value="Statutory">Statutory Pension (Pre-2013)</option>
                                        <option value="NPS">National Pension System (NPS)</option>
                                    </select>
                                </div>
                                <span className="field-hint">Threshold: Join Date 01/04/2013</span>
                            </div>
                            <div className="form-group">
                                <label>Retirement Date</label>
                                <div className="input-with-icon">
                                    <Calendar size={18} />
                                    <input
                                        type="date"
                                        name="retirementDate"
                                        className="readonly-input"
                                        value={formData.retirementDate || ''}
                                        readOnly
                                    />
                                </div>
                                <span className="field-hint">Calculated based on KER/KSR Rules</span>
                            </div>
                            <div className="form-group">
                                <label>Basic Pay (₹)</label>
                                <div className="input-with-icon">
                                    <IndianRupee size={18} />
                                    <input
                                        type="number"
                                        name="basicPay"
                                        value={formData.basicPay || ''}
                                        onChange={handleChange}
                                        placeholder="Current basic pay"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* School Information */}
                    <div className="profile-section">
                        <div className="section-header">
                            <School className="section-icon" />
                            <h2>School Information</h2>
                        </div>
                        <div className="profile-grid">
                            <div className="form-group">
                                <label>School Code</label>
                                <div className="input-with-icon">
                                    <Building size={18} />
                                    <input
                                        type="text"
                                        name="schoolCode"
                                        value={formData.schoolCode || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 12345"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>School Name *</label>
                                <div className="input-with-icon">
                                    <Building size={18} />
                                    <input
                                        type="text"
                                        name="schoolName"
                                        value={formData.schoolName || ''}
                                        onChange={handleChange}
                                        placeholder="Full school name"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>School Type</label>
                                <div className="input-with-icon">
                                    <MapPin size={18} />
                                    <select
                                        name="schoolType"
                                        value={formData.schoolType || 'Government'}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="Government">Government</option>
                                        <option value="Aided">Aided</option>
                                        <option value="Private">Private</option>
                                    </select>
                                </div>
                            </div>
                             <div className="form-group">
                                 <label>Revenue District *</label>
                                 <div className="input-with-icon">
                                     <MapPin size={18} />
                                     <select
                                         name="district"
                                         value={formData.district || ''}
                                         onChange={handleDistrictChange}
                                         required
                                     >
                                         <option value="">Select Revenue District</option>
                                         {districts.map(d => (
                                             <option key={d} value={d}>{d}</option>
                                         ))}
                                     </select>
                                 </div>
                             </div>
                            <div className="form-group">
                                <label>Educational District (DEO) *</label>
                                <div className="input-with-icon">
                                    <MapPin size={18} />
                                      <select
                                          name="educationalDistrict"
                                          value={formData.educationalDistrict || ''}
                                          onChange={handleEducationalDistrictChange}
                                          disabled={!formData.district}
                                          required
                                      >
                                          <option value="">Select DEO</option>
                                          {formData.district && KERALA_ADMIN_STRUCTURE[formData.district as District] && 
                                              Object.keys(KERALA_ADMIN_STRUCTURE[formData.district as District]).map(ed => (
                                                  <option key={ed} value={ed}>{ed}</option>
                                              ))
                                          }
                                      </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Educational Sub-District (AEO) *</label>
                                <div className="input-with-icon">
                                    <MapPin size={18} />
                                      <select
                                          name="subdistrict"
                                          value={formData.subdistrict || ''}
                                          onChange={handleChange}
                                          disabled={!formData.educationalDistrict}
                                          required
                                      >
                                          <option value="">Select AEO</option>
                                          {formData.district && formData.educationalDistrict && 
                                           KERALA_ADMIN_STRUCTURE[formData.district as District]?.[formData.educationalDistrict]?.map(sd => (
                                              <option key={sd} value={sd}>{sd}</option>
                                          ))}
                                      </select>
                                </div>
                            </div>
                             <div className="form-group">
                                 <label>BRC Name</label>
                                 <div className="input-with-icon">
                                     <Building size={18} />
                                     <input
                                         type="text"
                                         name="brcName"
                                         value={formData.brcName || ''}
                                         onChange={handleChange}
                                         placeholder="e.g. BRC Neyyattinkara"
                                     />
                                 </div>
                             </div>
                         </div>
                     </div>

                    {/* Bank Details */}
                    <div className="profile-section">
                        <div className="section-header">
                            <Landmark className="section-icon" />
                            <h2>Bank Information</h2>
                        </div>
                        <div className="profile-grid">
                            <div className="form-group">
                                <label>Bank Name</label>
                                <div className="input-with-icon">
                                    <Building size={18} />
                                    <input
                                        type="text"
                                        name="bankName"
                                        value={formData.bankName || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. SBI, Federal Bank"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Branch Name</label>
                                <div className="input-with-icon">
                                    <MapPin size={18} />
                                    <input
                                        type="text"
                                        name="bankBranch"
                                        value={formData.bankBranch || ''}
                                        onChange={handleChange}
                                        placeholder="Branch location"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Account Number *</label>
                                <div className="input-with-icon">
                                    <CreditCard size={18} />
                                    <input
                                        type="text"
                                        name="bankAccountNumber"
                                        value={formData.bankAccountNumber || ''}
                                        onChange={handleChange}
                                        placeholder="Your bank account number"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>IFSC Code *</label>
                                <div className="input-with-icon">
                                    <Landmark size={18} />
                                    <input
                                        type="text"
                                        name="bankIfsc"
                                        className="uppercase-input"
                                        value={formData.bankIfsc || ''}
                                        onChange={handleChange}
                                        placeholder="11-digit IFSC code"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feedback Messages */}
                    {error && (
                        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
                            <AlertCircle size={20} />
                            <p>{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-xl border border-green-100">
                            <CheckCircle size={20} />
                            <p>Profile updated successfully!</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="profile-actions">
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="profile-save-btn px-8"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    <span>Save Profile</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                .profile-container {
                    background-color: #f8fafc;
                    min-height: 100vh;
                    overflow-x: hidden;
                }
                .profile-back-btn {
                    color: #64748b;
                    font-weight: 600;
                    font-size: 0.875rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .profile-back-btn:hover {
                    color: #4f46e5;
                    transform: translateX(-4px);
                }
                .profile-title {
                    font-family: 'Syne', sans-serif;
                    font-size: 2rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #1e293b 0%, #4f46e5 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    line-height: 1.2;
                    padding-bottom: 0.2rem;
                }
                @media (max-width: 640px) {
                    .profile-title { font-size: 1.5rem; }
                    .profile-container { padding-left: 1rem; padding-right: 1rem; }
                }
                .profile-subtitle {
                    color: #64748b;
                    font-size: 0.875rem;
                }
                .profile-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    width: 100%;
                }
                .profile-section {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 1rem;
                    padding: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    width: 100%;
                    box-sizing: border-box;
                }
                @media (max-width: 480px) {
                    .profile-section { padding: 1.25rem 0.85rem; }
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px dashed #f1f5f9;
                }
                .section-icon {
                    color: #4f46e5;
                    flex-shrink: 0;
                }
                .section-header h2 {
                    font-family: 'Syne', sans-serif;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #334155;
                }
                .profile-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
                    gap: 1rem;
                    width: 100%;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                    min-width: 0;
                    width: 100%;
                }
                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #64748b;
                    display: block;
                    width: 100%;
                    white-space: normal; /* Allow wrapping for long labels */
                    line-height: 1.2;
                }
                .form-group input, 
                .form-group select {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    padding: 0.65rem 0.85rem;
                    font-size: 0.9rem;
                    color: #1e293b;
                    font-family: 'DM Sans', sans-serif;
                    transition: all 0.2s;
                    width: 100%;
                    min-width: 0;
                    box-sizing: border-box;
                }
                .input-with-icon {
                    position: relative;
                    width: 100%;
                }
                .input-with-icon svg {
                    position: absolute;
                    left: 0.85rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    pointer-events: none;
                }
                .input-with-icon input,
                .input-with-icon select {
                    padding-left: 2.5rem;
                }
                .profile-actions {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 1rem;
                    margin-top: 0.5rem;
                    padding: 1.25rem;
                    background: #f8fafc;
                    border-radius: 1rem;
                    border: 1px solid #e2e8f0;
                }
                @media (max-width: 480px) {
                    .profile-actions { justify-content: center; }
                    .profile-save-btn { width: 100%; justify-content: center; }
                    .profile-actions button:first-child { width: 100%; order: 2; }
                }
                .profile-save-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    background: #4f46e5;
                    color: white;
                    font-weight: 700;
                    font-size: 0.95rem;
                    padding: 0.75rem 1.75rem;
                    border-radius: 0.75rem;
                    transition: all 0.2s;
                }
            `}</style>
        </div>
    );
};

export default UserProfile;
