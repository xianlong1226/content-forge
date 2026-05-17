import type { XiaohongshuOutput } from "../types";

/**
 * Parse and format Xiaohongshu content from raw LLM output.
 * Ensures proper emoji usage, formatting, and tag structure.
 */
export function formatXiaohongshuContent(
  title: string,
  body: string,
  tags: string[],
  imagePrompts: string[]
): XiaohongshuOutput {
  // Ensure title has emoji (add if missing)
  let formattedTitle = title;
  if (!hasEmoji(title)) {
    formattedTitle = `💡${title}`;
  }

  // Truncate title to 15 chars
  if (formattedTitle.length > 18) {
    formattedTitle = formattedTitle.slice(0, 17) + "…";
  }

  // Ensure body has emoji in bullet points
  let formattedBody = body;
  // Add emoji to numbered points if missing
  formattedBody = formattedBody.replace(
    /^(\d+)\.\s/gm,
    (_, num) => `${getPointEmoji(parseInt(num))} `
  );

  // Add emoji to dash points if missing
  formattedBody = formattedBody.replace(
    /^[-•]\s/gm,
    () => `${getBulletEmoji()} `
  );

  // Format tags
  const formattedTags = tags.map((tag) => {
    if (tag.startsWith("#")) return tag;
    return `#${tag}`;
  });

  return {
    title: formattedTitle,
    body: formattedBody,
    imagePrompts: imagePrompts.length > 0 ? imagePrompts : [
      `主图：关于${title}的信息图，简洁现代风格`,
      `配图1：数据可视化图表`,
      `配图2：实用建议清单卡片`,
    ],
    tags: formattedTags.length > 0 ? formattedTags : [],
  };
}

function hasEmoji(text: string): boolean {
  return /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}💡✅❌🔥⭐]/u.test(text);
}

const POINT_EMOJIS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
function getPointEmoji(index: number): string {
  return POINT_EMOJIS[Math.min(index - 1, POINT_EMOJIS.length - 1)] || "📌";
}

const BULLET_EMOJIS = ["✅", "💡", "📌", "🌟", "👉", "🔥"];
let bulletIndex = 0;
function getBulletEmoji(): string {
  const emoji = BULLET_EMOJIS[bulletIndex % BULLET_EMOJIS.length];
  bulletIndex++;
  return emoji;
}

/**
 * Generate the final Xiaohongshu post text.
 */
export function renderXiaohongshuPost(output: XiaohongshuOutput): string {
  return `${output.title}

${output.body}

${output.tags.join(" ")}

---
📌 保存收藏，随时查看
💬 评论区说说你的经历`;
}
