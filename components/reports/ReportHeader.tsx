import React from 'react';
import { Blueprint } from '../../types';

interface ReportHeaderProps {
  blueprint: Blueprint;
  sectionTitle: string;
  orientation?: 'portrait' | 'landscape';
}

const getRomanClass = (cls: string | number): string => {
  const c = String(cls).toUpperCase();
  if (c === '8' || c === '_8') return 'VIII';
  if (c === '9' || c === '_9') return 'IX';
  if (c === '10' || c === '_10' || c === 'SSLC' || c === '_SSLC') return 'X';
  return c;
};

export const ReportHeader: React.FC<ReportHeaderProps> = ({ blueprint, sectionTitle }) => {
  const isAT = blueprint.subject.includes('AT');
  const subjectEnglish = isAT ? "First Language Paper I" : "First Language Paper II";
  const subjectCode = isAT ? "AT" : "BT";

  // Question Paper code - T prefix
  const codeMap: Record<string, string> = {
    '8-AT': '802',  '8-BT': '812',
    '9-AT': '902',  '9-BT': '912',
    '10-AT': '1002', '10-BT': '1012'
  };
  const baseCode = codeMap[`${blueprint.classLevel}-${subjectCode}`] || `${blueprint.classLevel}${isAT ? '02' : '12'}`;
  const paperCode = `T${baseCode}`;
  
  const setLetter = (blueprint.setId || 'A').replace(/SET\s+/i, '').trim().charAt(0).toUpperCase();
  
  const classVal = getRomanClass(blueprint.classLevel);
  const termVal = blueprint.examTerm || 'First Term Summative';
  const yearVal = blueprint.academicYear || '2026 - 27';
  const timeVal = blueprint.totalMarks <= 40 ? "1.30 Hrs" : "2.30 Hrs";
  const scoreVal = blueprint.totalMarks;

  const isReport1 = sectionTitle.includes("QUESTION PAPER DESIGN") || sectionTitle.includes("PART – III");
  const isReport2 = sectionTitle.includes("ITEM-WISE ANALYSIS");
  const isReport3 = sectionTitle.includes("UNIT WISE ANALYSIS") || sectionTitle.includes("BLUEPRINT MATRIX") || sectionTitle.includes("CONTENT AREA ANALYSIS");

  return (
    <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: '20px', color: '#000', fontFamily: "'Times New Roman', Times, serif" }} className="no-print-header-color">
      
      {/* Horizontal top line */}
      <div style={{ borderTop: '1.5px solid #000', margin: '0 0 8px 0' }} />

      {/* Centered Main Title - Report 1 */}
      {isReport1 && (
        <>
          <div style={{ textAlign: 'center', color: '#000', fontSize: '15pt', fontWeight: 'bold', margin: '8px 0' }}>
            Question Paper Analysis Report 1
          </div>
          {/* Horizontal line under main title */}
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
        </>
      )}

      {/* Centered Main Title - Report 2 & 3 */}
      {(isReport2 || isReport3) && (
        <>
          <div style={{ textAlign: 'center', color: '#000', fontSize: '15pt', fontWeight: 'bold', margin: '8px 0 2px 0' }}>
            Proforma for Analysing Question Paper
          </div>
          <div style={{ textAlign: 'center', color: '#000', fontSize: '10pt', fontWeight: 'bold', margin: '2px 0 8px 0' }}>
            {isReport3 ? 'Proforma for Unit Analysis' : 'Item/Question-wise Analysis'}
          </div>
          {/* Horizontal line under main title */}
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
        </>
      )}

      <div style={{ textAlign: 'center', color: '#000', fontSize: '11pt', fontWeight: 'bold', margin: '8px 0' }}>
        Part – I : General Information
      </div>
      <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />

      {/* General Information Grid - (Replaces table to be border-free) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 30px',
        fontSize: '11pt',
        margin: '10px 0',
        fontFamily: "'Times New Roman', Times, serif"
      }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '100px', flexShrink: 0 }}>Class</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{classVal}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '120px', flexShrink: 0 }}>Subject</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{subjectEnglish}</span>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '100px', flexShrink: 0 }}>Term</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{termVal}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '120px', flexShrink: 0 }}>Year</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{yearVal}</span>
        </div>

        {/* Row 3 */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '100px', flexShrink: 0 }}>Time Allotted</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{timeVal}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '120px', flexShrink: 0 }}>Max. Score</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{scoreVal}</span>
        </div>

        {/* Row 4 */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '100px', flexShrink: 0 }}>Set</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{setLetter}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '120px', flexShrink: 0 }}>Type</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>1</span>
        </div>

        {/* Row 5 */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '100px', flexShrink: 0 }}>Paper Code</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span>{paperCode}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 'bold', width: '120px', flexShrink: 0 }}>Sections, if any</span>
          <span style={{ width: '15px', flexShrink: 0 }}>:</span>
          <span></span>
        </div>
      </div>

      {/* Horizontal line and subtitles - ONLY for Report 1 */}
      {isReport1 && (
        <>
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
          <div style={{ textAlign: 'center', color: '#000', fontSize: '13pt', fontWeight: 'bold', margin: '8px 0' }}>
            Question Paper Design
          </div>
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
        </>
      )}
      {isReport2 && (
        <>
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
          <div style={{ textAlign: 'center', color: '#000', fontSize: '12pt', fontWeight: 'bold', margin: '8px 0' }}>
            Part – II : Item-wise Analysis
          </div>
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
        </>
      )}
      {isReport3 && (
        <>
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
          <div style={{ textAlign: 'center', color: '#000', fontSize: '12pt', fontWeight: 'bold', margin: '8px 0' }}>
            Part – II : Unit Wise Analysis
          </div>
          <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }} />
        </>
      )}

    </div>
  );
};
