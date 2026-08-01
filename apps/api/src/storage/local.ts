import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import type {
  GetObjectResult,
  PutObjectInput,
  StorageBackend,
} from "./types.js";

export function createLocalStorage(dir: string): StorageBackend {
  async function pathFor(key: string): Promise<string> {
    const target = `${dir}/${key}`;
    await mkdir(dirname(target), { recursive: true });
    return target;
  }

  return {
    async put(key: string, input: PutObjectInput): Promise<void> {
      const target = await pathFor(key);
      const out = createWriteStream(target);
      await pipeline(input.stream, out);
    },

    get(key: string): Promise<GetObjectResult> {
      return Promise.resolve({ stream: createReadStream(`${dir}/${key}`) });
    },

    async delete(key: string): Promise<void> {
      await rm(`${dir}/${key}`, { force: true });
    },
  };
}
