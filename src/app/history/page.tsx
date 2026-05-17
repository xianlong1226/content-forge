"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface ContentItem {
  id: string;
  topicId: string;
  platform: string;
  style: string;
  rawMarkdown: string | null;
  renderedHtml: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportItem {
  id: string;
  date: string;
  createdAt: string;
  topicCount: number;
}

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

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">加载中...</div>}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const statusFilter = searchParams.get("status");

  const [activeTab, setActiveTab] = useState<"content" | "reports">(tabParam === "reports" ? "reports" : "content");

  // Content state
  const [items, setItems] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  // Reports state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setContentLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "reports") return;
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => setReports(data.items || []))
      .catch(() => {})
      .finally(() => setReportsLoading(false));
  }, [activeTab]);

  const filtered = statusFilter && activeTab === "content"
    ? items.filter((item) => item.status === statusFilter)
    : items;

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function extractTitle(raw: string | null): string {
    if (!raw) return "无标题";
    const m = raw.match(/---TITLE---\s*\n(.+?)(?:\n|$)/);
    return m?.[1]?.trim() || raw.slice(0, 40) + "...";
  }

  const filterLabel = statusFilter ? (STATUS_MAP[statusFilter]?.label || statusFilter) : null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">历史记录</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("content")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "content" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          生成内容
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "reports" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          素材
        </button>
      </div>

      {/* Content tab */}
      {activeTab === "content" && (
        <>
          {filterLabel && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="text-gray-500">筛选:</span>
              <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">{filterLabel}</span>
              <a href="/history" className="text-gray-400 hover:text-gray-600">✕ 清除</a>
            </div>
          )}

          {contentLoading ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-gray-500">{filterLabel ? "没有符合条件的内容" : "暂无历史记录"}</p>
              <p className="text-sm text-gray-400 mt-1">生成内容后将自动保存在这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const status = STATUS_MAP[item.status] || STATUS_MAP.draft;
                const platform = PLATFORM_MAP[item.platform] || { label: item.platform, color: "bg-gray-50 text-gray-600" };
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-300 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${platform.color}`}>{platform.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <p className="font-medium text-gray-900 truncate">{extractTitle(item.rawMarkdown)}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(item.updatedAt)}</p>
                    </div>
                    <a
                      href={`/content/${item.id}`}
                      className="ml-4 text-sm text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                    >
                      查看
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Reports tab */}
      {activeTab === "reports" && (
        <>
          {reportsLoading ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📰</div>
              <p className="text-gray-500">暂无素材记录</p>
              <p className="text-sm text-gray-400 mt-1">上传素材后将自动保存在这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-gray-300 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">{report.date}</span>
                      <span className="text-xs text-gray-400">{report.topicCount} 个选题</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">上传于 {formatDate(report.createdAt)}</p>
                  </div>
                  <a
                    href={`/create?reportId=${report.id}`}
                    className="ml-4 text-sm text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                  >
                    查看选题
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
