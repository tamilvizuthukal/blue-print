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
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.trim().replace(/\/$/, '');
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
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();
  const isJson = contentType.toLowerCase().includes('application/json');

  if (response.status === 401) {
    // Only clear storage if it hasn't been cleared yet to avoid redundant updates
    if (localStorage.getItem('blueprint_token')) {
      localStorage.removeItem('blueprint_token');
      localStorage.removeItem('currentUser');
    }

    if (isJson) {
      const error = JSON.parse(rawBody || '{}');
      throw new Error(`Unauthorized: ${error.message || error.error || 'Session invalid'}`);
    }
    throw new Error('Unauthorized: Session expired or invalid');
  }

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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const initDB = async (retries = 5, delay = 2000): Promise<DB> => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API_URL}/init`);
      if (res.status === 503 && i < retries - 1) {
        console.warn(`Database initializing (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
        await wait(delay);
        continue;
      }
      const data = await handleResponse(res);
      cachedDB = data;
      return data;
    } catch (err) {
      if (i === retries - 1) {
        console.error('Database initialization error after retries:', err);
        throw err;
      }
      console.warn(`Fetch error (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
      await wait(delay);
    }
  }
  throw new Error('Failed to initialize database after multiple retries.');
};

export const validateSession = async (): Promise<User> => {
  const res = await fetch(`${API_URL}/profile`, { headers: getAuthHeaders() });
  return await handleResponse(res);
};

export const getDB = () => cachedDB;

export const exportPDF = async (id: string, baseUrl: string, tab: string, mode: string, settings?: any): Promise<Blob> => {
  const res = await fetch(`${API_URL}/export/pdf`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, baseUrl, tab, mode, settings })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to export PDF: ${res.status} ${errorText}`);
  }
  
  return await res.blob();
};

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

