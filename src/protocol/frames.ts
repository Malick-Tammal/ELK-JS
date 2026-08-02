const GAMMA = 2.2;
const GAMMA_TABLE = Array.from({ length: 256 }, (_, i) =>
  Math.round(Math.pow(i / 255, GAMMA) * 255),
);

function gamma(value: number): number {
  return GAMMA_TABLE[Math.min(255, Math.max(0, Math.round(value)))]!;
}

export function powerOn(): number[] {
  return [0x7e, 0x00, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0xef];
}

export function powerOff(): number[] {
  return [0x7e, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xef];
}

// Gamma-corrected, with this strip's R/G channel order swap.
export function setColor(r: number, g: number, b: number): number[] {
  return [
    0x7e,
    0x00,
    0x05,
    0x03,
    gamma(g),
    gamma(r),
    gamma(b),
    0x00,
    0xef,
  ];
}

export function setBrightness(level: number): number[] {
  const value = Math.min(100, Math.max(0, Math.round(level)));
  return [0x7e, 0x00, 0x01, value, 0x00, 0x00, 0x00, 0x00, 0xef];
}
