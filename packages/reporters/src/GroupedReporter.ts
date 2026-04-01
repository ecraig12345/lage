import { formatHrtime } from "./formatDuration.js";
import { isTargetLogEntry, isTargetStatusLogEntry } from "./isTargetLogEntry.js";
import { LogLevel } from "@lage-run/logger";
import chalk from "chalk";
import type { LogEntry } from "@lage-run/logger";
import type { SchedulerRunSummary, TargetRun } from "@lage-run/scheduler-types";
import type { TargetStatusData } from "./types/TargetLogData.js";
import type { Writable } from "stream";
import { slowestTargetRuns } from "./slowestTargetRuns.js";
import { formatMemoryUsage, statusIcons } from "./formatHelpers.js";
import { statusColorFn } from "./LogReporter.js";
import type { MaybeTargetLogEntry, TargetLogEntry, TargetReporter } from "./types/TargetReporter.js";
import { isCompletionStatus, isNonFailureCompletionStatus } from "./isCompletionStatus.js";

const logLevelLabel = {
  [LogLevel.info]: "INFO",
  [LogLevel.warn]: "WARN",
  [LogLevel.error]: "ERR!",
  [LogLevel.silly]: "SILLY",
  [LogLevel.verbose]: "VERB",
};

export interface GroupedReporterOptions {
  /** Only report logs with this level or numerically lower/logically higher (default info) */
  logLevel?: LogLevel;

  /** Whether to group log entries by target */
  grouped?: boolean;

  /** Whether to capture and report main process memory usage on target completion */
  logMemory?: boolean;

  /** stream for testing (defaults to stdout) */
  logStream?: Writable;

  colors?: { [k in LogLevel | "task" | "pkg" | "ok" | "error" | "warn"]: chalk.Chalk };
}

/**
 * Abstract reporter which optionally groups log entries by target.
 * If grouping is enabled, it only flushes a target's log entries when it completes.
 */
export abstract class GroupedReporter implements TargetReporter {
  protected logStream: Writable;
  /** Mapping from targetId to log entries, regardless of level (the logs will be cleared for non-failed completed targets) */
  protected logEntries = new Map<string, TargetLogEntry[]>();
  protected readonly colors: NonNullable<GroupedReporterOptions["colors"]>;

  constructor(protected options: GroupedReporterOptions) {
    options.logLevel ??= LogLevel.info;
    this.logStream = options.logStream || process.stdout;
    this.colors = options.colors || {
      [LogLevel.info]: chalk.white,
      [LogLevel.verbose]: chalk.gray,
      [LogLevel.warn]: chalk.white,
      [LogLevel.error]: chalk.white,
      [LogLevel.silly]: chalk.green,
      task: chalk.cyan,
      pkg: chalk.magenta,
      ok: chalk.green,
      error: chalk.red,
      warn: chalk.yellow,
    };
  }

  public log(entry: MaybeTargetLogEntry): void {
    if (isTargetLogEntry(entry)) {
      if (entry.data.target.hidden) return;
    } else {
      // log generic entries (not related to target)
      if (this.shouldLog(entry) && entry.msg) {
        this.printMessage(entry.level, "", entry.msg);
      }
      return;
    }

    // save the logs for errors (regardless of level)
    const targetId = entry.data.target.id;
    if (!this.logEntries.has(targetId)) {
      this.logEntries.set(targetId, []);
    }
    this.logEntries.get(targetId)!.push(entry);

    const statusLogEntry = isTargetStatusLogEntry(entry) ? entry : undefined;
    const status = statusLogEntry ? statusLogEntry.data.status : undefined;
    const isNonFailedCompletion = status && isNonFailureCompletionStatus(status);

    // log the entry
    if (this.shouldLog(entry)) {
      if (this.options.grouped) {
        // For groups, we don't log anything until completion
        if (statusLogEntry && status && isCompletionStatus(status)) {
          this.logTargetGroupCompleted(statusLogEntry);
        }
      } else {
        this.logTargetEntry(entry);
      }
    }

    // If it's a status message for non-failure completion, delete the target's entries to free memory
    if (isNonFailedCompletion) {
      this.logEntries.delete(targetId);
    }
  }

  /**
   * Whether the entry should be logged based solely on its level compared to the reporter's `logLevel`
   * (does not consider `entry.target.hidden` or message presence)
   */
  protected shouldLog(entry: MaybeTargetLogEntry): boolean {
    return this.options.logLevel! >= entry.level;
  }

  /** Write a message to `this.logStream` with level, prefix, and color formatting */
  protected printTargetEntry(entry: TargetLogEntry, message: string): void {
    const { target } = entry.data;
    const { packageName, task } = target;
    // TODO TODO TODO
    // const prefix = this.options.grouped ? "" : this.getTaskLogPrefix(packageName, task);
    this.printMessage(entry.level, this.getTaskLogPrefix(packageName, task), this.colors[entry.level](message));
  }

