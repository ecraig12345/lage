// This is a separate file from paths.ts because it uses findWorkspaceRoot

import { logVerboseWarning } from "./logging";
import { findGitRoot } from "./paths";
import type { WorkspaceManager } from "./types/WorkspaceManager.js";
import { getWorkspaceManagerRoot } from "./workspaces/getWorkspaceManagerRoot.js";

/**
 * Starting from `cwd`, searches up the directory hierarchy for the project root (workspace/monorepo
 * manager root), falling back to the git root if no manager root is detected. Results are cached by
 * `cwd`, and an error is thrown if no project root is found and it's not a git repo.
 *
 * To skip the git root fallback, use `getWorkspaceManagerRoot`. Usually the monorepo manager root
 * is the same as the git root, but this may not be the case with multiple "monorepos" in a single
 * git repo, or in project structures with multiple languages where the JS is not at the root.
 *
 * @param manager Optional workspace/monorepo manager to look for specifically
 */
export function findProjectRoot(cwd: string, manager?: WorkspaceManager): string {
  let workspaceRoot: string | undefined;
  try {
    workspaceRoot = getWorkspaceManagerRoot(cwd, manager);
    if (!workspaceRoot) {
      logVerboseWarning(`Could not find workspace manager root for ${cwd}. Falling back to git root.`);
    }
  } catch (err) {
    logVerboseWarning(`Error getting workspace manager root for ${cwd} (will fall back to git root)`, err);
  }

  return workspaceRoot || findGitRoot(cwd);
}
