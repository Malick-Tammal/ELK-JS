import chalk from "chalk";
import { config } from "../config.js";
import {
  ensureDaemon,
  isDaemonRunning,
  readDaemonPid,
  sendRequest,
  stopDaemon,
} from "../daemon/ipc.js";
import { log } from "../log.js";
import { type Command } from "./types.js";

type DaemonSub = "start" | "stop" | "status";

function parseSub(argv: string[]): DaemonSub {
  const sub = argv[0];
  if (sub === "start" || sub === "stop" || sub === "status") {
    return sub;
  }
  throw new Error('Invalid subcommand. Expected "daemon start|stop|status".');
}

export const daemonCommand: Command<DaemonSub> = {
  name: "daemon",
  usage: "daemon <start|stop|status>",
  description: "Manage the persistent background daemon.",
  parse: parseSub,
  run: async (_ctx, sub) => {
    switch (sub) {
      case "start":
        await ensureDaemon();
        log.success(`${chalk.white.bold("Daemon")} Started.`);
        log.info("Connecting in the background...");
        break;
      case "stop":
        if (await stopDaemon()) {
          log.stop(`${chalk.white.bold("Daemon")} stopped.`);
        } else {
          log.stop(`${chalk.white.bold("Daemon")} was not running.`);
        }
        break;
      case "status": {
        if (!(await isDaemonRunning())) {
          log.stop(`${chalk.white.bold("Daemon")} is not running.`);
          break;
        }
        const pid = readDaemonPid();
        try {
          const status = (await sendRequest("status")) as {
            connected: boolean;
            address: string | null;
          };
          if (status.connected) {
            log.success("Daemon is running.");
            log.list("Connected to", status.address ?? "?");
          } else {
            log.success("Daemon is running but not connected yet.");
          }
          if (pid) {
            log.list("PID", String(pid));
          }
          log.list("Log", config.daemonLogFile);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log.warn(`Daemon is running (status unavailable: ${message}).`);
        }
        break;
      }
    }
  },
};
