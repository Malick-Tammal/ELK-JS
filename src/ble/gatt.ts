import { type Device, type GattCharacteristic, type GattServer } from "node-ble";
import { config } from "../config.js";
import { SERVICE_CHAR_CANDIDATES } from "../protocol/uuid.js";
import { withTimeout } from "./connection.js";

export async function openGatt(device: Device): Promise<GattServer> {
  return withTimeout(
    device.gatt(),
    config.gattTimeoutMs,
    "GATT service discovery timed out",
  );
}

export async function resolveWriteCharacteristic(
  gatt: GattServer,
): Promise<GattCharacteristic> {
  const services = await gatt.services();
  const lowerServices = services.map((service) => service.toLowerCase());

  for (const { service, characteristic } of SERVICE_CHAR_CANDIDATES) {
    const serviceIndex = lowerServices.findIndex((uuid) => uuid.includes(service));
    if (serviceIndex === -1) {
      continue;
    }

    try {
      const gattService = await gatt.getPrimaryService(services[serviceIndex]!);
      const characteristics = await gattService.characteristics();
      const charIndex = characteristics.findIndex((uuid) =>
        uuid.toLowerCase().includes(characteristic),
      );
      if (charIndex === -1) {
        continue;
      }
      return await gattService.getCharacteristic(characteristics[charIndex]!);
    } catch {
      // Try the next candidate pair.
    }
  }

  throw new Error(
    `Unsupported device: no write characteristic found (looked for ` +
      `${SERVICE_CHAR_CANDIDATES.map((c) => `${c.service}/${c.characteristic}`).join(", ")}). ` +
      `Services present: ${services.join(", ") || "none"}`,
  );
}

export interface ServiceTree {
  service: string;
  characteristics: string[];
}

export async function listServices(gatt: GattServer): Promise<ServiceTree[]> {
  const services = await gatt.services();
  const tree: ServiceTree[] = [];

  for (const serviceUuid of services) {
    const service = await gatt.getPrimaryService(serviceUuid);
    const characteristics = await service.characteristics();
    tree.push({ service: serviceUuid, characteristics });
  }

  return tree;
}

export async function writeFrame(device: Device, frame: number[]): Promise<void> {
  const gatt = await openGatt(device);
  const characteristic = await resolveWriteCharacteristic(gatt);
  await characteristic.writeValueWithoutResponse(Buffer.from(frame));
}
