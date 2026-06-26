// Removed duplicate SchoolType string type definition


export type District = 
    "Thiruvananthapuram" | "Kollam" | "Pathanamthitta" | "Alappuzha" | 
    "Kottayam" | "Idukki" | "Ernakulam" | "Thrissur" | 
    "Palakkad" | "Malappuram" | "Kozhikode" | "Wayanad" | 
    "Kannur" | "Kasaragod";

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  WEBMASTER = 'WEBMASTER'
}

export type UserRole = Role;

export enum ClassLevel {
  _8 = 8,
  _9 = 9,
  _10 = 10,
  _SSLC = 'SSLC',
}

export type ClassGrade = ClassLevel;

export enum SubjectType {
  TAMIL_AT = 'Tamil AT',
  TAMIL_BT = 'Tamil BT'
}

export type Subject = SubjectType;

export enum ExamTerm {
  FIRST = 'First Term Summative',
  SECOND = 'Second Term Summative',
  THIRD = 'Third Term Summative'
}

export enum KnowledgeLevel {
  BASIC = 'Basic',
  AVERAGE = 'Average',
  PROFOUND = 'Profound'
}

export interface KnowledgeLevelOption {
  id: string;
  code: string;
  name: string;
}

export enum CognitiveProcess {
  CP1 = 'Conceptual Clarity',
  CP2 = 'Application Skill',
  CP3 = 'Computational Thinking',
  CP4 = 'Analytical Thinking',
  CP5 = 'Critical Thinking',
  CP6 = 'Creative Thinking',
  CP7 = 'Values/Attitudes'
}

export interface CognitiveLevel {
  id: string;
  code: string;
  name: string;
  color?: string;
}

export enum DifficultyLevel {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export enum ItemFormat {
  SR1 = 'SR1 (MCI)', 
  SR2 = 'SR2 (MI)',  
  CRS1 = 'CRS1 (VSA)', 
  CRS2 = 'CRS2 (SA)', 
  CRL = 'CRL (E)'    
}

export interface ItemFormatOption {
  id: string;
  code: string;
  name: string;
  type: string;
  abbreviation: string;
}

// Interface for components that treat ClassLevel as an object (SettingsManager, etc.)
export interface ExtendedClassLevel {
  id: string;
  name: string;
  subjects: Curriculum[];
}

export enum QuestionType {
  SR1 = 'SR1',
  SR2 = 'SR2',
  CRS1 = 'CRS1',
  CRS2 = 'CRS2',
  CRS3 = 'CRS3',
  CRL = 'CRL'
}

export enum SchoolType {
  GOVERNMENT = 'Government',
  AIDED = 'Aided',
  PRIVATE = 'Private'
}

export interface SubUnit {
  id: string;
  name: string;
  learningOutcomes?: string; // Added field for Learning Outcomes (LOs)
}

export interface Unit {
  id: string;
  unitNumber: number;
  name: string;
  subUnits: SubUnit[];
  learningOutcomes?: string; // Added field for Learning Outcomes (LOs)
}

export interface AnswerMark {
  answer: string;
  mark: string;
}

export interface Curriculum {
  id: string; // Added for UI management
  name: string; // Added for UI management
  classLevel: ClassLevel;
  subject: SubjectType;
  units: Unit[];
}

export interface BlueprintItem {
  id: string;
  unitId: string;
  subUnitId: string;
  knowledgeLevel: KnowledgeLevel;
  cognitiveProcess: CognitiveProcess;
  itemFormat: ItemFormat;
  questionCount: number;
  marksPerQuestion: number;
  totalMarks: number;
  sectionId?: string; // To link back to paper type section
  qNo?: string; // Manual Question Number
  questionText?: string; // Added
  answerText?: string;   // Added
  questionType?: QuestionType; // Added new field
  hasInternalChoice?: boolean; // Toggle for "Either/Or" options
  unitIdB?: string;
  subUnitIdB?: string;
  questionTextB?: string; // For Option B
  answerTextB?: string;   // For Option B
  structuredAnswers?: AnswerMark[]; // New structured answer field
  structuredAnswersB?: AnswerMark[]; // New structured answer field for Option B
  structuredQuestions?: AnswerMark[]; // New structured field for Question
  structuredQuestionsB?: AnswerMark[]; // New structured field for Question B
  knowledgeLevelB?: KnowledgeLevel; // Metadata for Option B
  cognitiveProcessB?: CognitiveProcess; // Metadata for Option B
  itemFormatB?: ItemFormat; // Metadata for Option B
  time?: number; // Time in minutes
  enableWriteContent?: boolean;
  enableDiscourse?: boolean;
  enableInputAnswer?: boolean;
  enableFurtherInfo?: boolean;
  furtherInfo?: string;
  enableWriteContentB?: boolean;
  enableDiscourseB?: boolean;
  enableInputAnswerB?: boolean;
  enableFurtherInfoB?: boolean;
  furtherInfoB?: string;
  discourseId?: string;
  discourseIdB?: string;
  answerBlocks?: any[];
  answerBlocksB?: any[];
  furtherInfoBlocks?: any[];
  furtherInfoBlocksB?: any[];
  answerPrompt?: string;
  answerPromptB?: string;

