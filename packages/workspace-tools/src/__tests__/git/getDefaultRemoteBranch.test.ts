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

const gitGetRemotesConfig = "config --get-regexp remote\\..*\\.url";
const gitGetOriginDefaultBranch = "ls-remote --symref origin HEAD";
const gitGetFooDefaultBranch = "ls-remote --symref foo HEAD";
const gitGetRoot = "rev-parse --show-toplevel";

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

    expect(consoleMock).toHaveBeenCalledTimes(1);
    expect(consoleMock).toHaveBeenCalledWith(expect.stringContaining('Valid "repository" key not found'));

    // For each test, verify the specific git commands that were invoked.
    // This increases visibility into internal behavior of specific cases, as well as if
    // more operations are added later.
    expect(getGitCalls()).toEqual([gitGetRoot, gitGetRemotesConfig]);
  });

  it("with branch name that includes a slash, returns <defaultRemote>/<branch> without querying remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd, { repository: "https://github.com/microsoft/lage.git" });
    gitRemote("add", "origin", "https://github.com/example/lage.git");
    gitRemote("add", "upstream", "https://github.com/microsoft/lage.git");
    gitObserver.mockClear();

    expect(getDefaultRemoteBranch({ cwd, branch: "feature/foo" })).toBe("upstream/feature/foo");
    expect(consoleMock).not.toHaveBeenCalled(); // no warning since repository field is valid

    expect(getGitCalls()).toEqual([gitGetRemotesConfig]);
  });

  it("gets default branch from remote via ls-remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupLocalRemote({ cwd, remoteName: "foo" });
    gitObserver.mockClear();

    expect(getDefaultRemoteBranch({ cwd })).toBe("foo/main");

    // setupLocalRemote updates package.json so we don't get the warning
    expect(consoleMock).not.toHaveBeenCalled();
    expect(getGitCalls()).toEqual([gitGetRemotesConfig, gitGetFooDefaultBranch]);
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

    expect(getGitCalls()).toEqual([
      gitGetRoot,
      gitGetRemotesConfig,
      gitGetOriginDefaultBranch,
      "config init.defaultBranch",
    ]);
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

    expect(getGitCalls()).toEqual([gitGetRoot, gitGetRemotesConfig]);
  });

  it("recognizes a non-default remote prefix in branch name", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    gitRemote("add", "origin", "https://github.com/microsoft/lage.git");
    gitRemote("add", "myremote", "https://github.com/myuser/lage.git");
    gitObserver.mockClear();

    expect(resolveRemoteBranch({ branch: "myremote/feature", cwd })).toBe("myremote/feature");

    expect(getGitCalls()).toEqual([gitGetRemotesConfig]);
  });

  it("prepends default remote when slash-containing branch prefix is not a real remote", () => {
    cwd = setupFixture(undefined, { git: true });
    setupPackageJson(cwd);
    gitRemote("add", "origin", "https://github.com/microsoft/lage.git");
    gitObserver.mockClear();

    // "feature" is not a remote, so the whole string is treated as the branch name
    expect(resolveRemoteBranch({ branch: "feature/foo", cwd })).toBe("origin/feature/foo");

    expect(getGitCalls()).toEqual([gitGetRemotesConfig, gitGetRoot]);
  });

  it("queries remote for default branch when no branch is given", () => {
    cwd = setupFixture(undefined, { git: true });
    setupLocalRemote({ cwd, remoteName: "origin" });
    jest.clearAllMocks();

    expect(resolveRemoteBranch({ branch: undefined, cwd })).toBe("origin/main");

    expect(getGitCalls()).toEqual([gitGetRemotesConfig, gitGetOriginDefaultBranch]);
  });
});
