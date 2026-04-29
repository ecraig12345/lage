import { git } from "./git.js";
import type { GitCommonOptions } from "./types.js";

/**
 * Get a mapping from remote names to fetch URLs.
 *
 * Note this returns the URLs directly from `git config --get-regexp 'remote\..*\.url'`, which
 * doesn't respect any `url.<base>.insteadOf` remappings (such as for ssh). This should be fine
 * for current usage: `parseRemoteBranch` only needs the names, and `getDefaultRemote` compares
 * parsed URLs from `package.json` `repository` and should be flexible about formats.
 *
 * @param options git options. The config command exits with an error if there are no remotes configured,
 * so `throwOnError` is not supported.
 *
 * @returns An object mapping remote names to URLs, or undefined if nothing found.
 */
export function getRemotes(options: Omit<GitCommonOptions, "throwOnError">): Record<string, string> | undefined {
  // Get remote names and URLs, similar to `git remote -v` but without localization concerns.
  // It's expected that this will exit with an error if there are no remotes configured
  // (so we override throwOnError in case it was present on a reused options object).
  const remotesResult = git(["config", "--get-regexp", "remote\\..*\\.url"], { ...options, throwOnError: false });
  if (!remotesResult.success) {
    return undefined;
  }

  const remotes: Record<string, string> = {};
  const remoteLines = remotesResult.stdout.trim().split("\n");
  for (const line of remoteLines) {
    const remoteMatch = line.match(/^remote\.(.+?)\.url\s+(.*)$/);
    if (!remoteMatch) continue;
    const [, remoteName, remoteUrl] = remoteMatch;
    remotes[remoteName] = remoteUrl;
  }

  return remotes;
}
