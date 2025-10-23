import type { ConfigOptions } from "@lage-run/config";
import { Command } from "commander";
import { infoAction } from "./action.js";
import { addOptions } from "../addOptions.js";

export function infoCommand(config: ConfigOptions) {
  const command = new Command("info");
  addOptions("server", command);
  addOptions("runner", command);
  addOptions("logger", command, config);
  addOptions("filter", command);
  addOptions("info", command);
  command.action(infoAction);
  return command;
}
