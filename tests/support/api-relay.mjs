import { createServer } from "node:http";

// Test-only fault injection. Normal GETs pass through to the existing API.
// Laravel never receives a write request, including from the test control route.
let mode = "normal";
const upstream = process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const modes = new Set([
  "normal",
  "offline",
  "malformed",
  "pricing-offline",
  "categories-offline",
  "slow",
  "timeout",
  "wrong-product",
  "wrong-price",
]);

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:8101");
  if (url.pathname === "/health") {
    response.end("ready");
    return;
  }
  if (url.pathname === "/__test/mode" && request.method === "POST") {
    const nextMode = url.searchParams.get("value");
    if (!modes.has(nextMode)) {
      response.writeHead(400).end();
      return;
    }
    mode = nextMode;
    response.end("ok");
    return;
  }
  if (
    request.method !== "GET" ||
    !/^\/api\/(categories|products(?:\/\d+(?:\/price)?)?)$/.test(url.pathname)
  ) {
    response.writeHead(405).end();
    return;
  }
  if (
    mode === "offline" ||
    (mode === "pricing-offline" && url.pathname.endsWith("/price")) ||
    (mode === "categories-offline" && url.pathname.endsWith("/categories"))
  ) {
    response.writeHead(503).end();
    return;
  }
  if (mode === "malformed") {
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end('{"data":"invalid"}');
    return;
  }
  const currentMode = mode;
  if (currentMode === "slow" || currentMode === "timeout")
    await new Promise((resolve) =>
      setTimeout(resolve, currentMode === "slow" ? 2_000 : 9_000),
    );
  try {
    const result = await fetch(
      `${upstream.replace(/\/$/, "")}${url.pathname.slice(4)}${url.search}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    response.writeHead(result.status, { "Content-Type": "application/json" });
    if (
      result.ok &&
      ((currentMode === "wrong-product" &&
        /^\/api\/products\/\d+$/.test(url.pathname)) ||
        (currentMode === "wrong-price" && url.pathname.endsWith("/price")))
    ) {
      const payload = await result.json();
      if (currentMode === "wrong-product") payload.data.id += 1;
      else payload.data.product_id += 1;
      response.end(JSON.stringify(payload));
      return;
    }
    response.end(await result.text());
  } catch {
    response.writeHead(503).end();
  }
}).listen(8101, "127.0.0.1");
