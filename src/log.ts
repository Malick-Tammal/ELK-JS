import { createWriteStream, type WriteStream } from "node:fs";
import chalk from "chalk";

let debugMode = false;
let fileStream: WriteStream | null = null;

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, "");

function emit(line: string): void {
  process.stdout.write(line + "\n");
  if (fileStream) {
    fileStream.write(stripAnsi(line) + "\n");
  }
}

function emitErr(line: string): void {
  process.stderr.write(line + "\n");
  if (fileStream) {
    fileStream.write(stripAnsi(line) + "\n");
  }
}

export function setDebug(on: boolean): void {
  debugMode = on;
}

export function enableFileLogging(path: string): void {
  fileStream = createWriteStream(path, { flags: "a" });
}

export const log = {
  heading(msg: string): void {
    emit(`${chalk.green.bold("[+]")} ${chalk.white.bold(msg)}`);
  },
  success(msg: string): void {
    emit(`${chalk.green.bold("[+]")} ${msg}`);
  },
  info(msg: string): void {
    emit(`${chalk.yellow("[-]")} ${msg}`);
  },
  muted(msg: string): void {
    emit(chalk.dim(msg));
  },
  debug(msg: string): void {
    if (debugMode) {
      emit(chalk.gray(msg));
    }
  },
  warn(msg: string): void {
    emitErr(`${chalk.yellow("[!]")} ${msg}`);
  },
  error(msg: string): void {
    emitErr(`${chalk.red.bold("[*]")} ${msg}`);
  },
  stop(msg: string): void {
    emit(`${chalk.red.bold("[*]")} ${msg}`);
  },
  list(label: string, value: string): void {
    emit(`${chalk.yellow("[-]")} ${label}: ${chalk.dim(value)}`);
  },
  color(label: string, rgb: [number, number, number]): void {
    const hex = `#${rgb
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
    emit(
      `${chalk.green.bold("[+]")} ${chalk.white.bold(label)} ${chalk.dim("RGB" + "(" + rgb + ")")} ${chalk.dim(hex)} ${chalk.hex(hex).bold("██")}`,
    );
  },
  blank(): void {
    emit("");
  },
};
