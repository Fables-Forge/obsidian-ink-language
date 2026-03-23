import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "main.js", "src/**/*.js"],
  },
  // obsidianmd rules for all TS files
  {
    files: ["src/**/*.ts"],
    plugins: { obsidianmd },
    rules: obsidianmd.configs.recommended,
  },
  // TypeScript-ESLint recommended + typed rules for source files only
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Test files: relax rules that conflict with Node.js test runner
  {
    files: ["src/**/*.test.ts"],
    rules: {
      // node:test and node:assert/strict are required by Node's built-in test runner.
      // These files are never bundled into the plugin — they run only in dev.
      "no-restricted-imports": "off",
      // test() / describe() from node:test intentionally return floating Promises.
      "@typescript-eslint/no-floating-promises": "off",
      // Test helpers sometimes need `any` for dynamic key lookups.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
