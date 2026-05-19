import type { ParsedTopic, Platform, ContentStyle } from "../types";

export interface PromptConfig {
  topic: ParsedTopic;
  platform: Platform;
  style: ContentStyle;
  targetAudience?: string;
  customInstructions?: string;
}

const STYLE_MAP: Record<ContentStyle, string> = {
  "professional-friendly": "专业但亲切，严谨但易懂",
  casual: "轻松口语化，像跟朋友聊天，偶尔幽默",
  "dry-humor": "犀利直接，有态度，带点冷幽默",
};

const AUDIENCE_DEFAULTS: Record<Platform, string> = {
  wechat: "25-40岁职场人群",
  xiaohongshu: "20-35岁年轻职场人，爱收藏干货",
};

/**
 * Build the full LLM prompt for content generation.
 */
export function buildPrompt(config: PromptConfig): string {
  const { topic, platform, style, targetAudience, customInstructions } = config;
  const audience = targetAudience || AUDIENCE_DEFAULTS[platform];
  const styleDesc = STYLE_MAP[style];

  if (platform === "wechat") {
    return buildWechatPrompt(topic, styleDesc, audience, customInstructions);
  }
  return buildXiaohongshuPrompt(topic, styleDesc, audience, customInstructions);
}

function buildWechatPrompt(
  topic: ParsedTopic,
  style: string,
  audience: string,
  custom?: string
): string {
  return `你是一个资深内容创作者，擅长把复杂知识讲得通俗易懂。

请根据以下素材写一篇微信公众号文章。

【选题】${topic.title}

【核心数据】
${topic.coreData.map((d) => `- ${d}`).join("\n")}

【要点分析】
${topic.keyInsights.map((e) => `- ${e}`).join("\n")}

【参考标题】
${topic.suggestedTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

要求：
1. 标题：从参考标题中选一个或自拟，吸引眼球但不夸张，20字以内
2. 开头：用生活场景切入，引发共鸣（2-3句话）
3. 正文：
   - 分3-5个小节，每节200-300字
   - 用比喻、案例解释专业概念
   - 语言口语化，像跟朋友聊天
4. 结尾：给2-3个实用建议
5. 免责声明：在末尾加一句"本文仅供参考，不构成专业建议"

风格：${style}
目标受众：${audience}
字数：800-1200字

${custom ? `额外要求：${custom}` : ""}

输出格式：
---TITLE---
（标题）
---BODY---
（正文，用标准的Markdown格式）
---COVER_IMAGE_PROMPT---
（封面配图的画面建议：描述一个适合公众号封面的视觉场景，要有视觉冲击力，与文章主题相关，风格偏商务简约）`;
}

function buildXiaohongshuPrompt(
  topic: ParsedTopic,
  style: string,
  audience: string,
  custom?: string
): string {
  return `你是一个小红书内容创作者。

请根据以下素材写一篇小红书图文内容。

【选题】${topic.title}

【核心数据】
${topic.coreData.map((d) => `- ${d}`).join("\n")}

【要点分析】
${topic.keyInsights.map((e) => `- ${e}`).join("\n")}

要求：
1. 标题：小红书风格，带emoji，15字内
2. 正文：
   - 分点列出，每点50-80字
   - 带emoji，排版美观
   - 有互动引导（收藏/评论）
3. 免责声明：在末尾加"内容仅供参考"
4. 话题标签：5-8个相关话题

风格：${style}
目标受众：${audience}
字数：300-500字

${custom ? `额外要求：${custom}` : ""}

输出格式：
---TITLE---
（标题，带emoji）
---BODY---
（正文，分点排版+emoji）
---TAGS---
（话题标签，用空格分隔）
---IMAGE_PROMPTS---
（3-5张配图的画面建议，每行一个）`;
}
