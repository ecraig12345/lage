import { Command } from "commander";
import { initAction } from "./action.js";

export function initCommand() {
  const command = new Command("init");
  command.description("Install lage in a workspace and create a config file").action(initAction);
  return command;
}
