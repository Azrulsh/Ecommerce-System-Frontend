import "server-only";
import { FileStore, developmentKey } from "./file-store";
import { resolveBffConfig } from "./config";
import { ApiError } from "../api/errors";

export async function bffRuntime() {
  const config = resolveBffConfig(process.env);
  try {
    const key = config.key
      ? Buffer.from(config.key, "base64")
      : await developmentKey(config.directory);
    const store = new FileStore(config.directory, key);
    await store.initialize();
    return { config, store };
  } catch {
    throw new ApiError("unavailable", 503);
  }
}
