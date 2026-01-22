// Created with:
//   docusaurus swizzle @docusaurus/theme-classic MDXComponents/Pre --typescript --eject
// and modified per https://lachieh.github.io/docusaurus-with-shiki-rehype/docs/intro/

import React, { type ReactNode } from "react";
import type { Props } from "@theme/MDXComponents/Pre";

export default function MDXPre(props: Props): ReactNode | undefined {
  return <pre {...props} />;
}
