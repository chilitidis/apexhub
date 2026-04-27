import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// -----------------------------------------------------------------------------
// Storage layer with graceful fallback
// -----------------------------------------------------------------------------
// The primary path uploads to Cloudflare R2 (or any S3-compatible provider)
// using the R2_* environment variables. When those variables are not set -
// which is the default on a fresh Railway / Vercel / Docker deploy - we fall
// back to returning a data: URL so features that call `storagePut` (notably
// the screenshot scanner) keep working out of the box.
//
// The UI only cares that the returned `url` is displayable in an <img> tag.
// A data: URL satisfies that contract just fine. We log once per process so
// the operator knows the upload was not durably persisted.
// -----------------------------------------------------------------------------

type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

let cachedClient: S3Client | null = null;
let cachedConfigKey = "";
let warnedAboutFallback = false;

function readR2Config(): R2Config | null {
  const endpoint = process.env.R2_ENDPOINT ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const region = process.env.R2_REGION ?? "auto";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
  };
}

export function storageConfigured(): boolean {
  return readR2Config() !== null;
}

function getR2Client(config: R2Config): S3Client {
  const configKey = [
    config.endpoint,
    config.bucket,
    config.accessKeyId,
    config.region,
  ].join("|");

  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    cachedConfigKey = configKey;
  }

  return cachedClient;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  return Buffer.from(data);
}

function warnFallback(feature: string) {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn(
    `[storage] R2 not configured - ${feature} will use in-memory data URLs. ` +
      "Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY to " +
      "persist uploads to Cloudflare R2.",
  );
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const config = readR2Config();
  const key = appendHashSuffix(normalizeKey(relKey));

  if (!config) {
    warnFallback("storagePut");
    // Inline the bytes as a data URL. The caller (e.g. the screenshot scanner)
    // only uses the URL to render an <img>, so this is a correct drop-in.
    const buffer = toBuffer(data);
    const base64 = buffer.toString("base64");
    return { key, url: `data:${contentType};base64,${base64}` };
  }

  const client = getR2Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: toBuffer(data),
      ContentType: contentType,
    }),
  );

  // Keep the old route name so the existing UI and saved rows keep working.
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(
  relKey: string,
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const config = readR2Config();
  if (!config) {
    throw new Error(
      "Screenshot storage is not configured. Set R2_ENDPOINT, R2_BUCKET, " +
        "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY to serve older uploads.",
    );
  }
  const client = getR2Client(config);
  const key = normalizeKey(relKey);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
    { expiresIn: 60 * 10 },
  );
}
