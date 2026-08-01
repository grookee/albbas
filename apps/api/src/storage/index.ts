import { env } from "../env.js";
import { createLocalStorage } from "./local.js";
import { createS3Storage } from "./s3.js";
import type { StorageBackend } from "./types.js";

export function createStorage(): StorageBackend {
  if (env.STORAGE_BACKEND === "local") {
    return createLocalStorage(env.LOCAL_STORAGE_DIR);
  }

  return createS3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
}
