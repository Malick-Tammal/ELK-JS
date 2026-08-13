import { log } from "../log.js";
import { setMode } from "../protocol/frames.js";
import { type Command } from "./types.js";
import chalk from "chalk";

function parseMode(argv: string[]): number {
  if (argv.length !== 1) {
    throw new Error('Invalid arguments. Expected "mode <id>".');
  }

  const modeId = Number(argv[0]);
  if (isNaN(modeId) || modeId < 0 || modeId > 255) {
    throw new Error("Mode ID must be a number between 0 and 255.");
  }

  return modeId;
}

const modeCommand: Command<number> = {
  name: "mode",
  usage: "mode <id>",
  description: "Set a hardware built-in animation mode (ID: 0-255).",
  parse: parseMode,
  run: async (ctx, modeId) => {
    await ctx.writeFrame(setMode(modeId));
    log.success(
      `${chalk.white.bold("Mode")} set to ID ${chalk.yellow(modeId)}`,
    );
  },
};

export default modeCommand;
