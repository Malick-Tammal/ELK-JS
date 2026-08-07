import brightnessCommand from "./brightness.js";
import colorCommand from "./color.js";
import { connectCommand } from "./connect.js";
import { daemonCommand } from "./daemon.js";
import { offCommand } from "./off.js";
import { onCommand } from "./on.js";
import { resetCommand } from "./reset.js";
import { scanCommand } from "./scan.js";
import { helpCommand } from "./help.js";
import pickerCommand from "./picker.js";
import { type Command } from "./types.js";

export const commands: readonly Command<any>[] = [
  connectCommand,
  onCommand,
  offCommand,
  colorCommand,
  brightnessCommand,
  scanCommand,
  resetCommand,
  daemonCommand,
  helpCommand,
  pickerCommand,
];

export function getCommand(name: string): Command<any> | undefined {
  return commands.find((command) => command.name === name);
}
