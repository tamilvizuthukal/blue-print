import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFDocument } from 'pdf-lib';
import Swal from 'sweetalert2';
import { exportPDF, saveMergedPDF, getFilteredCurriculum, getUsers } from './db';
import { Blueprint, Curriculum, User } from '../types';

/**
 * Configuration option for bulk export mode.
 * Set to 'INDIVIDUAL', 'ZIP', or 'MERGED'.
 * 'MERGED' will generate all PDFs, merge them, save them to the local Documents folder on the server, and download.
 */
export const BULK_EXPORT_MODE: 'INDIVIDUAL' | 'ZIP' | 'MERGED' = 'MERGED';

/**
 * Sanitizes a string for safe use in filenames.
 */
const sanitize = (val: string): string => {
    return val
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^a-zA-Z0-9-]/g, '') // Remove invalid filename characters
        .replace(/-+/g, '-') // No duplicate hyphens
        .replace(/^-|-$/g, ''); // Trim hyphens from starts/ends
};

/**
 * Helper to convert Blob to base64 string.
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Merges multiple PDF blobs into a single PDF blob.
 */
export const mergePdfBlobs = async (blobs: Blob[], title?: string): Promise<Blob> => {
    const mergedPdf = await PDFDocument.create();
    if (title) {
        mergedPdf.setTitle(title);
    }
    for (const blob of blobs) {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const mergedPdfBytes = await mergedPdf.save();
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
};

/**
 * Generates a standardized filename for a given blueprint and report type.
 * Standard format: <Class>-<Subject>-<Set>-<ReportType>.pdf
 */
export const createFileName = (blueprint: Blueprint, type: string): string => {
    const classVal = sanitize(String(blueprint.classLevel));
    const subjectVal = sanitize(blueprint.subject);
    
    // Normalize "SET X" or "set X" or "X" to "Set X"
    const rawSet = blueprint.setId || 'A';
    let cleanSet = rawSet.trim();
    if (/^set\s+/i.test(cleanSet)) {
        cleanSet = `Set ${cleanSet.slice(4).trim()}`;
    } else if (!/^set/i.test(cleanSet)) {
        cleanSet = `Set ${cleanSet}`;
    }
    const setVal = sanitize(cleanSet);

    const baseName = `${classVal}-${subjectVal}-${setVal}`;
    
    let typeSuffix = '';
    const normType = type.toLowerCase();
    if (normType === 'report1') {
        typeSuffix = '-Report1';
    } else if (normType === 'report2') {
        typeSuffix = '-Report2';
    } else if (normType === 'report3') {
        typeSuffix = '-Report3';
    } else if (normType === 'answerkey' || normType === 'answer_key') {
        typeSuffix = '-AnswerKey';
    } else {
        typeSuffix = `-${sanitize(type)}`;
    }

    return `${baseName}${typeSuffix}.pdf`;
};

/**
 * Helper to generate a single report PDF blob and its filename.
 */
const generateReportPDF = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    type: string,
    isAdmin: boolean
): Promise<{ blob: Blob; filename: string }> => {
    const sessionSettings = blueprint.perReportSettings || {};
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const filename = createFileName(blueprint, type);
    const title = filename.slice(0, -4); // Remove .pdf

    const blob = await exportPDF(
        blueprint.id,
        baseUrl,
        type,
        isAdmin ? 'admin' : 'user',
        sessionSettings,
        title
    );
    return { blob, filename };
};

/**
 * Generates Report 1 PDF.
 */
export const generateReport1PDF = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    isAdmin: boolean
): Promise<{ blob: Blob; filename: string }> => {
    return generateReportPDF(blueprint, curriculum, 'report1', isAdmin);
};

/**
 * Generates Report 2 PDF.
 */
export const generateReport2PDF = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    isAdmin: boolean
): Promise<{ blob: Blob; filename: string }> => {
    return generateReportPDF(blueprint, curriculum, 'report2', isAdmin);
};

/**
 * Generates Report 3 PDF.
 */
export const generateReport3PDF = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    isAdmin: boolean
): Promise<{ blob: Blob; filename: string }> => {
    return generateReportPDF(blueprint, curriculum, 'report3', isAdmin);
};

