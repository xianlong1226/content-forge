"use client";

import { useState, useEffect, use } from "react";

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
  const m = raw.match(/---BODY---\s*\n([\s\S]*?)(?=\n---(?:TAGS|IMAGE_PROMPTS)---|$)/);
  return m?.[1]?.trim() || raw;
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

  useEffect(() => {
    fetch(`/api/contents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("内容不存在");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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
          <div className="p-6">
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
      </div>
    </div>
  );
}