export const deleteUser = async (id: string): Promise<void> => {
  await fetch(`${API_URL}/users?id=${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(handleResponse);
};

export const heartbeat = async (): Promise<void> => {
  const token = localStorage.getItem('blueprint_token');
  if (!token) return;
  try {
    await fetch(`${API_URL}/heartbeat`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (err) {
    console.error('Heartbeat failed', err);
  }
};

export const getLiveUsers = async (): Promise<User[]> => {
  const res = await fetch(`${API_URL}/live-users`, { headers: getAuthHeaders() });
  return await handleResponse(res) || [];
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
  const res = await fetch(`${API_URL}/curriculums`, { headers: getAuthHeaders() });
  const list: Curriculum[] = await handleResponse(res) || [];
  return list.find(c => c.classLevel === cls && c.subject === sub) || null;
};

export const getFilteredCurriculum = async (cls?: ClassLevel, sub?: SubjectType): Promise<Curriculum[]> => {
  const res = await fetch(`${API_URL}/curriculums`, { headers: getAuthHeaders() });
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
  const res = await fetch(`${API_URL}/exam-configs`, { headers: getAuthHeaders() });
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
  const res = await fetch(`${API_URL}/settings`, { headers: getAuthHeaders() });
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

export const getBlueprintById = async (id: string): Promise<Blueprint | null> => {
  const res = await fetch(`${API_URL}/blueprints/single/${id}`, { headers: getAuthHeaders() });
  return await handleResponse(res);
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
  const res = await fetch(`${API_URL}/paper-types`, { headers: getAuthHeaders() });
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
  const res = await fetch(`${API_URL}/discourses`, { headers: getAuthHeaders() });
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

const getAllowedBlueprintCPs = (): CognitiveProcess[] =>
  Object.values(CognitiveProcess).filter(cp => cp !== CognitiveProcess.CP3);

const computeKlTargets = (totalMarks: number): Record<KnowledgeLevel, number> => {
  const exact = [
    { level: KnowledgeLevel.BASIC, value: totalMarks * 0.3 },
    { level: KnowledgeLevel.AVERAGE, value: totalMarks * 0.5 },
    { level: KnowledgeLevel.PROFOUND, value: totalMarks * 0.2 },
  ];
  const result = {
    [KnowledgeLevel.BASIC]: 0,
    [KnowledgeLevel.AVERAGE]: 0,
    [KnowledgeLevel.PROFOUND]: 0,
  } as Record<KnowledgeLevel, number>;
  exact.forEach(entry => { result[entry.level] = Math.floor(entry.value); });
  let remaining = totalMarks - Object.values(result).reduce((sum, v) => sum + v, 0);
  exact
    .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)))
    .forEach(entry => {
      if (remaining > 0) {
        result[entry.level] += 1;
        remaining -= 1;
      }
    });
  return result;
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

const assignKnowledgeLevels = (items: BlueprintItem[], targets: Record<KnowledgeLevel, number>): boolean => {
  const klOrder = [KnowledgeLevel.BASIC, KnowledgeLevel.AVERAGE, KnowledgeLevel.PROFOUND];
  
  // Refined rules: 1M must be BASIC, 3M must be AVERAGE, 6M must be PROFOUND
  const solve = (idx: number, currentDeficits: Record<string, number>): boolean => {
    if (idx === items.length) {
      return Object.values(currentDeficits).every(d => d === 0);
    }
    
    const item = items[idx];
    let allowedKL: KnowledgeLevel[] = [];
    
    if (item.marksPerQuestion === 1) {
      allowedKL = [KnowledgeLevel.BASIC];
    } else if (item.marksPerQuestion === 3) {
      allowedKL = [KnowledgeLevel.AVERAGE];
    } else if (item.marksPerQuestion === 6) {
      allowedKL = [KnowledgeLevel.PROFOUND];
    } else {
      allowedKL = [...klOrder];
    }
    
    // Randomize options each time to ensure different blueprints on reset
    const options = shuffle(allowedKL);
    for (const kl of options) {
      if (currentDeficits[kl] >= item.totalMarks) {
        currentDeficits[kl] -= item.totalMarks;
        item.knowledgeLevel = kl;
        if (item.hasInternalChoice) item.knowledgeLevelB = kl; 
        
        if (solve(idx + 1, currentDeficits)) return true;
        currentDeficits[kl] += item.totalMarks;
      }
    }
    return false;
  };

  const initialDeficits = { ...targets };
  const shuffledItems = shuffle(items);
  
  const success = solve(0, initialDeficits);
  
  if (!success) {
     // Fallback: Try with tolerance 1, then 2 if absolutely necessary
     const solveWithTolerance = (idx: number, deficits: Record<string, number>, tolerance: number): boolean => {
        if (idx === items.length) return Object.values(deficits).every(d => Math.abs(d) <= tolerance);
        const item = items[idx];
        let allowed = item.marksPerQuestion === 1 ? [KnowledgeLevel.BASIC] : 
                      item.marksPerQuestion === 3 ? [KnowledgeLevel.AVERAGE] : 
                      item.marksPerQuestion === 6 ? [KnowledgeLevel.PROFOUND] : [...klOrder];
        
        for (const kl of shuffle(allowed)) {
          deficits[kl] -= item.totalMarks;
          item.knowledgeLevel = kl;
          if (item.hasInternalChoice) item.knowledgeLevelB = kl;
          if (solveWithTolerance(idx + 1, deficits, tolerance)) return true;
          deficits[kl] += item.totalMarks;
        }
        return false;
     };

     if (solveWithTolerance(0, { ...targets }, 1)) return true;
     return solveWithTolerance(0, { ...targets }, 2);
  }
  return true;
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
  const cpList = getAllowedBlueprintCPs();
  let cpIdx = Math.floor(Math.random() * cpList.length);
  const applyInternalChoiceMetadata = (item: BlueprintItem) => {
    item.hasInternalChoice = true;
    item.unitIdB = item.unitId;
    item.subUnitIdB = item.subUnitId;
    item.knowledgeLevelB = item.knowledgeLevel;
    item.cognitiveProcessB = item.cognitiveProcess;
    item.itemFormatB = item.itemFormat;
  };
  const clearInternalChoiceMetadata = (item: BlueprintItem) => {
    item.hasInternalChoice = false;
    item.unitIdB = undefined;
    item.subUnitIdB = undefined;
    item.knowledgeLevelB = undefined;
    item.cognitiveProcessB = undefined;
    item.itemFormatB = undefined;
  };

  unitAllocation.forEach(alloc => {
    const shuffledTokens = shuffle(alloc.tokens);
    const subUnitMarkDeficits: Record<string, number> = {};
    alloc.unit.subUnits.forEach(su => { subUnitMarkDeficits[su.id] = 0; });
    
    shuffledTokens.forEach(token => {
      let subUnitId = 'general';
      if (alloc.unit.subUnits.length > 0) {
        // Find subunit with the least marks assigned so far to ensure balanced weightage
        subUnitId = alloc.unit.subUnits[0].id;
        let minMarks = subUnitMarkDeficits[subUnitId] || 0;
        
        for (const su of alloc.unit.subUnits) {
          const currentMarks = subUnitMarkDeficits[su.id] || 0;
          if (currentMarks < minMarks) {
            minMarks = currentMarks;
            subUnitId = su.id;
          }
        }
      }
      
      subUnitMarkDeficits[subUnitId] = (subUnitMarkDeficits[subUnitId] || 0) + token.mark;
      
      const section = paperType.sections.find(s => s.id === token.sectionId);
      const currentORCountInSection = items.filter(i => i.sectionId === token.sectionId && i.hasInternalChoice).length;
      const requiredORCount = section?.optionCount || 0;
      const hasInternalChoice = requiredORCount > 0 && currentORCountInSection < requiredORCount;

      const cp = cpList[cpIdx % cpList.length];
      cpIdx++;

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
        unitIdB: hasInternalChoice ? alloc.unit.id : undefined,
        subUnitIdB: hasInternalChoice ? subUnitId : undefined,
        cognitiveProcessB: cp,
        itemFormatB: getDefaultFormat(token.mark),
        questionText: '',
        answerText: ''
      });
    });
  });

  // Final validation and fix for OR: match each section's requested OR count.
  paperType.sections.forEach(s => {
    const sectionItems = items.filter(i => i.sectionId === s.id);
    const requiredORCount = Math.min(s.optionCount || 0, sectionItems.length);
    const withOR = shuffle(sectionItems.filter(i => i.hasInternalChoice));
    const withoutOR = shuffle(sectionItems.filter(i => !i.hasInternalChoice));

    if (requiredORCount === 0) {
      sectionItems.forEach(clearInternalChoiceMetadata);
      return;
    }

    if (withOR.length < requiredORCount) {
      withoutOR.slice(0, requiredORCount - withOR.length).forEach(applyInternalChoiceMetadata);
    } else if (withOR.length > requiredORCount) {
      withOR.slice(requiredORCount).forEach(clearInternalChoiceMetadata);
    }
  });

  // Spread OR within the same unit across a different sub-unit whenever possible.
  paperType.sections.forEach(s => {
    if (s.optionCount <= 0) return;
    items
      .filter(i => i.sectionId === s.id && i.hasInternalChoice)
      .forEach(item => {
        const unit = filteredUnits.find(u => u.id === item.unitId);
        const alternatives = shuffle((unit?.subUnits || []).filter(su => su.id !== item.subUnitId));
        const chosen = alternatives[0];
        item.unitIdB = item.unitId;
        item.subUnitIdB = chosen?.id || item.subUnitId;
        item.knowledgeLevelB = item.knowledgeLevel;
        item.cognitiveProcessB = cpList[cpIdx % cpList.length];
        item.itemFormatB = item.itemFormat;
        cpIdx++;
      });
  });

  const klTargets = computeKlTargets(paperType.totalMarks);
  assignKnowledgeLevels(items, klTargets);

  items.forEach(item => {
    if (item.hasInternalChoice) {
      item.knowledgeLevelB = item.knowledgeLevel;
      item.itemFormatB = item.itemFormat;
      item.cognitiveProcess = item.cognitiveProcess === CognitiveProcess.CP3 ? cpList[0] : item.cognitiveProcess;
      item.cognitiveProcessB = item.cognitiveProcessB === CognitiveProcess.CP3 ? cpList[1 % cpList.length] : item.cognitiveProcessB;
    }
  });

  return items;
};
