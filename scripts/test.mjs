import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const tests = readdirSync(new URL('../tests/', import.meta.url)).filter(name => name.endsWith('.test.ts')).sort()
if (!tests.length) throw new Error('No se encontraron pruebas')
for (const test of tests) {
  const result = spawnSync(process.execPath, [`tests/${test}`], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
