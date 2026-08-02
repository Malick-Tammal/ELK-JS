import chalk from "chalk";
import { emitKeypressEvents } from "node:readline";
import { type DeviceChange, type DeviceInfo } from "../ble/discovery.js";
import { config } from "../config.js";
import { log } from "../log.js";
import { type Command } from "./types.js";

export const scanCommand: Command = {
  name: "scan",
  usage: "scan",
  description: "Search for nearby BLE devices.",
  parse: () => undefined,
  run: async (ctx) => {
    log.blank();
    log.heading("Searching for devices...");
    log.blank();

    let cleanup: (() => void) | undefined;
    const controller = new AbortController();

    if (process.stdin.isTTY) {
      emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const onKeypress = (
        _str: string,
        key: { name?: string; ctrl?: boolean },
      ) => {
        if (key.ctrl && key.name === "c") {
          cleanup?.();
          process.exit(130);
        }
        if (key.name === "q" || key.name === "x") {
          controller.abort();
        }
      };

      process.stdin.on("keypress", onKeypress);
      cleanup = () => {
        process.stdin.off("keypress", onKeypress);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      };

      log.muted("Press q or x to stop.");
      log.blank();
    }

    try {
      const target = config.ledMac.toUpperCase();

      let targetFound = false;
      const lineFor = (device: DeviceInfo, marker: string) => {
        const rssi =
          device.rssi === "cached"
            ? chalk.gray("cached")
            : chalk.blue(`RSSI ${device.rssi}`);
        return `${chalk.white(device.name.padEnd(24))} ${chalk.dim(device.address)} ${rssi} ${marker}`;
      };

      const onSeen = (device: DeviceInfo, change: DeviceChange) => {
        const isTarget = device.address.toUpperCase() === target;
        if (isTarget) {
          targetFound = true;
        }

        if (change === "new") {
          const marker = isTarget
            ? device.rssi === "cached"
              ? "  <-- Target (cached)"
              : "  <-- Target"
            : "";
          const line = lineFor(device, marker);
          if (isTarget) {
            log.success(line);
          } else {
            log.info(line);
          }
          return;
        }

        if (change === "up") {
          log.success(lineFor(device, "  <-- Target (reconnected)"));
          return;
        }

        if (change === "down") {
          const line = `${chalk.white(device.name.padEnd(24))} ${chalk.dim(device.address)}  <-- Target (disconnected)`;
          log.warn(line);
        }
      };

      const devices = await ctx.search(onSeen, {
        signal: controller.signal,
        trackAddress: target,
      });

      if (controller.signal.aborted) {
        log.muted("Stopped.");
        return;
      }

      if (devices.length === 0) {
        log.warn("No devices found. Make sure the strip is powered on and in range.");
        return;
      }

      if (!targetFound) {
        log.warn(
          `Configured target (${config.ledMac}) not seen advertising. ` +
            "Power-cycle the strip, move it closer, and close any phone app controlling it.",
        );
      } else {
        log.success("Target found.");
      }
    } finally {
      cleanup?.();
    }
  },
};
