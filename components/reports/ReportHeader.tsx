import React from 'react';
import { Blueprint } from '../../types';
import { getTermTamilMap } from '../../utils/reportCalculations';

interface ReportHeaderProps {
  blueprint: Blueprint;           // from ../types
  sectionTitle: string;           // e.g. "ANSWER KEY & SCORING INDICATORS"
  orientation?: 'portrait' | 'landscape';  // default 'portrait'
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({ blueprint, sectionTitle }) => {
  const termMap = getTermTamilMap();
  const examTitle = termMap[blueprint.examTerm]
    ? `${termMap[blueprint.examTerm]} ${blueprint.academicYear || ''}`
    : `${blueprint.examTerm} ${blueprint.academicYear || ''}`;

  // Mapping subject details from subject string (e.g. "Tamil AT")
  const isAT = blueprint.subject.includes('AT');
  const subjectEnglish = isAT ? "First Language Paper I" : "First Language Paper II";
  const subjectTamil = isAT ? "தமிழ் முதல் தாள்" : "தமிழ் இரண்டாம் தாள்";
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

  return (
    <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid', marginBottom: '20px', color: '#000' }}>

      {/* ── Row 1: Set | சமக்ர சிக்ஷா கேரளம் title | PaperCode ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', gap: '8px' }}>

        {/* Left: Set box */}
        <div style={{
          border: '1.5px solid #000',
          minWidth: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16pt',
          fontWeight: 'bold',
          fontFamily: "'Times New Roman', serif",
          flexShrink: 0,
        }}>
          {setLetter}
        </div>

        {/* Center: Title block (all 4 lines centered) */}
        <div style={{ flex: 1, textAlign: 'center', lineHeight: '1.5' }}>
          <div style={{ fontFamily: "'TAU-Paalai', 'Latha', serif", fontSize: '15pt', fontWeight: 'bold' }}>
            சமக்ர சிக்ஷா கேரளம்
          </div>
          <div style={{ fontFamily: "'TAU-Paalai', 'Latha', serif", fontSize: '12pt' }}>
            {examTitle}
          </div>
          <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '11pt', fontWeight: 'bold' }}>
            {subjectEnglish}
          </div>
          <div style={{ fontFamily: "'TAU-Paalai', 'Latha', serif", fontSize: '11pt' }}>
            {subjectTamil} ({subjectCode})
          </div>
        </div>

        {/* Right: Paper Code box */}
        <div style={{
          border: '1.5px solid #000',
          minWidth: '70px',
          padding: '4px 8px',
          textAlign: 'center',
          fontSize: '11pt',
          fontWeight: 'bold',
          fontFamily: "'Times New Roman', serif",
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {paperCode}
        </div>
      </div>

      {/* ── Row 2: Time / Class (No borders) ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 10px',
        fontFamily: "'TAU-Paalai', 'Latha', serif",
        fontSize: '11pt',
      }}>
        <div style={{ fontWeight: 'bold' }}>
          <div>நேரம்: 90 நிமிடம்</div>
          <div>சிந்தனை நேரம்: 15 நிமிடம்</div>
        </div>
        <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
          <div>வகுப்பு: <span style={{ fontFamily: "'Times New Roman', serif" }}>{blueprint.classLevel}</span></div>
          <div>மதிப்பெண்: <span style={{ fontFamily: "'Times New Roman', serif" }}>{blueprint.totalMarks}</span></div>
        </div>
      </div>

      {/* ── Row 3: Section title (With borders above and below) ── */}
      <div style={{
        textAlign: 'center',
        fontFamily: "'Times New Roman', serif",
        fontSize: '11pt',
        fontWeight: 'bold',
        letterSpacing: '2px',
        padding: '10px 0',
        borderTop: '1.5px solid #000',
        borderBottom: '1.5px solid #000',
      }}>
        {sectionTitle}
      </div>

    </div>
  );
};
