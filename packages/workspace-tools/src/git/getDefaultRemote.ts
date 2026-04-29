import fs from "fs";
import path from "path";
import { findGitRoot } from "../paths.js";
import { type PackageInfo } from "../types/PackageInfo.js";
import { getRepositoryName } from "./getRepositoryName.js";
import { getRemotes } from "./getRemotes.js";

export type GetDefaultRemoteOptions = {
  /** Get repository info relative to this directory. */
  cwd: string;
  /**
   * If true, throw an error if remote info can't be found, or if a `repository` is not specified
   * in package.json and no matching remote is found.
   */
  strict?: boolean;
  /** If true, log debug messages about how the remote was chosen */
  verbose?: boolean;
  /** Optional pre-fetched mapping from remote name to remote URL */
  remotes?: Record<string, string>;
};

/**
 * Get the name of the default remote: the one matching the `repository` field in package.json.
 * Throws if `options.cwd` is not in a git repo or there's no package.json at the repo root.
 *
 * The order of preference for returned remotes is:
 * 1. If `repository` is defined in package.json, the remote with a matching URL (if `options.strict`
 *    is true, throws an error if no matching remote exists)
 * 2. `upstream` if defined
 * 3. `origin` if defined
 * 4. The first defined remote
 * 5. If there are no defined remotes: throws an error if `options.strict` is true; otherwise returns `origin`
 *
 * @returns The name of the inferred default remote.
 */
export function getDefaultRemote(options: GetDefaultRemoteOptions): string;
/** @deprecated Use the object param version */
export function getDefaultRemote(cwd: string): string;
export function getDefaultRemote(cwdOrOptions: string | GetDefaultRemoteOptions): string {
  const options = typeof cwdOrOptions === "string" ? { cwd: cwdOrOptions } : cwdOrOptions;
  const { cwd, strict, verbose } = options;

  const log = (message: string) => verbose && console.log(message);
  const logOrThrow = (message: string) => {
    if (strict) {
      throw new Error(message);
    }
    log(message);
  };

  // Try package.json from `cwd` first, since cwd is often the project root in actual usage,
  // and the repository URL should be the same throughout the repo.
  let urlResult = getRepositoryUrlFromPackageJson(cwd, logOrThrow);
  if (!urlResult.repositoryUrl) {
    // If not found in cwd, try the git root (which may be a parent directory)
    const gitRoot = findGitRoot(cwd);
    if (gitRoot !== cwd) {
      urlResult = getRepositoryUrlFromPackageJson(gitRoot, logOrThrow);
    }

    if (!urlResult.repositoryUrl) {
      // This is always logged because it's strongly recommended to fix
      console.log(
        `Valid "repository" key not found in package.json at "${urlResult.packageJsonPath}". ` +
          `Consider adding this info for more accurate git remote detection.`
      );
    }
  }

  /** Repository full name (owner and repo name) specified in package.json */
  const repositoryName = urlResult.repositoryUrl && getRepositoryName(urlResult.repositoryUrl);

  // Get remote names and URLs
  const remotes = options.remotes || getRemotes({ cwd });
  if (!remotes || !Object.keys(remotes).length) {
    // If we get here, no git remotes were found. This should probably always be an error (since
    // subsequent operations which require a remote likely won't work), but to match old behavior,
    // still default to "origin" unless `strict` is true.
    logOrThrow(`Could not find any remotes in git repo at "${cwd}".`);
    log(`Assuming default remote "origin".`);
    return "origin";
  }

  for (const [remoteName, remoteUrl] of Object.entries(remotes)) {
    // There are many possible remote URL formats, so normalize before comparison
    const remoteRepoName = getRepositoryName(remoteUrl);
    if (remoteRepoName === repositoryName) {
      return remoteName;
    }
  }

  if (repositoryName) {
    // If `strict` is true, and repositoryName is found, there MUST be a matching remote
    logOrThrow(`Could not find remote pointing to repository "${repositoryName}".`);
  }

  // Default to upstream or origin if available, or the first remote otherwise
  const fallback = ["upstream", "origin"].find((name) => !!remotes[name]) || Object.keys(remotes)[0];
  log(`Default to remote "${fallback}"`);
  return fallback;
}

function getRepositoryUrlFromPackageJson(
  dir: string,
  logOrThrow: (message: string) => void
): { packageJsonPath: string; repositoryUrl: string | undefined } {
  const packageJsonPath = path.join(dir, "package.json");
  let repositoryUrl: string | undefined;

  try {
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageInfo;
      const { repository } = packageJson;
      repositoryUrl = typeof repository === "string" ? repository : repository?.url;
    }
  } catch {
    logOrThrow(`Could not read "${packageJsonPath}"`);
  }

  return { packageJsonPath, repositoryUrl };
}
