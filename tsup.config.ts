import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [`app/main.ts`, `app/register-commands.ts`],
    target: `node19`,
    splitting: false,
    sourcemap: true,
    clean: true,
});