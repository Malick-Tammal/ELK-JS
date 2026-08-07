import chalk from "chalk";
import { log } from "../log.js";
import { commands } from "./registry.js";
import { type Command } from "./types.js";

function printUsage(): void {
  log.heading("ELK-BLEDOM LED strip controller");
  log.blank();
  log.info("Usage: pnpm dev <command> [args]");
  log.blank();
  log.info("Commands:");
  for (const command of commands) {
    log.info(
      `  ${chalk.bold(command.usage.padEnd(28))} ${command.description}`,
    );
  }
}

const helpCommand: Command = {
  name: "help",
  usage: "help",
  description: "Print this help message.",
  parse: () => undefined,
  run: async () => {
    printUsage();
  },
};

export { helpCommand, printUsage };
