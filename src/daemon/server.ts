import { setMaxListeners } from "node:events";
import { rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { type GattCharacteristic, type GattServer } from "node-ble";
import chalk from "chalk";
import { openConnection, type Connection } from "../ble/connection.js";
import {
  listServices,
  openGatt,
  resolveWriteCharacteristic,
} from "../ble/gatt.js";
import { config } from "../config.js";
import { enableFileLogging, log } from "../log.js";

interface State {
  connection: Connection | null;
  gatt: GattServer | null;
  characteristic: GattCharacteristic | null;
  connecting: Promise<void> | null;
}

const state: State = {
  connection: null,
  gatt: null,
  characteristic: null,
  connecting: null,
};

function clearState(): void {
  state.connection = null;
  state.gatt = null;
  state.characteristic = null;
}

function disconnectQuietly(): void {
  const connection = state.connection;
  clearState();
  if (connection) {
    connection.destroy().catch(() => {});
  }
}

async function connectAndResolve(): Promise<void> {
  disconnectQuietly();
  const connection = await openConnection();
  state.connection = connection;
  connection.device.on("disconnect", () => {
    log.info("[daemon] Strip disconnected; will reconnect on next request.");
    clearState();
  });
  const gatt = await openGatt(connection.device);
  const characteristic = await resolveWriteCharacteristic(gatt);
  state.gatt = gatt;
  state.characteristic = characteristic;
  log.success(
    `[daemon] Connected to ${connection.address} (write char ${await characteristic.getUUID()}).`,
  );
}

async function ensureWriteCharacteristic(): Promise<GattCharacteristic> {
  if (state.characteristic) {
    return state.characteristic;
  }
  if (!state.connecting) {
    state.connecting = connectAndResolve();
  }
  try {
    await state.connecting;
    if (!state.characteristic) {
      throw new Error("failed to resolve the write characteristic");
    }
    return state.characteristic;
  } finally {
    state.connecting = null;
  }
}

async function handleRequest(cmd: string, args: unknown): Promise<unknown> {
  switch (cmd) {
    case "write": {
      const frame = (args as { frame?: unknown } | undefined)?.frame;
      if (!Array.isArray(frame)) {
        throw new Error("write requires a frame array");
      }
      let characteristic = await ensureWriteCharacteristic();
      try {
        await characteristic.writeValueWithoutResponse(Buffer.from(frame));
      } catch (error) {
        clearState();
        characteristic = await ensureWriteCharacteristic();
        await characteristic.writeValueWithoutResponse(Buffer.from(frame));
      }
      return { written: true };
    }
    case "connect": {
      const characteristic = await ensureWriteCharacteristic();
      if (!state.gatt) {
        throw new Error("no GATT server available");
      }
      const tree = await listServices(state.gatt);
      return {
        address: state.connection?.address ?? null,
        writeUuid: await characteristic.getUUID(),
        services: tree,
      };
    }
    case "status":
      return {
        running: true,
        connected: state.connection !== null,
        address: state.connection?.address ?? null,
      };
    case "stop":
      disconnectQuietly();
      return { stopping: true };
    default:
      throw new Error(`Unknown daemon command "${cmd}".`);
  }
}

function cleanup(): void {
  disconnectQuietly();
  rmSync(config.daemonSocketPath, { force: true });
  rmSync(config.daemonPidFile, { force: true });
}

export function daemonServerMain(): void {
  setMaxListeners(0);
  process.title = "elk-js-daemon";
  chalk.level = 0;
  enableFileLogging(config.daemonLogFile);
  writeFileSync(config.daemonPidFile, String(process.pid));

  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) {
          continue;
        }
        let id: number;
        let cmd: string;
        let args: unknown;
        try {
          const message = JSON.parse(line) as {
            id: number;
            cmd: string;
            args?: unknown;
          };
          id = message.id;
          cmd = message.cmd;
          args = message.args;
        } catch {
          continue;
        }

        let ok = false;
        let result: unknown;
        let error: string | undefined;
        handleRequest(cmd, args)
          .then((value) => {
            ok = true;
            result = value;
          })
          .catch((err: unknown) => {
            error = err instanceof Error ? err.message : String(err);
          })
          .finally(() => {
            if (socket.writable) {
              socket.write(JSON.stringify({ id, ok, result, error }) + "\n");
            }
            if (cmd === "stop") {
              socket.end();
              cleanup();
              setTimeout(() => process.exit(0), 50);
            }
          });
      }
    });

    socket.on("error", () => {});
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      rmSync(config.daemonSocketPath, { force: true });
      server.listen(config.daemonSocketPath);
      return;
    }
    log.error(`[daemon] server error: ${error.message}`);
    process.exit(1);
  });

  server.listen(config.daemonSocketPath, () => {
    log.info(
      `[daemon] listening on ${config.daemonSocketPath} (pid ${process.pid})`,
    );
  });

  ensureWriteCharacteristic().catch((error: unknown) => {
    log.warn(
      `[daemon] initial connect failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("exit", () => {
    rmSync(config.daemonSocketPath, { force: true });
    rmSync(config.daemonPidFile, { force: true });
  });
}
