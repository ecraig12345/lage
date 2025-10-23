import type { ConfigOptions } from "@lage-run/config";
import { Command } from "commander";
import { serverAction } from "./action.js";
import { addOptions } from "../addOptions.js";

export function serverCommand(config: ConfigOptions) {
  const command = new Command("server");

  command.action(serverAction);
  addOptions("server", command);
  addOptions("pool", command);
  addOptions("runner", command);
  addOptions("logger", command, config);
  command.action(serverAction);

  return command;
}
