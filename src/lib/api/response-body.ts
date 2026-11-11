// Allows 100 products with maximum Unicode descriptions; bounds decoded bytes,
// not just Content-Length (which may describe compressed or chunked data).
export const maxApiResponseBytes = 8 * 1024 * 1024;

export async function readResponseJson(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body.");
  let abort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new Error("Response deadline exceeded."));
    signal.addEventListener("abort", abort, { once: true });
  });
  let complete = false;
  try {
    const declared = response.headers.get("content-length");
    if (
      declared &&
      /^\d+$/.test(declared) &&
      Number(declared) > maxApiResponseBytes
    )
      throw new Error("Response is too large.");
    let length = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const chunk = await Promise.race([reader.read(), aborted]);
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxApiResponseBytes)
        throw new Error("Response is too large.");
      chunks.push(chunk.value);
    }
    complete = true;
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.concat(chunks, length),
      ),
    ) as unknown;
  } finally {
    signal.removeEventListener("abort", abort);
    if (!complete) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
