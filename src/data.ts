import type { AcceptanceRecord, ReviewStatus, SignItem, SignProject, TermBinding } from "./types";
import { DEFAULT_FONT, DEFAULT_WIDTH, evaluateLayout } from "./utils";

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "草稿",
  pending: "待确认",
  confirmed: "已确认",
  changes: "需修改",
};

const term = (source: string, target: string, confirmed = false, required = true): TermBinding => ({
  id: uid("term"),
  source,
  target,
  required,
  confirmed,
});

type RawSign = Omit<SignItem, "previewWidth" | "previewFont" | "acceptance">;

/** 按指定版面参数生成一条验收快照，passed/行数由当时场景标准计算 */
const acceptanceAt = (
  sign: RawSign,
  width: number,
  fontSize: number,
  overrides: Partial<AcceptanceRecord> = {},
): AcceptanceRecord => {
  const check = evaluateLayout(
    { ...sign, previewWidth: width, previewFont: fontSize, acceptance: null },
    width,
    fontSize,
  );
  return {
    id: uid("accept"),
    passed: check.pass,
    width,
    fontSize,
    standardKey: check.standard?.key ?? "",
    targetText: sign.targetText,
    targetLanguage: sign.targetLanguage,
    scenario: sign.scenario,
    emergencyRevision: sign.emergencyRevision,
    lineCount: check.lineCount,
    failureSummary: check.shortReasons,
    createdAt: "2026-09-20T03:00:00.000Z",
    ...overrides,
  };
};

export const createSeedProject = (): SignProject => {
  const rawSigns: RawSign[] = [
    {
      id: "sign-platform",
      code: "TR-01",
      sourceText: "候车区。请在黄线内排队，照看好随身物品。",
      targetLanguage: "English",
      targetText: "Waiting Area\nPlease queue behind the yellow line and keep your belongings with you.",
      scenario: "轨道交通站台",
      regulation: "GB/T 10001.1-2023 公共信息图形符号",
      status: "pending",
      terms: [term("候车区", "Waiting Area"), term("黄线", "yellow line")],
      comments: [],
      versions: [],
      emergencyRevision: false,
      updatedAt: "2026-09-21T09:20:00.000Z",
    },
    {
      id: "sign-exit",
      code: "EM-02",
      sourceText: "紧急出口。发生紧急情况时，请按指示方向迅速撤离，不要乘坐电梯。",
      targetLanguage: "English",
      targetText: "EMERGENCY EXIT\nIn an emergency, leave quickly in the direction shown. Do not use the elevator.",
      scenario: "商场疏散通道",
      regulation: "GB 13495.1-2015 消防安全标志",
      status: "confirmed",
      terms: [term("紧急出口", "EMERGENCY EXIT", true), term("电梯", "elevator", true)],
      comments: [],
      versions: [],
      emergencyRevision: false,
      updatedAt: "2026-09-18T06:10:00.000Z",
    },
    {
      id: "sign-water",
      code: "SV-03",
      sourceText: "直饮水。请勿将茶叶、果皮等杂物丢入水槽。",
      targetLanguage: "日本語",
      targetText: "飲料水\n茶殻や果物の皮などを流さないでください。",
      scenario: "公园服务亭",
      regulation: "城市公共设施双语标识译写规范",
      status: "changes",
      terms: [term("直饮水", "飲料水"), term("水槽", "排水口")],
      comments: [],
      versions: [],
      emergencyRevision: false,
      updatedAt: "2026-09-23T02:40:00.000Z",
    },
    {
      id: "sign-smoking",
      code: "PR-07",
      sourceText: "禁止吸烟。包括电子烟。",
      targetLanguage: "Français",
      targetText: "INTERDICTION DE FUMER\nCigarettes électroniques incluses.",
      scenario: "医院入口",
      regulation: "公共场所卫生管理条例实施细则",
      status: "draft",
      terms: [term("禁止吸烟", "INTERDICTION DE FUMER"), term("电子烟", "Cigarettes électroniques")],
      comments: [],
      versions: [],
      emergencyRevision: false,
      updatedAt: "2026-09-24T04:15:00.000Z",
    },
  ];

  // 每条标识的预览参数与验收独立保存：
  // - 站台标识在 960px/40px 下验收有效
  // - 疏散标识的验收快照基于旧译文，译文加长后已失效
  // - 公园标识从未验收
  // - 医院入口标识在 320px/28px 下验收未通过（字号不足）
  const signs: SignItem[] = rawSigns.map((sign) => {
    if (sign.id === "sign-platform") {
      return { ...sign, previewWidth: 960, previewFont: 40, acceptance: acceptanceAt(sign, 960, 40) };
    }
    if (sign.id === "sign-exit") {
      const oldText = "EMERGENCY EXIT\nDo not use the elevator.";
      return {
        ...sign,
        previewWidth: 720,
        previewFont: 36,
        acceptance: acceptanceAt({ ...sign, targetText: oldText }, 720, 36, {
          targetText: oldText,
          createdAt: "2026-09-17T08:30:00.000Z",
        }),
      };
    }
    if (sign.id === "sign-smoking") {
      return { ...sign, previewWidth: 320, previewFont: 28, acceptance: acceptanceAt(sign, 320, 28) };
    }
    return { ...sign, previewWidth: DEFAULT_WIDTH, previewFont: DEFAULT_FONT, acceptance: null };
  });

  return {
    id: "public-sign-review-1008",
    title: "城市公共标识多语言校对",
    location: "滨海交通枢纽一期",
    activeSignId: signs[0].id,
    signs,
    updatedAt: new Date().toISOString(),
  };
};

/** 兼容旧版本地数据：补齐每条标识独立的预览参数与验收字段 */
export function normalizeProject(project: SignProject): SignProject {
  let changed = false;
  const signs = project.signs.map((sign) => {
    if (typeof sign.previewWidth === "number" && typeof sign.previewFont === "number" && "acceptance" in sign) {
      return sign;
    }
    changed = true;
    return { ...sign, previewWidth: DEFAULT_WIDTH, previewFont: DEFAULT_FONT, acceptance: null };
  });
  return changed ? { ...project, signs } : project;
}
