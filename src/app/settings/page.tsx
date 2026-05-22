"use client";

import { useState, useEffect } from "react";

const DEFAULT_SETTINGS: Record<string, string> = {
  llm_provider: "deepseek",
  llm_model: "deepseek-chat",
  llm_api_key: "",
  llm_base_url: "https://api.deepseek.com/v1",
  llm_temperature: "0.7",
  wechat_style: "professional-friendly",
  xhs_style: "casual",
  default_audience: "目标受众",
  max_topics: "2",
  image_provider: "siliconflow",
  image_model: "black-forest-labs/FLUX.1-schnell",
  image_api_key: "",
  image_api_secret: "",
  image_base_url: "https://api.siliconflow.cn/v1",
  image_size: "1024x1024",
};

/** 各图片服务商预设 */
const IMAGE_PRESETS: Record<
  string,
  { label: string; model: string; baseUrl: string; needsSecret: boolean; secretLabel?: string; apiKeyLabel: string }
> = {
  siliconflow: {
    label: "Silicon Flow",
    model: "black-forest-labs/FLUX.1-schnell",
    baseUrl: "https://api.siliconflow.cn/v1",
    needsSecret: false,
    apiKeyLabel: "API Key",
  },
  openai: {
    label: "OpenAI (DALL-E)",
    model: "dall-e-3",
    baseUrl: "https://api.openai.com/v1",
    needsSecret: false,
    apiKeyLabel: "API Key",
  },
  tencent: {
    label: "腾讯混元",
    model: "lite",
    baseUrl: "https://aiart.tencentcloudapi.com",
    needsSecret: true,
    apiKeyLabel: "SecretId",
    secretLabel: "SecretKey",
  },
  alibaba: {
    label: "阿里百炼 (万相/千问)",
    model: "wan2.7-image-pro",
    baseUrl: "https://dashscope.aliyuncs.com",
    needsSecret: false,
    apiKeyLabel: "API Key",
  },
  bytedance: {
    label: "字节火山 (豆包)",
    model: "doubao-seedream-3.0",
    baseUrl: "https://ark.cn-beijing.volces.com",
    needsSecret: false,
    apiKeyLabel: "API Key",
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [hasImageApiKey, setHasImageApiKey] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const merged = { ...DEFAULT_SETTINGS, ...data };
        setSettings(merged);
        setHasApiKey(!!data.llm_api_key);
        setHasImageApiKey(!!data.image_api_key);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setHasApiKey(!!settings.llm_api_key);
    setHasImageApiKey(!!settings.image_api_key);
    setTimeout(() => setSaved(false), 2000);
  }

  const currentImagePreset = IMAGE_PRESETS[settings.image_provider] || IMAGE_PRESETS.siliconflow;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">配置中心</h1>
      <p className="text-gray-500 mb-4">管理模型、提示词和合规规则</p>

      {!hasApiKey && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-800">API Key 未配置</p>
            <p className="text-sm text-amber-600">请先填写 LLM API Key，否则无法生成内容</p>
          </div>
        </div>
      )}

      {/* LLM Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">🤖 模型配置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={settings.llm_provider}
              onChange={(e) => {
                const provider = e.target.value;
                const updates: Record<string, string> = { llm_provider: provider };
                if (provider === "deepseek") {
                  updates.llm_model = "deepseek-chat";
                  updates.llm_base_url = "https://api.deepseek.com/v1";
                } else if (provider === "openai") {
                  updates.llm_model = "gpt-4o";
                  updates.llm_base_url = "";
                } else if (provider === "anthropic") {
                  updates.llm_model = "claude-sonnet-4-20250514";
                  updates.llm_base_url = "";
                }
                setSettings({ ...settings, ...updates });
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              value={settings.llm_model}
              onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={settings.llm_api_key}
              onChange={(e) => setSettings({ ...settings, llm_api_key: e.target.value })}
              placeholder="必填！填入你的 DeepSeek / OpenAI / Anthropic API Key"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {settings.llm_base_url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                value={settings.llm_base_url}
                onChange={(e) => setSettings({ ...settings, llm_base_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature: {settings.llm_temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.llm_temperature}
              onChange={(e) => setSettings({ ...settings, llm_temperature: e.target.value })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Style Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">🎨 风格配置</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公众号风格</label>
            <select
              value={settings.wechat_style}
              onChange={(e) => setSettings({ ...settings, wechat_style: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="professional-friendly">专业亲切</option>
              <option value="casual">轻松口语</option>
              <option value="dry-humor">犀利直接</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">小红书风格</label>
            <select
              value={settings.xhs_style}
              onChange={(e) => setSettings({ ...settings, xhs_style: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="casual">轻松口语</option>
              <option value="professional-friendly">专业亲切</option>
              <option value="dry-humor">犀利直接</option>
            </select>
          </div>
        </div>
      </div>

      {/* Defaults */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">⚙️ 默认设置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目标受众</label>
            <input
              type="text"
              value={settings.default_audience}
              onChange={(e) => setSettings({ ...settings, default_audience: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">每次最大选题数</label>
            <input
              type="number"
              min="1"
              max="5"
              value={settings.max_topics}
              onChange={(e) => setSettings({ ...settings, max_topics: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Image Generation Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-bold text-lg mb-4">🖼️ 图片生成配置</h2>
        {!hasImageApiKey && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm">
            <span>⚠️</span>
            <span className="text-amber-700">图片 API Key 未配置，生成配图功能不可用</span>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">服务商</label>
            <select
              value={settings.image_provider}
              onChange={(e) => {
                const provider = e.target.value;
                const preset = IMAGE_PRESETS[provider];
                if (!preset) return;
                const updates: Record<string, string> = {
                  image_provider: provider,
                  image_model: preset.model,
                  image_base_url: preset.baseUrl,
                };
                setSettings({ ...settings, ...updates });
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Object.entries(IMAGE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            {settings.image_provider === "tencent" ? (
              <select
                value={settings.image_model}
                onChange={(e) => setSettings({ ...settings, image_model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="lite">混元极速版 (TextToImageLite)</option>
                <option value="v2">混元 2.0 (TextToImageRapid)</option>
                <option value="v3">混元 3.0 (SubmitTextToImageJob)</option>
              </select>
            ) : (
              <input
                type="text"
                value={settings.image_model}
                onChange={(e) => setSettings({ ...settings, image_model: e.target.value })}
                placeholder={currentImagePreset.model}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            )}
          </div>

          {/* API Key / SecretId */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {currentImagePreset.apiKeyLabel}
            </label>
            <input
              type="password"
              value={settings.image_api_key}
              onChange={(e) => setSettings({ ...settings, image_api_key: e.target.value })}
              placeholder={
                settings.image_provider === "tencent"
                  ? "腾讯云 SecretId"
                  : settings.image_provider === "alibaba"
                  ? "百炼 API Key (sk-xxx)"
                  : settings.image_provider === "bytedance"
                  ? "火山方舟 API Key"
                  : "API Key"
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 腾讯 SecretKey */}
          {currentImagePreset.needsSecret && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {currentImagePreset.secretLabel || "Secret"}
              </label>
              <input
                type="password"
                value={settings.image_api_secret}
                onChange={(e) => setSettings({ ...settings, image_api_secret: e.target.value })}
                placeholder="腾讯云 SecretKey"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              type="text"
              value={settings.image_base_url}
              onChange={(e) => setSettings({ ...settings, image_base_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">图片尺寸</label>
            {settings.image_provider === "tencent" ? (
              <select
                value={settings.image_size}
                onChange={(e) => setSettings({ ...settings, image_size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="1024x1024">1024 × 1024（方形 1:1）</option>
                <option value="768x1024">768 × 1024（竖版 3:4）</option>
                <option value="1024x768">1024 × 768（横版 4:3）</option>
                <option value="576x1024">576 × 1024（竖版 9:16）</option>
                <option value="1024x576">1024 × 576（横版 16:9）</option>
              </select>
            ) : settings.image_provider === "alibaba" ? (
              <select
                value={settings.image_size}
                onChange={(e) => setSettings({ ...settings, image_size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="1024x1024">1024 × 1024（方形）</option>
                <option value="1280x720">1280 × 720（横版封面）</option>
                <option value="720x1280">720 × 1280（竖版小红书）</option>
                <option value="2048x2048">2048 × 2048（高清方形）</option>
                <option value="1024x576">1024 × 576（宽屏横版）</option>
                <option value="576x1024">576 × 1024（窄竖版）</option>
              </select>
            ) : (
              <select
                value={settings.image_size}
                onChange={(e) => setSettings({ ...settings, image_size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="1024x1024">1024 × 1024（方形）</option>
                <option value="1280x720">1280 × 720（横版封面）</option>
                <option value="720x1280">720 × 1280（竖版小红书）</option>
                <option value="1024x576">1024 × 576（宽屏横版）</option>
                <option value="576x1024">576 × 1024（窄竖版）</option>
              </select>
            )}
          </div>

          {/* 平台提示 */}
          {settings.image_provider === "tencent" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              💡 腾讯混元尺寸使用冒号分隔（如 1024:1024），系统会自动转换。SecretId/SecretKey 在
              <a
                href="https://console.cloud.tencent.com/cam/capi"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                腾讯云访问管理
              </a>
              获取。
            </div>
          )}
          {settings.image_provider === "alibaba" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              💡 阿里百炼尺寸使用星号分隔（如 1024*1024），系统会自动转换。API Key 在
              <a
                href="https://bailian.console.aliyun.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                百炼控制台
              </a>
              获取。
            </div>
          )}
          {settings.image_provider === "bytedance" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              💡 字节火山 API 兼容 OpenAI 格式。API Key 在
              <a
                href="https://console.volcengine.com/ark"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                火山方舟控制台
              </a>
              获取。
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
      >
        {saved ? "✅ 已保存" : "💾 保存配置"}
      </button>
    </div>
  );
}
