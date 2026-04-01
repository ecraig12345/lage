import { formatHrtime, hrtimeDiff } from "./formatDuration.js";
import { LogLevel, type LogEntry } from "@lage-run/logger";
import chalk from "chalk";
import type { Chalk } from "chalk";
import type { SchedulerRunSummary, TargetRun, TargetStatus } from "@lage-run/scheduler-types";
import type { TargetStatusData } from "./types/TargetLogData.js";
import crypto from "crypto";
import { fancyGradient, formatBytes, hrLine } from "./formatHelpers.js";
import { slowestTargetRuns } from "./slowestTargetRuns.js";
import { GroupedReporter, type GroupedReporterOptions } from "./GroupedReporter.js";

/** Color scheme from lage v1's reporter and others derived from it */
export const colors = {
  [LogLevel.info]: chalk.white,
  [LogLevel.verbose]: chalk.gray,
  [LogLevel.warn]: chalk.white,
  [LogLevel.error]: chalk.hex("#FF1010"),
  [LogLevel.silly]: chalk.green,
  task: chalk.hex("#00DDDD"),
  pkg: chalk.hex("#FFD66B"),
  ok: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
};

/** Status color scheme from lage v1's reporter and others derived from it */
export const statusColorFn: Record<TargetStatus, Chalk> = {
  success: chalk.greenBright,
  failed: chalk.redBright,
  skipped: chalk.gray,
  running: chalk.yellow,
  pending: chalk.gray,
  aborted: chalk.red,
  queued: chalk.magenta,
};

// Monokai color scheme
const pkgColors: Chalk[] = [
  chalk.hex("#e5b567"),
  chalk.hex("#b4d273"),
  chalk.hex("#e87d3e"),
  chalk.hex("#9e86c8"),
  chalk.hex("#b05279"),
  chalk.hex("#6c99bb"),
];

function hashStringToNumber(str: string): number {
  const hash = crypto.createHash("md5");
  hash.update(str);
  const hex = hash.digest("hex").substring(0, 6);
  return parseInt(hex, 16);
}

const pkgNameToIndexInPkgColorArray = new Map<string, number>();

/** Get the color for a package name per lage v1 package color logic */
function getColorForPkg(pkg: string): Chalk {
  if (!pkgNameToIndexInPkgColorArray.has(pkg)) {
    const index = hashStringToNumber(pkg) % pkgColors.length;
    pkgNameToIndexInPkgColorArray.set(pkg, index);
  }

  return pkgColors[pkgNameToIndexInPkgColorArray.get(pkg)!];
}

function getTaskLogPrefix(pkg: string, task: string) {
  const pkgColor = getColorForPkg(pkg);
  return `${pkgColor(pkg)} ${colors.task(task)}`;
}

/**
 * Lage v1 reporter that logs tasks without progress spinners.
 * It can either log entries immediately, or grouped when a target completes.
 */
export class LogReporter extends GroupedReporter {
  constructor(options: Omit<GroupedReporterOptions, "colors">) {
    super({ ...options, colors });
  }

  private print(message: string) {
    this.logStream.write(message + "\n");
  }

  protected override logTargetGroupCompleted(entry: Required<LogEntry<TargetStatusData>>): void {
    const { id } = entry.data.target;

    const entries = this.logEntries.get(id)!;

    for (const targetEntry of entries) {
      this.logTargetEntry(targetEntry);
    }

    if (entries.length > 2) {
      this.print(hrLine);
    }
  }

  protected override formatGroupStart(): string {
    throw new Error("not implemented due to logTargetGroupCompleted override");
  }
  protected override formatGroupEnd(): string {
    throw new Error("not implemented due to logTargetGroupCompleted override");
  }

  public override summarize(schedulerRunSummary: SchedulerRunSummary): void {
    const { targetRuns, targetRunByStatus } = schedulerRunSummary;
    const { failed, aborted, skipped, success, pending } = targetRunByStatus;

    this.writeSummaryHeader();

    if (targetRuns.size > 0) {
      const slowestTargets = slowestTargetRuns([...targetRuns.values()]);

      for (const wrappedTarget of slowestTargets) {
        const { target, status, duration } = wrappedTarget;
        const colorFn = statusColorFn[status] ?? chalk.white;
        const queueDuration = hrtimeDiff(wrappedTarget.queueTime, wrappedTarget.startTime);

        this.print(
          `${getTaskLogPrefix(target.packageName || "<root>", target.task)} ${colorFn(
            `${status === "running" ? "running - incomplete" : status}${
              duration ? `, took ${formatHrtime(duration)}, queued for ${formatHrtime(queueDuration)}` : ""
            }`
          )}`
        );
      }

      this.print(
        `success: ${success.length}, skipped: ${skipped.length}, pending: ${pending.length}, aborted: ${aborted.length}, failed: ${failed.length}`
      );

      this.print(
        `worker restarts: ${schedulerRunSummary.workerRestarts}, max worker memory usage: ${formatBytes(
          schedulerRunSummary.maxWorkerMemoryUsage
        )}`
      );
    } else {
      this.print("Nothing has been run.");
    }

    this.writeSummaryFooter();

    const allCacheHits = [...targetRuns.values()].filter((run) => !run.target.hidden).length === skipped.length;
    const allCacheHitText = allCacheHits ? fancyGradient(`All targets skipped!`) : "";

    this.print(`Took a total of ${formatHrtime(schedulerRunSummary.duration)} to complete. ${allCacheHitText}`);
  }

  protected override writeSummaryHeader(): void {
    this.print(chalk.cyanBright(`\nSummary`));
    this.print(hrLine);
  }

  protected override writeFailures(failed: string[], targetRuns: Map<string, TargetRun<unknown>>): void {
    for (const targetId of failed) {
      const target = targetRuns.get(targetId)?.target;

      if (target) {
        const { packageName, task } = target;
        const failureLogs = this.logEntries.get(targetId);

        this.print(`[${colors.pkg(packageName ?? "<root>")} ${colors.task(task)}] ${colors[LogLevel.error]("ERROR DETECTED")}`);

        if (failureLogs) {
          for (const entry of failureLogs) {
            // Log each entry separately to prevent truncation
            this.print(entry.msg);
          }
        }

        this.print(hrLine);
      }
    }
  }

  protected override writeSummaryFooter(): void {
    this.print(hrLine);
  }

  public resetLogEntries(): void {
    this.logEntries.clear();
  }
}
