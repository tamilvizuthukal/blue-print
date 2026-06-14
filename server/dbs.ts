import {
  Role, ClassLevel, SubjectType, Unit, Curriculum,
  ExamTerm, KnowledgeLevel, ItemFormat, CognitiveProcess,
  User, ExamConfiguration, SystemSettings, BlueprintItem,
  QuestionType,
  Blueprint,
  QuestionPaperType,
  Discourse,
  SharedBlueprint
} from '../types';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const isLocalHostname = (hostname: string) => LOCAL_HOSTNAMES.has(String(hostname || '').toLowerCase());

const isLoopbackUrl = (value: string) => {
  try {
    return isLocalHostname(new URL(value).hostname);
  } catch {
    return false;
  }
};

const resolveApiUrl = () => {
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  const browserHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const runningLocally = isLocalHostname(browserHostname);

  if (envUrl && typeof envUrl === 'string') {
    const normalized = envUrl.trim().replace(/\/$/, '');

    // Prevent production deployments from calling a developer's localhost API.
    if (!(isLoopbackUrl(normalized) && !runningLocally)) {
      return normalized;
    }

    console.warn('Ignoring VITE_API_URL because it points to localhost in a non-local environment.');
  }

  if (runningLocally) {
    return 'http://localhost:5001/api';
  }

  return '/api';
};

const API_URL = resolveApiUrl();

// --- API Implementation ---

export interface DB {
  curriculums: Curriculum[];
  users: User[];
  examConfigs: ExamConfiguration[];
  settings: SystemSettings;
  blueprints: Blueprint[];
  questionPaperTypes: QuestionPaperType[];
  discourses: Discourse[];
  sharedBlueprints: SharedBlueprint[];
}

let cachedDB: DB | null = null;

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueprint_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    localStorage.removeItem('blueprint_token');
    localStorage.removeItem('currentUser');
    throw new Error('Unauthorized');
  }

  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = JSON.parse(rawBody || '{}');
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    throw new Error(
      `Non-JSON error response from ${response.url} (${response.status} ${response.statusText}). ` +
      `Content-Type: ${contentType || 'unknown'}. Body starts with: ${rawBody.slice(0, 120)}`
    );
  }

  if (!isJson) {
    throw new Error(
      `Expected JSON from ${response.url} but received ${contentType || 'unknown'}. ` +
      `Body starts with: ${rawBody.slice(0, 120)}`
    );
  }

  return rawBody ? JSON.parse(rawBody) : null;
};

export const initDB = async (): Promise<DB> => {
  try {
    const res = await fetch(`${API_URL}/init`);
    const data = await handleResponse(res);
    cachedDB = data;
    return data;
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
};

export const validateSession = async (): Promise<User> => {
  const res = await fetch(`${API_URL}/profile`, { headers: getAuthHeaders() });
  return await handleResponse(res);
};

export const getDB = () => cachedDB;

export const login = async (username: string, password: string): Promise<{ success: boolean, user?: User, error?: string }> => {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') || '';
      const rawBody = await res.text();
      if (contentType.toLowerCase().includes('application/json')) {
        const data = JSON.parse(rawBody || '{}');
        return { success: false, error: data.error || 'Invalid credentials' };
      }
      return {
        success: false,
        error: `Login API returned ${res.status}. Body starts with: ${rawBody.slice(0, 120)}`
      };
    }
    const { token, user } = await handleResponse(res);
    localStorage.setItem('blueprint_token', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    return { success: true, user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Server connection failed' };
  }
};

export const logout = () => {
  localStorage.removeItem('blueprint_token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('admin_active_tab');
  localStorage.removeItem('user_dashboard_view');
  localStorage.removeItem('user_current_blueprint');
  cachedDB = null;
};

export const getHealth = async (): Promise<{ status: string, database: string }> => {
  try {
    const res = await fetch(`${API_URL}/health`);
    return await res.json();
  } catch (err) {
    return { status: 'error', database: 'disconnected' };
  }
};

export const getUsers = async (): Promise<User[]> => {
  const res = await fetch(`${API_URL}/users`, { headers: getAuthHeaders() });
  return await handleResponse(res) || [];
};

export const saveUsers = async (users: User[]): Promise<void> => {
  await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ users })
  }).then(handleResponse);
};

