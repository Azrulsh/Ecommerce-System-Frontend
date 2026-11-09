import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const children = [];
function launch(args, env = {}) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}
function stop() {
  for (const child of children.toReversed()) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}
async function isServing(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return true;
  } catch {
    return false;
  }
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`Test service exited before becoming ready: ${url}`);
    if (await isServing(url)) return;
    await delay(500);
  }
  throw new Error(`Test service did not become ready: ${url}`);
}

process.once("SIGINT", () => {
  stop();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stop();
  process.exit(143);
});

try {
  for (const url of ["http://127.0.0.1:3100", "http://127.0.0.1:8101/health"]) {
    if (await isServing(url))
      throw new Error(
        `Test port is already in use: ${url}. Stop its owner before running tests.`,
      );
  }
  const relay = launch(["tests/support/api-relay.mjs"]);
  await ready("http://127.0.0.1:8101/health", relay);
  const app = launch(
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { LARAVEL_API_URL: "http://127.0.0.1:8101/api" },
  );
  await ready("http://127.0.0.1:3100", app);
  const runner = launch([
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2),
  ]);
  const [code] = await once(runner, "exit");
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unable to start tests.",
  );
  process.exitCode = 1;
} finally {
  stop();
}
