import type { ConfigOptions } from "@lage-run/config";
import { Command } from "commander";
import { execAction } from "./action.js";
import { addOptions } from "../addOptions.js";

export function execCommand(config: ConfigOptions) {
  const command = new Command("exec");
  addOptions("pool", command);
  addOptions("runner", command);
  addOptions("server", command);
  addOptions("logger", command, config);
  command.action(execAction);
  return command;
}
