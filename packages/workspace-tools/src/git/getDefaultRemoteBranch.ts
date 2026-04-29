import { getDefaultRemote, type GetDefaultRemoteOptions } from "./getDefaultRemote.js";
import { git } from "./git.js";
import { getDefaultBranch } from "./gitUtilities.js";
import { parseRemoteBranchPlusRemotes } from "./parseRemoteBranch.js";

export type GetDefaultRemoteBranchOptions = GetDefaultRemoteOptions & {
  /**
   * Name of branch to use, **without** a remote prefix. If you want to resolve a branch
   * that may already include a remote prefix, use {@link resolveRemoteBranch}.
   *
   * If undefined, uses the default branch name (falling back to `master`).
   */
  branch?: string;
};

/**
 * Gets a reference to `options.branch` or the default branch relative to the default remote.
 * (See {@link getDefaultRemote} for how the default remote is determined.)
 *
 * If you want to resolve a branch that may already include a remote prefix, use
 * {@link resolveRemoteBranch} instead.
 *
 * @returns A branch reference like `upstream/master` or `origin/master`.
 */
export function getDefaultRemoteBranch(options: GetDefaultRemoteBranchOptions): string;
/**
 * First param: `branch`. Second param: `cwd`. See {@link GetDefaultRemoteBranchOptions} for more info.
 * (This had to be changed to `...args` to avoid a conflict with the object param version.)
 * @deprecated Use the object param version
 */
export function getDefaultRemoteBranch(...args: string[]): string;
export function getDefaultRemoteBranch(...args: (string | GetDefaultRemoteBranchOptions)[]): string {
  const [branchOrOptions, argsCwd] = args;
  const options =
    typeof branchOrOptions === "string"
      ? ({ branch: branchOrOptions, cwd: argsCwd } as GetDefaultRemoteBranchOptions)
      : branchOrOptions;
  const { cwd, branch } = options;

  const defaultRemote = getDefaultRemote(options);

  if (branch) {
    return `${defaultRemote}/${branch}`;
  }

  let remoteDefaultBranch: string | undefined;

  // Get the default branch name from the default remote.
  // ls-remote is a plumbing command with stable, locale-independent output.
  // Output format: "ref: refs/heads/main\tHEAD\n<hash>\tHEAD"
  const lsRemote = git(["ls-remote", "--symref", defaultRemote, "HEAD"], { cwd });
  if (lsRemote.success) {
    const refRegex = /^ref: refs\/heads\/(.*?)\t/;
    const symRefLine = lsRemote.stdout.split("\n").find((line) => refRegex.test(line));
    remoteDefaultBranch = symRefLine && symRefLine.match(refRegex)?.[1];
  }

  // If no default branch found from the remote, fall back to the local git config or "master"
  // (this can't use throwOnError in case the key isn't set)
  remoteDefaultBranch ||= getDefaultBranch({ cwd });

  return `${defaultRemote}/${remoteDefaultBranch}`;
}

/**
 * Resolve a user-provided branch (possibly with a remote) to a fully-qualified remote branch.
 * First tries the less-expensive {@link parseRemoteBranchPlusRemotes} (`git remote`) to see if
 * there's an explicit remote in the branch name, then tries {@link getDefaultRemoteBranch}.
 *
 * @returns A fully-qualified target remote branch reference (e.g. `origin/main`)
 */
export function resolveRemoteBranch(
  options: Omit<GetDefaultRemoteBranchOptions, "branch" | "remotes"> & {
    /** Branch which might include a remote prefix */
    branch: string | undefined;
  }
): string {
  const { branch } = options;

  let parsed: ReturnType<typeof parseRemoteBranchPlusRemotes> | undefined;
  if (branch) {
    // A branch is provided, so see if it includes a remote name.
    // The result is saved so the fetched list of remotes can be reused.
    parsed = parseRemoteBranchPlusRemotes({ ...options, branch });
    if (parsed.remote) {
      return `${parsed.remote}/${parsed.remoteBranch}`;
    }
  }

  // No branch provided, or the provided branch didn't include a remote.
  // Get the default remote and possibly default branch.
  return getDefaultRemoteBranch({ ...options, remotes: parsed?.remotes });
}
