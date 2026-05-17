import type { Metadata } from "next";
import "./globals.css";
import ConfigIndicator from "@/components/config-indicator";

export const metadata: Metadata = {
  title: "ContentForge - 智能内容生产工具",
  description: "一键将素材转化为微信公众号和小红书内容",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-800">
              <h1 className="text-lg font-bold flex items-center gap-2">
                🔮 <span>ContentForge</span>
              </h1>
              <p className="text-xs text-gray-400 mt-1">智能内容工厂</p>
            </div>
            <nav className="flex-1 py-4">
              {[
                { href: "/", label: "仪表盘", icon: "📊" },
                { href: "/create", label: "新建内容", icon: "✨" },
                { href: "/history", label: "历史记录", icon: "📁" },
                { href: "/settings", label: "配置中心", icon: "⚙️" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
            <ConfigIndicator />
            <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
              v0.1.0 · Powered by AI
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-gray-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
