import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const rootLayoutPath = path.join(process.cwd(), 'app', 'layout.js')
const rootLayoutSource = fs.readFileSync(rootLayoutPath, 'utf8')

test('root layout does not include a theme bootstrap script', () => {
  assert.equal(
    rootLayoutSource.includes('id="theme-bootstrap"'),
    false,
    'Expected RootLayout not to include the theme bootstrap script',
  )
  assert.equal(
    rootLayoutSource.includes("import Script from 'next/script'"),
    false,
    'Expected RootLayout not to import next/script for theme bootstrap',
  )
})