  /** Write a message to `this.logStream` with level and prefix */
  protected printMessage(level: LogLevel, prefix: string, message: string): void {
    this.logStream.write(`${logLevelLabel[level]}: ${prefix} ${message}\n`);
  }

  private getTaskLogPrefix(pkg: string | undefined, task: string): string {
    return `${this.colors.pkg(pkg ?? "<root>")} ${this.colors.task(task)}`;
  }

  /** Print the entry for a target */
  protected logTargetEntry(entry: TargetLogEntry): void {
    const colors = this.colors;

    if (!isTargetStatusLogEntry(entry)) {
      this.printTargetEntry(entry, "|  " + entry.msg);
      return;
    }

    const { hash, duration, status, memoryUsage } = entry.data;
    const mem = formatMemoryUsage(memoryUsage, this.options.logMemory);
    const icon = statusIcons[status];
    // TODO
    // const pkgTask = this.options.grouped ? this.getTaskLogPrefix(packageName, task) : "";

    switch (status) {
      case "running":
        return this.printTargetEntry(entry, `${colors.ok(icon)} start`);
      // return this.printTargetEntry(entry, `${colors.ok(icon)} start ${pkgTask}`);

      case "success":
        return this.printTargetEntry(entry, `${colors.ok(icon)} done - ${formatHrtime(duration!)}${mem}`);
      // return this.printTargetEntry(entry, `${colors.ok(icon)} done ${pkgTask} - ${formatHrtime(duration!)}`);

      case "failed":
        return this.printTargetEntry(entry, `${colors.error(icon)} fail${mem}`);
      // return this.printTargetEntry(entry, `${colors.error(icon)} fail ${pkgTask}`);

      case "skipped":
        return this.printTargetEntry(entry, `${colors.ok(icon)} skip - ${hash!}${mem}`);
      // return this.printTargetEntry(entry, `${colors.ok(icon)} skip ${pkgTask} - ${hash!}`);

      case "aborted":
        return this.printTargetEntry(entry, `${colors.warn(icon)} aborted`);
      // return this.printTargetEntry(entry, `${colors.warn(icon)} aborted ${pkgTask}`);

      case "queued":
        return this.printTargetEntry(entry, `${colors.warn(icon)} queued`);
      // return this.printTargetEntry(entry, `${colors.warn(icon)} queued ${pkgTask}`);

      case "pending":
        return;

      default:
        throw new Error(`Internal error: unhandled target status "${status}"`);
    }
  }

  protected logTargetGroupCompleted(entry: Required<LogEntry<TargetStatusData>>): void {
    const { status, duration, target } = entry.data;
    const { id } = target;

    this.logStream.write(this.formatGroupStart(target.packageName ?? "<root>", target.task, status, duration));

    const entries = this.logEntries.get(id) || [];
    for (const targetEntry of entries) {
      // historically, AdoReporter and GithubActionsReporter only logged group entries satisfying logLevel
      if (this.shouldLog(targetEntry)) {
        this.logTargetEntry(targetEntry);
      }
    }

    this.logStream.write(this.formatGroupEnd());
  }

  public summarize(schedulerRunSummary: SchedulerRunSummary): void {
    const { targetRuns, targetRunByStatus } = schedulerRunSummary;
    const { failed, aborted, skipped, success, pending } = targetRunByStatus;

    this.writeSummaryHeader();

    if (targetRuns.size > 0) {
      const slowestTargets = slowestTargetRuns([...targetRuns.values()]);

      for (const wrappedTarget of slowestTargets) {
        const { target, status, duration } = wrappedTarget;
        const colorFn = statusColorFn[status] ?? chalk.white;

        this.printMessage(
          LogLevel.info,
          this.getTaskLogPrefix(target.packageName || "[GLOBAL]", target.task),
          colorFn(`${status}${duration ? `, took ${formatHrtime(duration)}` : ""}`)
        );
      }

      this.logStream.write(
        `[Tasks Count] success: ${success.length}, skipped: ${skipped.length}, pending: ${pending.length}, aborted: ${aborted.length}\n`
      );
    } else {
      this.logStream.write("Nothing has been run.\n");
    }

    this.writeSummaryFooter();

    if (failed.length > 0) {
      this.writeFailures(failed, targetRuns);
    }

    this.printMessage(LogLevel.info, "", `Took a total of ${formatHrtime(schedulerRunSummary.duration)} to complete`);
  }

  /** Returns the opening line for a grouped target log block, including trailing newline. */
  protected abstract formatGroupStart(packageName: string, task: string, status: string, duration?: [number, number]): string;

  /** Returns the closing line for a grouped target log block, including trailing newline. */
  protected abstract formatGroupEnd(): string;

  /** Writes the summary section header. */
  protected abstract writeSummaryHeader(): void;

  /** Writes anything needed after the summary target list (e.g. closing a group). */
  protected abstract writeSummaryFooter(): void;

  /** Writes per-CI-system error annotations for all failed targets. */
  protected abstract writeFailures(failed: string[], targetRuns: Map<string, TargetRun<unknown>>): void;
}
