// Created with:
//   docusaurus swizzle @docusaurus/theme-classic MDXComponents/Code --typescript --eject
// and modified per https://lachieh.github.io/docusaurus-with-shiki-rehype/docs/intro/
import type { ComponentProps, ReactNode } from "react";
import React from "react";
// Completely switching out the CodeBlock loses the copy button
// import CodeBlock from "@theme/CodeBlock";
import CodeInline from "@theme/CodeInline";
import type { Props } from "@theme/MDXComponents/Code";

function shouldBeInline(props: Props) {
  return (
    // empty code blocks have no props.children,
    // see https://github.com/facebook/docusaurus/pull/9704
    typeof props.children !== "undefined" &&
    React.Children.toArray(props.children).every(
      (el) => typeof el === "string" && !el.includes("\n")
    )
  );
}

function BasicCodeBlock(props: ComponentProps<"code">): JSX.Element {
  return <code {...props} />;
}

export default function MDXCode(props: Props): ReactNode {
  return shouldBeInline(props) ? (
    <CodeInline {...props} />
  ) : (
    <BasicCodeBlock {...props} />
  );
  // return shouldBeInline(props) ? (
  //   <CodeInline {...props} />
  // ) : props.className?.includes("shiki") ? (
  //   <BasicCodeBlock {...props} />
  // ) : (
  //   <CodeBlock {...(props as ComponentProps<typeof CodeBlock>)} />
  // );
}
