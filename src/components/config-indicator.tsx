"use client";

import { useState, useEffect } from "react";

export default function ConfigIndicator() {
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setHasKey(!!data.llm_api_key))
      .catch(() => {});
  }, []);

  if (hasKey) return null;

  return (
    <div className="p-3 border-t border-gray-800">
      <a
        href="/settings"
        className="block text-xs text-amber-400 hover:text-amber-300 text-center py-1 bg-amber-900/30 rounded"
      >
        ⚠️ API Key 未配置
      </a>
    </div>
  );
}
