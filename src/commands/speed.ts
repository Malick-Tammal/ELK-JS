import { log } from "../log.js";
import { setSpeed } from "../protocol/frames.js";
import { type Command } from "./types.js";
import chalk from "chalk";

function parseSpeed(argv: string[]): number {
  if (argv.length !== 1 || !/^\d{1,3}$/.test(argv[0]!)) {
    throw new Error('Invalid arguments. Expected "speed 0-100".');
  }
  const value = Number(argv[0]);
  if (value < 0 || value > 100) {
    throw new Error("Speed must be between 0 and 100.");
  }
  return value;
}

const speedCommand: Command<number> = {
  name: "speed",
  usage: "speed <0-100>",
  description: "Set the animation speed of the current mode (0-100).",
  parse: parseSpeed,
  run: async (ctx, speed) => {
    await ctx.writeFrame(setSpeed(speed));
    log.success(
      `${chalk.white.bold("Speed")} set to: ${chalk.dim(speed)}`,
    );
  },
};

export default speedCommand;
