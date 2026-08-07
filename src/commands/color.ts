import type { Command, RGB } from "./types.js";
import { hex2rgb, rgb2hex } from "../utils/colorConverter.js";
import { setColor } from "../protocol/frames.js";
import { log } from "../log.js";

const parseColor = (argv: string[]): RGB | null => {
  if (argv.length === 1) {
    return hex2rgb(argv[0]!);
  }

  if (argv.length === 3 && argv.every((arg) => /^\d{1,3}$/.test(arg))) {
    const [r, g, b] = argv.map(Number);
    if (r! >= 0 && r! <= 255 && g! >= 0 && g! <= 255 && b! >= 0 && b! <= 255) {
      return { r: r!, g: g!, b: b! };
    }
  }

  return null;
};

const colorCommand: Command<RGB | null> = {
  name: "color",
  usage: "color <r g b | #hex>",
  description: "Set the LED strip color (RGB 0-255 or hex).",
  parse: (argv: string[]) => parseColor(argv),
  run: async (ctx, args) => {
    const rgb = args;

    if (!rgb) {
      log.error(
        'Invalid color format. Expected "color 255 0 128" or "color #ff0080".',
      );
      return;
    }

    const hex = rgb2hex(rgb.r, rgb.g, rgb.b);

    log.success(`HEX: ${hex!}`);
    log.success(`RGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    ctx.writeFrame(setColor(rgb.r, rgb.g, rgb.b));
  },
};

export default colorCommand;
