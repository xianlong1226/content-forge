import { generateText } from "ai";
import { getModel, type LLMConfig } from "./parse-report";

const REVIEW_PROMPT = `你是一个内容合规审查专家。请审查以下文章内容，检查是否存在合规问题。

审查维度：
1. 行业合规：是否存在违反行业规范的表述（如虚假承诺、替代专业建议、未经验证的断言）
2. 广告法：是否存在绝对化用语（如"最"、"第一"、"绝对"、"100%"、"保证"、"首家"）
3. 平台规则：
   - 微信公众号：标题党、诱导分享、虚假信息
   - 小红书：导流到其他平台、虚假种草、过度夸张
4. 事实性：常识性数据是否合理（如"90%的人不知道"这类无依据数据）
5. 免责声明：是否包含"仅供参考"类声明
6. 其他风险：你认为可能有合规风险的任何内容

请严格返回以下JSON格式，不要包含任何其他内容：
{
  "violations": [
    {
      "type": "industry_compliance | ad_law | platform_rule | factual | missing_disclaimer | other",
      "category": "行业合规/广告法/平台规则/事实性/免责声明/其他",
      "original": "原文中的问题片段",
      "suggestion": "修改建议",
      "severity": "error | warning"
    }
  ]
}

如果没有问题，返回 {"violations": []}。

注意：
- 只标记真正有问题的地方，不要过度审查
- severity: error 表示严重违规必须修改，warning 表示建议优化
- 如果有免责声明，不要报 missing_disclaimer

发布平台：{platform}

文章内容：
---`;

export async function reviewWithLLM(
  text: string,
  platform: "wechat" | "xiaohongshu",
  config: LLMConfig
): Promise<{ violations: Array<{
  type: string;
  category: string;
  original: string;
  suggestion: string;
  severity: "error" | "warning";
}> }> {
  const model = getModel(config);

  const result = await generateText({
    model,
    prompt: `${REVIEW_PROMPT.replace("{platform}", platform === "wechat" ? "微信公众号" : "小红书")}\n${text}`,
    temperature: 0.1,
  });

  const responseText = result.text;

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { violations: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const violations = Array.isArray(parsed.violations) ? parsed.violations : [];
    return {
      violations: violations.map((v: any) => ({
        type: String(v.type || "other"),
        category: String(v.category || "其他"),
        original: String(v.original || ""),
        suggestion: String(v.suggestion || ""),
        severity: v.severity === "error" ? "error" : "warning",
      })),
    };
  } catch {
    return { violations: [] };
  }
}
