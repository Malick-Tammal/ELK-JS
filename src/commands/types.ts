import { type Connection } from "../ble/connection.js";
import {
  type DeviceChange,
  type DeviceInfo,
  type SearchOptions,
} from "../ble/discovery.js";

interface CommandContext {
  openConnection(): Promise<Connection>;
  search(
    onSeen: (device: DeviceInfo, change: DeviceChange) => void,
    options?: SearchOptions,
  ): Promise<DeviceInfo[]>;
  writeFrame(frame: number[]): Promise<void>;
  daemonRequest(cmd: string, args?: unknown): Promise<unknown>;
}

interface Command<TArgs = void> {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
  parse(argv: string[]): TArgs;
  run(ctx: CommandContext, args: TArgs): Promise<void>;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

export type { Command, CommandContext, RGB };
