export type ReviewStatus = "draft" | "pending" | "confirmed" | "changes";

export interface Reply {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  replies: Reply[];
}

export interface TermBinding {
  id: string;
  source: string;
  target: string;
  required: boolean;
  confirmed: boolean;
}

export interface VersionSnapshot {
  id: string;
  label: string;
  createdAt: string;
  sourceText: string;
  targetText: string;
  status: ReviewStatus;
  terms: TermBinding[];
}

export interface AcceptanceRecord {
  id: string;
  passed: boolean;
  width: number;
  fontSize: number;
  /** 验收时的场景标准键，标准修订或场景变化后用于判定是否失效 */
  standardKey: string;
  /** 验收快照：译文/目标语言/场景/紧急修订任一变化后验收即失效 */
  targetText: string;
  targetLanguage: string;
  scenario: string;
  emergencyRevision: boolean;
  lineCount: number;
  failureSummary: string;
  createdAt: string;
}

export interface SignItem {
  id: string;
  code: string;
  sourceText: string;
  targetLanguage: string;
  targetText: string;
  scenario: string;
  regulation: string;
  status: ReviewStatus;
  terms: TermBinding[];
  comments: ReviewComment[];
  versions: VersionSnapshot[];
  emergencyRevision: boolean;
  /** 每条标识独立保存的版面预览宽度 */
  previewWidth: number;
  /** 每条标识独立保存的版面预览字号 */
  previewFont: number;
  /** 最近一次版面验收结果，内容或标准变化后自动失效 */
  acceptance: AcceptanceRecord | null;
  updatedAt: string;
}

export interface SignProject {
  id: string;
  title: string;
  location: string;
  activeSignId: string;
  signs: SignItem[];
  updatedAt: string;
}

export interface PersistedProject {
  schema: 1;
  project: SignProject;
}

export interface DiffToken {
  type: "same" | "add" | "remove";
  value: string;
}
