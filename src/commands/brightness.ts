import { log } from "../log.js";
import { setBrightness } from "../protocol/frames.js";
import { type Command } from "./types.js";
import chalk from "chalk";

function parseBrightness(argv: string[]): number {
  if (argv.length !== 1 || !/^\d{1,3}$/.test(argv[0]!)) {
    throw new Error('Invalid brightness. Expected "brightness 0-100".');
  }
  const value = Number(argv[0]);
  if (value < 0 || value > 100) {
    throw new Error("Brightness must be between 0 and 100.");
  }
  return value;
}

const brightnessCommand: Command<number> = {
  name: "brightness",
  usage: "brightness <0-100>",
  description: "Set the LED strip brightness (0-100).",
  parse: parseBrightness,
  run: async (ctx, level) => {
    await ctx.writeFrame(setBrightness(level));
    log.success(
      `${chalk.white.bold("Brightness")} set to: ${chalk.dim(level + "%")}`,
    );
  },
};

export default brightnessCommand;
