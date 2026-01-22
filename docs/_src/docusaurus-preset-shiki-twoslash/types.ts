import type { DocusaurusContext, Preset } from "@docusaurus/types";
import type { Options as ShikiTwoslashOptions } from "remark-shiki-twoslash";

/**
 * @param {import("@docusaurus/types").DocusaurusContext} context
 * @param {import("remark-shiki-twoslash").Settings} pluginOptions
 * @returns {import("@docusaurus/types").Preset}
 */
declare function preset(
  context: import("@docusaurus/types").DocusaurusContext,
  pluginOptions: any
): import("@docusaurus/types").Preset;
