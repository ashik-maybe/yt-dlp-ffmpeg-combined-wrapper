import { readFileSync } from 'node:fs'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

const required = [
  'Install',
  'Quick start',
  'How it works',
  'Keys',
  'Flags',
  'Safety',
  'Limits',
  'Development',
  'docs/PLAN-SCHEMA.md',
  '--run',
  '--yes',
  '--force',
  '--unsafe',
  'bun run ci',
  'bun run tui:test',
  'bash scripts/package-tui.sh',
]

const missing = required.filter((value) => !readme.includes(value))

console.log(
  `readme-check: ${required.length} required, ${required.length - missing.length} found, ${missing.length} missing`,
)

if (missing.length > 0) {
  for (const value of missing) console.error(`  FAIL missing: ${value}`)
  process.exit(1)
}

console.log('readme-check: PASS')
