import type { ConfigOptions } from "@lage-run/config";
import type { Command, Option } from "commander";
import { type OptionCategory, getOptions } from "./options.js";

/**
 * Add a category of options. `config` is required for logger options.
 */
export function addOptions(category: Exclude<OptionCategory, "logger">, command: Command): Command;
export function addOptions(category: "logger", command: Command, config: ConfigOptions): Command;
export function addOptions(category: OptionCategory, command: Command, config?: ConfigOptions): Command {
  const options = getOptions(category, config);
  for (const option of Object.values<Option>(options)) {
    command.addOption(option);
  }
  return command;
}
