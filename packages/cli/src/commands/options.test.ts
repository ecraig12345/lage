import { Command } from "commander";
import { options } from "./options.js";

describe("reporter option parsing", () => {
  function parseReporter(args: string[]) {
    return new Command()
      .exitOverride()
      .configureOutput({ writeErr: () => {} })
      .addOption(options.logger.reporter)
      .parse(["node", "test", ...args])
      .opts().reporter;
  }

  it("parses single reporter", () => {
    const result = parseReporter(["--reporter", "json"]);
    expect(result).toEqual(["json"]);
  });

  it("parses multiple reporters with comma", () => {
    const result = parseReporter(["--reporter", "json,azureDevops"]);
    expect(result).toEqual(["json", "azureDevops"]);
  });

  it("parses multiple reporters with repeated options", () => {
    const result = parseReporter(["--reporter", "json", "--reporter", "azureDevops"]);
    expect(result).toEqual(["json", "azureDevops"]);
  });

  it("parses reporter with wrong casing", () => {
    const result = parseReporter(["--reporter", "JSON,AzureDevOps"]);
    expect(result).toEqual(["json", "azureDevops"]);
  });

  it("errors on invalid single reporter", () => {
    expect(() => parseReporter(["--reporter", "nope"])).toThrowErrorMatchingInlineSnapshot(
      `"error: option '--reporter <reporter...>' argument 'nope' is invalid. Allowed values are: json, azureDevops, npmLog, verboseFileLog, vfl, adoLog, old"`
    );
  });

  it("errors on invalid multiple reporters with commas", () => {
    expect(() => parseReporter(["--reporter", "json,nope,azureDevops"])).toThrowErrorMatchingInlineSnapshot(
      `"error: option '--reporter <reporter...>' argument 'json,nope,azureDevops' is invalid. Allowed values are: json, azureDevops, npmLog, verboseFileLog, vfl, adoLog, old"`
    );
  });

  it("errors on invalid multiple reporters with repeated options", () => {
    expect(() => parseReporter(["--reporter", "json", "--reporter", "nope"])).toThrowErrorMatchingInlineSnapshot(
      `"error: option '--reporter <reporter...>' argument 'nope' is invalid. Allowed values are: json, azureDevops, npmLog, verboseFileLog, vfl, adoLog, old"`
    );
  });
});
