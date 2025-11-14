//
// NOTE: This file is an entry point and should NOT import from other files in the package!
// It's supposed to be as lightweight as possible
//

import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

/**
 * Starting from `cwd`, searches up the directory hierarchy for `filePath`.
 * If multiple strings are given, searches each directory level for any of them.
 * @returns Full path to the item found, or undefined if not found.
 */
export function searchUp(filePath: string | string[], cwd: string): string | undefined {
  const paths = typeof filePath === "string" ? [filePath] : filePath;
  // convert to an absolute path if needed
  cwd = path.resolve(cwd);
  const root = path.parse(cwd).root;

  let foundPath: string | undefined;

  while (!foundPath && cwd !== root) {
    foundPath = paths.find((p) => fs.existsSync(path.join(cwd, p)));
    if (foundPath) {
      break;
    }

    cwd = path.dirname(cwd);
  }

  return foundPath ? path.join(cwd, foundPath) : undefined;
}

/**
 * Starting from `cwd`, uses `git rev-parse --show-toplevel` to find the root of the git repo.
 * Throws if `cwd` is not in a Git repository.
 */
export function findGitRoot(cwd: string) {
  // This uses spawnSync instead of the git helper to avoid the extra dependency
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd });

  if (result.status !== 0) {
    throw new Error(`Directory "${cwd}" is not in a git repository`);
  }

  return path.normalize(result.stdout.toString().trim());
}

/**
 * Starting from `cwd`, searches up the directory hierarchy for `package.json`.
 */
export function findPackageRoot(cwd: string): string | undefined {
  const jsonPath = searchUp("package.json", cwd);
  return jsonPath && path.dirname(jsonPath);
}

export function isChildOf(child: string, parent: string) {
  const relativePath = path.relative(child, parent);
  return /^[./\\]+$/.test(relativePath);
}