export const updateUserProfile = async (profileData: Partial<User>): Promise<User> => {
  const res = await fetch(`${API_URL}/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData)
  });
  return await handleResponse(res);
};

export const getCurriculum = async (cls: ClassLevel, sub: SubjectType): Promise<Curriculum | null> => {
  const res = await fetch(`${API_URL}/curriculums`);
  const list: Curriculum[] = await handleResponse(res) || [];
  return list.find(c => c.classLevel === cls && c.subject === sub) || null;
};

export const getFilteredCurriculum = async (cls?: ClassLevel, sub?: SubjectType): Promise<Curriculum[]> => {
  const res = await fetch(`${API_URL}/curriculums`);
  const list: Curriculum[] = await handleResponse(res) || [];
  return list.filter(c => (!cls || c.classLevel === cls) && (!sub || c.subject === sub));
};

export const saveCurriculum = async (curriculum: Curriculum): Promise<void> => {
  await fetch(`${API_URL}/curriculums`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(curriculum)
  }).then(handleResponse);
};

export const getExamConfigs = async (): Promise<ExamConfiguration[]> => {
  const res = await fetch(`${API_URL}/exam-configs`);
  return await handleResponse(res) || [];
};

export const saveExamConfigs = async (configs: ExamConfiguration[]): Promise<void> => {
  await fetch(`${API_URL}/exam-configs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ configs })
  }).then(handleResponse);
};

export const getSettings = async (): Promise<SystemSettings> => {
  const res = await fetch(`${API_URL}/settings`);
  return await handleResponse(res);
};

export const saveSettings = async (settings: SystemSettings): Promise<void> => {
  await fetch(`${API_URL}/settings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings)
  }).then(handleResponse);
};

export const getBlueprints = async (userId: string): Promise<Blueprint[]> => {
  const res = await fetch(`${API_URL}/blueprints/${userId}`, { headers: getAuthHeaders() });
  return await handleResponse(res) || [];
};

export const saveBlueprint = async (bp: Blueprint): Promise<void> => {
  await fetch(`${API_URL}/blueprints`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(bp)
  }).then(handleResponse);
};

export const deleteBlueprint = async (id: string): Promise<void> => {
  await fetch(`${API_URL}/blueprints/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse);
};

export const toggleBlueprintLock = async (id: string): Promise<void> => {
  const res = await fetch(`${API_URL}/blueprints/all`, { headers: getAuthHeaders() });
  const all: Blueprint[] = await handleResponse(res);
  const bp = all.find(b => b.id === id);
  if (bp) {
    bp.isLocked = !bp.isLocked;
    await saveBlueprint(bp);
  }
};

export const toggleBlueprintHidden = async (id: string): Promise<void> => {
  const res = await fetch(`${API_URL}/blueprints/all`, { headers: getAuthHeaders() });
  const all: Blueprint[] = await handleResponse(res);
  const bp = all.find(b => b.id === id);
  if (bp) {
    bp.isHidden = !bp.isHidden;
    await saveBlueprint(bp);
  }
};

