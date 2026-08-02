import chalk from "chalk";
import { log } from "../log.js";
import { powerOff } from "../protocol/frames.js";
import { type Command } from "./types.js";

export const offCommand: Command = {
  name: "off",
  usage: "off",
  description: "Turn the LED strip off.",
  parse: () => undefined,
  run: async (ctx) => {
    await ctx.writeFrame(powerOff());
    log.success(`${chalk.white.bold("LED Strip")} is off.`);
  },
};
