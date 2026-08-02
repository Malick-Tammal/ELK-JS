import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createBluetooth, type Adapter, type Device } from "node-ble";
import { config } from "../config.js";
import { log } from "../log.js";

const execFileAsync = promisify(execFile);
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

export interface DeviceInfo {
  address: string;
  name: string;
  rssi: string;
}

export type DeviceChange = "new" | "up" | "down";

export interface FoundDevice {
  device: Device;
  address: string;
  name: string;
  rssi: string;
}

export async function startDiscovery(adapter: Adapter): Promise<boolean> {
  if (!(await adapter.isPowered())) {
    throw new Error("Bluetooth adapter is turned off.");
  }
  try {
    await adapter.startDiscovery();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already in progress|InProgress/i.test(message)) {
      return false;
    }
    throw error;
  }
}

export type RefreshResult = "started" | "toggled" | "stuck";

export async function refreshDiscovery(
  adapter: Adapter,
  options: { allowPowerToggle?: boolean } = {},
): Promise<RefreshResult> {
  try {
    await adapter.stopDiscovery();
  } catch {
    // No discovery was running; we can start fresh immediately.
  }
  await sleep(config.discoveryStopDelayMs);

  if (await startDiscovery(adapter)) {
    return "started";
  }

  if (options.allowPowerToggle === false) {
    return "stuck";
  }

  log.warn("Discovery is stuck; toggling adapter power to reset it...");
  await execFileAsync("bluetoothctl", ["power", "off"]);
  await sleep(config.discoveryResetDelayMs);
  await execFileAsync("bluetoothctl", ["power", "on"]);
  await sleep(config.discoveryResetDelayMs);
  return (await startDiscovery(adapter)) ? "toggled" : "stuck";
}

export interface SearchOptions {
  budgetMs?: number;
  pollMs?: number;
  refreshIntervalMs?: number;
  signal?: AbortSignal;
  trackAddress?: string;
}

export async function searchDevices(
  adapter: Adapter,
  onSeen: (device: DeviceInfo, change: DeviceChange) => void,
  options: SearchOptions = {},
): Promise<DeviceInfo[]> {
  const budgetMs = options.budgetMs ?? config.searchBudgetMs;
  const pollMs = options.pollMs ?? 1000;
  const refreshIntervalMs =
    options.refreshIntervalMs ?? config.discoveryRefreshMs;
  const signal = options.signal;
  const trackAddress = options.trackAddress?.toUpperCase();
  const deadline = Date.now() + budgetMs;
  let nextRefresh = Date.now() + refreshIntervalMs;
  const seen = new Map<string, DeviceInfo>();
  const ordered: DeviceInfo[] = [];
  const live = new Map<string, boolean>();
  const everLive = new Map<string, boolean>();
  const offlineStreak = new Map<string, number>();
  let powerToggles = 0;
  let suppressDown = false;

  while (Date.now() < deadline && !signal?.aborted) {
    if (Date.now() >= nextRefresh && !signal?.aborted) {
      const result = await refreshDiscovery(adapter, {
        allowPowerToggle: powerToggles < config.discoveryPowerToggleMax,
      }).catch(() => "stuck" as const);
      if (result === "toggled") {
        powerToggles += 1;
      }
      log.muted("Refreshing discovery (stop/start)...");
      nextRefresh = Date.now() + refreshIntervalMs;
      suppressDown = true;
    }

    const addresses = await adapter.devices();
    const current = new Set(addresses);

    for (const address of addresses) {
      const isTracked = trackAddress !== undefined && address.toUpperCase() === trackAddress;
      try {
        const device = await adapter.getDevice(address);
        let rssi = "cached";
        let liveNow = false;
        try {
          rssi = String(await device.getRSSI());
          liveNow = true;
        } catch {
          // No live advertisement -> cached entry only.
        }
        const name = await device.getName().catch(() => "Unknown");

        const info: DeviceInfo = { address, name, rssi };

        if (!seen.has(address)) {
          seen.set(address, info);
          ordered.push(info);
          if (isTracked) {
            live.set(address, liveNow);
            everLive.set(address, liveNow);
          }
          onSeen(info, "new");
        } else if (isTracked) {
          if (liveNow) {
            if (!live.get(address)) {
              onSeen(info, "up");
            }
            live.set(address, true);
            everLive.set(address, true);
            offlineStreak.set(address, 0);
          } else {
            live.set(address, false);
            if (!suppressDown) {
              const streak = (offlineStreak.get(address) ?? 0) + 1;
              offlineStreak.set(address, streak);
              if (everLive.get(address) && streak === config.offlineStreakPolls) {
                onSeen(info, "down");
              }
            }
          }
        }
      } catch {
        // The device object vanished mid-poll; skip it.
      }
    }

    if (trackAddress !== undefined) {
      for (const address of seen.keys()) {
        if (address !== trackAddress || current.has(address)) {
          continue;
        }
        const info = seen.get(address)!;
        live.set(address, false);
        if (!suppressDown) {
          const streak = (offlineStreak.get(address) ?? 0) + 1;
          offlineStreak.set(address, streak);
          if (everLive.get(address) && streak === config.offlineStreakPolls) {
            onSeen(info, "down");
          }
        }
      }
    }

    suppressDown = false;
    await sleep(pollMs, signal);
  }

  return ordered;
}

export async function searchNearby(
  onSeen: (device: DeviceInfo, change: DeviceChange) => void,
  options: SearchOptions = {},
): Promise<DeviceInfo[]> {
  const { bluetooth, destroy } = createBluetooth();
  try {
    const adapter = await bluetooth.defaultAdapter();
    return await searchDevices(adapter, onSeen, options);
  } finally {
    destroy();
  }
}

export interface FindDeviceOptions {
  timeoutMs?: number;
  pollMs?: number;
}

export async function findDevice(
  adapter: Adapter,
  targetMac: string,
  prefixes: readonly string[] = config.namePrefixes,
  options: FindDeviceOptions = {},
): Promise<FoundDevice | null> {
  const timeoutMs = options.timeoutMs ?? config.discoveryTimeoutMs;
  const pollMs = options.pollMs ?? config.discoveryPollMs;
  const deadline = Date.now() + timeoutMs;
  const normalizedMac = targetMac.toUpperCase();
  const normalizedPrefixes = prefixes.map((prefix) => prefix.toLowerCase());

  while (Date.now() < deadline) {
    const addresses = await adapter.devices();

    for (const address of addresses) {
      try {
        const device = await adapter.getDevice(address);
        const rssi = await device.getRSSI();
        const name = await device.getName().catch(() => "");

        const addressMatch = address.toUpperCase() === normalizedMac;
        const nameMatch = normalizedPrefixes.some((prefix) =>
          name.toLowerCase().startsWith(prefix),
        );

        if (addressMatch || nameMatch) {
          return { device, address, name, rssi };
        }
      } catch {
        // The device object vanished mid-poll; skip it.
      }
    }

    await sleep(pollMs);
  }

  return null;
}

export async function removeDevice(address: string): Promise<void> {
  await execFileAsync("bluetoothctl", ["remove", address]);
}
