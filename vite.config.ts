import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), tailwindcss()],
  // App-i ngarkohet nga skedarët e APK-së, jo nga rrjeti; React, Supabase dhe Dexie bashkë
  // kalojnë 500 kB pa qenë problem shpejtësie. Ekranet ngarkohen kur hapen (router.tsx, V2-E1-16a),
  // ndaj asnjë pjesë nuk i afrohet kufirit; ai mbetet si roje për rritje të papritura.
  build: { chunkSizeWarningLimit: 800 },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    globals: true,
    // Worktree-t e nënagjentëve (.claude/worktrees) janë kopje të repo-s me provat e veta.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Nën ngarkesë (disa `npm test` njëherësh, `--maxWorkers` sa bërthamat) një provë ekrani me
    // seancë të plotë zgjat deri në 20 herë: seanca me drop set, 3,5 s vetëm, arriti 70 s me pesë
    // procese provash në dy bërthama. 5 s e parazgjedhjes nuk mjaftonin; kufiri vlen vetëm kur diçka
    // ngec. Pritjet e Testing Library: src/test/setup.ts.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
})
