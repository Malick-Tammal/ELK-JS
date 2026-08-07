import type { RGB } from "../commands/types.js";

const hex2rgb = (hex: string | undefined): RGB | null => {
  let cleanHex = hex!.trim().replace(/^#/, "");

  if (cleanHex.length === 3 || cleanHex.length === 4) {
    cleanHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const isValidHex = /^[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(cleanHex);
  if (!isValidHex) {
    return null;
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  return { r, g, b };
};

const rgb2hex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export { hex2rgb, rgb2hex };
