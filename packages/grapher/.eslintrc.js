// @ts-check
/** @type {import('eslint').Linter.Config} */
const config = {
  // This intentionally does NOT have "root" or "extends" because it breaks eslint in the editor
  // (the lint worker will set those when it runs)
  rules: {
    // Irrelevant for this package since it's general purpose
    "no-console": "off",
  },
};

module.exports = config;
