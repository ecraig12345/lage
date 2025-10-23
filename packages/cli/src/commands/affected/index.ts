import { Command } from "commander";
import { affectedAction } from "./action.js";
import { addOptions } from "../addOptions.js";

export function affectedCommand() {
  const command = new Command("affected");
  addOptions("filter", command);
  command.action(affectedAction);
  return command;
}
