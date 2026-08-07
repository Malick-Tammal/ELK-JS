import { type Command } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { hex2rgb } from "../utils/colorConverter.js";
import { setColor } from "../protocol/frames.js";
import { log } from "../log.js";

const execPromise = promisify(exec);

const picker = async (): Promise<string | null> => {
  try {
    const { stdout } = await execPromise("hyprpicker");
    const trimmed = stdout.trim();
    return trimmed || null;
  } catch {
    return null;
  }
};

const pickerCommand: Command = {
  name: "picker",
  usage: "picker",
  description: "Pick a color from the screen.",
  parse: () => undefined,
  run: async (ctx) => {
    const color = await picker();

    if (!color) {
      log.info("Color picker canceled.");
      return;
    }

    const rgb = hex2rgb(color);
    if (!rgb) {
      log.error(`Failed to parse HEX color: ${color}`);
      return;
    }

    log.success(`HEX: ${color!.trim()}`);
    log.success(`RGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    ctx.writeFrame(setColor(rgb.r, rgb.g, rgb.b));
  },
};

export default pickerCommand;
