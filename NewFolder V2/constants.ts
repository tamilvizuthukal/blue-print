import { ClassGrade, CognitiveLevel, KnowledgeLevelOption, ItemFormatOption, User, Role } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'password123', role: Role.ADMIN, name: 'Admin', fullName: 'System Administrator' },
];

export const COGNITIVE_PROCESSES: CognitiveLevel[] = [
  { id: 'cp1', code: 'CP1', name: 'Conceptual Clarity' },
  { id: 'cp2', code: 'CP2', name: 'Application Skill' },
  { id: 'cp3', code: 'CP3', name: 'Computational Thinking' },
  { id: 'cp4', code: 'CP4', name: 'Analytical Thinking' },
  { id: 'cp5', code: 'CP5', name: 'Critical Thinking' },
  { id: 'cp6', code: 'CP6', name: 'Creative Thinking' },
  { id: 'cp7', code: 'CP7', name: 'Values/Attitude' },
];

export const KNOWLEDGE_LEVELS: KnowledgeLevelOption[] = [
  { id: 'b', code: 'B', name: 'Basic Level' },
  { id: 'a', code: 'A', name: 'Average Level' },
  { id: 'p', code: 'P', name: 'Profound Level' },
];

export const ITEM_FORMATS: ItemFormatOption[] = [
  { id: 'sr1', code: 'SR1', type: 'SR', name: 'Selected Response 1 (Objective)', abbreviation: 'SR1' },
  { id: 'sr2', code: 'SR2', type: 'SR', name: 'Selected Response 2 (Objective)', abbreviation: 'SR2' },
  { id: 'crs1', code: 'CRS1', type: 'CRS', name: 'Short Answer (2M - 1/2 lines)', abbreviation: 'CRS1' },
  { id: 'crs2', code: 'CRS2', type: 'CRS', name: 'Medium Answer (3-4M)', abbreviation: 'CRS2' },
  { id: 'crl', code: 'CRL', type: 'CRL', name: 'Essay Type (5-6M)', abbreviation: 'CRL' },
];
