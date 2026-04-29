import { afterAll, describe, expect, it } from "@jest/globals";
import { cleanupFixtures, setupFixture } from "../setupFixture.js";
import { gitFailFast } from "../../git/git.js";
import { getRemotes } from "../../git/getRemotes.js";

describe("getRemotes", () => {
  function gitRemote(cwd: string, ...args: string[]) {
    gitFailFast(["remote", ...args], { cwd, noExitCode: true });
  }

  afterAll(() => {
    cleanupFixtures();
  });

  it("returns undefined when not in a git repo", () => {
    // here, a nonexistent path behaves the same as not in a git repo
    expect(getRemotes({ cwd: "/fake/path" })).toBeUndefined();
  });

  it("returns undefined when no remotes are configured", () => {
    const cwd = setupFixture(undefined, { git: true });
    expect(getRemotes({ cwd })).toBeUndefined();
  });

  it("returns a single remote", () => {
    const cwd = setupFixture(undefined, { git: true });
    gitRemote(cwd, "add", "origin", "https://github.com/microsoft/lage.git");

    expect(getRemotes({ cwd })).toEqual({ origin: "https://github.com/microsoft/lage.git" });
  });

  it("returns multiple remotes with correct names and URLs", () => {
    const cwd = setupFixture(undefined, { git: true });
    gitRemote(cwd, "add", "origin", "https://github.com/myuser/lage.git");
    gitRemote(cwd, "add", "upstream", "https://github.com/microsoft/lage.git");
    gitRemote(cwd, "add", "fork", "git@github.com:otherfork/lage.git");

    expect(getRemotes({ cwd })).toEqual({
      origin: "https://github.com/myuser/lage.git",
      upstream: "https://github.com/microsoft/lage.git",
      fork: "git@github.com:otherfork/lage.git",
    });
  });

  it("handles remote names containing dots", () => {
    const cwd = setupFixture(undefined, { git: true });
    gitRemote(cwd, "add", "my.remote", "https://github.com/microsoft/lage.git");

    expect(getRemotes({ cwd })).toEqual({ "my.remote": "https://github.com/microsoft/lage.git" });
  });
});
