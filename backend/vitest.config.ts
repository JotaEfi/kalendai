import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Ambiente Node puro (sem DOM)
    environment: 'node',
    // Glob de arquivos de teste
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    // Exclui o build compilado
    exclude: ['dist/**', 'node_modules/**'],
    // Suporte a TypeScript via esbuild interno do Vitest
    // (sem necessidade de configuração extra para ESM)
    globals: true,
    // Relatório visual
    reporter: ['verbose'],
    // Cobertura
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/timeUtils.ts', 'src/services/kanbanService.ts'],
      exclude: ['src/**/__tests__/**', 'dist/**']
    }
  }
});