/**
 * Generates Answer Key PDF.
 */
export const generateAnswerKeyPDF = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    isAdmin: boolean
): Promise<{ blob: Blob; filename: string }> => {
    return generateReportPDF(blueprint, curriculum, 'answerkey', isAdmin);
};

/**
 * Packages multiple files into a single ZIP archive and triggers download.
 */
export const createZipPackage = async (
    files: { name: string; blob: Blob }[],
    zipFileName: string
): Promise<void> => {
    const zip = new JSZip();
    files.forEach(f => {
        zip.file(f.name, f.blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, zipFileName);
};

/**
 * Validates whether essential blueprint fields are defined.
 */
export const validateBlueprintForExport = (blueprint: Blueprint | null): { valid: boolean; error?: string } => {
    if (!blueprint) {
        return { valid: false, error: 'No blueprint selected.' };
    }
    if (!blueprint.classLevel) {
        return { valid: false, error: 'Class is not selected.' };
    }
    if (!blueprint.subject) {
        return { valid: false, error: 'Subject is not selected.' };
    }
    if (!blueprint.setId) {
        return { valid: false, error: 'Question Set is not selected.' };
    }
    return { valid: true };
};

/**
 * Generates all report PDFs sequentially, triggering downloads, ZIP packaging, or merging.
 */
export const generateAllPDFs = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    isAdmin: boolean,
    onProgress: (pct: number, text: string) => void,
    openInNewTab: boolean = false
): Promise<{ results: { type: string; success: boolean; filename?: string; error?: string; blob?: Blob }[] }> => {
    const tasks = [
        { type: 'report1', label: 'Report 1', fn: () => generateReport1PDF(blueprint, curriculum, isAdmin) },
        { type: 'report2', label: 'Report 2', fn: () => generateReport2PDF(blueprint, curriculum, isAdmin) },
        { type: 'report3', label: 'Report 3', fn: () => generateReport3PDF(blueprint, curriculum, isAdmin) },
        { type: 'answerkey', label: 'Answer Key', fn: () => generateAnswerKeyPDF(blueprint, curriculum, isAdmin) }
    ];

    const results: { type: string; success: boolean; filename?: string; error?: string; blob?: Blob }[] = [];

    // Process sequentially to prevent browser memory issues
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const progressPct = Math.round((i / tasks.length) * 100);
        onProgress(progressPct, `Generating ${task.label}...`);

        try {
            const res = await task.fn();
            results.push({
                type: task.type,
                success: true,
                filename: res.filename,
                blob: res.blob
            });
        } catch (err) {
            console.error(`Failed to generate ${task.label}:`, err);
            results.push({
                type: task.type,
                success: false,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    onProgress(100, 'Processing complete!');

    const successfulFiles = results.filter(r => r.success && r.blob && r.filename) as { filename: string; blob: Blob }[];

    if (successfulFiles.length > 0) {
        const classVal = sanitize(String(blueprint.classLevel));
        const subjectVal = sanitize(blueprint.subject);
        
        let cleanSet = (blueprint.setId || 'A').trim();
        if (/^set\s+/i.test(cleanSet)) {
            cleanSet = `Set ${cleanSet.slice(4).trim()}`;
        } else if (!/^set/i.test(cleanSet)) {
            cleanSet = `Set ${cleanSet}`;
        }
        const setVal = sanitize(cleanSet);
        
        const examName = `${blueprint.examTerm} ${blueprint.academicYear || '2026-27'}`;
        const baseName = `${classVal}-${subjectVal}-${setVal}`;

        if (BULK_EXPORT_MODE === 'MERGED') {
            onProgress(100, 'Merging PDFs...');
            try {
                const mergedBlob = await mergePdfBlobs(successfulFiles.map(f => f.blob), baseName);
                const mergedFileName = `${baseName}.pdf`;

                onProgress(100, 'Saving to Documents folder...');
                const base64Data = await blobToBase64(mergedBlob);
                await saveMergedPDF(base64Data, examName, mergedFileName);

                // Also trigger browser download or new tab
                const url = URL.createObjectURL(mergedBlob);
                if (openInNewTab) {
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                } else {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = mergedFileName;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 1000);
                }
            } catch (err) {
                console.error('Failed to merge/save PDF:', err);
                throw new Error(`Failed to merge or save consolidated PDF: ${err instanceof Error ? err.message : String(err)}`);
            }
        } else if (BULK_EXPORT_MODE === 'ZIP') {
            const zipName = `${baseName}-Reports.zip`;
            await createZipPackage(
                successfulFiles.map(f => ({ name: f.filename, blob: f.blob })),
                zipName
            );
        } else {
            // Download individually
            successfulFiles.forEach(f => {
                const url = URL.createObjectURL(f.blob);
                if (openInNewTab) {
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                } else {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = f.filename;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 1000);
                }
            });
        }
    }

    return { results };
};

/**
 * Orchestrates validation, modal loading state, PDF rendering, merging, saving, and downloading.
 */
export const runBulkExportAndMerge = async (
    blueprint: Blueprint,
    curriculum: Curriculum,
    isAdmin: boolean,
    openInNewTab: boolean = false
): Promise<void> => {
    const valRes = validateBlueprintForExport(blueprint);
    if (!valRes.valid) {
        Swal.fire({
            title: 'Validation Error',
            text: valRes.error || 'Required details are missing.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    Swal.fire({
        title: 'Exporting All PDFs…',
        html: `
            <div class="flex flex-col items-center gap-4 py-4">
                <div class="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden border">
                    <div id="bulk-pdf-progress-bar" class="bg-red-600 h-full transition-all duration-300 ease-out" style="width: 0%"></div>
                </div>
                <div class="text-center font-bold text-lg mb-2" id="bulk-pdf-pct">0%</div>
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 w-full text-left font-mono text-xs max-h-48 overflow-y-auto space-y-1" id="bulk-pdf-logs">
                </div>
                <p id="bulk-pdf-status-text" class="text-gray-500 font-medium text-xs mt-2 italic">Initializing export process...</p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const updateBulkProgress = (pct: number, statusText: string) => {
        const bar = document.getElementById('bulk-pdf-progress-bar');
        const pctText = document.getElementById('bulk-pdf-pct');
        const status = document.getElementById('bulk-pdf-status-text');
        const logs = document.getElementById('bulk-pdf-logs');

        if (bar) bar.style.width = `${pct}%`;
        if (pctText) pctText.innerText = `${pct}%`;
        if (status) status.innerText = statusText;

        if (logs && (statusText.startsWith('Generating') || statusText.startsWith('Merging') || statusText.startsWith('Saving'))) {
            const logItem = document.createElement('div');
            logItem.className = 'text-gray-500 flex items-center gap-1.5';
            logItem.innerHTML = `<span>⏳</span><span>${statusText}</span>`;
            logs.appendChild(logItem);
            logs.scrollTop = logs.scrollHeight;
        }
    };

    try {
        const { results } = await generateAllPDFs(blueprint, curriculum, isAdmin, updateBulkProgress, openInNewTab);

        const logs = document.getElementById('bulk-pdf-logs');
        if (logs) {
            logs.innerHTML = '';
            results.forEach(r => {
                const label = r.type === 'report1' ? 'Report 1' : r.type === 'report2' ? 'Report 2' : r.type === 'report3' ? 'Report 3' : 'Answer Key';
                const item = document.createElement('div');
                if (r.success) {
                    item.className = 'text-green-600 font-bold flex items-center gap-1.5';
                    item.innerHTML = `<span>✓</span><span>${label} generated</span>`;
                } else {
                    item.className = 'text-red-600 font-bold flex items-center gap-1.5';
                    item.innerHTML = `<span>✗</span><span>${label} failed: ${r.error}</span>`;
                }
                logs.appendChild(item);
            });
            const failed = results.filter(r => !r.success);
            if (failed.length === 0) {
                const mergeItem = document.createElement('div');
                mergeItem.className = 'text-green-600 font-bold flex items-center gap-1.5';
                mergeItem.innerHTML = `<span>✓</span><span>Merged & Saved to Documents successfully</span>`;
                logs.appendChild(mergeItem);
            }
        }

        setTimeout(() => {
            Swal.close();

            const failed = results.filter(r => !r.success);
            const succeeded = results.filter(r => r.success);
            const classVal = String(blueprint.classLevel);
            const subjectVal = blueprint.subject;
            let cleanSet = (blueprint.setId || 'A').trim();
            if (/^set\s+/i.test(cleanSet)) {
                cleanSet = `Set ${cleanSet.slice(4).trim()}`;
            } else if (!/^set/i.test(cleanSet)) {
                cleanSet = `Set ${cleanSet}`;
            }
            const folderName = `${blueprint.examTerm} ${blueprint.academicYear || '2026-27'}`;
            const fileName = `${classVal}-${subjectVal}-${cleanSet}.pdf`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '').replace(/-+/g, '-');

            if (failed.length === 0) {
                Swal.fire({
                    title: 'Export Success',
                    html: `
                        <div class="text-left space-y-2 py-2">
                            <div class="text-green-600 font-bold flex items-center gap-2">✓ <span>All reports merged & saved successfully!</span></div>
                            <div class="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded border font-mono break-all">
                                Saved to: Documents/${folderName}/${fileName}
                            </div>
                        </div>
                    `,
                    icon: 'success',
                    confirmButtonColor: '#2563eb'
                });
            } else {
                const listHtml = results.map(r => {
                    const label = r.type === 'report1' ? 'Report 1' : r.type === 'report2' ? 'Report 2' : r.type === 'report3' ? 'Report 3' : 'Answer Key';
                    return r.success 
                        ? `<div class="text-green-600 font-bold flex items-center gap-2">✓ <span>${label} generated</span></div>`
                        : `<div class="text-red-600 font-bold flex items-center gap-2">✗ <span>${label} failed:</span> <span class="text-xs font-normal text-gray-500">${r.error}</span></div>`;
                }).join('');

                Swal.fire({
                    title: succeeded.length > 0 ? 'Export Completed with Errors' : 'Export Failed',
                    html: `<div class="text-left space-y-2 py-2">${listHtml}</div>`,
                    icon: succeeded.length > 0 ? 'warning' : 'error',
                    confirmButtonColor: '#2563eb'
                });
            }
        }, 800);

    } catch (error) {
        console.error('Bulk export failed:', error);
        Swal.close();
        Swal.fire({
            title: 'Export Failed',
            text: error instanceof Error ? error.message : 'An unexpected error occurred during bulk export.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
};

/**
 * Processes bulk exam export: loads all confirmed blueprints/answers keys for the selected exam,
 * renders all 4 reports for each, structures them into zip folders Exam -> Set -> Class -> Subject,
 * generates an Export-Summary.txt with stats and logs, and triggers a single ZIP download.
 */
export const runBulkExamExport = async (
    selectedFilter: string,
    blueprints: Blueprint[]
): Promise<void> => {
    // 1. Validation
    if (!selectedFilter || selectedFilter === 'all') {
        Swal.fire({
            title: 'Validation Error',
            text: 'Please select a specific Exam from the dropdown.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const [term, year] = selectedFilter.split('|');
    const examName = `${term} ${year}`;

    // Filter blueprints for the selected exam
    const examBlueprints = blueprints.filter(bp => {
        const bpYear = bp.academicYear || '2026-27'; // fallback consistent with getCurrentAcademicYear
        return bp.examTerm === term && bpYear === year;
    });

    // Only include confirmed blueprints and confirmed answer keys
    const eligibleBlueprints = examBlueprints.filter(bp => bp.isConfirmed && bp.isAnswerKeyConfirmed);

    if (eligibleBlueprints.length === 0) {
        Swal.fire({
            title: 'Export Validation',
            text: 'No eligible confirmed blueprint and answer key records found.',
            icon: 'warning',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    // Sort by Set, then by Class, then by Subject
    const sortedEligible = [...eligibleBlueprints].sort((a, b) => {
        const setA = (a.setId || 'A').trim().toUpperCase();
        const setB = (b.setId || 'A').trim().toUpperCase();
        const setCompare = setA.localeCompare(setB);
        if (setCompare !== 0) return setCompare;

        const classA = a.classLevel === 'SSLC' ? 11 : parseInt(String(a.classLevel)) || 0;
        const classB = b.classLevel === 'SSLC' ? 11 : parseInt(String(b.classLevel)) || 0;
        if (classA !== classB) return classA - classB;

        return a.subject.localeCompare(b.subject);
    });

    Swal.fire({
        title: 'Initializing Bulk Exam Export…',
        text: 'Fetching database records...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    let allCurriculums: Curriculum[] = [];
    let allUsers: User[] = [];

    try {
        const [curs, usersList] = await Promise.all([
            getFilteredCurriculum(),
            getUsers()
        ]);
        allCurriculums = curs;
        allUsers = usersList;
    } catch (err) {
        console.error('Failed to pre-fetch curriculums and users:', err);
        Swal.fire('Export Failed', 'Failed to load curriculum configurations or user details from database.', 'error');
        return;
    }

    Swal.fire({
        title: 'Generating Exam PDFs...',
        html: `
            <div class="flex flex-col items-center gap-4 py-4">
                <div class="text-left w-full text-sm font-semibold text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                    <div>Status:</div>
                    <div id="bulk-curr-set" class="font-black text-purple-700 text-xs">Set: Initializing...</div>
                    <div id="bulk-curr-class" class="font-black text-blue-700 text-xs">Class: -</div>
                    <div id="bulk-curr-subject" class="font-bold text-gray-900 text-xs">Subject: -</div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden border">
                    <div id="bulk-progress-bar" class="bg-emerald-600 h-full transition-all duration-300 ease-out" style="width: 0%"></div>
                </div>
                <div class="text-center font-bold text-sm mb-2 text-gray-500" id="bulk-progress-status">0 / 0 Completed</div>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const updateProgress = (completed: number, total: number, set: string, cls: string, subject: string) => {
        const bar = document.getElementById('bulk-progress-bar');
        const status = document.getElementById('bulk-progress-status');
        const currSet = document.getElementById('bulk-curr-set');
        const currClass = document.getElementById('bulk-curr-class');
        const currSub = document.getElementById('bulk-curr-subject');

        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (bar) bar.style.width = `${pct}%`;
        if (status) status.innerText = `${completed} / ${total} Completed`;
        if (currSet) currSet.innerText = `Set: ${set}`;
        if (currClass) currClass.innerText = `Class: ${cls}`;
        if (currSub) currSub.innerText = `Subject: ${subject}`;
    };

    const totalFiles = sortedEligible.length * 4;
    let completedCount = 0;
    const startMs = Date.now();
    const startTime = new Date();

    const filesToZip: { path: string; blob: Blob }[] = [];
    const logs: string[] = [];

    let countReport1 = 0;
    let countReport2 = 0;
    let countReport3 = 0;
    let countAnswerKey = 0;

    for (const bp of sortedEligible) {
        const setLabel = (bp.setId || 'A').trim();
        let cleanSet = setLabel;
        if (/^set\s+/i.test(cleanSet)) {
            cleanSet = `Set ${cleanSet.slice(4).trim()}`;
        } else if (!/^set/i.test(cleanSet)) {
            cleanSet = `Set ${cleanSet}`;
        }
        const setFolder = sanitize(cleanSet);
        const classFolder = `Class-${bp.classLevel}`;
        const subjectFolder = sanitize(bp.subject);
        
        const teacher = allUsers.find(u => u.id === bp.ownerId);
        const teacherName = teacher ? teacher.name : 'Unknown';

        const cur = allCurriculums.find(c => c.classLevel === bp.classLevel && c.subject === bp.subject);

        const currentRecordLog = `Teacher: ${teacherName}\nClass: ${bp.classLevel}\nSubject: ${bp.subject}\nType: ${bp.questionPaperTypeName}\nSet: ${setLabel}\nBlueprint: Confirmed\nAnswer Key: Confirmed`;

        if (!cur) {
            completedCount += 4;
            logs.push(`${currentRecordLog}\nGenerated: FAILED\nReason: Curriculum configuration missing\n------------------------------------------------`);
            continue;
        }

        const reportTasks = [
            { type: 'report1', label: 'Report 1', fileName: 'Report1.pdf', countInc: () => countReport1++ },
            { type: 'report2', label: 'Report 2', fileName: 'Report2.pdf', countInc: () => countReport2++ },
            { type: 'report3', label: 'Report 3', fileName: 'Report3.pdf', countInc: () => countReport3++ },
            { type: 'answerkey', label: 'Answer Key', fileName: 'AnswerKey.pdf', countInc: () => countAnswerKey++ }
        ];

        let failedReason = '';

        for (const task of reportTasks) {
            updateProgress(completedCount, totalFiles, cleanSet, `Class ${bp.classLevel}`, bp.subject);
            
            try {
                const { blob } = await generateReportPDF(bp, cur, task.type, true);
                
                filesToZip.push({
                    path: `${setFolder}/${classFolder}/${subjectFolder}/${task.fileName}`,
                    blob
                });

                task.countInc();
            } catch (err) {
                console.error(`Failed to generate ${task.label} for ${bp.id}:`, err);
                failedReason += `${task.label} failed: ${err instanceof Error ? err.message : String(err)}; `;
            }
            
            completedCount++;
        }

        if (failedReason) {
            logs.push(`${currentRecordLog}\nGenerated: FAILED\nReason: ${failedReason}\n------------------------------------------------`);
        } else {
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            logs.push(`${currentRecordLog}\nGenerated: ${timestamp}\n------------------------------------------------`);
        }

        // Delay to allow GC to clean memory and prevent browser freeze
        await new Promise(r => setTimeout(r, 200));
    }

    const endMs = Date.now();
    const endTime = new Date();
    const durationSeconds = Math.round((endMs - startMs) / 1000);
    const durationMinutes = Math.round(durationSeconds / 60);

    const uniqueTeachers = new Set(sortedEligible.map(bp => bp.ownerId)).size;
    const uniqueClasses = new Set(sortedEligible.map(bp => String(bp.classLevel))).size;
    const uniqueSubjects = new Set(sortedEligible.map(bp => bp.subject)).size;
    const uniqueSets = new Set(sortedEligible.map(bp => (bp.setId || 'A').trim().toUpperCase())).size;

    const totalPDFs = countReport1 + countReport2 + countReport3 + countAnswerKey;

    const formatTime12h = (date: Date) => {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    let summaryText = `Exam: ${examName}

Teachers: ${uniqueTeachers}
Classes: ${uniqueClasses}
Subjects: ${uniqueSubjects}
Sets: ${uniqueSets}

Report1: ${countReport1}
Report2: ${countReport2}
Report3: ${countReport3}
AnswerKey: ${countAnswerKey}

Total PDFs: ${totalPDFs}

Started: ${formatTime12h(startTime)}
Completed: ${formatTime12h(endTime)}
Duration: ${durationMinutes > 0 ? `${durationMinutes} Minutes` : `${durationSeconds} Seconds`}

================================================
DETAILED RECORD LOG
================================================

`;

    summaryText += logs.join('\n\n');

    Swal.fire({
        title: 'Packaging Exam ZIP...',
        text: 'Structuring directories...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const zip = new JSZip();
        const examSlug = examName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        
        zip.file(`${examSlug}/Export-Summary.txt`, summaryText);

        filesToZip.forEach(f => {
            zip.file(`${examSlug}/${f.path}`, f.blob);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${examSlug}.zip`);

        Swal.fire({
            title: 'Bulk Export Completed!',
            text: `Successfully generated ${totalPDFs} PDFs in ${examSlug}.zip. Check Export-Summary.txt for details.`,
            icon: 'success',
            confirmButtonColor: '#2563eb'
        });
    } catch (err) {
        console.error('Packaging ZIP failed:', err);
        Swal.fire('ZIP Packaging Failed', 'An error occurred while compiling the final ZIP file.', 'error');
    }
};

/**
 * Processes bulk exam export and merges all generated PDFs into a single file:
 * loads all confirmed blueprints/answers keys for the selected exam,
 * renders all 4 reports for each, merges them into a single PDF,
 * saves it on the server and downloads it.
 */
export const runBulkExamExportAndMerge = async (
    selectedFilter: string,
    blueprints: Blueprint[]
): Promise<void> => {
    // 1. Validation
    if (!selectedFilter || selectedFilter === 'all') {
        Swal.fire({
            title: 'Validation Error',
            text: 'Please select a specific Exam from the dropdown.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const [term, year] = selectedFilter.split('|');
    const examName = `${term} ${year}`;

    // Filter blueprints for the selected exam
    const examBlueprints = blueprints.filter(bp => {
        const bpYear = bp.academicYear || '2026-27'; // fallback consistent with getCurrentAcademicYear
        return bp.examTerm === term && bpYear === year;
    });

    // Only include confirmed blueprints and confirmed answer keys
    const eligibleBlueprints = examBlueprints.filter(bp => bp.isConfirmed && bp.isAnswerKeyConfirmed);

    if (eligibleBlueprints.length === 0) {
        Swal.fire({
            title: 'Export Validation',
            text: 'No eligible confirmed blueprint and answer key records found.',
            icon: 'warning',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    // Sort by Set, then by Class, then by Subject
    const sortedEligible = [...eligibleBlueprints].sort((a, b) => {
        const setA = (a.setId || 'A').trim().toUpperCase();
        const setB = (b.setId || 'A').trim().toUpperCase();
        const setCompare = setA.localeCompare(setB);
        if (setCompare !== 0) return setCompare;

        const classA = a.classLevel === 'SSLC' ? 11 : parseInt(String(a.classLevel)) || 0;
        const classB = b.classLevel === 'SSLC' ? 11 : parseInt(String(b.classLevel)) || 0;
        if (classA !== classB) return classA - classB;

        return a.subject.localeCompare(b.subject);
    });

    Swal.fire({
        title: 'Initializing Bulk Print Merge…',
        text: 'Fetching database records...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    let allCurriculums: Curriculum[] = [];
    let allUsers: User[] = [];

    try {
        const [curs, usersList] = await Promise.all([
            getFilteredCurriculum(),
            getUsers()
        ]);
        allCurriculums = curs;
        allUsers = usersList;
    } catch (err) {
        console.error('Failed to pre-fetch curriculums and users:', err);
        Swal.fire('Export Failed', 'Failed to load curriculum configurations or user details from database.', 'error');
        return;
    }

    Swal.fire({
        title: 'Generating Exam PDFs...',
        html: `
            <div class="flex flex-col items-center gap-4 py-4">
                <div class="text-left w-full text-sm font-semibold text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                    <div>Status:</div>
                    <div id="bulk-curr-set" class="font-black text-purple-700 text-xs">Set: Initializing...</div>
                    <div id="bulk-curr-class" class="font-black text-blue-700 text-xs">Class: -</div>
                    <div id="bulk-curr-subject" class="font-bold text-gray-900 text-xs">Subject: -</div>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden border">
                    <div id="bulk-progress-bar" class="bg-emerald-600 h-full transition-all duration-300 ease-out" style="width: 0%"></div>
                </div>
                <div class="text-center font-bold text-sm mb-2 text-gray-500" id="bulk-progress-status">0 / 0 Completed</div>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    const updateProgress = (completed: number, total: number, set: string, cls: string, subject: string) => {
        const bar = document.getElementById('bulk-progress-bar');
        const status = document.getElementById('bulk-progress-status');
        const currSet = document.getElementById('bulk-curr-set');
        const currClass = document.getElementById('bulk-curr-class');
        const currSub = document.getElementById('bulk-curr-subject');

        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (bar) bar.style.width = `${pct}%`;
        if (status) status.innerText = `${completed} / ${total} Completed`;
        if (currSet) currSet.innerText = `Set: ${set}`;
        if (currClass) currClass.innerText = `Class: ${cls}`;
        if (currSub) currSub.innerText = `Subject: ${subject}`;
    };

    const totalFiles = sortedEligible.length * 4;
    let completedCount = 0;

    const pdfBlobs: Blob[] = [];
    const logs: string[] = [];

    let countReport1 = 0;
    let countReport2 = 0;
    let countReport3 = 0;
    let countAnswerKey = 0;

    for (const bp of sortedEligible) {
        const setLabel = (bp.setId || 'A').trim();
        let cleanSet = setLabel;
        if (/^set\s+/i.test(cleanSet)) {
            cleanSet = `Set ${cleanSet.slice(4).trim()}`;
        } else if (!/^set/i.test(cleanSet)) {
            cleanSet = `Set ${cleanSet}`;
        }
        
        const teacher = allUsers.find(u => u.id === bp.ownerId);
        const teacherName = teacher ? teacher.name : 'Unknown';

        const cur = allCurriculums.find(c => c.classLevel === bp.classLevel && c.subject === bp.subject);

        const currentRecordLog = `Teacher: ${teacherName}\nClass: ${bp.classLevel}\nSubject: ${bp.subject}\nType: ${bp.questionPaperTypeName}\nSet: ${setLabel}\nBlueprint: Confirmed\nAnswer Key: Confirmed`;

        if (!cur) {
            completedCount += 4;
            logs.push(`${currentRecordLog}\nGenerated: FAILED\nReason: Curriculum configuration missing\n------------------------------------------------`);
            continue;
        }

        const reportTasks = [
            { type: 'report1', label: 'Report 1', countInc: () => countReport1++ },
            { type: 'report2', label: 'Report 2', countInc: () => countReport2++ },
            { type: 'report3', label: 'Report 3', countInc: () => countReport3++ },
            { type: 'answerkey', label: 'Answer Key', countInc: () => countAnswerKey++ }
        ];

        let failedReason = '';

        for (const task of reportTasks) {
            updateProgress(completedCount, totalFiles, cleanSet, `Class ${bp.classLevel}`, bp.subject);
            
            try {
                const { blob } = await generateReportPDF(bp, cur, task.type, true);
                
                pdfBlobs.push(blob);
                task.countInc();
            } catch (err) {
                console.error(`Failed to generate ${task.label} for ${bp.id}:`, err);
                failedReason += `${task.label} failed: ${err instanceof Error ? err.message : String(err)}; `;
            }
            
            completedCount++;
        }

        if (failedReason) {
            logs.push(`${currentRecordLog}\nGenerated: FAILED\nReason: ${failedReason}\n------------------------------------------------`);
        } else {
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            logs.push(`${currentRecordLog}\nGenerated: ${timestamp}\n------------------------------------------------`);
        }

        // Delay to allow GC to clean memory and prevent browser freeze
        await new Promise(r => setTimeout(r, 200));
    }

    if (pdfBlobs.length === 0) {
        Swal.fire({
            title: 'Export Failed',
            text: 'No PDFs were successfully generated to merge.',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    Swal.fire({
        title: 'Merging PDFs...',
        text: `Merging ${pdfBlobs.length} generated documents into a single PDF. Please wait...`,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const examSlug = examName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const mergedFileName = `${examSlug}-Merged.pdf`;

        const mergedBlob = await mergePdfBlobs(pdfBlobs, `${examName} Consolidated`);

        Swal.fire({
            title: 'Saving Merged PDF...',
            text: 'Writing file to server...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const base64Data = await blobToBase64(mergedBlob);
        await saveMergedPDF(base64Data, examName, mergedFileName);

        // Also trigger browser download
        const url = URL.createObjectURL(mergedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = mergedFileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);

        Swal.fire({
            title: 'Bulk Print Merge Completed!',
            text: `Successfully generated and merged ${pdfBlobs.length} PDFs into ${mergedFileName}.`,
            icon: 'success',
            confirmButtonColor: '#2563eb'
        });
    } catch (err) {
        console.error('Merging/Saving failed:', err);
        Swal.fire('Merging Failed', 'An error occurred while merging or saving the final PDF.', 'error');
    }
};
