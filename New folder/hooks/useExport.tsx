import Swal from 'sweetalert2';
import { exportPDF as serverExportPDF } from '../services/db';
import { DocExportService } from '../services/docExport';
import { Blueprint, Curriculum, Discourse } from '../types';

/**
 * useExport hook
 *
 * PDF export uses the server-side Puppeteer engine (/api/export/pdf),
 * which navigates to /print-view/:id and renders the report in a real browser
 * context — avoiding html2canvas / oklch color incompatibility issues.
 *
 * The server reads per-tab and global settings from the blueprint document
 * (stored in perReportSettings / reportSettings), so all font, paper-size,
 * and orientation preferences are honoured automatically.
 */
export const useExport = () => {
    const handleDownloadPDF = async (
        currentBlueprint: Blueprint | null,
        curriculum: Curriculum | null,
        type: string = 'all',
        isAdmin: boolean = false
    ) => {
        if (!currentBlueprint || !curriculum) return;

        // Derive display labels for the progress dialog
        const perReport: any = currentBlueprint.perReportSettings?.[type] || {};
        const globalSettings: any = currentBlueprint.reportSettings || {};
        const paperSize = perReport.paperSize || globalSettings.paperSize || 'A4';
        const isLandscapeDefault = (type === 'report2' || type === 'report3');
        const orientation = perReport.orientation || globalSettings.orientation || (isLandscapeDefault ? 'l' : 'p');
        const orientLabel = orientation === 'l' ? 'Landscape' : 'Portrait';

        Swal.fire({
            title: 'Generating PDF…',
            html: `
                <div class="flex flex-col items-center gap-4 py-4">
                    <div class="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                        <div id="pdf-progress-bar" class="bg-red-600 h-full transition-all duration-500 ease-out" style="width: 10%"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 w-full text-sm">
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p class="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-1">Paper Size</p>
                            <p class="text-gray-900 font-black">${paperSize}</p>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p class="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-1">Orientation</p>
                            <p class="text-gray-900 font-black">${orientLabel}</p>
                        </div>
                    </div>
                    <p id="pdf-status-text" class="text-gray-500 font-medium text-xs mt-2 italic">Connecting to PDF server…</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const updateProgress = (pct: number, text: string) => {
            const bar = document.getElementById('pdf-progress-bar');
            const status = document.getElementById('pdf-status-text');
            if (bar) bar.style.width = `${pct}%`;
            if (status) status.innerText = text;
        };

        try {
            updateProgress(30, 'Sending request to Puppeteer render engine…');

            // Base URL of the frontend (used by the server so Puppeteer can navigate to the print view)
            const baseUrl = `${window.location.protocol}//${window.location.host}`;

            // Pass the full per-report settings map so the server can forward it to localStorage
            // in the headless browser before rendering.
            const sessionSettings = currentBlueprint.perReportSettings || {};

            updateProgress(55, 'Rendering report in headless browser…');

            const blob = await serverExportPDF(
                currentBlueprint.id,
                baseUrl,
                type,
                isAdmin ? 'admin' : 'user',
                sessionSettings
            );

            updateProgress(90, 'Preparing download…');

            // Build a sensible filename
            const className = currentBlueprint.classLevel === 'SSLC'
                ? '11_SSLC'
                : `Class_${currentBlueprint.classLevel}`;
            const subjectName = currentBlueprint.subject.replace(/\s+/g, '_');
            const examTerm = currentBlueprint.examTerm.replace(/\s+/g, '_');
            const tabLabel = type.replace(/\s+/g, '_');
            const filename = `${className}_${subjectName}_${examTerm}_${tabLabel}.pdf`;

            // Open in new tab
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000);

            updateProgress(100, 'Download complete!');
            setTimeout(() => Swal.close(), 800);

        } catch (error) {
            console.error('Server PDF generation failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Swal.fire(
                'PDF Export Failed',
                `The server-side PDF engine returned an error:\n\n${errorMessage}`,
                'error'
            );
        }
    };

    const handleDownloadWord = async (
        currentBlueprint: Blueprint | null,
        curriculum: Curriculum | null,
        discourses: Discourse[],
        type: string = 'all'
    ) => {
        if (!currentBlueprint || !curriculum) return;
        try {
            if (type === 'answerKey' || type === 'all') {
                await DocExportService.exportAnswerKey(currentBlueprint, curriculum, discourses);
            }
        } catch (error) {
            console.error('Word export failed:', error);
            Swal.fire('Error', 'Failed to export Word document.', 'error');
        }
    };

    return { handleDownloadPDF, handleDownloadWord };
};
