import type { Readable } from 'node:stream';

export interface PutObjectInput {
  stream: Readable;
  contentType: string;
}

export interface GetObjectResult {
  stream: Readable;
}

export interface StorageBackend {
  put(key: string, input: PutObjectInput): Promise<void>;
  get(key: string): Promise<GetObjectResult>;
  delete(key: string): Promise<void>;
}
