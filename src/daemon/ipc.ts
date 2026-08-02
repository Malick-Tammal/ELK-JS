import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import net from "node:net";
import { config } from "../config.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DaemonUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DaemonUnavailableError";
  }
}

interface RequestMessage {
  id: number;
  cmd: string;
  args?: unknown;
}

interface ResponseMessage {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

let requestId = 0;

export function sendRequest(
  cmd: string,
  args?: unknown,
  timeoutMs: number = config.daemonRequestTimeoutMs,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(config.daemonSocketPath);
    const id = ++requestId;
    let buffer = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(
        new Error(`Daemon request "${cmd}" timed out after ${timeoutMs}ms.`),
      );
    }, timeoutMs);

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      const message: RequestMessage = { id, cmd, args };
      socket.write(JSON.stringify(message) + "\n");
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) {
          continue;
        }
        let message: ResponseMessage;
        try {
          message = JSON.parse(line) as ResponseMessage;
        } catch {
          continue;
        }
        if (message.id !== id || settled) {
          continue;
        }
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (message.ok) {
          resolve(message.result);
        } else {
          reject(
            new Error(message.error ?? `Daemon request "${cmd}" failed.`),
          );
        }
      }
    });
    socket.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        reject(
          new DaemonUnavailableError(
            `Daemon is not running (${error.code}).`,
          ),
        );
      } else {
        reject(error);
      }
    });
    socket.on("close", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(
          new Error(`Daemon connection closed before "${cmd}" was answered.`),
        );
      }
    });
  });
}

export function isDaemonRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(config.daemonSocketPath);
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export function readDaemonPid(): number | null {
  try {
    const raw = readFileSync(config.daemonPidFile, "utf8");
    const pid = Number(raw.trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function spawnDaemon(): void {
  try {
    rmSync(config.daemonSocketPath, { force: true });
  } catch {
    // Best effort; the daemon also cleans up stale sockets.
  }
  const script = process.argv[1];
  if (!script) {
    throw new Error("Cannot start daemon: no entry script found.");
  }
  const child = spawn(
    process.execPath,
    [...process.execArgv, script, "daemon"],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ELK_DAEMON_SERVER: "1" },
    },
  );
  child.unref();
}

export async function ensureDaemon(): Promise<void> {
  if (await isDaemonRunning()) {
    return;
  }
  spawnDaemon();
  const deadline = Date.now() + config.daemonStartTimeoutMs;
  while (Date.now() < deadline) {
    await sleep(100);
    if (await isDaemonRunning()) {
      return;
    }
  }
  throw new DaemonUnavailableError(
    `Daemon did not start within ${Math.round(
      config.daemonStartTimeoutMs / 1000,
    )}s.`,
  );
}

export async function stopDaemon(): Promise<boolean> {
  const pid = readDaemonPid();
  try {
    await sendRequest("stop", undefined, 5000);
    if (pid) {
      for (let i = 0; i < 50; i += 1) {
        await sleep(100);
        try {
          process.kill(pid, 0);
        } catch {
          break;
        }
      }
    }
    return true;
  } catch (error) {
    if (error instanceof DaemonUnavailableError) {
      if (pid) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // Already gone.
        }
        rmSync(config.daemonPidFile, { force: true });
      }
      return pid !== null;
    }
    throw error;
  }
}
