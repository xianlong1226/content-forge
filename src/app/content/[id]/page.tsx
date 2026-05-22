"use client";

import { useState, useEffect, use, useCallback } from "react";
import type { GeneratedImage } from "@/lib/types";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-100 text-gray-600" },
  generated: { label: "已生成", color: "bg-green-100 text-green-700" },
  reviewed: { label: "已审查", color: "bg-blue-100 text-blue-700" },
  exported: { label: "已导出", color: "bg-purple-100 text-purple-700" },
};

const PLATFORM_MAP: Record<string, { label: string; color: string }> = {
  wechat: { label: "公众号", color: "bg-green-50 text-green-600" },
  xiaohongshu: { label: "小红书", color: "bg-red-50 text-red-600" },
};

function extractTitle(raw: string | null, topicTitle?: string): string {
  if (!raw) return topicTitle || "无标题";
  const m = raw.match(/---TITLE---\s*\n(.+?)(?:\n|$)/);
  return m?.[1]?.trim() || topicTitle || raw.slice(0, 60) + "...";
}

function extractBody(raw: string | null): string {
  if (!raw) return "";
  const m = raw.match(/---BODY---\s*\n([\s\S]*?)(?=\n---(?:TAGS|IMAGE_PROMPTS|COVER_IMAGE_PROMPT)---|$)/);
  return m?.[1]?.trim() || raw;
}

