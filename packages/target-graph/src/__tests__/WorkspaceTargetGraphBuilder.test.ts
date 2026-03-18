import type { PackageInfos } from "workspace-tools";
import { WorkspaceTargetGraphBuilder } from "../WorkspaceTargetGraphBuilder.js";
import type { TargetGraph } from "../types/TargetGraph.js";

function getRootPackageInfo() {
  return {
    name: "root",
    version: "1.0.0",
    private: true,
    packageJsonPath: "/path/to/package.json",
  };
}

function createPackageInfos(packages: { [id: string]: string[] }) {
  const packageInfos: PackageInfos = {};
  Object.keys(packages).forEach((id) => {
    packageInfos[id] = {
      packageJsonPath: `/path/to/${id}/package.json`,
      name: id,
      version: "1.0.0",
      dependencies: packages[id].reduce((acc, dep) => {
        return { ...acc, [dep]: "*" };
      }, {}),
    };
  });

  return { packageInfos, rootPackageInfo: getRootPackageInfo() };
}

function createPackageInfoWithScripts(packages: { [id: string]: { deps: string[]; scripts: string[] } }) {
  const packageInfos: PackageInfos = {};
  Object.keys(packages).forEach((id) => {
    const { deps, scripts } = packages[id];
    packageInfos[id] = {
      packageJsonPath: `/path/to/${id}/package.json`,
      name: id,
      version: "1.0.0",
      dependencies: deps.reduce((acc, dep) => ({ ...acc, [dep]: "*" }), {}),
      devDependencies: {},
      scripts: scripts.reduce((acc, script) => ({ ...acc, [script]: `echo ${script}` }), {}),
    };
  });

  return { packageInfos, rootPackageInfo: getRootPackageInfo() };
}

/**
 * Get the graph from the target dependencies (in the form of `[dependsOn, target]`
 * (for running order, think of it as `[first, second]`)
 */
function getGraphFromTargets(targetGraph: TargetGraph, includeTypes?: boolean) {
  const graph: [string, string][] = [];
  for (const target of targetGraph.targets.values()) {
    for (const dep of target.dependencies) {
      graph.push([dep, includeTypes ? `${target.id} (${target.type})` : target.id]);
    }
  }

  return graph;
}

