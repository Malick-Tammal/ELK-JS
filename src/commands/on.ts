import chalk from "chalk";
import { log } from "../log.js";
import { powerOn } from "../protocol/frames.js";
import { type Command } from "./types.js";

export const onCommand: Command = {
  name: "on",
  usage: "on",
  description: "Turn the LED strip on.",
  parse: () => undefined,
  run: async (ctx) => {
    await ctx.writeFrame(powerOn());
    log.success(`${chalk.white.bold("LED Strip")} is on.`);
  },
};