export const resetBlueprintConfirmation = async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/blueprints/all`, { headers: getAuthHeaders() });
    const all: Blueprint[] = await handleResponse(res);
    const bp = all.find(b => b.id === id);
    if (bp) {
      bp.isConfirmed = false;
      await saveBlueprint(bp);
    }
};

export const getQuestionPaperTypes = async (): Promise<QuestionPaperType[]> => {
  const res = await fetch(`${API_URL}/paper-types`);
  return await handleResponse(res) || [];
};

export const saveQuestionPaperTypes = async (types: QuestionPaperType[]): Promise<void> => {
  await fetch(`${API_URL}/paper-types`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ types })
  }).then(handleResponse);
};

export const getDiscourses = async (): Promise<Discourse[]> => {
  const res = await fetch(`${API_URL}/discourses`);
  return await handleResponse(res) || [];
};

export const saveDiscourses = async (discourses: Discourse[]): Promise<void> => {
  await fetch(`${API_URL}/discourses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ discourses })
  }).then(handleResponse);
};

export const shareBlueprint = async (blueprintId: string, fromUserId: string, toUserId: string): Promise<boolean> => {
  const share = {
    id: Math.random().toString(36).substr(2, 9),
    blueprintId,
    ownerId: fromUserId,
    sharedWithUserId: toUserId,
    sharedAt: new Date().toISOString(),
    canEdit: true
  };
  const res = await fetch(`${API_URL}/share`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(share)
  });
  return !!(await handleResponse(res));
};

