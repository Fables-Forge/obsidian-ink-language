import obsidian from "eslint-plugin-obsidianmd";

export default [
  ...obsidian.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    settings: {
      obsidianPluginId: "ink-language",
      obsidianPluginName: "Ink Language",
    },
  },
];
