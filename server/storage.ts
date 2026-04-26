import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

let cachedClient: S3Client | null = null;
let cachedConfigKey = "";

function getR2Config(): R2Config {
  const endpoint = process.env.R2_ENDPOINT ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const region = process.env.R2_REGION ?? "auto";

  const missing = [
    ["R2_ENDPOINT", endpoint],
    ["R2_BUCKET", bucket],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      `Screenshot storage is not configured. Missing: ${missing.join(", ")}`,
    );
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
  };
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

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const config = getR2Config();
  const client = getR2Client(config);
  const key = appendHashSuffix(normalizeKey(relKey));

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
  const config = getR2Config();
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
