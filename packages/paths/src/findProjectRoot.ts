import { findGitRoot } from "./findGitRoot";
import { getWorkspaceRoot } from "./findWorkspaceRoot";

/**
 * Starting from `cwd`, searches up the directory hierarchy for the workspace root,
 * falling back to the git root if no workspace is detected.
 */
export function findProjectRoot(cwd: string): string {
  let workspaceRoot: string | undefined;
  try {
    workspaceRoot = getWorkspaceRoot(cwd);
  } catch (err) {
    logVerboseWarning(`Error getting workspace root for ${cwd}`, err);
  }

  if (!workspaceRoot) {
    logVerboseWarning(`Could not find workspace root for ${cwd}. Falling back to git root.`);
  }
  return workspaceRoot || findGitRoot(cwd);
}
