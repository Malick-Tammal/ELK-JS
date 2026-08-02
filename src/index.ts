import { setMaxListeners } from "node:events";
import { config } from "./config.js";
import { openConnection } from "./ble/connection.js";
import { searchNearby } from "./ble/discovery.js";
import { writeFrame as writeFrameDirect } from "./ble/gatt.js";
import { getCommand } from "./commands/registry.js";
import { printUsage } from "./commands/help.js";
import { type Command, type CommandContext } from "./commands/types.js";
import { daemonServerMain } from "./daemon/server.js";
import {
  DaemonUnavailableError,
  ensureDaemon,
  sendRequest,
} from "./daemon/ipc.js";
import { log, setDebug } from "./log.js";

setMaxListeners(0);
setDebug(config.debug);

function printCommandUsage(command: Command): void {
  log.error(`Usage: pnpm dev ${command.usage}`);
}

function buildContext(): CommandContext {
  return {
    openConnection: () => openConnection(),
    search: (onSeen, options) => searchNearby(onSeen, options),
    writeFrame: async (frame) => {
      try {
        await ensureDaemon();
        await sendRequest("write", { frame });
        return;
      } catch (error) {
        if (error instanceof DaemonUnavailableError) {
          log.warn("Daemon unavailable; using a direct connection.");
          const connection = await openConnection();
          try {
            await writeFrameDirect(connection.device, frame);
          } finally {
            await connection.destroy();
          }
          return;
        }
        throw error;
      }
    },
    daemonRequest: async (cmd, args) => {
      await ensureDaemon();
      return sendRequest(cmd, args);
    },
  };
}

async function main(): Promise<void> {
  if (process.env.ELK_DAEMON_SERVER === "1") {
    daemonServerMain();
    return;
  }

  const argv = process.argv.slice(2);
  const commandName = argv[0];

  if (!commandName) {
    printUsage();
    return;
  }

  const command = getCommand(commandName);
  if (!command) {
    log.error(`Unknown command "${commandName}".`);
    log.blank();
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const args = command.parse(argv.slice(argv.indexOf(commandName) + 1));
    await command.run(buildContext(), args);
  } catch (error) {
    log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    log.blank();
    printCommandUsage(command);
    process.exitCode = 1;
  }
}

main();
