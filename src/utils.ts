import type { AcceptanceRecord, DiffToken, SignItem, TermBinding } from "./types";

export const WIDTHS = [320, 480, 720, 960] as const;
export const FONT_MIN = 28;
export const FONT_MAX = 88;
export const DEFAULT_WIDTH = 480;
export const DEFAULT_FONT = 42;

/** 场景版面标准：标准修订（数值或键变化）会让旧验收判定为失效 */
export interface ScenarioStandard {
  key: string;
  label: string;
  minFontSize: number;
  maxLines: number;
}

export const SCENARIO_STANDARDS: ScenarioStandard[] = [
  { key: "rail-transit", label: "轨道交通", minFontSize: 40, maxLines: 3 },
  { key: "mall-evacuation", label: "商场疏散", minFontSize: 36, maxLines: 2 },
  { key: "park-service", label: "公园服务", minFontSize: 32, maxLines: 3 },
  { key: "hospital-entrance", label: "医院入口", minFontSize: 34, maxLines: 2 },
];

/** 场景字段是自由文本，按关键词归入四类标准场景；无法归类时没有强制标准 */
export function resolveScenarioStandard(scenario: string): ScenarioStandard | null {
  const text = scenario.trim();
  if (!text) return null;
  if (/商场|疏散|消防|商业/.test(text)) return SCENARIO_STANDARDS[1];
  if (/医院|医疗|入口/.test(text)) return SCENARIO_STANDARDS[3];
  if (/轨道|地铁|交通|站台|车站/.test(text)) return SCENARIO_STANDARDS[0];
  if (/公园|景区|园林|服务/.test(text)) return SCENARIO_STANDARDS[2];
  return null;
}

export interface LayoutCheck {
  standard: ScenarioStandard | null;
  width: number;
  fontSize: number;
  lineCount: number;
  pass: boolean;
  fontShortfall: number;
  extraLines: number;
  reasons: string[];
  shortReasons: string;
}

/** 按场景标准检查指定宽度/字号下的最低字号和最多行数 */
export function evaluateLayout(sign: SignItem, width: number, fontSize: number): LayoutCheck {
  const standard = resolveScenarioStandard(sign.scenario);
  const lineCount = estimatedLines(sign.targetText, width, fontSize).length;
  const reasons: string[] = [];
  const fontShortfall = standard ? Math.max(0, standard.minFontSize - fontSize) : 0;
  const extraLines = standard ? Math.max(0, lineCount - standard.maxLines) : 0;
  if (!sign.targetText.trim()) reasons.push("译文为空");
  if (standard) {
    if (fontShortfall > 0) reasons.push(`字号低于标准：当前 ${fontSize}px，${standard.label}最低 ${standard.minFontSize}px，差 ${fontShortfall}px`);
    if (extraLines > 0) reasons.push(`行数超出标准：当前 ${lineCount} 行，${standard.label}最多 ${standard.maxLines} 行，超 ${extraLines} 行`);
  }
  const shortReasons = [
    fontShortfall > 0 ? `字号缺 ${fontShortfall}px` : "",
    extraLines > 0 ? `超出 ${extraLines} 行` : "",
  ].filter(Boolean).join("，");
  return {
    standard,
    width,
    fontSize,
    lineCount,
    pass: Boolean(sign.targetText.trim()) && fontShortfall === 0 && extraLines === 0,
    fontShortfall,
    extraLines,
    reasons,
    shortReasons,
  };
}

export type AcceptanceState = "none" | "valid" | "stale" | "failed";

/**
 * 判定验收结果状态：
 * - none：从未验收
 * - valid：验收通过，且译文/目标语言/场景/紧急修订与验收快照一致、场景标准未修订、当前版面仍达标
 * - stale：验收被内容或标准变化作废（旧验收失效）
 * - failed：最近一次验收本身未通过
 */
