import { removeDevice } from "../ble/discovery.js";
import { log } from "../log.js";
import { type Command } from "./types.js";
import chalk from "chalk";

function parseAddress(argv: string[]): string {
  if (
    argv.length !== 1 ||
    !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(argv[0]!)
  ) {
    throw new Error('Invalid address. Expected "reset AA:BB:CC:DD:EE:FF".');
  }
  return argv[0]!.toUpperCase();
}

export const resetCommand: Command<string> = {
  name: "reset",
  usage: "reset <address>",
  description: "Remove a stale Bluetooth entry (bluetoothctl remove).",
  parse: parseAddress,
  run: async (_ctx, address) => {
    await removeDevice(address);
    log.success(
      `${chalk.white.bold("Removed Bluetooth")} entry for: ${chalk.dim(address)}.`,
    );
  },
};