  // Aliases for compatibility with older components
  numQuestions?: number;
  marksPerItem?: number;
  cognitiveId?: string;
  formatId?: string;
  knowledgeId?: string;
}

export interface BlueprintEntry extends BlueprintItem {
  // Can be used interchangeably or with specific UI flags
}

export interface QuestionPatternSection {
  id: string;
  marks: number;
  count: number;
  maxQuestions?: number; // Added for compatibility with AnalysisReport
  instruction?: string; // Direction for the user (e.g., 'Answer any 5')
  massViewHeader?: string; // Optional header for Mass View
  optionCount?: number; // Number of questions in this section that should have internal choice
  timePerQuestion?: number; // New field for time allocation per question
}

export interface QuestionPaperType {
  id: string;
  name: string;
  totalMarks: number; // Computed from sections
  description: string;
  sections: QuestionPatternSection[];
  questionTypes?: QuestionPatternSection[]; // Alias for compatibility
}

export type PaperType = QuestionPaperType;

export interface ReportSettings {
  fontSizeBody: number; // Alias for English font size
  fontSizeTitle: number;
  fontSizeTamil: number;
  fontSizeEnglish?: number; // Explicit English font size
  lineHeight: number;
  rowHeight: number;
  columnWidths: Record<string, number>;
  showLogo: boolean;
  compactMode: boolean;
  fontFamily: string;
  fontFamilyEnglish?: string;
  headerFontStyle?: string;
  orientation?: 'p' | 'l'; // p = portrait, l = landscape
  paperSize?: 'A4' | 'Legal';
  contentFontSize?: number; // Legacy, will migrate to fontSizeTamil
  otherFontSize?: number; // Legacy, will migrate to fontSizeEnglish
}

export interface Blueprint {
  id: string;
  examTerm: ExamTerm;
  classLevel: ClassLevel;
  subject: SubjectType;
  questionPaperTypeId: string;
  questionPaperTypeName: string;
  totalMarks: number;
  items: BlueprintItem[];
  createdAt: string;
  updatedAt?: string;
  setId?: string;
  academicYear?: string;
  ownerId?: string; // User ID of the creator
  sharedWith?: string[]; // Array of user IDs who have access
  isLocked?: boolean; // Admin can lock a blueprint
  isHidden?: boolean; // Admin can hide a blueprint from the user
  isConfirmed?: boolean; // User has confirmed the pattern
  isQuestionConfirmed?: boolean; // User has confirmed the questions
  isAnswerKeyConfirmed?: boolean; // User has confirmed the answer key
  reportSettings?: ReportSettings; // Global fallback
  perReportSettings?: Record<string, ReportSettings>; // Per report (report1, report2, etc.)
  isAdminAssigned?: boolean; // New field to track if assigned by admin
  massViewHeader?: string; // Content for the consolidated editor
  examType?: string; // Added for compatibility
  maxScore?: number; // Added for compatibility
}

export type SavedBlueprint = Blueprint;

export interface SharedBlueprint {
  id: string;
  blueprintId: string;
  ownerId: string;
  sharedWithUserId: string;
  sharedAt: string;
  canEdit: boolean;
}

export interface User {
  id: string;
  username: string;
  password?: string; // For simple auth demo
  role: Role;
  name: string;
  fullName?: string; // Added for compatibility
  status?: 'active' | 'blocked'; // Added status field
  
  // Profile fields
  pen?: string;
  designation?: string;
  mobile?: string;
  phoneNumber?: string; // Ally with UserProfile for now
  email?: string;
  emailPersonal?: string;
  emailSchool?: string;
  hmName?: string;
  hmMobile?: string;
  district?: string;
  educationalDistrict?: string;
  subdistrict?: string;
  brcName?: string;
  schoolCode?: string;
  schoolName?: string;
  schoolType?: SchoolType;
  accountNo?: string;
  bankAccountNumber?: string; // Align with UserProfile
  bankName?: string;
  branch?: string;
  bankBranch?: string; // Align with UserProfile
  ifscCode?: string;
  bankIfsc?: string; // Align with UserProfile
  
  // New details
  dob?: string;
  joinDate?: string;
  retirementDate?: string;
  experience?: string;
  basicPay?: number;
  salaryScale?: string;
  pensionScheme?: 'Statutory' | 'NPS';
  staffId?: string;
}

// Configuration for Exam Weightage
export interface UnitWeightage {
  unitNumber: number;
  percentage: number; // 0.0 to 1.0
}

export interface ExamConfiguration {
  id: string;
  classLevel: ClassLevel;
  subject: SubjectType;
  term: ExamTerm;
  weightages: UnitWeightage[];
}

export interface DiscourseScores {
  point: string;
  marks: number;
}

export interface Discourse {
  id: string;
  subject: SubjectType;
  marks: number;
  name: string;
  description: string;
  cognitiveProcess?: CognitiveProcess; // Added cognitive process
  rubrics: DiscourseScores[];
  aiPrompt?: string;
}

// Master Data definition (for dynamic labels if needed)
export interface MasterDataCode {
  code: string;
  name: string;
  description: string;
}

export interface SystemSettings {
  cognitiveProcesses: MasterDataCode[];
  knowledgeLevels: MasterDataCode[];
  itemFormats: MasterDataCode[];
}

export interface DictionaryWord {
  word: string;
  isCustom: boolean;
}

export interface DictionaryResponse {
  words: DictionaryWord[];
  total: number;
  page: number;
  limit: number;
}

export interface GrammarRule {
  id: string;
  category: string;
  ruleCode: string;
  ruleName: string;
  description: string;
  isEnabled: boolean;
  priority: number;
}

export interface GrammarSettingsResponse {
  globalEnabled: boolean;
  categoryStates: { [category: string]: boolean };
  rules: GrammarRule[];
}

export interface DatasetAnalysisResult {
  totalExtractedCount: number;
  uniqueCount: number;
  matchCount: number;
  unknownCount: number;
  unknownWords: string[];
}

export interface BulkAddResponse {
  success: boolean;
  selectedCount: number;
  addedCount: number;
  skippedCount: number;
  failedCount: number;
}