describe("workspace target graph builder", () => {
  it("should build a target based on a simple package graph and task graph", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("build", {
      dependsOn: ["^build"],
    });

    const targetGraph = await builder.build(["build"], undefined, [{ package: "b", task: "build", priority: 100 }]);

    // size is 3, because we also need to account for the root target node (start target ID)
    expect(targetGraph.targets.size).toBe(3);

    // Ensure priorities were set from the global priority argument
    expect(Array.from(targetGraph.targets.values())).toEqual([
      expect.objectContaining({ id: "__start", priority: 100 }),
      expect.objectContaining({ id: "a#build", priority: 0 }),
      expect.objectContaining({ id: "b#build", priority: 100 }),
    ]);

    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#build"],
      ["b#build", "a#build"],
      ["__start", "b#build"],
    ]);
  });

  it("should generate target graphs for tasks that do not depend on each other", async () => {
    const root = "/repos/a";
    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("test");
    await builder.addTargetConfig("lint");

    const targetGraph = await builder.build(["test", "lint"]);

    // includes the pseudo-target for the "start" target
    expect(targetGraph.targets.size).toBe(5);
    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#test"],
      ["__start", "b#test"],
      ["__start", "a#lint"],
      ["__start", "b#lint"],
    ]);
  });

  it("should generate targetGraph with some specific package task target dependencies, running against all packages", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
      c: ["b"],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });

    await builder.addTargetConfig("build", {
      dependsOn: ["^build"],
    });

    await builder.addTargetConfig("a#build", {
      dependsOn: [],
    });

    const targetGraph = await builder.build(["build"]);
    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#build"],
      ["__start", "b#build"],
      ["__start", "c#build"],
      ["b#build", "c#build"],
    ]);
  });

  it("should generate targetGraph with some specific package task target dependencies, running against a specific package", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
      c: ["b"],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });

    await builder.addTargetConfig("build", {
      dependsOn: ["^build"],
    });

    await builder.addTargetConfig("a#build", {
      dependsOn: [],
    });

    const targetGraph = await builder.build(["build"], ["a", "b"]);
    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#build"],
      ["__start", "b#build"],
    ]);
  });

  it("should generate targetGraph with transitive dependencies", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: ["c"],
      c: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });

    await builder.addTargetConfig("bundle", {
      dependsOn: ["^^transpile"],
    });

    await builder.addTargetConfig("transpile");

    const targetGraph = await builder.build(["bundle"], ["a"]);
    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#bundle"],
      ["b#transpile", "a#bundle"],
      ["c#transpile", "a#bundle"],
      ["__start", "b#transpile"],
      ["__start", "c#transpile"],
    ]);
  });

  it("should generate target graph for a general task on a specific target", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: [],
      b: [],
      c: [],
      common: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });

    await builder.addTargetConfig("build", {
      dependsOn: ["common#copy", "^build"],
    });

    await builder.addTargetConfig("common#copy");
    await builder.addTargetConfig("common#build");

    const targetGraph = await builder.build(["build"]);
    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#build"],
      ["common#copy", "a#build"],
      ["__start", "b#build"],
      ["common#copy", "b#build"],
      ["__start", "c#build"],
      ["common#copy", "c#build"],
      ["__start", "common#build"],
      ["__start", "common#copy"],
    ]);
  });

  it("should build a target graph with global task as a dependency", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("build", {
      dependsOn: ["^build", "#global:task"],
    });

    await builder.addTargetConfig("#global:task", {
      dependsOn: [],
    });

    const targetGraph = await builder.build(["build"]);

    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#build"],
      ["b#build", "a#build"],
      ["#global:task", "a#build"],
      ["__start", "b#build"],
      ["#global:task", "b#build"],
      ["__start", "#global:task"],
    ]);
  });

  it("should build a target graph with global task on its own", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("build", {
      dependsOn: ["^build", "#global:task"],
    });

    await builder.addTargetConfig("#global:task", {
      dependsOn: [],
    });

    const targetGraph = await builder.build(["global:task"]);

    expect(getGraphFromTargets(targetGraph)).toEqual([["__start", "#global:task"]]);
  });

  it("should build a target graph without including global task", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfos({
      a: ["b"],
      b: [],
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("build", {
      dependsOn: ["^build"],
    });

    await builder.addTargetConfig("#global:task", {
      dependsOn: [],
    });

    const targetGraph = await builder.build(["build"]);

    expect(getGraphFromTargets(targetGraph)).toEqual([
      ["__start", "a#build"],
      ["b#build", "a#build"],
      ["__start", "b#build"],
    ]);
  });

  it("should not create phantom transitive deps for packages missing a target", async () => {
    const root = "/repos/a";

    // "app" has emitDeclarations in scripts, "dep" does not
    const { packageInfos, rootPackageInfo } = createPackageInfoWithScripts({
      app: { deps: ["dep"], scripts: ["transpile", "typecheck", "emitDeclarations"] },
      dep: { deps: [], scripts: ["transpile", "typecheck"] },
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("transpile");
    await builder.addTargetConfig("emitDeclarations", {
      dependsOn: ["typecheck"],
    });
    await builder.addTargetConfig("typecheck", {
      dependsOn: ["^^emitDeclarations", "transpile", "^^transpile"],
    });

    const targetGraph = await builder.build(["typecheck"], ["app"]);
    const graph = getGraphFromTargets(targetGraph);
    expect(graph).toEqual([
      ["__start", "app#typecheck"],
      ["dep#emitDeclarations", "app#typecheck"],
      // app#typecheck should depend on app#transpile (same-package dep)
      ["app#transpile", "app#typecheck"],
      // app#typecheck should depend on dep#transpile (via ^^transpile, dep has the script)
      ["dep#transpile", "app#typecheck"],
      ["__start", "dep#emitDeclarations"],
      ["dep#typecheck", "dep#emitDeclarations"],
      ["__start", "app#transpile"],
      ["__start", "dep#transpile"],
      ["__start", "dep#typecheck"],
      ["dep#transpile", "dep#typecheck"],
    ]);

    // app#typecheck should NOT depend on dep#typecheck — dep doesn't have emitDeclarations,
    // so the phantom dep#emitDeclarations should not create a transitive link
    expect(graph).not.toContainEqual(["dep#typecheck", "app#typecheck"]);
  });

  // it("test", async () => {
  //   const root = "/repos/a";

  //   // "app" has emitDeclarations in scripts, "dep" does not
  //   const packageInfos = createPackageInfoWithScripts({
  //     app: { deps: ["dep"], scripts: ["transpile", "typecheck", "emitDeclarations"] },
  //     dep: { deps: ["dep2"], scripts: ["transpile", "typecheck"] },
  //     dep2: { deps: [], scripts: ["transpile", "typecheck"] },
  //   });

  //   const builder = new WorkspaceTargetGraphBuilder({ root, packageInfos, rootPackageInfo, enableTargetConfigMerging: false, enablePhantomTargetOptimization: false});
  //   await builder.addTargetConfig("transpile");
  //   await builder.addTargetConfig("emitDeclarations", {
  //     dependsOn: ["typecheck", "^^typecheck"],
  //   });
  //   await builder.addTargetConfig("typecheck", {
  //     // app depends on all deps' emitDeclarations and transpile
  //     dependsOn: ["^^emitDeclarations", "transpile", "^^transpile"],
  //   });

  //   const targetGraph = await builder.build(["typecheck"], ["app"]);
  //   const graph = getGraphFromTargets(targetGraph);
  //   expect(graph).toEqual([
  //     ["__start", "app#typecheck"],
  //     ["app#transpile", "app#typecheck"],
  //     ["dep#transpile", "app#typecheck"],
  //     ["dep2#transpile", "app#typecheck"],
  //     ["__start", "app#transpile"],
  //     ["__start", "dep#transpile"],
  //     ["__start", "dep2#transpile"],
  //   ]);

  //   // app#typecheck should NOT depend on dep#typecheck — dep doesn't have emitDeclarations,
  //   // so the phantom dep#emitDeclarations should not create a transitive link
  //   expect(graph).not.toContainEqual(["dep#typecheck", "app#typecheck"]);

  //   const targetGraph2 = await builder.build(["emitDeclarations"], ["app"]);
  //   const graph2 = getGraphFromTargets(targetGraph2);
  //   expect(graph2).toEqual([
  //     ["__start", "app#emitDeclarations"],
  //     ["app#typecheck", "app#emitDeclarations"],
  //     ["dep#typecheck", "app#emitDeclarations"],
  //     ["dep2#typecheck", "app#emitDeclarations"],
  //     ["__start", "app#typecheck"],
  //     ["app#transpile", "app#typecheck"],
  //     ["dep#transpile", "app#typecheck"],
  //     ["dep2#transpile", "app#typecheck"],
  //     ["__start", "dep#typecheck"],
  //     ["dep#transpile", "dep#typecheck"],
  //     ["dep2#transpile", "dep#typecheck"],
  //     ["__start", "dep2#typecheck"],
  //     ["dep2#transpile", "dep2#typecheck"],
  //     ["__start", "app#transpile"],
  //     ["__start", "dep#transpile"],
  //     ["__start", "dep2#transpile"],
  //   ]);
  // });

  it("preserves indirect links", async () => {
    const root = "/repos/a";

    const { packageInfos, rootPackageInfo } = createPackageInfoWithScripts({
      a: { deps: ["b"], scripts: ["build"] },
      b: { deps: ["c"], scripts: [] },
      c: { deps: [], scripts: ["build"] },
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("build", {
      dependsOn: ["^build"],
    });

    const targetGraph = await builder.build(["build"]);
    const graph = getGraphFromTargets(targetGraph, true);
    // This will be reduced by optimizeTargetGraph to have a#build depend on c#build
    // via no-op b#build
    expect(graph).toEqual([
      ["__start", "a#build (npmScript)"],
      ["b#build", "a#build (npmScript)"],
      ["__start", "b#build (noop)"],
      ["c#build", "b#build (noop)"],
      ["__start", "c#build (npmScript)"],
    ]);
  });

  it("should preserve ^^ deps for non-npmScript typed targets", async () => {
    const root = "/repos/a";

    // "dep" doesn't have "customTask" in scripts, but it's configured as a worker type
    const { packageInfos, rootPackageInfo } = createPackageInfoWithScripts({
      app: { deps: ["dep"], scripts: ["build"] },
      dep: { deps: [], scripts: ["build"] },
    });

    const builder = new WorkspaceTargetGraphBuilder({
      root,
      packageInfos,
      rootPackageInfo,
      enableTargetConfigMerging: false,
      enablePhantomTargetOptimization: false,
    });
    await builder.addTargetConfig("customTask", {
      type: "worker",
    });
    await builder.addTargetConfig("build", {
      dependsOn: ["^^customTask"],
    });

    const targetGraph = await builder.build(["build"], ["app"]);
    const graph = getGraphFromTargets(targetGraph);

    expect(graph).toEqual([
      ["__start", "app#build"],
      // app#build should depend on dep#customTask even though dep doesn't have it in scripts,
      // because the target has an explicit non-npmScript type ("worker")
      ["dep#customTask", "app#build"],
      ["__start", "dep#customTask"],
    ]);
  });
});
