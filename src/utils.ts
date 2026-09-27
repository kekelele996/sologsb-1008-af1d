import type {
  AcceptanceResult,
  DiffToken,
  LayoutEvaluation,
  LayoutScenarioKey,
  LayoutStandard,
  SignItem,
  TermBinding,
} from "./types";

/**
 * 按场景限定的版面标准：最低字号（像素）与最多行数。
 * 场景名称命中关键词即适用对应标准。
 */
export const LAYOUT_STANDARDS: LayoutStandard[] = [
  { key: "rail", label: "轨道交通", match: ["轨道交通", "地铁", "站台", "车站"], minFont: 40, maxLines: 4 },
  { key: "mall", label: "商场疏散", match: ["商场", "疏散", "消防", "安全出口", "紧急出口"], minFont: 48, maxLines: 3 },
  { key: "park", label: "公园服务", match: ["公园", "景区", "绿地", "服务亭"], minFont: 28, maxLines: 3 },
  { key: "hospital", label: "医院入口", match: ["医院", "入口", "门诊", "急诊"], minFont: 32, maxLines: 2 },
];

export function standardForScenario(scenario: string): LayoutStandard | null {
  const name = scenario ?? "";
  return LAYOUT_STANDARDS.find((standard) => standard.match.some((keyword) => name.includes(keyword))) ?? null;
}

/** 验收依据指纹：译文、目标语言、场景、紧急修订任一变化都会使旧验收失效。 */
export function acceptanceBasis(sign: SignItem): string {
  return JSON.stringify({
    targetText: sign.targetText,
    targetLanguage: sign.targetLanguage,
    scenario: sign.scenario,
    emergencyRevision: sign.emergencyRevision,
  });
}

export type AcceptanceState = "valid" | "stale" | "none";

export function acceptanceState(sign: SignItem): AcceptanceState {
  if (!sign.acceptance) return "none";
  return sign.acceptance.basis === acceptanceBasis(sign) ? "valid" : "stale";
}

/** 对比失效验收的指纹，列出导致失效的变化项。 */
export function acceptanceBasisChanges(sign: SignItem): string[] {
  if (!sign.acceptance) return [];
  let old: { targetText?: string; targetLanguage?: string; scenario?: string; emergencyRevision?: boolean };
  try {
    old = JSON.parse(sign.acceptance.basis);
  } catch {
    return ["验收依据已变化"];
  }
  const changes: string[] = [];
  if (old.targetText !== sign.targetText) changes.push("译文已修改");
  if (old.targetLanguage !== sign.targetLanguage) changes.push("目标语言已更换");
  if (old.scenario !== sign.scenario) changes.push("适用场景已调整");
  if (Boolean(old.emergencyRevision) !== sign.emergencyRevision) changes.push("紧急修订状态已切换");
  return changes;
}

export function evaluateLayout(sign: SignItem, width?: number, fontSize?: number): LayoutEvaluation {
  const standard = standardForScenario(sign.scenario);
  const w = width ?? sign.previewWidth;
  const font = fontSize ?? sign.previewFont;
  const lineCount = estimatedLines(sign.targetText, w, font).length;
  const failures: LayoutEvaluation["failures"] = [];
  if (!standard) {
    failures.push({ kind: "unknown", message: "场景未匹配轨道交通、商场疏散、公园服务、医院入口标准" });
  } else {
    if (font < standard.minFont) {
      failures.push({
        kind: "font",
        message: `字号 ${font}px 低于「${standard.label}」最低 ${standard.minFont}px（缺 ${standard.minFont - font}px）`,
      });
    }
    if (lineCount > standard.maxLines) {
      failures.push({
        kind: "lines",
        message: `预计 ${lineCount} 行，超出「${standard.label}」最多 ${standard.maxLines} 行（超 ${lineCount - standard.maxLines} 行）`,
      });
    }
  }
  return { standard, width: w, fontSize: font, lineCount, pass: failures.length === 0, failures };
}

export function buildAcceptance(
  sign: SignItem,
  evaluation: LayoutEvaluation,
  acceptedAt = new Date().toISOString(),
): AcceptanceResult {
  return {
    passed: true,
    width: evaluation.width,
    fontSize: evaluation.fontSize,
    lineCount: evaluation.lineCount,
    standardKey: (evaluation.standard?.key ?? null) as LayoutScenarioKey | null,
    standardLabel: evaluation.standard?.label ?? "未匹配场景标准",
    basis: acceptanceBasis(sign),
    acceptedAt,
  };
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
