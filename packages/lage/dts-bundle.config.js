// This is the config file for `dts-bundle-generator`, which is basically like Rollup for dts files.
// https://github.com/timocov/dts-bundle-generator/blob/master/src/config-file/README.md
//
// Since `lage`'s config types are defined in `@lage-run/cli` (and its dependencies), and `lage` ships
// a bundle rather than installing dependencies, it's also necessary to bundle the types in case
// consumers want to use them in their own lage configs.
//
// TODO
//
// The update script also does some basic validation: mainly detecting if a new dep is used which
// needs to be added to one of the `inlinedLibraries` lists below.

// @ts-check
const path = require("path");
const { getPackageInfos } = require("workspace-tools");

const azurePackagePath = path.dirname(require.resolve("@azure/core-http/package.json"));
const azurePackageJson = require("@azure/core-http/package.json");
const azureTypesPath = path.join(azurePackagePath, azurePackageJson.types);

/** @type {import('dts-bundle-generator/config-schema').BundlerConfig} */
const config = {
  compilationOptions: {
    preferredConfigPath: path.join(__dirname, "tsconfig.json"),
  },

  entries: [
    {
      filePath: path.join(path.dirname(require.resolve("@lage-run/cli/package.json")), "lib/index.d.ts"),
      outFile: "./dist/index.d.ts",
      libraries: {
        // Inline any types from workspace packages into the dts bundle,
        // as well as backfill and @azure/core-http (which are bundled).
        inlinedLibraries: [
          ...Object.values(getPackageInfos(process.cwd()))
            .filter((p) => p.name !== "lage" && !p.private)
            .map((p) => p.name),
          "@azure/core-http",
          "backfill-config",
          "backfill-logger",
        ],
      },
      output: {
        // Only export the types which are explicitly exported in the original files
        // (rather than all types referenced by exported types)
        exportReferencedTypes: false,
        inlineDeclareExternals: true,
      },
    },
    {
      // filePath: path.join(__dirname, "azure.d.ts"),
      filePath: azureTypesPath,
      outFile: "./dist/azure.d.ts",
      libraries: {
        inlinedLibraries: ["@azure/core-http", "@azure/abort-controller"],
      },
      output: {
        // Only export the types which are explicitly exported in the original files
        // (rather than all types referenced by exported types)
        // exportReferencedTypes: false,
        inlineDeclareExternals: true,
      },
    },
  ],
};

module.exports = config;
