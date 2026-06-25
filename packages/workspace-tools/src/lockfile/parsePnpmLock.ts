import { nameAtVersion } from "./nameAtVersion.js";
import { type LockDependency, type ParsedLock, type PnpmLockFile } from "./types.js";

export function parsePnpmLock(yaml: PnpmLockFile): ParsedLock {
  const object: {
    [key in string]: LockDependency;
  } = {};

  if (!yaml.packages) {
    return { object, type: "success" };
  }

  // All versions: https://github.com/pnpm/spec/blob/master/lockfile/README.md
  // Unfortunately the dependency path spec for each version is not as clear as it could be...
  const lockfileVersion = Number(yaml.lockfileVersion.match(/^\d+/)?.[0]);
  if (!lockfileVersion || lockfileVersion > 9 || lockfileVersion < 5) {
    // A new lockfileVersion might have changed the key format again
    throw new Error(`Unsupported pnpm lockfile version: ${yaml.lockfileVersion}`);
  }

  for (let [pkgSpec, snapshot] of Object.entries(yaml.packages)) {
    let name: string;
    let version: string;
    if (lockfileVersion === 5) {
      // /@types/node/20.19.33 or add scoped parts after another /
      // TODO: handle file:foo.tgz syntax (rush uses this for internal package links)
      const specParts = pkgSpec.split("/");
      name = specParts.length > 3 ? `${specParts[1]}/${specParts[2]}` : specParts[1];
      version = specParts.length > 3 ? specParts[3] : specParts[2];
    }

    // pnpm 8 format (lockfileVersion 6):     /@types/node@20.19.33 or /@rushstack/k@1.0.0(@rushstack/m@1.0.0)(@rushstack/n@2.0.0)
    // pnpm 9+ format (lockfileVersion 9):    @types/node@20.19.33
    if (lockfileVersion < 6) {
      // pnpm < 8 format (lockfileVersion < 6):
    } else if (lockfileVersion === 6) {
    } else {
    }
    if (lockfileVersion < 9 && pkgSpec.startsWith("/")) {
      pkgSpec = pkgSpec.slice(1);
    }

    object[nameAtVersion(name, version)] = {
      version,
      dependencies: snapshot.dependencies,
    };
  }

  return {
    object,
    type: "success",
  };
}
