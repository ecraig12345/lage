import { git } from "./git.js";
import { type GitCommonOptions } from "./types.js";

/**
 * Get the value of a git config key. Returns null if it's not set.
 * (Note: setting `throwOnError: true` will cause it to fail if the key is unset.)
 */
export function getConfigValue(options: { key: string } & GitCommonOptions): string | null {
  const { key, ...gitOptions } = options;
  const results = git(["config", key], gitOptions);
  // command failure here just means it's not set
  return results.success ? results.stdout.trim() : null;
}

// Other config helpers can move here in the future
