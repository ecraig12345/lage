import path from "path";
import type { PackageInfo, PackageInfos } from "workspace-tools";
import { builtInTargetTypes } from "./builtInTargetTypes.js";
import { getWeight } from "./getWeight.js";
import { getPackageAndTask, getStagedTargetId, getTargetId } from "./targetId.js";
import type { Target } from "./types/Target.js";
import type { StagedTargetConfig, TargetConfig } from "./types/TargetConfig.js";

export interface TargetFactoryOptions {
  root: string;
  packageInfos: PackageInfos;
  /** Root package.json for reference by global tasks */
  rootPackageInfo: PackageInfo | undefined;
}

export class TargetFactory {
  private _allPackageScripts: Set<string> | undefined;

  constructor(private options: TargetFactoryOptions) {}

  /**
   * Creates a package task `Target`
   */
  public createPackageTarget(packageName: string, task: string, config: TargetConfig): Target {
    const { inputs, priority, maxWorkers, environmentGlob, weight } = config;
    const packageInfo = this.getPackageInfo(packageName);
    const cwd = path.dirname(packageInfo.packageJsonPath);

    const targetType =
      config.type || (typeof packageInfo?.scripts?.[task] === "string" ? builtInTargetTypes.npmScript : builtInTargetTypes.noop);

    const target: Target = {
      id: getTargetId(packageName, task),
      label: `${packageName} - ${task}`,
      type: targetType,
      packageName,
      task,
      cache: config.cache !== false,
      cwd,
      depSpecs: config.dependsOn ?? config.deps ?? [],
      dependencies: [],
      dependents: [],
      inputs,
      outputs: targetType === builtInTargetTypes.noop ? [] : config.outputs,
      priority,
      maxWorkers,
      environmentGlob,
      weight: 1,
      options: config.options,
      shouldRun: true,
    };

    target.weight = getWeight(target, weight, maxWorkers);

    return target;
  }

  public createGlobalTarget(id: string, config: TargetConfig): Target {
    const { root } = this.options;
    const { options, dependsOn = config.deps ?? [], cache, inputs, outputs, priority, maxWorkers, environmentGlob, weight } = config;
    const { task } = getPackageAndTask(id);
    const target: Target = {
      id,
      label: id,
      type: config.type || (this.getAllPackageScripts().has(task) ? builtInTargetTypes.npmScript : builtInTargetTypes.noop),
      task,
      cache: cache !== false,
      cwd: root,
      depSpecs: dependsOn,
      dependencies: [],
      dependents: [],
      inputs,
      outputs,
      priority,
      maxWorkers,
      environmentGlob,
      weight: 1,
      options,
      shouldRun: true,
    };

    target.weight = getWeight(target, weight, maxWorkers);

    return target;
  }

  /**
   * Creates a target that operates on files that are "staged" (changed in git vs `--since`)
   */
  public createStagedTarget(task: string, config: StagedTargetConfig, changedFiles: string[]): Target {
    const { root } = this.options;
    const { dependsOn, priority } = config;

    // Clone & modify the options to include the changed files as taskArgs
    const options = { ...config.options };

    if (config.type !== builtInTargetTypes.noop) {
      // Clone any taskArgs and add the staged files
      options.taskArgs = [...(options.taskArgs ?? []), ...changedFiles];
    }

    const id = getStagedTargetId(task);
    const target: Target = {
      id,
      label: id,
      type: config.type,
      task,
      cache: false,
      cwd: root,
      depSpecs: dependsOn ?? [],
      dependencies: [],
      dependents: [],
      inputs: [],
      outputs: [],
      priority,
      maxWorkers: 1,
      environmentGlob: [],
      weight: 1,
      options,
      shouldRun: true,
    };

    return target;
  }

  private getPackageInfo(packageName: string): PackageInfo {
    const { packageInfos, rootPackageInfo } = this.options;
    const packageInfo = rootPackageInfo && rootPackageInfo.name === packageName ? rootPackageInfo : packageInfos[packageName];
    if (!packageInfo) {
      throw new Error(`Package "${packageName}" not found when creating target`);
    }
    if (!packageInfo.packageJsonPath) {
      throw new Error(`Package "${packageName}" is missing packageJsonPath when creating target`);
    }
    return packageInfo;
  }

  private getAllPackageScripts(): Set<string> {
    if (!this._allPackageScripts) {
      this._allPackageScripts = new Set();
      const packages = Object.values(this.options.packageInfos);
      this.options.rootPackageInfo && packages.push(this.options.rootPackageInfo);

      for (const pkg of packages) {
        if (!pkg.scripts) continue;
        for (const scriptName of Object.keys(pkg.scripts)) {
          this._allPackageScripts.add(scriptName);
        }
      }
    }
    return this._allPackageScripts;
  }
}
