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

export type LayoutScenarioKey = "rail" | "mall" | "park" | "hospital";

export interface LayoutStandard {
  key: LayoutScenarioKey;
  label: string;
  /** 场景名称中命中以下任一关键词即适用该标准。 */
  match: string[];
  minFont: number;
  maxLines: number;
}

export interface LayoutFailure {
  kind: "font" | "lines" | "unknown";
  message: string;
}

export interface LayoutEvaluation {
  standard: LayoutStandard | null;
  width: number;
  fontSize: number;
  lineCount: number;
  pass: boolean;
  failures: LayoutFailure[];
}

/** 版面验收记录；basis 保存验收时译文/语言/场景/紧急修订的指纹。 */
export interface AcceptanceResult {
  passed: boolean;
  width: number;
  fontSize: number;
  lineCount: number;
  standardKey: LayoutScenarioKey | null;
  standardLabel: string;
  basis: string;
  acceptedAt: string;
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
  /** 每条标识独立保存的预览宽度（像素）。 */
  previewWidth: number;
  /** 每条标识独立保存的预览字号（像素）。 */
  previewFont: number;
  /** 最近一次版面验收结果；basis 变化后视为失效。 */
  acceptance: AcceptanceResult | null;
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
  schema: 2;
  project: SignProject;
}

export interface DiffToken {
  type: "same" | "add" | "remove";
  value: string;
}
