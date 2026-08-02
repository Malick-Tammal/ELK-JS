import { createBluetooth, type Adapter, type Device } from "node-ble";
import { config } from "../config.js";
import { log } from "../log.js";
import { findDevice, refreshDiscovery, removeDevice } from "./discovery.js";

export interface Connection {
  readonly device: Device;
  readonly address: string;
  readonly adapter: Adapter;
  destroy(): Promise<void>;
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function connectOnce(device: Device): Promise<void> {
  if (await device.isConnected()) {
    return;
  }
  await device.connect();
}

/**
 * Mirrors the proven Python/bleak flow: keep a clean BlueZ slate, wait for a
 * fresh advertisement, and connect immediately inside that advertisement
 * window. On failure, clear the entry and wait for the next one.
 */
export async function openConnection(): Promise<Connection> {
  const { bluetooth, destroy } = createBluetooth();

  try {
    const adapter = await bluetooth.defaultAdapter();
    const fresh = await refreshDiscovery(adapter);

    await removeDevice(config.ledMac).catch(() => {});

    const deadline = Date.now() + config.connectBudgetMs;
    let lastError: unknown;
    let everSeen = false;
    let nextRefresh = Date.now() + config.discoveryRefreshMs;

    while (Date.now() < deadline) {
      if (Date.now() >= nextRefresh) {
        await refreshDiscovery(adapter).catch(() => {});
        log.muted("Refreshing discovery (stop/start)...");
        nextRefresh = Date.now() + config.discoveryRefreshMs;
      }

      const remaining = deadline - Date.now();
      const found = await findDevice(
        adapter,
        config.ledMac,
        config.namePrefixes,
        {
          timeoutMs: Math.min(config.discoveryTimeoutMs, remaining),
        },
      );

      if (!found) {
        lastError = new Error("the strip never advertised");
        continue;
      }

      everSeen = true;

      let connected = false;

      for (
        let attempt = 1;
        attempt <= config.connectRetriesPerSighting && Date.now() < deadline;
        attempt += 1
      ) {
        try {
          await withTimeout(
            connectOnce(found.device),
            config.connectTimeoutMs,
            `connection timed out after ${config.connectTimeoutMs}ms`,
          );
          connected = true;
          break;
        } catch (error) {
          lastError = error;
          log.debug(
            `Connect attempt ${attempt}/${config.connectRetriesPerSighting} failed: ${messageOf(error)}`,
          );
          await sleep(config.retryDelayMs);
        }
      }

      if (connected) {
        log.success(`Connected to ${found.address}.`);
        const connectedDevice = found.device;

        return {
          device: connectedDevice,
          address: found.address,
          adapter,
          destroy: async () => {
            try {
              await withTimeout(
                connectedDevice.disconnect(),
                3000,
                "disconnect timed out",
              );
            } catch {
              // The strip may have dropped the link already.
            }
            destroy();
          },
        };
      }

      await removeDevice(found.address).catch(() => {});
      log.warn("Connection failed; cleared entry, waiting for the next advertisement...");
    }

    throw new Error(
      `Could not connect within ${Math.round(config.connectBudgetMs / 1000)}s. ` +
        (everSeen
          ? "The strip advertised but every connection attempt failed. Move it closer to the adapter, power-cycle it, or ensure no phone app is connected. "
          : "The strip never advertised. Power-cycle it and keep it near the adapter. ") +
        `Last error: ${messageOf(lastError)}`,
    );
  } catch (error) {
    destroy();
    throw error;
  }
}
