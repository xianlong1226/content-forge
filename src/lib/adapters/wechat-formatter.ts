/**
 * WeChat Markdown Formatter — ported from the standalone wechat-formatter.html
 * Converts Markdown to fully inline-styled HTML that can be pasted into WeChat editor.
 *
 * Key: ALL styles must be inline (WeChat strips class/id selectors).
 */

import { Marked } from "marked";

// ============================================
// Theme definitions
// ============================================
interface ThemeColors {
  h2Border: string;
  h3Border: string;
  bqBorder: string;
  bqBg: string;
  codeColor: string;
  codeBg: string;
  linkColor: string;
}

const THEMES: Record<string, ThemeColors> = {
  "ink-gold": {
    h2Border: "#c9a84c",
    h3Border: "#c9a84c",
    bqBorder: "#c9a84c",
    bqBg: "#faf8f2",
    codeColor: "#c0392b",
    codeBg: "#f5f2eb",
    linkColor: "#c9a84c",
  },
  "clean-snow": {
    h2Border: "#1a73e8",
    h3Border: "#1a73e8",
    bqBorder: "#1a73e8",
    bqBg: "#f0f7ff",
    codeColor: "#e65100",
    codeBg: "#fff3e0",
    linkColor: "#1a73e8",
  },
  "ink-green": {
    h2Border: "#2e7d32",
    h3Border: "#2e7d32",
    bqBorder: "#2e7d32",
    bqBg: "#f1f8e9",
    codeColor: "#c62828",
    codeBg: "#f5f2eb",
    linkColor: "#2e7d32",
  },
  "warm-rose": {
    h2Border: "#c0392b",
    h3Border: "#c0392b",
    bqBorder: "#c0392b",
    bqBg: "#fdf0ee",
    codeColor: "#8e44ad",
    codeBg: "#f3e5f5",
    linkColor: "#c0392b",
  },
};

