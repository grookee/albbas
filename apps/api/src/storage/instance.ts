import { createStorage } from "./index.js";
import type { StorageBackend } from "./types.js";

export const storage: StorageBackend = createStorage();