export const removeShare = async (blueprintId: string, userId: string): Promise<boolean> => {
  const res = await fetch(`${API_URL}/share/${blueprintId}/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return !!(await handleResponse(res));
};

export const getSharedWithUsers = async (blueprintId: string): Promise<User[]> => {
  const res = await fetch(`${API_URL}/share/${blueprintId}`, { headers: getAuthHeaders() });
  return await handleResponse(res) || [];
};

export const getSharedBlueprints = async (userId: string): Promise<Blueprint[]> => {
  const res = await fetch(`${API_URL}/blueprints/${userId}?type=shared`, { headers: getAuthHeaders() });
  return await handleResponse(res) || [];
};

export const getAllAccessibleBlueprints = async (userId: string): Promise<Blueprint[]> => {
  const [owned, shared] = await Promise.all([
    getBlueprints(userId),
    getSharedBlueprints(userId)
  ]);
  const all = [...owned, ...shared];
  return all.filter((bp, index, self) => index === self.findIndex(b => b.id === bp.id));
};

// --- Logic Helpers ---

export const getTermConfiguration = (db: DB, term: ExamTerm, subject: SubjectType, classLevel: ClassLevel) => {
  const config = db.examConfigs.find(c => c.classLevel === classLevel && c.subject === subject && c.term === term);
  if (!config) return [];
  return config.weightages.map(w => ({ u: w.unitNumber, w: w.percentage / 100 }));
};

export const filterCurriculumByTerm = (db: DB, curriculum: Curriculum | null, term: ExamTerm): Curriculum | null => {
  if (!curriculum) return null;
  const weightages = getTermConfiguration(db, term, curriculum.subject, curriculum.classLevel);
  if (weightages.length === 0) return curriculum;

  const activeUnitNumbers = weightages.map(w => w.u);
  return {
    ...curriculum,
    units: curriculum.units.filter(unit => activeUnitNumbers.includes(unit.unitNumber))
  };
};

export const getDefaultFormat = (marks: number): ItemFormat => {
  if (marks === 1) return ItemFormat.SR1;
  if (marks === 2) return ItemFormat.CRS1;
  if (marks === 3) return ItemFormat.CRS2;
  if (marks >= 4) return ItemFormat.CRL;
  return ItemFormat.CRS1;
};

export const getDefaultKnowledge = (marks: number): KnowledgeLevel => {
  if (marks === 1) return KnowledgeLevel.BASIC;
  if (marks === 3) return KnowledgeLevel.AVERAGE;
  if (marks === 6) return KnowledgeLevel.PROFOUND;
  // For 2M and 5M, we usually mix, but default to AVERAGE for stability
  return KnowledgeLevel.AVERAGE;
};

const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const partitionTokensToUnits = (
  tokens: { mark: number, sectionId: string }[],
  unitTargets: { unit: Unit, target: number }[]
): { unit: Unit, tokens: { mark: number, sectionId: string }[] }[] | null => {
  const solve = (tokenIdx: number, deficits: number[]): { mark: number, sectionId: string }[][] | null => {
    if (tokenIdx === tokens.length) {
      // Allow slight tolerance due to integer marks
      return deficits.every(d => Math.abs(d) <= 2) ? deficits.map(() => []) : null;
    }
    const token = tokens[tokenIdx];
    const unitIndices = shuffle(Array.from({ length: deficits.length }, (_, i) => i));
    for (const uIdx of unitIndices) {
      if (deficits[uIdx] >= token.mark - 1) {
        deficits[uIdx] -= token.mark;
        const result = solve(tokenIdx + 1, deficits);
        if (result) {
          result[uIdx].push(token);
          return result;
        }
        deficits[uIdx] += token.mark;
      }
    }
    return null;
  };
  const initialDeficits = unitTargets.map(ut => ut.target);
  const allocation = solve(0, initialDeficits);
  if (!allocation) return null;
  return unitTargets.map((ut, i) => ({ unit: ut.unit, tokens: allocation[i] }));
};

/**
 * Assigns KnowledgeLevel to each item so that the per-KL mark totals
 * exactly match `targets`.
 *
 * FLEXIBLE RULES (priority order):
 *  - 1M items  → prefer BASIC, but may spill into AVERAGE if needed
 *  - 2M items  → BASIC or AVERAGE
 *  - 3M items  → prefer AVERAGE, but may spill into BASIC/PROFOUND
 *  - 5M items  → AVERAGE or PROFOUND
 *  - 6M items  → prefer PROFOUND, but may spill into AVERAGE
 *
 * The solver first tries the "preferred" ordering; if that fails it tries
 * all orderings. A tolerance fallback (±1M per KL) is used as a last
 * resort so the blueprint always completes.
 */
const assignKnowledgeLevels = (items: BlueprintItem[], targets: Record<KnowledgeLevel, number>): boolean => {
  const klOrder = [KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND];

  const preferredKLs = (marks: number): KnowledgeLevel[] => {
    if (marks === 1) return [KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE];
    if (marks === 2) return [KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE];
    if (marks === 3) return [KnowledgeLevel.AVERAGE, KnowledgeLevel.BASIC, KnowledgeLevel.PROFOUND];
    if (marks === 5) return [KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND];
    if (marks === 6) return [KnowledgeLevel.PROFOUND, KnowledgeLevel.AVERAGE];
    return [...klOrder];
  };

  // Pass 1: exact solver with preferred orderings
  const solve = (idx: number, deficits: Record<string, number>): boolean => {
    if (idx === items.length) return Object.values(deficits).every(d => d === 0);
    const item = items[idx];
    for (const kl of preferredKLs(item.marksPerQuestion)) {
      if (deficits[kl] >= item.totalMarks) {
        deficits[kl] -= item.totalMarks;
        item.knowledgeLevel = kl;
        if (item.hasInternalChoice) item.knowledgeLevelB = kl;
        if (solve(idx + 1, deficits)) return true;
        deficits[kl] += item.totalMarks;
      }
    }
    return false;
  };

  shuffle(items);
  if (solve(0, { ...targets })) return true;

  // Pass 2: unrestricted — allow any KL for any mark value
  const solveUnrestricted = (idx: number, deficits: Record<string, number>): boolean => {
    if (idx === items.length) return Object.values(deficits).every(d => d === 0);
    const item = items[idx];
    for (const kl of shuffle([...klOrder])) {
      if (deficits[kl] >= item.totalMarks) {
        deficits[kl] -= item.totalMarks;
        item.knowledgeLevel = kl;
        if (item.hasInternalChoice) item.knowledgeLevelB = kl;
        if (solveUnrestricted(idx + 1, deficits)) return true;
        deficits[kl] += item.totalMarks;
      }
    }
    return false;
  };

  if (solveUnrestricted(0, { ...targets })) return true;

  // Pass 3: tolerance fallback (±1M per KL) — always succeeds
  const solveWithTolerance = (idx: number, deficits: Record<string, number>): boolean => {
    if (idx === items.length) return Object.values(deficits).every(d => Math.abs(d) <= 1);
    const item = items[idx];
    for (const kl of preferredKLs(item.marksPerQuestion)) {
      deficits[kl] -= item.totalMarks;
      item.knowledgeLevel = kl;
      if (item.hasInternalChoice) item.knowledgeLevelB = kl;
      if (solveWithTolerance(idx + 1, deficits)) return true;
      deficits[kl] += item.totalMarks;
    }
    return false;
  };

  return solveWithTolerance(0, { ...targets });
};

/**
 * Returns true if the subject is a language subject.
 * Language subjects do NOT use "Computational Thinking" (CP3)
 * as it is not relevant to language learning.
 *
 * Matching is case-insensitive and covers Tamil, English, Hindi,
 * Sanskrit, French, Urdu, and generic "language" / "மொழி" labels.
 */
const LANGUAGE_KEYWORDS = [
  'tamil', 'english', 'hindi', 'sanskrit', 'french', 'urdu',
  'arabic', 'telugu', 'kannada', 'malayalam', 'language', 'மொழி', 'lang'
];

export const isLanguageSubject = (subject: string): boolean => {
  const lower = (subject || '').toLowerCase();
  return LANGUAGE_KEYWORDS.some(kw => lower.includes(kw));
};

export const generateBlueprintTemplate = (
  db: DB,
  curriculum: Curriculum,
  term: ExamTerm,
  paperTypeId: string
): BlueprintItem[] => {
  const paperType = db.questionPaperTypes.find((p: any) => p.id === paperTypeId);
  if (!paperType) return [];

  const weightages = getTermConfiguration(db, term, curriculum.subject, curriculum.classLevel);
  const activeUnitNumbers = weightages.map(w => w.u);
  const filteredUnits = weightages.length > 0
    ? curriculum.units.filter(u => activeUnitNumbers.includes(u.unitNumber))
    : curriculum.units;

  if (filteredUnits.length === 0) return [];

  const unitTargets: { unit: Unit, target: number }[] = [];
  const activeWeightages = weightages.length > 0 ? weightages : filteredUnits.map(u => ({ u: u.unitNumber, w: 1 / filteredUnits.length }));

  activeWeightages.forEach(w => {
    const unit = filteredUnits.find(u => u.unitNumber === w.u);
    if (unit) unitTargets.push({ unit, target: paperType.totalMarks * w.w });
  });

  const tokenPool: { mark: number, sectionId: string }[] = [];
  paperType.sections.forEach(section => {
    for (let i = 0; i < section.count; i++) tokenPool.push({ mark: section.marks, sectionId: section.id });
  });

  let unitAllocation = partitionTokensToUnits(tokenPool, unitTargets);
  if (!unitAllocation) {
    const deficits = unitTargets.map(ut => ut.target);
    const allocation: { mark: number, sectionId: string }[][] = unitTargets.map(() => []);
    shuffle(tokenPool).forEach(token => {
      let maxDeficitIdx = 0;
      for (let i = 1; i < deficits.length; i++) if (deficits[i] > deficits[maxDeficitIdx]) maxDeficitIdx = i;
      allocation[maxDeficitIdx].push(token);
      deficits[maxDeficitIdx] -= token.mark;
    });
    unitAllocation = unitTargets.map((ut, i) => ({ unit: ut.unit, tokens: allocation[i] }));
  }

  const items: BlueprintItem[] = [];
  const usageTracker: Record<string, number> = {};

  // CP3 (Computational Thinking) is not applicable to language subjects
  const allCPs = Object.values(CognitiveProcess);
  const cpList = isLanguageSubject(curriculum.subject)
    ? allCPs.filter(cp => cp !== CognitiveProcess.CP3)
    : allCPs;
  let cpIdx = Math.floor(Math.random() * cpList.length);

  const orTracker: Record<string, boolean> = {}; // Track section IDs that already got an OR item

  unitAllocation.forEach(alloc => {
    // Randomize the order of tokens for this unit to ensure they don't always land in the same sub-units
    const shuffledTokens = shuffle(alloc.tokens);
    
    shuffledTokens.forEach(token => {
      if (!usageTracker[alloc.unit.id]) usageTracker[alloc.unit.id] = 0;
      
      // Use the usage tracker with an offset based on blueprint ID or random to rotate starting sub-units
      const subUnitOffset = Math.floor(Math.random() * alloc.unit.subUnits.length);
      const subUnitId = alloc.unit.subUnits.length > 0
        ? alloc.unit.subUnits[(usageTracker[alloc.unit.id] + subUnitOffset) % alloc.unit.subUnits.length].id
        : 'general';
      
      const section = paperType.sections.find(s => s.id === token.sectionId);
      
      // Rule: Strictly ONE internal choice per section that allows it
      const currentORCountInSection = items.filter(i => i.sectionId === token.sectionId && i.hasInternalChoice).length;
      const hasInternalChoice = (section?.optionCount || 0) > 0 && currentORCountInSection === 0;

      const cp = cpList[cpIdx % cpList.length];
      cpIdx++;
      usageTracker[alloc.unit.id]++;

      items.push({
        id: Math.random().toString(36).substr(2, 9),
        unitId: alloc.unit.id,
        subUnitId: subUnitId,
        marksPerQuestion: token.mark,
        totalMarks: token.mark,
        questionCount: 1,
        sectionId: token.sectionId,
        knowledgeLevel: KnowledgeLevel.BASIC, 
        cognitiveProcess: cp,
        itemFormat: getDefaultFormat(token.mark),
        questionType: token.mark === 1 ? QuestionType.SR1 : token.mark === 2 ? QuestionType.CRS1 : token.mark === 3 ? QuestionType.CRS2 : token.mark === 4 ? QuestionType.CRS3 : QuestionType.CRL,
        hasInternalChoice: hasInternalChoice,
        cognitiveProcessB: cp,
        itemFormatB: getDefaultFormat(token.mark),
        questionText: '',
        answerText: ''
      });
    });
  });

  // Final validation and fix for OR: Ensure every eligible section got EXACTLY one OR
  paperType.sections.forEach(s => {
    if (s.optionCount > 0) {
      const sectionItems = items.filter(i => i.sectionId === s.id);
      const withOR = sectionItems.filter(i => i.hasInternalChoice);
      
      if (withOR.length === 0 && sectionItems.length > 0) {
        // Give OR to a random question in this section
        const randIdx = Math.floor(Math.random() * sectionItems.length);
        sectionItems[randIdx].hasInternalChoice = true;
      } else if (withOR.length > 1) {
        // Keep only the first one
        withOR.forEach((item, idx) => {
           if (idx > 0) item.hasInternalChoice = false;
        });
      }
    } else {
       // Ensure NO internal choices in other sections
       items.filter(i => i.sectionId === s.id).forEach(i => i.hasInternalChoice = false);
    }
  });

  // KL targets must sum exactly to totalMarks — Profound absorbs rounding remainder
  const basicTarget    = Math.round(paperType.totalMarks * 0.3);
  const averageTarget  = Math.round(paperType.totalMarks * 0.5);
  const profoundTarget = paperType.totalMarks - basicTarget - averageTarget;
  const klTargets = {
    [KnowledgeLevel.BASIC]:    basicTarget,
    [KnowledgeLevel.AVERAGE]:  averageTarget,
    [KnowledgeLevel.PROFOUND]: profoundTarget,
  };
  assignKnowledgeLevels(items, klTargets);

  return items;
};
