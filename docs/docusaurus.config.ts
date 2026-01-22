import type { Options as ClientRedirectsOptions } from "@docusaurus/plugin-client-redirects";
import type {
  Options as ClassicPresetOptions,
  ThemeConfig as ClassicThemeConfig,
} from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
// import { themes as prismThemes } from "prism-react-renderer";
import tailwindcss from "@tailwindcss/postcss";
import path from "path";

import rehypeShiki, { type RehypeShikiOptions } from "@shikijs/rehype";
import { transformerTwoslash } from "@shikijs/twoslash";
// import twoslash, {
//   type Options as ShikiTwoslashOptions,
// } from "remark-shiki-twoslash";

/*
"<div class=\"shiki-twoslash-fragment\"><pre class=\"shiki light-plus\" style=\"background-color: #FFFFFF; color: #000000\">
<div class='code-container'>
<code><div class='line'><span style=\"color: undefined\">code</span></div></code></div></pre>\n<pre class=\"shiki nord\" style=\"background-color: #2e3440ff; color: #d8dee9ff\"><div class='code-container'><code><div class='line'><span style=\"color: undefined\">code</span></div></code></div></pre></div>"
*/

const config: Config = {
  title: "Lage",
  tagline: "A Beautiful JS Monorepo Task Runner",
  url: process.env.DEPLOY_URL || "https://microsoft.github.io",
  baseUrl: "/lage/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "throw",
  // no longer exists
  // favicon: "/img/lage-logo.svg",
  organizationName: "microsoft",
  projectName: "lage",

  markdown: {
    mermaid: true,
  },

  themes: ["@docusaurus/theme-mermaid"],

  presets: [
    [
      "classic",
      {
        docs: {
          editUrl: "https://github.com/microsoft/lage/edit/master/docs",
          rehypePlugins: [
            [
              rehypeShiki,
              {
                // or `theme` for a single theme
                themes: {
                  light: "light-plus",
                  dark: "nord",
                },
                transformers: [
                  transformerTwoslash({
                    langs: ["ts", "js", "md"],
                    rendererRich: {},
                  }),
                ],
              } satisfies RehypeShikiOptions,
            ],
          ],
          // beforeDefaultRemarkPlugins: [
          //   [
          //     twoslash,
          //     {
          //       themes: ["light-plus", "nord"],
          //     } satisfies ShikiTwoslashOptions,
          //   ],
          // ],
        },
        theme: {
          customCss: [path.join(__dirname, "src/css/custom.css")],
        },
      } satisfies ClassicPresetOptions,
    ],
    // [
    //   "docusaurus-preset-shiki-twoslash",
    //   path.join(__dirname, "src/docusaurus-preset-shiki-twoslash/index.js"),
    //   {
    //     themes: ["light-plus", "nord"],
    //   } satisfies ShikiTwoslashOptions,
    // ],
  ],

  themeConfig: {
    navbar: {
      logo: {
        alt: "Lage Logo",
        src: "img/lage.png",
      },
      items: [
        {
          type: "doc",
          docId: "introduction",
          position: "left",
          label: "Guide",
        },
        {
          href: "https://github.com/microsoft/lage",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    colorMode: {
      respectPrefersColorScheme: true,
    },
    // prism: {
    //   theme: {
    //     ...prismThemes.vsLight,
    //     plain: {
    //       color: prismThemes.vsLight.plain.color,
    //       backgroundColor: prismThemes.oneLight.plain.backgroundColor,
    //     },
    //   },
    //   darkTheme: prismThemes.vsDark,
    // },
  } satisfies ClassicThemeConfig,

  plugins: [
    "@cmfcmf/docusaurus-search-local",
    [
      "@docusaurus/plugin-client-redirects",
      {
        createRedirects: (path) => {
          // Redirects for old URLs (don't need to bother with casing changes)
          if (path.startsWith("/docs/guides/")) {
            return path.replace("/docs/guides/", "/docs/tutorial/");
          }
          if (path === "/docs/quick-start") {
            return "/docs/Quick Start";
          }
        },
      } satisfies ClientRedirectsOptions,
    ],
    () => ({
      name: "docusaurus-tailwindcss",
      configurePostCss(postcssOptions) {
        postcssOptions.plugins.push(tailwindcss);
        return postcssOptions;
      },
    }),
  ],
};

export default config;