// ============================================
// Link + image tracking for footnotes
// ============================================
let linkIndex = 0;
const linkMap = new Map<number, { href: string; text: string }>();
let imageIndex = 0;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================
// Create a themed Marked instance
// ============================================
function createMarkedInstance(theme: string = "ink-gold") {
  const t = THEMES[theme] || THEMES["ink-gold"];
  const marked = new Marked();

  const renderer = new marked.Renderer();

  renderer.paragraph = function ({ tokens }: any) {
    return `<p style="margin:0 0 16px;text-align:justify;line-height:2;">${this.parser.parseInline(tokens)}</p>`;
  };

  renderer.heading = function ({ tokens, depth }: any) {
    const text = this.parser.parseInline(tokens);
    if (depth === 1) {
      return `<h1 style="text-align:center;font-size:22px;font-weight:700;margin:0 0 8px;color:#1a1a1a;line-height:1.6;">${text}</h1>`;
    }
    if (depth === 2) {
      return `<h2 style="font-size:18px;font-weight:700;margin:32px 0 16px;padding-bottom:8px;border-bottom:2px solid ${t.h2Border};color:#1a1a1a;">${text}</h2>`;
    }
    if (depth === 3) {
      return `<h3 style="font-size:16px;font-weight:700;margin:24px 0 12px;color:#1a1a1a;padding-left:10px;border-left:3px solid ${t.h3Border};">${text}</h3>`;
    }
    return `<h${depth} style="font-size:15px;font-weight:700;margin:20px 0 8px;color:#333;">${text}</h${depth}>`;
  };

  renderer.strong = function ({ tokens }: any) {
    return `<strong style="color:#1a1a1a;font-weight:700;">${this.parser.parseInline(tokens)}</strong>`;
  };

  renderer.em = function ({ tokens }: any) {
    return `<em style="color:#666;font-style:italic;">${this.parser.parseInline(tokens)}</em>`;
  };

  renderer.link = function ({ href, tokens }: any) {
    const text = this.parser.parseInline(tokens);
    if (!href || href.startsWith("#")) {
      return `<span style="color:${t.linkColor};">${text}</span>`;
    }
    linkIndex++;
    linkMap.set(linkIndex, { href, text });
    return `<span style="color:${t.linkColor};border-bottom:1px solid #ddd;">${text}<sup>${linkIndex}</sup></span>`;
  };

  renderer.code = ({ text, lang }) => {
    const code = text;
    const highlighted = escapeHtml(code); // simplified: no hljs in backend
    return `<pre style="margin:16px 0;padding:16px;background:#1e1e1e;border-radius:6px;overflow-x:auto;"><code style="background:none;color:#d4d4d4;padding:0;font-size:13px;line-height:1.6;font-family:'Menlo',monospace;">${highlighted}</code></pre>`;
  };

  renderer.codespan = ({ text }) => {
    return `<code style="font-family:'Menlo',monospace;background:${t.codeBg};color:${t.codeColor};padding:2px 6px;border-radius:3px;font-size:13px;">${text}</code>`;
  };

  renderer.image = ({ href, text }) => {
    imageIndex++;
    let imgName = text || "";
    if (!imgName) {
      try {
        const urlPath = new URL(href).pathname;
        imgName = decodeURIComponent(urlPath.split("/").pop() || "") || href;
      } catch {
        imgName = href.split("/").pop() || href;
      }
    }
    if (imgName.length > 50) {
      imgName = imgName.substring(0, 47) + "...";
    }
    return `<div style="margin:20px 0;padding:20px 16px;background:#faf8f2;border:2px dashed #c9a84c;border-radius:8px;text-align:center;color:#999;font-size:13px;line-height:1.8;"><span style="font-size:28px;display:block;margin-bottom:6px;">🖼</span><span style="font-weight:700;color:#8a7550;font-size:14px;word-break:break-all;">图片 ${imageIndex}：${imgName}</span><div style="font-size:12px;color:#bba86e;margin-top:4px;">请在公众号编辑器中手动插入此图片</div></div>`;
  };

  renderer.blockquote = function ({ tokens }: any) {
    return `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid ${t.bqBorder};background:${t.bqBg};color:#666;font-size:14px;border-radius:0 4px 4px 0;">${this.parser.parse(tokens)}</blockquote>`;
  };

  renderer.list = function ({ ordered, items }: any) {
    const tag = ordered ? "ol" : "ul";
    const body = items.map((item: any) => this.listitem(item)).join("");
    return `<${tag} style="margin:12px 0;padding-left:24px;">${body}</${tag}>`;
  };

  renderer.listitem = function (item: any) {
    const body = this.parser.parse(item.tokens);
    return `<li style="margin:4px 0;line-height:1.9;">${body}</li>`;
  };

  renderer.table = function ({ header, body }: any) {
    return `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;"><thead>${header}</thead><tbody>${body}</tbody></table>`;
  };

  renderer.tablerow = function ({ text }: any) {
    return `<tr>${text}</tr>`;
  };

  renderer.tablecell = function ({ tokens, header: isHeader }: any) {
    const text = this.parser.parseInline(tokens);
    const tag = isHeader ? "th" : "td";
    const bg = isHeader ? "background:#faf8f2;font-weight:700;" : "";
    return `<${tag} style="${bg}padding:${isHeader ? "10px" : "8px"} 12px;border:1px solid #e5e0d5;">${text}</${tag}>`;
  };

  renderer.hr = () => {
    return `<hr style="border:none;border-top:1px solid ${t.h2Border};margin:28px 0;">`;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  return marked;
}

// ============================================
// Main export: format markdown to WeChat-compatible HTML
// ============================================
export function formatForWechat(
  markdown: string,
  theme: string = "ink-gold"
): { html: string; footnotes: string } {
  // Reset state
  linkIndex = 0;
  linkMap.clear();
  imageIndex = 0;

  const marked = createMarkedInstance(theme);
  const bodyHtml = marked.parse(markdown) as string;

  // Build footnotes
  const t = THEMES[theme] || THEMES["ink-gold"];
  let footnotes = "";
  if (linkMap.size > 0) {
    for (const [idx, { href, text }] of linkMap) {
      footnotes += `<p style="margin:4px 0;line-height:1.6;">[${idx}] ${text}: <span style="color:${t.linkColor};">${href}</span></p>`;
    }
  }

  // Wrap in article container
  const fullHtml = `<div style="font-family:'Noto Serif SC',Georgia,serif;font-size:15px;line-height:2;color:#333;word-break:break-word;padding:0;margin:0;">${bodyHtml}${
    footnotes
      ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e0d5;font-size:13px;color:#999;">${footnotes}</div>`
      : ""
  }</div>`;

  return { html: fullHtml, footnotes };
}

export { THEMES };
