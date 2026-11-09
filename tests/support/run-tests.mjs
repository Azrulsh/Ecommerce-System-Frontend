import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { mkdir, rm } from "node:fs/promises";

const testRoot = path.resolve(os.tmpdir(), "everyday-bff-test-runs");
const runDirectory = path.resolve(testRoot, randomUUID());
if (!runDirectory.startsWith(testRoot + path.sep))
  throw new Error("Test output must stay in the frontend test directory.");
const sessionKey = randomBytes(32).toString("base64");
const fixturePassword = `Fixture-${randomBytes(16).toString("hex")}aA1`;

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
  for (const url of [
    "http://127.0.0.1:3100",
    "http://127.0.0.1:8101/health",
    "http://127.0.0.1:8102/health",
  ]) {
    if (await isServing(url))
      throw new Error(
        `Test port is already in use: ${url}. Stop its owner before running tests.`,
      );
  }
  await mkdir(runDirectory, { recursive: true });
  const fixture = launch(["tests/support/auth-api-fixture.mjs"], {
    FIXTURE_PASSWORD: fixturePassword,
  });
  await ready("http://127.0.0.1:8102/health", fixture);
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
    {
      LARAVEL_API_URL: "http://127.0.0.1:8101/api",
      APP_ORIGIN: "http://127.0.0.1:3100",
      SESSION_DEPLOYMENT: "single-host",
      SESSION_STORE_DIRECTORY: runDirectory,
      SESSION_ENCRYPTION_KEY: sessionKey,
    },
  );
  await ready("http://127.0.0.1:3100", app);
  const runner = launch(
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      FIXTURE_PASSWORD: fixturePassword,
      TEST_SESSION_DIRECTORY: runDirectory,
      TEST_SESSION_KEY: sessionKey,
    },
  );
  const [code] = await once(runner, "exit");
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unable to start tests.",
  );
  process.exitCode = 1;
} finally {
  stop();
  await delay(300);
  await rm(runDirectory, { recursive: true, force: true });
}
