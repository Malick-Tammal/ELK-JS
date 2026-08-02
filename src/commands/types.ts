import { type Connection } from "../ble/connection.js";
import {
  type DeviceChange,
  type DeviceInfo,
  type SearchOptions,
} from "../ble/discovery.js";

export interface CommandContext {
  openConnection(): Promise<Connection>;
  search(
    onSeen: (device: DeviceInfo, change: DeviceChange) => void,
    options?: SearchOptions,
  ): Promise<DeviceInfo[]>;
  writeFrame(frame: number[]): Promise<void>;
  daemonRequest(cmd: string, args?: unknown): Promise<unknown>;
}

export interface Command<TArgs = void> {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
  parse(argv: string[]): TArgs;
  run(ctx: CommandContext, args: TArgs): Promise<void>;
}
