import type { Violation } from "../types";

export interface ComplianceConfig {
  bannedWords: Record<string, string>;
  sensitivePatterns: { pattern: RegExp; severity: "error" | "warning" }[];
  disclaimerWechat: string;
  disclaimerXhs: string;
  disclaimerKeywords: string[];
}

const DEFAULT_CONFIG: ComplianceConfig = {
  bannedWords: {},
  sensitivePatterns: [
    { pattern: /百分之百/g, severity: "warning" as const },
    { pattern: /保证.{0,4}效果/g, severity: "warning" as const },
  ],
  disclaimerWechat: "本文仅供参考，不构成专业建议。",
  disclaimerXhs: "内容仅供参考。",
  disclaimerKeywords: ["仅供参考"],
};

export const MEDICAL_CONFIG: ComplianceConfig = {
  bannedWords: {
    治疗: "改善",
    诊断: "识别",
    处方药: "药品",
    治愈: "恢复",
    必须用药: "可能需要咨询医生",
    你的病是: "可能的原因包括",
    保证治愈: "可能改善",
    药到病除: "可能缓解",
    根治: "改善",
    彻底治愈: "逐步恢复",
  },
  sensitivePatterns: [
    { pattern: /必须?吃.{0,5}药/g, severity: "error" as const },
    { pattern: /不用看医生/g, severity: "error" as const },
    { pattern: /自己(买|吃|用)药/g, severity: "error" as const },
    { pattern: /百分之百/g, severity: "warning" as const },
    { pattern: /保证.{0,4}效果/g, severity: "warning" as const },
  ],
  disclaimerWechat: "本文仅供参考，不构成医疗建议。如有健康问题，请咨询专业医疗机构或医生。",
  disclaimerXhs: "科普内容，仅供参考，不替代医生诊断。",
  disclaimerKeywords: ["仅供参考", "医疗建议", "不替代", "不构成"],
};

/**
 * Check content for compliance violations.
 * Returns violations found and auto-fixed text.
 */
export function checkCompliance(
  text: string,
  platform: "wechat" | "xiaohongshu",
  config: ComplianceConfig = DEFAULT_CONFIG
): { violations: Violation[]; autoFixed: string; hasDisclaimer: boolean } {
  const violations: Violation[] = [];
  let autoFixed = text;

  const disclaimer = platform === "wechat" ? config.disclaimerWechat : config.disclaimerXhs;
  const hasDisclaimer = text.includes(disclaimer) || config.disclaimerKeywords.some((kw) => text.includes(kw));

  const isDisclaimerLine = (line: string) =>
    config.disclaimerKeywords.some((kw) => line.includes(kw));

  // Check banned words
  const lines = autoFixed.split("\n");
  for (const [banned, replacement] of Object.entries(config.bannedWords)) {
    for (let i = 0; i < lines.length; i++) {
      if (isDisclaimerLine(lines[i])) continue;
      let searchFrom = 0;
      while (true) {
        const idx = lines[i].indexOf(banned, searchFrom);
        if (idx === -1) break;
        violations.push({
          type: "banned_word",
          original: banned,
          replacement,
          position: -1,
          severity: "warning",
        });
        lines[i] = lines[i].slice(0, idx) + replacement + lines[i].slice(idx + banned.length);
        searchFrom = idx + replacement.length;
      }
    }
  }
  autoFixed = lines.join("\n");

  // Check sensitive patterns
  for (const { pattern, severity } of config.sensitivePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      violations.push({
        type: "sensitive_claim",
        original: match[0],
        position: match.index,
        severity,
      });
    }
  }

  // Append disclaimer if missing
  if (!hasDisclaimer) {
    violations.push({
      type: "missing_disclaimer",
      original: "",
      replacement: disclaimer,
      position: -1,
      severity: "error",
    });
    autoFixed = autoFixed.trimEnd() + "\n\n" + disclaimer;
  }

  return { violations, autoFixed, hasDisclaimer };
}
