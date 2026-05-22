import crypto from "crypto";
import type { ImageGenerateConfig, GeneratedImage } from "../../types";
import type { ImageAdapter } from "./types";

/**
 * 腾讯混元图片生成适配器
 * 使用腾讯云 API 3.0 (TC3-HMAC-SHA256) 签名认证
 *
 * 支持模型：
 * - TextToImageLite  (极速版，同步)
 * - TextToImageRapid (2.0，同步)
 * - SubmitTextToImageJob + QueryTextToImageJob (3.0，异步)
 */

const SERVICE = "aiart";
const HOST = "aiart.tencentcloudapi.com";
const REGION = "ap-guangzhou";
const VERSION = "2022-12-29";

/** 腾讯混元文生图版本 */
export type TencentImageVersion = "lite" | "v2" | "v3";

/** 将标准尺寸 "1024x1024" 转为腾讯格式 "1024:1024" */
function convertSize(size: string): string {
  return size.replace(/x/gi, ":");
}

/** HMAC-SHA256 */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/** SHA256 hex */
function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * 计算 TC3-HMAC-SHA256 签名
 */
function sign(
  secretId: string,
  secretKey: string,
  payload: string,
  timestamp: number,
  action: string
): Record<string, string> {
  const date = new Date(timestamp * 1000).toISOString().split("T")[0]; // YYYY-MM-DD

  // 1. 拼接 CanonicalRequest
  const httpMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = "";
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedPayload = sha256Hex(payload);
  const canonicalRequest = [
    httpMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join("\n");

  // 2. 拼接 StringToSign
  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const hashedCanonical = sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonical].join("\n");

  // 3. 计算 Signature
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, SERVICE);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = crypto.createHmac("sha256", secretSigning).update(stringToSign).digest("hex");

  // 4. 组装 Authorization
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "X-TC-Timestamp": String(timestamp),
    "X-TC-Date": date,
  };
}

/**
 * 腾讯云签名请求
 */
async function tencentRequest(
  action: string,
  body: Record<string, any>,
  secretId: string,
  secretKey: string
): Promise<any> {
  const payload = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);

  const sigHeaders = sign(secretId, secretKey, payload, timestamp, action);

  const res = await fetch(`https://${HOST}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Host: HOST,
      "X-TC-Action": action,
      "X-TC-Version": VERSION,
      "X-TC-Region": REGION,
      ...sigHeaders,
    },
    body: payload,
  });

  const data = await res.json();
  const resp = data.Response;

  if (resp.Error) {
    throw new Error(`腾讯混元请求失败: ${resp.Error.Code} - ${resp.Error.Message}`);
  }

  return resp;
}

export class TencentAdapter implements ImageAdapter {
  async generate(prompt: string, config: ImageGenerateConfig): Promise<GeneratedImage> {
    // 确定版本：model 字段可以传 "lite" / "v2" / "v3"，默认 lite
    const version: TencentImageVersion = ["lite", "v2", "v3"].includes(config.model)
      ? (config.model as TencentImageVersion)
      : "lite";

    // 腾讯认证：apiKey 存 secretId，apiSecret 存 secretKey
    const secretId = config.apiKey;
    const secretKey = config.apiSecret || "";
    if (!secretId || !secretKey) {
      throw new Error("腾讯混元需要同时配置 SecretId 和 SecretKey");
    }

    const resolution = convertSize(config.size);

    if (version === "v3") {
      return this.generateV3(prompt, resolution, secretId, secretKey, config);
    }

    // 同步调用：lite / v2
    const action = version === "v2" ? "TextToImageRapid" : "TextToImageLite";
    const body: Record<string, any> = {
      Prompt: prompt,
      Resolution: resolution,
      RspImgType: "url",
      LogoAdd: 0,
    };

    if (version === "v2") {
      // v2 额外支持 Style 和参考图
      // Style 数字 1-30，默认不传
    }

    const resp = await tencentRequest(action, body, secretId, secretKey);
    const imageUrl = resp.ResultImage;

    if (!imageUrl) {
      throw new Error("腾讯混元返回图片数据为空");
    }

    const [width, height] = config.size.split("x").map(Number);
    return {
      prompt,
      url: imageUrl,
      width: width || 1024,
      height: height || 1024,
      model: `hunyuan-${version}`,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 混元 3.0 异步调用：提交任务 → 轮询结果
   */
  private async generateV3(
    prompt: string,
    resolution: string,
    secretId: string,
    secretKey: string,
    config: ImageGenerateConfig
  ): Promise<GeneratedImage> {
    // 1. 提交任务
    const submitResp = await tencentRequest(
      "SubmitTextToImageJob",
      {
        Prompt: prompt,
        Resolution: resolution,
        RspImgType: "url",
        LogoAdd: 0,
      },
      secretId,
      secretKey
    );

    const jobId = submitResp.JobId;
    if (!jobId) {
      throw new Error("腾讯混元 3.0 提交任务失败：未返回 JobId");
    }

    // 2. 轮询结果，最多等 120 秒
    const maxWait = 120_000;
    const interval = 3_000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, interval));

      const queryResp = await tencentRequest(
        "QueryTextToImageJob",
        { JobId: jobId },
        secretId,
        secretKey
      );

      const status = queryResp.JobStatus;
      if (status === "SUCCESS" || status === "SUCCEEDED") {
        const imageUrl = queryResp.ResultImage;
        if (!imageUrl) {
          throw new Error("腾讯混元 3.0 返回图片数据为空");
        }
        const [width, height] = config.size.split("x").map(Number);
        return {
          prompt,
          url: imageUrl,
          width: width || 1024,
          height: height || 1024,
          model: "hunyuan-v3",
          createdAt: new Date().toISOString(),
        };
      }

      if (status === "FAIL" || status === "FAILED") {
        throw new Error(`腾讯混元 3.0 任务失败: ${queryResp.FailReason || "未知原因"}`);
      }

      // PENDING / RUNNING → 继续轮询
    }

    throw new Error("腾讯混元 3.0 生成超时，请稍后重试");
  }
}
