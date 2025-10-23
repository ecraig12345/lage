import type { ConfigOptions } from "@lage-run/config";
import { Command } from "commander";
import { cacheAction } from "./action.js";
import { addOptions } from "../addOptions.js";

export function cacheCommand(config: ConfigOptions) {
  const command = new Command("cache");

  addOptions("cache", command);
  addOptions("logger", command, config);
  command.action(cacheAction);

  return command;
}
