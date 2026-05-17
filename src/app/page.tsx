"use client";

import { useState, useEffect } from "react";

interface Stats {
  dailyReports: number;
  totalContents: number;
  pendingReview: number;
  exported: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ dailyReports: 0, totalContents: 0, pendingReview: 0, exported: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="text-gray-500 mt-1">从素材到多平台内容，一键搞定</p>
        </div>
        <a
          href="/create"
          className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
        >
          ✨ 新建内容
        </a>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "今日素材", value: String(stats.dailyReports), icon: "📰", color: "bg-blue-50 text-blue-600", href: "/history?tab=reports" },
          { label: "生成文章", value: String(stats.totalContents), icon: "📝", color: "bg-green-50 text-green-600", href: "/history" },
          { label: "待审查", value: String(stats.pendingReview), icon: "🔍", color: "bg-yellow-50 text-yellow-600", href: "/history?status=generated" },
          { label: "已导出", value: String(stats.exported), icon: "📦", color: "bg-purple-50 text-purple-600", href: "/history?status=exported" },
        ].map((stat) => (
          <a key={stat.label} href={stat.href} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md transition-all block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center text-lg`}>
                {stat.icon}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Getting Started */}
      {stats.totalContents === 0 && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">开始你的第一次内容创作</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            上传素材内容，AI自动解析选题，一键生成多平台内容
          </p>
          <a
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            ✨ 上传素材，开始创作
          </a>
        </div>
      )}

      {/* Workflow Preview */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4">创作流程</h3>
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: "上传素材", icon: "📄", desc: "粘贴或上传 Markdown" },
            { step: 2, label: "选题筛选", icon: "🎯", desc: "可视化选择热门选题" },
            { step: 3, label: "内容生成", icon: "🤖", desc: "AI 双平台同时生成" },
            { step: 4, label: "合规审查", icon: "✅", desc: "自动检查 + 人工确认" },
            { step: 5, label: "导出发布", icon: "📤", desc: "HTML / 文本 / 一键发布" },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl mx-auto mb-2">
                  {item.icon}
                </div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
              {i < 4 && (
                <div className="mx-3 text-gray-300 mb-6">→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
