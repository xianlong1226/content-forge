"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { GeneratedImage } from "@/lib/types";

interface ParsedTopic {
  id: string;
  title: string;
  coreData: string[];
  keyInsights: string[];
  suggestedTitles: string[];
  heatLevel: number;
}

interface ParseResult {
  reportId: string;
  date: string;
  topics: ParsedTopic[];
  supplementaryTopics: ParsedTopic[];
}

type Phase = "upload" | "select" | "generate" | "review" | "export";
type Platform = "wechat" | "xiaohongshu";

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

function CreatePageInner() {
  const searchParams = useSearchParams();
  const reportIdParam = searchParams.get("reportId");

  const [phase, setPhase] = useState<Phase>(reportIdParam ? "select" : "upload");
  const [markdown, setMarkdown] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<ParsedTopic[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["wechat", "xiaohongshu"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!reportIdParam) return;
    setLoading(true);
    fetch(`/api/reports/${reportIdParam}`)
      .then((r) => {
        if (!r.ok) throw new Error("内容不存在");
        return r.json();
      })
      .then((data) => {
        setParseResult(data);
        setPhase("select");
      })
      .catch((e) => {
        setError(e.message);
        setPhase("upload");
      })
      .finally(() => setLoading(false));
  }, [reportIdParam]);

  // Generate state
  const [currentTopicIdx, setCurrentTopicIdx] = useState(0);
  const [wechatText, setWechatText] = useState("");
  const [xhsText, setXhsText] = useState("");
  const [wechatContentId, setWechatContentId] = useState("");
  const [xhsContentId, setXhsContentId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Review state
  const [violations, setViolations] = useState<any[]>([]);
  const [passed, setPassed] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Export state
  const [exportData, setExportData] = useState<any[]>([]);

  // Image generation state (export phase)
  const [contentImages, setContentImages] = useState<Record<string, GeneratedImage[]>>({});
  const [genImgIdx, setGenImgIdx] = useState<number | null>(null);
  const [genImgAll, setGenImgAll] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [customImgPrompt, setCustomImgPrompt] = useState<Record<string, string>>({});
  const [imgSize, setImgSize] = useState("1024x1024");

  async function handleParse() {
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      if (markdown.trim()) {
        formData.append("markdown", markdown);
      } else if (fileRef.current?.files?.[0]) {
        formData.append("file", fileRef.current.files[0]);
      } else {
        setError("请输入或上传素材内容");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "解析失败");
        setLoading(false);
        return;
      }

      setParseResult(data);
      setPhase("select");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleTopic(topic: ParsedTopic) {
    setSelectedTopics((prev) => {
      const exists = prev.find((t) => t.id === topic.id);
      if (exists) return prev.filter((t) => t.id !== topic.id);
      return [...prev, topic];
    });
  }

  async function handleGenerate() {
    if (selectedTopics.length === 0 || selectedPlatforms.length === 0) return;
    setPhase("generate");
    setGenError("");
    if (selectedPlatforms.includes("wechat")) {
      setWechatText("");
      setWechatContentId("");
    }
    if (selectedPlatforms.includes("xiaohongshu")) {
      setXhsText("");
      setXhsContentId("");
    }
    setGenerating(true);
    setError("");

    const topic = selectedTopics[0];

    const platformCalls = selectedPlatforms.map((p) =>
      p === "wechat"
        ? generateStream(topic.id, "wechat", setWechatText, setWechatContentId)
        : generateStream(topic.id, "xiaohongshu", setXhsText, setXhsContentId)
    );
    const results = await Promise.allSettled(platformCalls);

    setGenerating(false);

    // Check for errors
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason?.message || "生成失败");
    if (errors.length > 0) {
      setGenError(errors.join("; "));
    }
  }

  async function generateStream(
    tid: string,
    platform: "wechat" | "xiaohongshu",
    setter: (fn: (prev: string) => string) => void,
    setContentId: (id: string) => void
  ) {
    setter(() => "");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId: tid,
        platform,
        style: "professional-friendly",
      }),
    });

    if (!res.ok) {
      let errMsg = `生成失败 (${platform})`;
      try {
        const errData = await res.json();
        errMsg = errData.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("无法读取响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "chunk") {
            setter((prev) => prev + data.text);
          } else if (data.type === "done") {
            setContentId(data.contentId);
          } else if (data.type === "error") {
            setter((prev) => prev + "\n\n⚠️ " + data.error);
          }
        } catch {}
      }
    }
  }

  async function handleReview() {
    const contentIds = [wechatContentId, xhsContentId].filter(Boolean);
    if (contentIds.length === 0) {
      setGenError("没有可审查的内容");
      return;
    }

    // Sync edited text to DB before review
    const updates: Promise<any>[] = [];
    if (wechatContentId) {
      updates.push(
        fetch("/api/contents/" + wechatContentId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawMarkdown: wechatText }),
        })
      );
    }
    if (xhsContentId) {
      updates.push(
        fetch("/api/contents/" + xhsContentId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawMarkdown: xhsText }),
        })
      );
    }
    if (updates.length > 0) await Promise.all(updates);

    setReviewLoading(true);
    setPhase("review");

    const allViolations: any[] = [];
    let allPassed = true;

    for (const cid of contentIds) {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: cid }),
      });
      const data = await res.json();
      allViolations.push(...(data.violations || []));
      if (!data.passed) allPassed = false;
    }

    setViolations(allViolations);
    setPassed(allPassed);
    setReviewLoading(false);
  }

  async function handleExport() {
    const contentIds = [wechatContentId, xhsContentId].filter(Boolean);
    const results: any[] = [];

    for (const cid of contentIds) {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: cid, theme: wechatTheme }),
      });
      const data = await res.json();
      results.push(data);
    }

    setExportData(results);
    setPhase("export");
  }

  async function handleGenImage(contentId: string, prompt: string, index: number) {
    setGenImgIdx(index);
    setImgError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, prompt, size: imgSize }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "生成失败");
      setContentImages((prev) => ({ ...prev, [contentId]: result.images }));
    } catch (err: any) {
      setImgError(err.message);
    } finally {
      setGenImgIdx(null);
    }
  }

  async function handleGenAllImages(contentId: string, prompts: string[]) {
    if (prompts.length === 0) return;
    setGenImgAll(true);
    setImgError(null);
    for (let i = 0; i < prompts.length; i++) {
      setGenImgIdx(i);
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId, prompt: prompts[i], size: imgSize }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "生成失败");
        setContentImages((prev) => ({ ...prev, [contentId]: result.images }));
      } catch (err: any) {
        setImgError(`第 ${i + 1} 张图生成失败: ${err.message}`);
        break;
      }
    }
    setGenImgIdx(null);
    setGenImgAll(false);
  }

  async function handleDeleteImage(contentId: string, imageIndex: number) {
    try {
      const res = await fetch("/api/generate-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, imageIndex }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "删除失败");
      setContentImages((prev) => ({ ...prev, [contentId]: result.images }));
    } catch (err: any) {
      setImgError(err.message);
    }
  }

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [wechatTheme, setWechatTheme] = useState("ink-gold");

  async function copyToClipboard(htmlContent: string, plainText: string, key: string) {
    try {
      // Copy as both HTML and plain text — WeChat editor picks up HTML,
      // other editors get plain text fallback
      const htmlBlob = new Blob([htmlContent], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
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

  // ========== Phase: Upload ==========
  if (phase === "upload") {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">上传素材</h1>
        <p className="text-gray-500 mb-6">粘贴素材内容或上传 Markdown 文件</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            粘贴内容
          </label>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={"# 热点素材 | 2026-05-17\n\n## 🔥 热门话题一：...\n### 核心数据\n- ..."}
            className="w-full h-80 p-4 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            或上传文件
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,.markdown"
            onChange={() => setMarkdown("")}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            ❌ {error}
          </div>
        )}

        <button
          onClick={handleParse}
          disabled={loading}
          className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "⏳ AI 正在解析内容，请稍候..." : "🔍 解析内容"}
        </button>
      </div>
    );
  }

  // ========== Phase: Select ==========
  if (phase === "select") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">选题筛选</h1>
            <p className="text-gray-500 mt-1">
              {parseResult?.date} · 共 {parseResult?.topics.length} 个热点
            </p>
          </div>
          <button
            onClick={() => { setPhase("upload"); setError(""); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 返回上传
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {parseResult?.topics.map((topic) => {
            const isSelected = selectedTopics.some((t) => t.id === topic.id);
            return (
              <div
                key={topic.id}
                onClick={() => toggleTopic(topic)}
                className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all ${
                  isSelected
                    ? "border-green-500 shadow-md shadow-green-100"
                    : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔥</span>
                      <h3 className="font-bold text-gray-900">{topic.title}</h3>
                    </div>
                    <div className="mt-2 space-y-1">
                      {topic.coreData.slice(0, 2).map((data, i) => (
                        <p key={i} className="text-sm text-gray-600 line-clamp-1">
                          • {data}
                        </p>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {topic.suggestedTitles.slice(0, 2).map((title, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                        >
                          {title.slice(0, 20)}...
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className="text-sm">
                      {"⭐".repeat(Math.min(topic.heatLevel, 5))}
                    </span>
                    {isSelected && (
                      <span className="text-green-600 font-bold text-sm">✓ 已选</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {parseResult?.supplementaryTopics && parseResult.supplementaryTopics.length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-3">💡 补充选题</h2>
            <div className="space-y-3 mb-6">
              {parseResult.supplementaryTopics.map((topic) => {
                const isSelected = selectedTopics.some((t) => t.id === topic.id);
                return (
                  <div
                    key={topic.id}
                    onClick={() => toggleTopic(topic)}
                    className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all ${
                      isSelected
                        ? "border-green-500 shadow-md shadow-green-100"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>💊</span>
                      <h3 className="font-bold text-gray-900">{topic.title}</h3>
                      {isSelected && (
                        <span className="ml-auto text-green-600 font-bold text-sm">✓ 已选</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-500">
              已选 <span className="font-bold text-green-600">{selectedTopics.length}</span> 个选题
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlatforms(prev =>
                  prev.includes("wechat") ? prev.filter(p => p !== "wechat") : [...prev, "wechat"]
                )}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                  selectedPlatforms.includes("wechat")
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                📱 公众号
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlatforms(prev =>
                  prev.includes("xiaohongshu") ? prev.filter(p => p !== "xiaohongshu") : [...prev, "xiaohongshu"]
                )}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                  selectedPlatforms.includes("xiaohongshu")
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                📕 小红书
              </button>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={selectedTopics.length === 0 || selectedPlatforms.length === 0}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 开始生成内容
          </button>
        </div>
      </div>
    );
  }

  // ========== Phase: Generate ==========
  if (phase === "generate") {
    return (
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              🤖 内容生成
              {selectedTopics[0] && (
                <span className="text-base font-normal text-gray-500 ml-2">
                  {selectedTopics[0].title}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              {[
                { key: "generate", label: "1. 生成", icon: "🤖" },
                { key: "review", label: "2. 审查", icon: "✅" },
                { key: "export", label: "3. 导出", icon: "📤" },
              ].map((s) => (
                <span
                  key={s.key}
                  className={`text-sm px-3 py-1 rounded-full ${
                    phase === s.key
                      ? "bg-green-100 text-green-700 font-medium"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s.icon} {s.label}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setPhase("select"); setWechatText(""); setXhsText(""); setGenError(""); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 返回选题
          </button>
        </div>

        {/* Error banner */}
        {genError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium mb-1">❌ 生成失败</p>
            <p className="text-sm text-red-600">{genError}</p>
            <button
              onClick={handleGenerate}
              className="mt-2 text-sm text-red-700 underline hover:no-underline"
            >
              重新生成
            </button>
          </div>
        )}

        {/* Preview */}
        <div className={`grid gap-6 mb-6 ${selectedPlatforms.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {/* WeChat */}
          {selectedPlatforms.includes("wechat") && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                <span className="font-medium text-green-700">📱 微信公众号</span>
                {generating && <span className="text-xs text-green-500 animate-pulse">生成中...</span>}
              </div>
              <div className="p-4 min-h-[400px]">
                {wechatText ? (
                  <textarea
                    value={wechatText}
                    onChange={(e) => setWechatText(e.target.value)}
                    disabled={generating}
                    className="w-full min-h-[380px] whitespace-pre-wrap text-sm text-gray-700 font-sans bg-transparent border-0 outline-none resize-y p-0 focus:ring-0 disabled:opacity-100"
                  />
                ) : (
                  <p className="text-gray-400 text-sm">
                    {generating ? "等待生成..." : "点击「开始生成」"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Xiaohongshu */}
          {selectedPlatforms.includes("xiaohongshu") && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <span className="font-medium text-red-700">📕 小红书</span>
                {generating && <span className="text-xs text-red-500 animate-pulse">生成中...</span>}
              </div>
              <div className="p-4 min-h-[400px]">
                {xhsText ? (
                  <textarea
                    value={xhsText}
                    onChange={(e) => setXhsText(e.target.value)}
                    disabled={generating}
                    className="w-full min-h-[380px] whitespace-pre-wrap text-sm text-gray-700 font-sans bg-transparent border-0 outline-none resize-y p-0 focus:ring-0 disabled:opacity-100"
                  />
                ) : (
                  <p className="text-gray-400 text-sm">
                    {generating ? "等待生成..." : "点击「开始生成」"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {!generating && !wechatText && !xhsText && !genError && (
              <button
                onClick={handleGenerate}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                🚀 开始生成
              </button>
            )}
          </div>
          {!generating && (wechatContentId || xhsContentId) && (
            <button
              onClick={handleReview}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✅ 下一步：合规审查
            </button>
          )}
        </div>
      </div>
    );
  }

  // ========== Phase: Review ==========
  if (phase === "review") {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">✅ 合规审查</h1>
            <div className="flex items-center gap-3 mt-2">
              {[
                { key: "generate", label: "1. 生成", icon: "🤖" },
                { key: "review", label: "2. 审查", icon: "✅" },
                { key: "export", label: "3. 导出", icon: "📤" },
              ].map((s) => (
                <span
                  key={s.key}
                  className={`text-sm px-3 py-1 rounded-full ${
                    phase === s.key
                      ? "bg-green-100 text-green-700 font-medium"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s.icon} {s.label}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setPhase("generate")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 返回修改
          </button>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            {reviewLoading ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2 animate-pulse">🔍</div>
                <p className="text-gray-500">AI 正在审查内容，请稍候...</p>
              </div>
            ) : violations.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎉</div>
                <p className="text-green-600 font-medium">全部通过，无合规问题</p>
              </div>
            ) : (
              <div className="space-y-3">
                {violations.map((v: any, i: number) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${
                      v.severity === "error"
                        ? "bg-red-50 border-red-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{v.severity === "error" ? "🔴" : "🟡"}</span>
                      <span className="font-medium text-sm">
                        {v.category || (
                          <>
                            {v.type === "banned_word" && "禁用词"}
                            {v.type === "missing_disclaimer" && "缺少免责声明"}
                            {v.type === "sensitive_claim" && "敏感断言"}
                            {v.type === "medical_claim" && "行业合规"}
                            {v.type === "industry_compliance" && "行业合规"}
                            {v.type === "ad_law" && "广告法"}
                            {v.type === "platform_rule" && "平台规则"}
                            {v.type === "factual" && "事实性"}
                            {v.type === "other" && "其他"}
                          </>
                        )}
                      </span>
                    </div>
                    {v.original && (
                      <p className="text-sm text-gray-600 mt-1">
                        原文：<code className="bg-gray-100 px-1 rounded">{v.original}</code>
                        {v.replacement && (
                          <>
                            {" → "}
                            <code className="bg-green-100 px-1 rounded">{v.replacement}</code>
                            <span className="text-green-600 ml-1">（已自动替换）</span>
                          </>
                        )}
                      </p>
                    )}
                    {v.suggestion && (
                      <p className="text-sm text-blue-600 mt-1">💡 {v.suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setPhase("generate")}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← 返回修改
              </button>
              <button
                onClick={handleExport}
                disabled={reviewLoading}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                📤 下一步：导出
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== Phase: Export ==========
  if (phase === "export") {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">📤 导出内容</h1>
            <div className="flex items-center gap-3 mt-2">
              {[
                { key: "generate", label: "1. 生成", icon: "🤖" },
                { key: "review", label: "2. 审查", icon: "✅" },
                { key: "export", label: "3. 导出", icon: "📤" },
              ].map((s) => (
                <span
                  key={s.key}
                  className={`text-sm px-3 py-1 rounded-full ${
                    phase === s.key
                      ? "bg-green-100 text-green-700 font-medium"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {s.icon} {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className={`grid gap-6 ${exportData.length === 1 ? "grid-cols-1 max-w-2xl" : "grid-cols-2"}`}>
            {exportData.map((data: any, i: number) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-4 py-3 border-b ${
                  data.platform === "wechat" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                }`}>
                  <span className={`font-medium ${
                    data.platform === "wechat" ? "text-green-700" : "text-red-700"
                  }`}>
                    {data.platform === "wechat" ? "📱 微信公众号" : "📕 小红书"}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {data.platform === "wechat" && (
                    <>
                      {/* Theme selector */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">排版主题</label>
                        <div className="flex gap-2">
                          {[
                            { key: "ink-gold", label: "🖌 墨金", color: "#c9a84c" },
                            { key: "clean-snow", label: "❄️ 清雪", color: "#1a73e8" },
                            { key: "ink-green", label: "🌿 墨绿", color: "#2e7d32" },
                            { key: "warm-rose", label: "🌹 暖红", color: "#c0392b" },
                          ].map((th) => (
                            <button
                              key={th.key}
                              onClick={async () => {
                                setWechatTheme(th.key);
                                // Re-export with new theme
                                if (wechatContentId) {
                                  const res = await fetch("/api/export", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ contentId: wechatContentId, theme: th.key }),
                                  });
                                  const newData = await res.json();
                                  setExportData((prev) =>
                                    prev.map((item) =>
                                      item.platform === "wechat" ? newData : item
                                    )
                                  );
                                }
                              }}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                wechatTheme === th.key
                                  ? "border-gray-800 bg-gray-800 text-white"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                              }`}
                            >
                              {th.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <label className="text-xs text-gray-500">文章标题</label>
                        <p className="font-medium">{data.title}</p>
                      </div>

                      {/* Formatted preview */}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">排版预览</label>
                        <div
                          className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto text-sm"
                          dangerouslySetInnerHTML={{ __html: data.articleHtml || data.bodyHtml || data.html }}
                        />
                      </div>

                      {/* Copy buttons */}
                      <button
                        onClick={() => copyToClipboard(
                          data.articleHtml || data.bodyHtml || data.html,
                          data.bodyMarkdown || "",
                          'wechat-article'
                        )}
                        className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors font-medium"
                      >
                        {copiedKey === 'wechat-article' ? '✅ 已复制！粘贴到公众号编辑器即可' : '📋 复制排版内容（粘贴到公众号编辑器）'}
                      </button>
                      <button
                        onClick={() => copyToClipboard(data.bodyMarkdown, data.bodyMarkdown, 'wechat-md')}
                        className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                      >
                        {copiedKey === 'wechat-md' ? '✅ 已复制 Markdown' : '📝 复制 Markdown 原文'}
                      </button>
                    </>
                  )}

                  {data.platform === "xiaohongshu" && (
                    <>
                      <div>
                        <label className="text-xs text-gray-500">标题</label>
                        <p className="font-medium">{data.title}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">正文</label>
                        <pre className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-lg max-h-60 overflow-auto">
                          {data.body}
                        </pre>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">话题标签</label>
                        <p className="text-sm text-blue-600">{data.tags?.join(" ")}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(data.rendered, data.rendered, 'xhs-all')}
                        className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors font-medium"
                      >
                        {copiedKey === 'xhs-all' ? '✅ 已复制！粘贴到小红书即可' : '📋 复制全部内容（粘贴到小红书）'}
                      </button>
                    </>
                  )}
                </div>
                {(() => {
                  const cid = data.platform === "wechat" ? wechatContentId : xhsContentId;
                  const raw = data.platform === "wechat" ? wechatText : xhsText;
                  if (!cid) return null;
                  const imgPrompts = extractImagePrompts(raw, data.platform);
                  const imgs = contentImages[cid] || [];
                  return (
                    <div className="border-t border-gray-100 p-4 pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">🖼️ 配图生成</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={imgSize}
                            onChange={(e) => setImgSize(e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
                          >
                            <option value="1024x1024">1:1 方形</option>
                            <option value="1280x720">16:9 横版封面</option>
                            <option value="720x1280">9:16 竖版小红书</option>
                            <option value="1024x576">16:9 宽屏</option>
                            <option value="576x1024">9:16 窄竖版</option>
                          </select>
                          {imgPrompts.length > 0 && (
                            <button
                              onClick={() => handleGenAllImages(cid, imgPrompts)}
                              disabled={genImgAll || genImgIdx !== null}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {genImgAll ? "生成中..." : "一键生成全部"}
                            </button>
                          )}
                        </div>
                      </div>
                      {imgPrompts.map((prompt, pi) => {
                        const related = imgs.filter((img) => img.prompt === prompt);
                        return (
                          <div key={pi} className="bg-gray-50 rounded p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-gray-400 block">
                                  {data.platform === "wechat" ? "封面图提示词" : `配图 ${pi + 1}`}
                                </span>
                                <p className="text-xs text-gray-600 break-words">{prompt}</p>
                              </div>
                              <button
                                onClick={() => handleGenImage(cid, prompt, pi)}
                                disabled={genImgIdx !== null}
                                className="shrink-0 text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {genImgIdx === pi ? "⏳" : "🎨 生成"}
                              </button>
                            </div>
                            {related.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {related.map((img, j) => {
                                  const gIdx = imgs.indexOf(img);
                                  return (
                                    <div key={j} className="relative group">
                                      <img src={img.url} alt="" className="w-20 h-20 object-cover rounded border" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                                        <a href={img.url} download={`image-${gIdx}.png`} className="text-[10px] text-white bg-white/20 px-1.5 py-0.5 rounded hover:bg-white/40">下载</a>
                                        <button onClick={() => handleDeleteImage(cid, gIdx)} className="text-[10px] text-white bg-red-500/60 px-1.5 py-0.5 rounded hover:bg-red-500/80">删除</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customImgPrompt[cid] || ""}
                          onChange={(e) => setCustomImgPrompt((prev) => ({ ...prev, [cid]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (customImgPrompt[cid] || "").trim()) {
                              handleGenImage(cid, (customImgPrompt[cid] || "").trim(), -1);
                              setCustomImgPrompt((prev) => ({ ...prev, [cid]: "" }));
                            }
                          }}
                          placeholder="自定义图片描述..."
                          className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <button
                          onClick={() => {
                            if ((customImgPrompt[cid] || "").trim()) {
                              handleGenImage(cid, (customImgPrompt[cid] || "").trim(), -1);
                              setCustomImgPrompt((prev) => ({ ...prev, [cid]: "" }));
                            }
                          }}
                          disabled={!(customImgPrompt[cid] || "").trim() || genImgIdx !== null}
                          className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {genImgIdx === -1 ? "..." : "生成"}
                        </button>
                      </div>
                      {imgError && (
                        <p className="text-xs text-red-500">{imgError}</p>
                      )}
                      {imgs.length > 0 && (
                        <div>
                          <span className="text-[10px] text-gray-400">已生成 {imgs.length} 张配图</span>
                          <div className="grid grid-cols-3 gap-1.5 mt-1">
                            {imgs.map((img, gi) => (
                              <div key={gi} className="relative group">
                                <img src={img.url} alt="" className="w-full aspect-square object-cover rounded border" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                                  <a href={img.url} download={`image-${gi}.png`} className="text-[10px] text-white bg-white/20 px-1 rounded hover:bg-white/40">下载</a>
                                  <button onClick={() => handleDeleteImage(cid, gi)} className="text-[10px] text-white bg-red-500/60 px-1 rounded hover:bg-red-500/80">删</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => { setPhase("select"); setWechatText(""); setXhsText(""); setGenError(""); }}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              🔄 再选一个选题
            </button>
            <a
              href="/create"
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✨ 新建内容
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">加载中...</div>}>
      <CreatePageInner />
    </Suspense>
  );
}
