/**
 * Convert Markdown to WeChat-compatible inline HTML.
 * WeChat editor requires inline CSS, no external stylesheets.
 */
export function markdownToWechatHtml(markdown: string, title: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:bold;color:#1a1a1a;margin:24px 0 12px;border-left:4px solid #4CAF50;padding-left:12px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:bold;color:#1a1a1a;margin:28px 0 14px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 20px;text-align:center;">$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e74c3c;">$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0;color:#333;line-height:1.8;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) =>
    `<ul style="padding-left:20px;margin:8px 0;">${match}</ul>`
  );

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:4px 0;color:#333;line-height:1.8;">$1</li>');

  // Paragraphs (lines not already tagged)
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol") || trimmed.startsWith("<li")) {
        return trimmed;
      }
      return `<p style="font-size:15px;line-height:1.8;color:#333;margin:10px 0;">${trimmed}</p>`;
    })
    .join("\n");

  // Wrap in full WeChat article template
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
</head>
<body style="max-width:578px;margin:0 auto;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

<div style="text-align:center;margin-bottom:30px;">
  <h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 8px;">${title}</h1>
  <p style="font-size:13px;color:#999;">仅供参考</p>
  <div style="width:60px;height:3px;background:#4CAF50;margin:12px auto 0;"></div>
</div>

${html}

<div style="margin-top:30px;padding:12px;background:#f5f5f5;border-radius:8px;border-left:4px solid #ff9800;">
  <p style="font-size:13px;color:#666;margin:0;line-height:1.6;">⚠️ 本文仅供参考，不构成专业建议。</p>
</div>

</body>
</html>`;
}

/**
 * Generate a cover image prompt for WeChat article.
 */
export function generateCoverPrompt(title: string, topic: string): string {
  return `Professional article cover image, modern minimalist style, about "${topic}", warm colors, professional illustration, 900x383 pixels, no text overlay`;
}
