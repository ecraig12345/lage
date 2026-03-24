import type { LockDependency, ParsedLock, BerryLockFile } from "./types.js";

/**
 * Convert a Yarn Berry (v2+) YAML lock file contents into a standardized format.
 */
export function parseBerryLock(yaml: BerryLockFile): ParsedLock {
  const results: { [key: string]: LockDependency } = {};

  for (const [keySpec, descriptor] of Object.entries(yaml)) {
    if (keySpec === "__metadata") {
      continue;
    }

    const keys = keySpec.split(", ");

    for (const key of keys) {
      const normalizedKey = key.replace("@npm:", "@");
      results[normalizedKey] = {
        version: descriptor.version,
        dependencies: descriptor.dependencies ?? {},
      };
    }
  }

  return {
    object: results,
    type: "success",
  };
}