export function reviewAcceptance(sign: SignItem): { state: AcceptanceState; staleReasons: string[]; check: LayoutCheck | null } {
  const record = sign.acceptance;
  const check = evaluateLayout(sign, sign.previewWidth ?? DEFAULT_WIDTH, sign.previewFont ?? DEFAULT_FONT);
  if (!record) return { state: "none", staleReasons: [], check };
  if (!record.passed) return { state: "failed", staleReasons: [], check };
  const staleReasons: string[] = [];
  if (record.targetText !== sign.targetText) staleReasons.push("译文已修改");
  if (record.targetLanguage !== sign.targetLanguage) staleReasons.push("目标语言已修改");
  if (record.scenario !== sign.scenario) staleReasons.push("场景已修改");
  if (record.emergencyRevision !== sign.emergencyRevision) {
    staleReasons.push(sign.emergencyRevision ? "已进入紧急修订" : "紧急修订状态已变化");
  }
  const currentStandard = resolveScenarioStandard(sign.scenario);
  if (record.standardKey !== (currentStandard?.key ?? "")) {
    staleReasons.push("场景标准已变化");
  } else if (currentStandard && !check.pass) {
    staleReasons.push(`不再满足${currentStandard.label}当前标准`);
  }
  if (record.width !== sign.previewWidth || record.fontSize !== sign.previewFont) {
    staleReasons.push("预览版面参数已调整");
  }
  return { state: staleReasons.length ? "stale" : "valid", staleReasons, check };
}

/** 未达到当前场景标准（或验收失效）的标识不能确认 */
export function canConfirmSign(sign: SignItem): { ok: boolean; messages: string[] } {
  const review = reviewAcceptance(sign);
  const messages: string[] = [];
  if (review.check && !review.check.pass) messages.push(...review.check.reasons);
  if (review.state === "stale") messages.push(`旧验收已失效：${review.staleReasons.join("、")}，请重新验收`);
  if (review.state === "none") messages.push("尚未保存版面验收结果，请先验收");
  if (review.state === "failed") messages.push("最近一次验收未通过，请重新验收");
  if (sign.emergencyRevision) messages.push("紧急修订模式下确认已锁定");
  return { ok: messages.length === 0, messages };
}

export function estimatedLines(text: string, width: number, fontSize: number, lineHeight = 1.25) {
  if (!text.trim()) return [];
  const usable = Math.max(120, width - 48);
  const lines: string[] = [];
  for (const hardLine of text.split("\n")) {
    if (!hardLine) {
      lines.push("");
      continue;
    }
    let current = "";
    let currentWidth = 0;
    for (const char of hardLine) {
      const charWidth = /[\u2e80-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)
        ? fontSize
        : char === " "
          ? fontSize * 0.34
          : fontSize * 0.58;
      if (current && currentWidth + charWidth > usable) {
        lines.push(current.trimEnd());
        current = char.trimStart();
        currentWidth = charWidth;
      } else {
        current += char;
        currentWidth += charWidth;
      }
    }
    if (current) lines.push(current.trimEnd());
  }
  return lines;
}

export function analyzeSign(sign: SignItem, width: number, fontSize: number) {
  const lines = estimatedLines(sign.targetText, width, fontSize);
  const lineCapacity = Math.max(1, Math.floor((width * 0.62) / (fontSize * 1.25)));
  const visible = lines.slice(0, lineCapacity);
  const overflow = lines.length > lineCapacity;
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const estimatedCharacterLimit = Math.max(12, Math.floor((width - 48) / (fontSize * 0.55)) * lineCapacity);
  const tooLong = sign.targetText.replace(/\s/g, "").length > estimatedCharacterLimit;
  const missingTerms = sign.terms.filter(
    (term) => term.required && !sign.targetText.toLocaleLowerCase().includes(term.target.toLocaleLowerCase()),
  );
  return {
    lines,
    visible,
    overflow,
    tooLong,
    missingTerms,
    risk: overflow || tooLong || missingTerms.length ? "high" : lines.length >= lineCapacity - 1 ? "medium" : "low",
  };
}

function tokenize(value: string) {
  return value.match(/[\u3400-\u9fff]|[A-Za-zÀ-ÿ0-9'’\-]+|\s+|./gu) ?? [];
}

function lcsTable(left: string[], right: string[]) {
  const table = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

export function diffText(oldText: string, newText: string): DiffToken[] {
  const left = tokenize(oldText);
  const right = tokenize(newText);
  if (left.length * right.length > 180000) {
    return [{ type: "remove", value: oldText }, { type: "add", value: newText }];
  }
  const table = lcsTable(left, right);
  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  const push = (type: DiffToken["type"], value: string) => {
    const previous = tokens.at(-1);
    if (previous?.type === type) previous.value += value;
    else tokens.push({ type, value });
  };
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      push("same", left[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("remove", left[i]);
      i += 1;
    } else {
      push("add", right[j]);
      j += 1;
    }
  }
  while (i < left.length) push("remove", left[i++]);
  while (j < right.length) push("add", right[j++]);
  return tokens;
}

export function cloneTerms(terms: TermBinding[]) {
  return structuredClone(terms);
}
