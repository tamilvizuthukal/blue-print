
import Swal from 'sweetalert2';
import { DocExportService } from '../services/docExport';
import { exportPDF } from '../services/db';
import { Blueprint, Curriculum, Discourse, ReportSettings } from '../types';
export const useExport = () => {
    const handleDownloadPDF = async (currentBlueprint: Blueprint | null, curriculum: Curriculum | null, type: string = 'all', isAdmin: boolean = false) => {
        if (!currentBlueprint || !curriculum) return;
        
        // Extract settings for the specific tab
        const perReport: Partial<ReportSettings> = currentBlueprint.perReportSettings?.[type] || {};
        const globalSettings: Partial<ReportSettings> = currentBlueprint.reportSettings || {};
        const paperSize = perReport.paperSize || globalSettings.paperSize || 'A4';
        const isLandscapeDefault = (type === 'report2' || type === 'report3');
        const orientation = perReport.orientation || globalSettings.orientation || (isLandscapeDefault ? 'l' : 'p');
        const orientLabel = orientation === 'l' ? 'Landscape' : 'Portrait';

        Swal.fire({
            title: 'Generating PDF...',
            html: `
                <div class="flex flex-col items-center gap-4 py-4">
                    <div class="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
                        <div id="pdf-progress-bar" class="bg-blue-600 h-full transition-all duration-500 ease-out" style="width: 10%"></div>
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
                    <p id="pdf-status-text" class="text-gray-500 font-medium text-xs mt-2 italic">Initializing server connection...</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const updateProgress = (pct: number, text: string) => {
            const bar = document.getElementById('pdf-progress-bar');
            const status = document.getElementById('pdf-status-text');
            if (bar) bar.style.width = `${pct}%`;
            if (status) status.innerText = text;
        };

        try {
            const baseUrl = window.location.origin;
            const mode = isAdmin ? 'admin' : 'user';
            
            updateProgress(30, 'Analyzing blueprint and applying settings...');
            await new Promise(r => setTimeout(r, 800));
            
            updateProgress(60, 'Rendering document with Puppeteer...');
            const pdfBlob = await exportPDF(currentBlueprint.id, baseUrl, type, mode, currentBlueprint.perReportSettings);
            
            const fileSizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
            updateProgress(90, `Finalizing PDF stream (${fileSizeMB} MB)...`);
            await new Promise(r => setTimeout(r, 500));
            
            const url = window.URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');
            
            updateProgress(100, 'Done!');
            
            // Note: We don't immediately revoke the URL so the new tab has time to load it.
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 60000);

            Swal.close();
        } catch (error) {
            console.error("PDF generation failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            Swal.fire("Error", `Failed to generate PDF document. ${errorMessage}`, "error");
        }
    };

    const handleDownloadWord = async (currentBlueprint: Blueprint | null, curriculum: Curriculum | null, discourses: Discourse[], type: string = 'all') => {
        if (!currentBlueprint || !curriculum) return;
        try {
            if (type === 'answerKey' || type === 'all') await DocExportService.exportAnswerKey(currentBlueprint, curriculum, discourses);
        } catch (error) {
            console.error("Word export failed:", error);
            Swal.fire("Error", "Failed to export Word document.", "error");
        }
    };

    return {
        handleDownloadPDF,
        handleDownloadWord
    };
};
