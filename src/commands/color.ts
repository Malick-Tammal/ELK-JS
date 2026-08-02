import { log } from "../log.js";
import { setColor } from "../protocol/frames.js";
import { type Command } from "./types.js";

interface ColorArgs {
  r: number;
  g: number;
  b: number;
}

function parseColor(argv: string[]): ColorArgs {
  if (argv.length === 1) {
    const hex = argv[0]!.trim().replace(/^#/, "");
    const match = /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(
      hex,
    );
    if (match) {
      return {
        r: parseInt(match[1]!, 16),
        g: parseInt(match[2]!, 16),
        b: parseInt(match[3]!, 16),
      };
    }
  }

  if (argv.length === 3 && argv.every((arg) => /^\d{1,3}$/.test(arg))) {
    const [r, g, b] = argv.map(Number);
    if (r! >= 0 && r! <= 255 && g! >= 0 && g! <= 255 && b! >= 0 && b! <= 255) {
      return { r: r!, g: g!, b: b! };
    }
  }

  throw new Error(
    'Invalid color. Expected "color 255 0 128" (0-255) or "color #ff0080".',
  );
}

export const colorCommand: Command<ColorArgs> = {
  name: "color",
  usage: "color <r g b | #hex>",
  description: "Set the LED strip color (RGB 0-255 or hex).",
  parse: parseColor,
  run: async (ctx, args) => {
    await ctx.writeFrame(setColor(args.r, args.g, args.b));
    log.color("Color set to", [args.r, args.g, args.b]);
  },
};
