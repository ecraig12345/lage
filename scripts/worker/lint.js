/** @import { BasicWorkerRunnerFunction } from "../types.js" */
const { ESLint } = require("eslint");
const fs = require("fs");
const path = require("path");
const { getPackageInfo } = require("workspace-tools-npm");

/**
 * This worker is used for `lage run lint`, in place of the per-package `lint` script.
 *
 * Since this worker function has some extra logic/config, it's reused by the per-package `lint` script
 * (`monorepo-scripts lint` which runs commands/lint.js) to avoid duplication.
 *
 * @type {BasicWorkerRunnerFunction}
 */
async function lint(data) {
  const { target, taskArgs } = data;
  const packageJson = getPackageInfo(target.cwd);

  if (!packageJson?.scripts?.lint) {
    process.stdout.write('No "lint" script found - skipping');
    // pass
    return;
  }

  const projectConfigPath = path.join(target.cwd, ".eslintrc.js");
  const baseConfigPath = path.resolve(__dirname, "../config/eslintrc.js");
  const hasProjectConfig = fs.existsSync(projectConfigPath);
  const config = hasProjectConfig ? require(projectConfigPath) : require(baseConfigPath);

  (config.parserOptions ??= {}).project = path.join(target.cwd, "tsconfig.json");
  if (hasProjectConfig) {
    // The project configs intentionally don't have "root" or "extends" to make the single
    // config for the editor work (repo root .eslintrc.js)
    config.root = true;
    config.extends = baseConfigPath;
  }

  const shouldFix = taskArgs?.includes("--fix");

  const eslint = new ESLint({
    reportUnusedDisableDirectives: "error",
    baseConfig: config,
    fix: shouldFix,
    cache: false,
    cwd: target.cwd,
  });

  const files = target.packageName === "@lage-run/monorepo-scripts" ? ["."] : ["src"];
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter("stylish");
  const resultText = await formatter.format(results);

  await ESLint.outputFixes(results);

  if (resultText) {
    process.stdout.write(resultText + "\n");
  }

  const hasErrors = results.some((r) => r.errorCount > 0);
  const hasWarnings = results.some((r) => r.warningCount > 0);
  if (hasErrors || hasWarnings) {
    throw new Error(`Linting failed with ${hasErrors ? "errors" : "warnings"}`);
  }
}

module.exports = lint;
