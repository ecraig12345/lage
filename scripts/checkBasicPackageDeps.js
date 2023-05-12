//
// This script verifies that low-level packages don't accidentally have dependencies added,
// so they stay as lightweight as possible.
//

// @ts-check
const fs = require("fs-extra");
const path = require("path");

let hasError = false;

// @ws-tools/types should definitely never have dependencies
const typesPackageJson = fs.readJSONSync(path.resolve(__dirname, "../packages/types/package.json"));
if (typesPackageJson.dependencies && Object.keys(typesPackageJson.dependencies).length) {
  console.error("The @ws-tools/types package should not have any dependencies");
  hasError = true;
} else {
  console.log("✅ The @ws-tools/types package has no dependencies");
}

// @ws-tools/paths should *probably* not have dependencies.
// This could change later if needed, but it should be carefully considered.
const pathsPackageJson = fs.readJSONSync(path.resolve(__dirname, "../packages/paths/package.json"));
const pathsDeps = Object.keys(pathsPackageJson.dependencies);
if (pathsDeps.length !== 1 || pathsDeps[0] !== "@ws-tools/types") {
  console.error("The @ws-tools/paths package should only depend on @ws-tools/types");
  hasError = true;
} else {
  console.log("✅ The @ws-tools/paths package only depends on @ws-tools/types");
}

if (hasError) {
  process.exit(1);
}
