import { TargetFactory } from "../TargetFactory.js";

describe("TargetFactory", () => {
  it("should give a type of 'npmScript' if the package contains that script", () => {
    const factory = new TargetFactory({
      root: "root",
      rootPackageInfo: undefined,
      packageInfos: {
        a: {
          name: "a",
          packageJsonPath: "root/a/package.json",
          version: "1.0.0",
          scripts: { build: "echo build" },
        },
      },
    });

    const target = factory.createPackageTarget("a", "build", {
      dependsOn: ["^build"],
    });

    expect(target.type).toBe("npmScript");
  });

  it("should give a type of 'noop' if the package does not contain that script", () => {
    const factory = new TargetFactory({
      root: "root",
      rootPackageInfo: undefined,
      packageInfos: {
        a: {
          name: "a",
          packageJsonPath: "root/a/package.json",
          version: "1.0.0",
          scripts: { test: "echo test" },
        },
        b: {
          name: "b",
          packageJsonPath: "root/b/package.json",
          version: "1.0.0",
          scripts: { build: "echo build" },
        },
      },
    });

    // b has build but a doesn't, so it's a noop
    const target = factory.createPackageTarget("a", "build", {
      dependsOn: ["^build"],
    });

    expect(target.type).toBe("noop");
  });

  it("uses type npmScript for global target with matching script in root package", () => {
    const factory = new TargetFactory({
      root: "root",
      rootPackageInfo: {
        name: "root",
        packageJsonPath: "root/package.json",
        version: "1.0.0",
        scripts: { build: "echo build" },
      },
      packageInfos: {},
    });

    const target = factory.createPackageTarget("root", "build", {
      dependsOn: ["^build"],
    });

    expect(target.type).toBe("npmScript");
  });

  // This is probably not possible since the root package isn't in the package infos
  // (so trying to reference it in a task would probably fail elsewhere)
  it("uses type npmScript for root package target with matching script", () => {
    const factory = new TargetFactory({
      root: "root",
      rootPackageInfo: {
        name: "root",
        packageJsonPath: "root/package.json",
        version: "1.0.0",
        scripts: { build: "echo build" },
      },
      packageInfos: {},
    });

    const target = factory.createPackageTarget("root", "build", {
      dependsOn: ["^build"],
    });

    expect(target.type).toBe("npmScript");
  });
});
