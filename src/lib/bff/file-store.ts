import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, open, readFile, rename, unlink, chmod } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { ApiError } from "../api/errors";

function missing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
function exists(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

// Persistent encrypted records and exclusive filesystem locks for one Node host.
export class FileStore {
  constructor(
    readonly directory: string,
    private readonly key: Buffer,
  ) {
    if (key.length !== 32) throw new ApiError("configuration");
  }
  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
  }
  private filename(namespace: string, id: string) {
    const digest = createHash("sha256")
      .update(`${namespace}:${id}`)
      .digest("hex");
    return path.join(this.directory, digest);
  }
  async read<T>(
    namespace: string,
    id: string,
    parse: (value: unknown) => T,
  ): Promise<T | null> {
    try {
      const data = await readFile(this.filename(namespace, id));
      if (data.length > 256_000 || data[0] !== 1) throw new Error();
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        data.subarray(1, 13),
      );
      decipher.setAuthTag(data.subarray(13, 29));
      const plain = Buffer.concat([
        decipher.update(data.subarray(29)),
        decipher.final(),
      ]);
      const value: unknown = JSON.parse(plain.toString("utf8"));
      return parse(value);
    } catch (error) {
      if (missing(error)) return null;
      // Authentication failures/corrupted records never become valid sessions.
      if (
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string" &&
        ["EACCES", "EPERM", "EIO"].includes(error.code)
      )
        throw new ApiError("unavailable", 503);
      throw new ApiError("unavailable", 503);
    }
  }
  async write(namespace: string, id: string, value: unknown) {
    const filename = this.filename(namespace, id);
    const temp = `${filename}.${randomBytes(12).toString("hex")}.tmp`;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(
        Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), body]),
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temp, filename);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
  }
  async remove(namespace: string, id: string) {
    try {
      await unlink(this.filename(namespace, id));
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  async withLock<T>(
    name: string,
    action: () => Promise<T>,
    waitMs = 2000,
  ): Promise<T> {
    const filename = `${this.filename("lock", name)}.lock`;
    const until = Date.now() + waitMs;
    for (;;) {
      try {
        const handle = await open(filename, "wx", 0o600);
        await handle.close();
        break;
      } catch (error) {
        if (!exists(error)) throw error;
        if (Date.now() >= until) throw new ApiError("conflict", 409);
        await delay(40);
      }
    }
    try {
      return await action();
    } finally {
      await unlink(filename);
    }
  }
}

export async function developmentKey(directory: string): Promise<Buffer> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, ".development-key");
  try {
    const handle = await open(filename, "wx", 0o600);
    try {
      await handle.writeFile(randomBytes(32));
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!exists(error)) throw error;
  }
  // Another worker may have just created the file and still be writing it.
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = await readFile(filename);
    if (key.length === 32) return key;
    await delay(20);
  }
  throw new ApiError("configuration");
}