function extractImagePrompts(raw: string | null, platform: string): string[] {
  if (!raw) return [];

  if (platform === "xiaohongshu") {
    const match = raw.match(/---IMAGE_PROMPTS---\s*\n([\s\S]*?)$/);
    if (match) {
      return match[1]
        .split("\n")
        .map((l) => l.replace(/^\d+[.、)）]\s*/, "").replace(/^[-*]\s*/, "").trim())
        .filter(Boolean);
    }
  }

  if (platform === "wechat") {
    const match = raw.match(/---COVER_IMAGE_PROMPT---\s*\n([\s\S]*?)$/);
    if (match) {
      const text = match[1].trim();
      return text ? [text] : [];
    }
  }

  return [];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Image generation state
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState("1024x1024");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/contents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("内容不存在");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function copyToClipboard(htmlContent: string, plainText: string, key: string) {
    try {
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
      ]);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = plainText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  async function handleGenerateImage(prompt: string, index: number) {
    setGeneratingIndex(index);
    setImageError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: id, prompt, size: imgSize }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "生成失败");
      // Update local state
      setData((prev: any) => ({
        ...prev,
        images: result.images,
      }));
    } catch (err: any) {
      setImageError(err.message);
    } finally {
      setGeneratingIndex(null);
    }
  }

  async function handleGenerateCustom() {
    if (!customPrompt.trim()) return;
    setGeneratingIndex(-1);
    setImageError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: id, prompt: customPrompt.trim(), size: imgSize }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "生成失败");
      setData((prev: any) => ({ ...prev, images: result.images }));
      setCustomPrompt("");
    } catch (err: any) {
      setImageError(err.message);
    } finally {
      setGeneratingIndex(null);
    }
  }

  async function handleGenerateAll() {
    const prompts = extractImagePrompts(data?.rawMarkdown, data?.platform);
    if (prompts.length === 0) return;
    setGeneratingAll(true);
    setImageError(null);
    for (let i = 0; i < prompts.length; i++) {
      setGeneratingIndex(i);
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: id, prompt: prompts[i], size: imgSize }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "生成失败");
        setData((prev: any) => ({ ...prev, images: result.images }));
      } catch (err: any) {
        setImageError(`第 ${i + 1} 张图生成失败: ${err.message}`);
        break;
      }
    }
    setGeneratingIndex(null);
    setGeneratingAll(false);
  }

  async function handleDeleteImage(imageIndex: number) {
    try {
      const res = await fetch("/api/generate-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: id, imageIndex }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "删除失败");
      setData((prev: any) => ({ ...prev, images: result.images }));
    } catch (err: any) {
      setImageError(err.message);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">加载中...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || "加载失败"}</p>
        <a href="/history" className="text-green-600 hover:underline">返回历史记录</a>
      </div>
    );
  }

  const status = STATUS_MAP[data.status] || STATUS_MAP.draft;
  const platform = PLATFORM_MAP[data.platform] || { label: data.platform, color: "bg-gray-50 text-gray-600" };
  const title = extractTitle(data.rawMarkdown, data.topicTitle);
  const body = extractBody(data.rawMarkdown);
  const imagePrompts = extractImagePrompts(data.rawMarkdown, data.platform);
  const images: GeneratedImage[] = data.images
    ? (typeof data.images === "string" ? JSON.parse(data.images) : data.images)
    : [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <a href="/history" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1">
        ← 返回历史记录
      </a>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${platform.color}`}>{platform.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span>创建: {formatDate(data.createdAt)}</span>
            <span>更新: {formatDate(data.updatedAt)}</span>
          </div>
          {data.renderedHtml && (
            <button
              onClick={() => {
                if (data.platform === "wechat") {
                  copyToClipboard(data.renderedHtml, body, "copy-content");
                } else {
                  copyToClipboard(data.renderedHtml, data.renderedHtml, "copy-content");
                }
              }}
              className={`mt-3 w-full py-2 text-sm rounded-lg transition-colors font-medium ${
                data.platform === "wechat"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {copiedKey === "copy-content"
                ? "✅ 已复制！粘贴到编辑器即可"
                : data.platform === "wechat"
                  ? "📋 复制排版内容（粘贴到公众号编辑器）"
                  : "📋 复制全部内容（粘贴到小红书）"}
            </button>
          )}
        </div>

        {/* Raw markdown content */}
        {body && (
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-2">正文内容</h3>
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
              {body}
            </pre>
          </div>
        )}

        {/* Rendered HTML preview */}
        {data.renderedHtml && (
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-2">排版预览</h3>
            {data.platform === "xiaohongshu" ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
                {data.renderedHtml}
              </pre>
            ) : (
              <div
                className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto text-sm"
                dangerouslySetInnerHTML={{ __html: data.renderedHtml }}
              />
            )}
          </div>
        )}

        {/* Image Generation Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">🖼️ 配图生成</h3>
            <div className="flex items-center gap-2">
              <select
                value={imgSize}
                onChange={(e) => setImgSize(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="1024x1024">1:1 方形</option>
                <option value="1280x720">16:9 横版封面</option>
                <option value="720x1280">9:16 竖版小红书</option>
                <option value="1024x576">16:9 宽屏</option>
                <option value="576x1024">9:16 窄竖版</option>
              </select>
              {imagePrompts.length > 0 && (
                <button
                  onClick={handleGenerateAll}
                  disabled={generatingAll || generatingIndex !== null}
                  className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingAll ? "生成中..." : "一键生成全部配图"}
                </button>
              )}
            </div>
          </div>

          {/* Image Prompts */}
          {imagePrompts.length > 0 && (
            <div className="space-y-3 mb-4">
              {imagePrompts.map((prompt, i) => {
                const relatedImages = images.filter((img) => img.prompt === prompt);
                return (
                  <div key={i} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-400 block mb-1">
                          {data.platform === "wechat" ? "封面图提示词" : `配图 ${i + 1}`}
                        </span>
                        <p className="text-sm text-gray-700 break-words">{prompt}</p>
                      </div>
                      <button
                        onClick={() => handleGenerateImage(prompt, i)}
                        disabled={generatingIndex !== null}
                        className="shrink-0 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {generatingIndex === i ? (
                          <>
                            <span className="animate-spin">⏳</span> 生成中
                          </>
                        ) : (
                          "🎨 生成"
                        )}
                      </button>
                    </div>
                    {/* Show generated images for this prompt */}
                    {relatedImages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {relatedImages.map((img, j) => {
                          const globalIdx = images.indexOf(img);
                          return (
                            <div key={j} className="relative group">
                              <img
                                src={img.url}
                                alt={img.prompt}
                                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                <a
                                  href={img.url}
                                  download={`image-${globalIdx}.png`}
                                  className="text-xs text-white bg-white/20 px-2 py-1 rounded hover:bg-white/40"
                                >
                                  下载
                                </a>
                                <button
                                  onClick={() => handleDeleteImage(globalIdx)}
                                  className="text-xs text-white bg-red-500/60 px-2 py-1 rounded hover:bg-red-500/80"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom prompt input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerateCustom()}
              placeholder="输入自定义图片描述..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleGenerateCustom}
              disabled={!customPrompt.trim() || generatingIndex !== null}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingIndex === -1 ? "生成中..." : "生成"}
            </button>
          </div>

          {/* Error display */}
          {imageError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
              {imageError}
            </div>
          )}

          {/* All generated images gallery */}
          {images.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 mb-2">
                已生成 {images.length} 张配图
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1 p-2">
                      <p className="text-xs text-white text-center line-clamp-2">{img.prompt}</p>
                      <div className="flex gap-1">
                        <a
                          href={img.url}
                          download={`image-${i}.png`}
                          className="text-xs text-white bg-white/20 px-2 py-1 rounded hover:bg-white/40"
                        >
                          下载
                        </a>
                        <button
                          onClick={() => handleDeleteImage(i)}
                          className="text-xs text-white bg-red-500/60 px-2 py-1 rounded hover:bg-red-500/80"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div className="absolute top-1 right-1 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded">
                      {img.model.split("/").pop()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No prompts hint */}
          {imagePrompts.length === 0 && images.length === 0 && (
            <p className="text-sm text-gray-400">
              暂无图片提示词。可在上方输入自定义描述生成配图，或重新生成文章以自动提取提示词。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
