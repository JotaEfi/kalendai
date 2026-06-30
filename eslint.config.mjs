import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import securityPlugin from "eslint-plugin-security";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "frontend/dist/**",
      "backend/dist/**",
      "backend/src/tests/**",
      "backend/src/middlewares/__tests__/**",
      "backend/src/services/__tests__/**",
      "backend/src/lib/__tests__/**"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "security": securityPlugin
    },
    rules: {
      ...securityPlugin.configs.recommended.rules,
      "security/detect-object-injection": "warn",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
