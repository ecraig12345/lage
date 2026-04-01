import { formatHrtime } from "./formatDuration.js";
import { isTargetLogEntry, isTargetStatusData, isTargetStatusLogEntry } from "./isTargetLogEntry.js";
import { LogLevel } from "@lage-run/logger";
import { Writable } from "stream";
import fs from "fs";
import path from "path";
import { formatMemoryUsage, stripAnsi, statusIcons } from "./formatHelpers.js";
import type { TargetLogEntry, MaybeTargetLogEntry, TargetReporter } from "./types/TargetReporter.js";

interface VerboseFileLogReporterOptions {
  /** Log file path from CLI args */
  logFile?: string;
  /** Whether to capture and report main process memory usage on target completion */
  logMemory?: boolean;
  /** Stream for testing (used instead of `logFile`) */
  fileStream?: Writable;
}

/**
 * Writes log entries to a file. It includes all log entries except "silly" level.
 */
export class VerboseFileLogReporter implements TargetReporter {
  private fileStream: Writable;
  private logMemory: boolean;

  constructor(options: VerboseFileLogReporterOptions);
  /** @deprecated use object params version */
  constructor(logFile?: string, fileStream?: Writable, logMemory?: boolean);
  constructor(fileOrOptions?: string | VerboseFileLogReporterOptions, _fileStream?: Writable, _logMemory?: boolean) {
    const options: VerboseFileLogReporterOptions =
      typeof fileOrOptions === "string" ? { logFile: fileOrOptions, logMemory: _logMemory, fileStream: _fileStream } : fileOrOptions || {};
    const { logFile } = options;

    this.logMemory = options.logMemory ?? false;
    if (logFile) {
      // make the parent directory if it doesn't exist
      fs.mkdirSync(path.dirname(path.resolve(logFile)), { recursive: true });
    }

    // if logFile is falsy (not specified on cli args), this.fileStream just become a "nowhere" stream and this reporter effectively does nothing
    this.fileStream = options.fileStream ?? (logFile ? fs.createWriteStream(logFile) : new Writable({ write() {} }));
  }

  public cleanup(): void {
    this.fileStream.end();
  }

  public log(entry: MaybeTargetLogEntry): void {
    // if level is "silly", do not report the entry
    if (entry.level > LogLevel.verbose) {
      return;
    }

    const targetEntry = isTargetLogEntry(entry) ? entry : undefined;
    if (targetEntry) {
      // if "hidden", do not even attempt to record or report the entry
      if (!targetEntry.data.target.hidden) {
        // log normal target entries
        this.logTargetEntry(targetEntry);
      }
    } else if (entry.msg) {
      // log generic entries (not related to target)
      this.print(`${entry.msg}`);
    }
  }

  private printEntry(entry: TargetLogEntry, message: string): void {
    const { packageName, task, id } = entry.data.target;
    const packageAndTask = `${packageName ?? "<root>"} ${task}`.trim();

    const entryTargetId = id ? `[:${id}:]` : "";
    const icon = isTargetStatusLogEntry(entry) ? statusIcons[entry.data.status] : ":";

    this.print(`${entryTargetId} ${packageAndTask} ${icon} ${message}`.trim());
  }

  private print(message: string) {
    this.fileStream.write(message + "\n");
  }

  private logTargetEntry(entry: TargetLogEntry) {
    const data = entry.data!;

    if (isTargetStatusData(data)) {
      const { hash, duration, status, memoryUsage } = data;
      const mem = formatMemoryUsage(memoryUsage, this.logMemory);

      switch (status) {
        case "running":
          return this.printEntry(entry, `start`);

        case "success":
          return this.printEntry(entry, `done - ${formatHrtime(duration!)}${mem}`);

        case "failed":
          return this.printEntry(entry, `fail${mem}`);

        case "skipped":
          return this.printEntry(entry, `skip - ${hash}${mem}`);

        case "aborted":
          return this.printEntry(entry, `aborted`);

        case "queued":
          return this.printEntry(entry, `queued`);

        case "pending":
          return this.printEntry(entry, `pending`);

        default:
          throw new Error(`Internal error: unhandled target status "${status}"`);
      }
    }

    return this.printEntry(entry, stripAnsi(entry.msg));
  }

  public summarize(): void {
    // No summary needed for VerboseFileLogReporter
  }
}
