import chalk from "chalk";
import { log } from "../log.js";
import { type Command } from "./types.js";

interface ConnectResult {
  address: string | null;
  writeUuid: string;
  services: { service: string; characteristics: string[] }[];
}

export const connectCommand: Command = {
  name: "connect",
  usage: "connect",
  description: "Connect and verify the GATT service/characteristic tree.",
  parse: () => undefined,
  run: async (ctx) => {
    const result = (await ctx.daemonRequest("connect")) as ConnectResult;
    log.info(`Write characteristic: ${chalk.dim(result.writeUuid)}`);
    log.heading("Services:");
    for (const { service, characteristics } of result.services) {
      log.muted(`  ${service}`);
      for (const characteristicUuid of characteristics) {
        log.muted(`    ${characteristicUuid}`);
      }
    }
  },
};
