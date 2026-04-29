import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { cleanupFixtures, setupFixture, setupLocalRemote, setupPackageJson } from "../setupFixture.js";
import { addGitObserver, clearGitObservers, gitFailFast, type GitObserver } from "../../git/git.js";
import { getDefaultRemoteBranch, resolveRemoteBranch } from "../../git/getDefaultRemoteBranch.js";

let cwd: string;
let consoleMock: jest.SpiedFunction<typeof console.log>;
const gitObserver = jest.fn<GitObserver>();

function gitRemote(...args: string[]) {
  gitFailFast(["remote", ...args], { cwd, noExitCode: true });
}

function getGitCalls() {
  return gitObserver.mock.calls.map(([args]) => args.join(" "));
}

/** Expect `getRemotes` to have been called exactly once */
function expectGetRemotesCalled() {
  const gitCalls = getGitCalls();
  expect(gitCalls).toContain("config --get-regexp remote\\..*\\.url");
  expect(gitCalls.filter((call) => call === "config --get-regexp remote\\..*\\.url")).toHaveLength(1);
}

/** Expect `getDefaultRemoteBranch` to have fetched default branch info from the remote or not */
function expectQueriedRemote(options?: { not?: boolean; remote?: string }) {
  const { not, remote = "origin" } = options || {};
  const gitCalls = getGitCalls();
  (not ? expect(gitCalls).not : expect(gitCalls)).toContain(`ls-remote --symref ${remote} HEAD`);
}

beforeAll(() => {
  consoleMock = jest.spyOn(console, "log").mockImplementation(() => undefined);
  addGitObserver(gitObserver);
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
  cleanupFixtures();
  clearGitObservers();
});

// These tests focus on the logic specific to getDefaultRemoteBranch, not the parts handled
// by getDefaultRemote.
describe("getDefaultRemoteBranch", () => {
  // This case uses the result of getDefaultRemote, no extra logic
  it("with branch option, returns <defaultRemote>/<branch> without querying remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    gitRemote("add", "origin", "https://github.com/microsoft/lage.git");
    gitObserver.mockClear();

    expect(getDefaultRemoteBranch({ cwd, branch: "main" })).toBe("origin/main");
    expectGetRemotesCalled();
    expectQueriedRemote({ not: true });
    expect(consoleMock).toHaveBeenCalledTimes(1);
    expect(consoleMock).toHaveBeenCalledWith(expect.stringContaining('Valid "repository" key not found'));
  });

  it("with branch name that includes a slash, returns <defaultRemote>/<branch> without querying remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd, { repository: "https://github.com/microsoft/lage.git" });
    gitRemote("add", "origin", "https://github.com/example/lage.git");
    gitRemote("add", "upstream", "https://github.com/microsoft/lage.git");
    gitObserver.mockClear();

    expect(getDefaultRemoteBranch({ cwd, branch: "feature/foo" })).toBe("upstream/feature/foo");
    expectGetRemotesCalled();
    expectQueriedRemote({ not: true });
    expect(consoleMock).not.toHaveBeenCalled(); // no warning since repository field is valid
  });

  it("gets default branch from remote via ls-remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupLocalRemote({ cwd, remoteName: "foo" });

    expect(getDefaultRemoteBranch({ cwd })).toBe("foo/main");
    expectQueriedRemote({ remote: "foo" });
    // setupLocalRemote updates package.json so we don't get the warning
    expect(consoleMock).not.toHaveBeenCalled();
  });

  // No remotes configured: getDefaultRemote falls back to "origin",
  // ls-remote fails, and getDefaultBranch reads init.defaultBranch ("main").
  it("falls back to init.defaultBranch when remote is unavailable", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    // Override init.defaultBranch to a predictable value
    gitFailFast(["config", "init.defaultBranch", "foo"], { cwd, noExitCode: true });
    gitObserver.mockClear();

    expect(getDefaultRemoteBranch({ cwd })).toBe("origin/foo");

    const gitCalls = getGitCalls();
    expectQueriedRemote();
    expect(gitCalls).toContain("config init.defaultBranch");
  });
});

describe("resolveRemoteBranch", () => {
  it("returns branch as-is when it already has a known remote prefix (no git ops)", () => {
    expect(resolveRemoteBranch({ branch: "origin/main", cwd: "fake" })).toBe("origin/main");
    expect(resolveRemoteBranch({ branch: "upstream/develop", cwd: "fake" })).toBe("upstream/develop");
    expect(resolveRemoteBranch({ branch: "origin/feature/foo", cwd: "fake" })).toBe("origin/feature/foo");
    expect(gitObserver).not.toHaveBeenCalled();
  });

  it("prepends default remote for plain branch with no slash", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    gitRemote("add", "origin", "https://github.com/microsoft/lage.git");
    gitObserver.mockClear();

    expect(resolveRemoteBranch({ branch: "main", cwd })).toBe("origin/main");
    expectGetRemotesCalled();
  });

  it("recognizes a non-default remote prefix in branch name", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    gitRemote("add", "origin", "https://github.com/microsoft/lage.git");
    gitRemote("add", "myremote", "https://github.com/myuser/lage.git");
    gitObserver.mockClear();

    expect(resolveRemoteBranch({ branch: "myremote/feature", cwd })).toBe("myremote/feature");
    expectGetRemotesCalled();
  });

  it("prepends default remote when slash-containing branch prefix is not a real remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    gitRemote("add", "origin", "https://github.com/microsoft/lage.git");

    // "feature" is not a remote, so the whole string is treated as the branch name
    expect(resolveRemoteBranch({ branch: "feature/foo", cwd })).toBe("origin/feature/foo");
    expectGetRemotesCalled();
  });

  it("queries remote for default branch when no branch is given", () => {
    cwd = setupFixture(undefined, { git: true });
    setupLocalRemote({ cwd, remoteName: "origin" });
    jest.clearAllMocks();

    expect(resolveRemoteBranch({ branch: undefined, cwd })).toBe("origin/main");
    expectQueriedRemote();
    expectGetRemotesCalled();
  });
});
