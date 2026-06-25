// NOTE: never place the import of lockfile implementation here, as it slows down the library as a whole
import fs from "fs";
import path from "path";
import { ParsedLock, PnpmLockFile, NpmLockFile, BerryLockFile } from "./types";
import { parsePnpmLock } from "./parsePnpmLock";
import { parseNpmLock } from "./parseNpmLock";
import { readYaml } from "./readYaml";
import { parseBerryLock } from "./parseBerryLock";
import { managerFiles } from "../workspaces/implementations/getWorkspaceManagerAndRoot";

const memoization: { [path: string]: ParsedLock } = {};

/**
 * Read the lock file from the given directory.
 * @param root Directory to look in (does NOT search up).
 * This should be either the monorepo root, or the package root in a non-monorepo.
 */
export async function parseLockFile(root: string): Promise<ParsedLock> {
  // rush lock files go under common/config/rush
  const lockFileRoot = fs.existsSync(path.join(root, managerFiles.rush)) ? path.join(root, "common/config/rush") : root;

  const manager = (["yarn", "pnpm", "npm"] as const).find((manager) =>
    fs.existsSync(path.join(lockFileRoot, managerFiles[manager]))
  );
  if (!manager) {
    throw new Error(`Couldn't find a npm, yarn, or pnpm lock file under ${root}`);
  }

  const lockFilePath = path.join(lockFileRoot, managerFiles[manager]);
  if (memoization[lockFilePath]) {
    return memoization[lockFilePath];
  }

  let parsed: ParsedLock;

  switch (manager) {
    case "yarn": {
      const yarnLock = fs.readFileSync(lockFilePath, "utf-8");

      const isBerry =
        yarnLock.includes("__metadata") || fs.existsSync(path.resolve(yarnLock.replace("yarn.lock", ".yarnrc.yml")));

      if (isBerry) {
        const yaml = readYaml<BerryLockFile>(lockFilePath);
        parsed = parseBerryLock(yaml);
      } else {
        // TODO: this should be an async import in the future (currently causes issues with jest setup)
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const parseYarnLock = require("@yarnpkg/lockfile").parse;
        parsed = parseYarnLock(yarnLock);
      }
      break;
    }
    case "pnpm": {
      const yaml = readYaml<PnpmLockFile>(lockFilePath);
      parsed = parsePnpmLock(yaml);
      break;
    }
    case "npm": {
      let npmLockJson: NpmLockFile;
      try {
        npmLockJson = JSON.parse(fs.readFileSync(lockFilePath, "utf-8"));
      } catch {
        throw new Error("Couldn't read package-lock.json");
      }

      if (!npmLockJson?.lockfileVersion || npmLockJson.lockfileVersion < 2) {
        throw new Error(
          `Your package-lock.json version is not supported: lockfileVersion is ${npmLockJson.lockfileVersion}. You need npm version 7 or above and package-lock version 2 or above. Please, upgrade npm or choose a different package manager.`
        );
      }

      parsed = parseNpmLock(npmLockJson);
      break;
    }
  }

  memoization[lockFilePath] = parsed;
  return parsed;
}
