const mongoose = require('mongoose');

// Helper to disable strict:false and ensure data integrity
const schemaOptions = { strict: true, timestamps: true };

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER' },
  name: { type: String, required: true },
  email: String,
  phoneNumber: String,
  pen: String,
  designation: String,
  dob: String,
  joinDate: String,
  retirementDate: String,
  experience: String,
  schoolName: String,
  schoolCode: String,
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  district: String,
  educationalDistrict: String,
  subdistrict: String,
  bankAccountNumber: String,
  bankIfsc: String,
  bankName: String,
  bankBranch: String,
  pensionScheme: String,
  basicPay: Number,
  staffId: String,
  brcName: String,
  schoolType: String,
  lastActive: Date
}, schemaOptions);

const curriculumSchema = new mongoose.Schema({
  classLevel: { type: mongoose.Schema.Types.Mixed, required: true },
  subject: { type: String, required: true },
  units: [{
    id: String,
    unitNumber: Number,
    name: String,
    subUnits: Array,
    learningOutcomes: String
  }]
}, schemaOptions);

const examConfigSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  classLevel: mongoose.Schema.Types.Mixed,
  subject: String,
  term: String,
  weightages: Array
}, schemaOptions);

const blueprintSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  examTerm: String,
  classLevel: mongoose.Schema.Types.Mixed,
  subject: String,
  questionPaperTypeId: String,
  questionPaperTypeName: String,
  totalMarks: Number,
  items: Array,
  createdAt: String,
  setId: String,
  academicYear: String,
  ownerId: { type: String, required: true },
  sharedWith: [String],
  isLocked: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  isConfirmed: { type: Boolean, default: false },
  isQuestionConfirmed: { type: Boolean, default: false },
  isAnswerKeyConfirmed: { type: Boolean, default: false },
  isAdminAssigned: { type: Boolean, default: false },
  massViewHeader: String,
  reportSettings: mongoose.Schema.Types.Mixed,
  perReportSettings: mongoose.Schema.Types.Mixed
}, schemaOptions);

const paperTypeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  totalMarks: Number,
  description: String,
  sections: Array
}, schemaOptions);

const discourseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  subject: String,
  marks: Number,
  name: String,
  description: String,
  cognitiveProcess: String,
  rubrics: Array
}, schemaOptions);

const systemSettingsSchema = new mongoose.Schema({
  cognitiveProcesses: Array,
  knowledgeLevels: Array,
  itemFormats: Array
}, schemaOptions);

const sharedBlueprintSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  blueprintId: String,
  ownerId: String,
  sharedWithUserId: String,
  sharedAt: String,
  canEdit: Boolean
}, schemaOptions);

const appSettingsSchema = new mongoose.Schema({
  geminiApiKey: { type: String, default: '' },
  academicYear: { type: String, default: '2026-27' }
}, schemaOptions);

module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Curriculum: mongoose.models.Curriculum || mongoose.model('Curriculum', curriculumSchema),
  ExamConfig: mongoose.models.ExamConfig || mongoose.model('ExamConfig', examConfigSchema),
  Blueprint: mongoose.models.Blueprint || mongoose.model('Blueprint', blueprintSchema),
  PaperType: mongoose.models.PaperType || mongoose.model('PaperType', paperTypeSchema),
  Discourse: mongoose.models.Discourse || mongoose.model('Discourse', discourseSchema),
  SystemSettings: mongoose.models.SystemSettings || mongoose.model('SystemSettings', systemSettingsSchema),
  SharedBlueprint: mongoose.models.SharedBlueprint || mongoose.model('SharedBlueprint', sharedBlueprintSchema),
  AppSettings: mongoose.models.AppSettings || mongoose.model('AppSettings', appSettingsSchema)
};
