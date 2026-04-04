#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()

const checkedRoutes = [
  'app/api/[location]/games/start/[id]/route.js',
  'app/api/[location]/games/stop/[id]/route.js',
  'app/api/[location]/gamesteams/process/[id]/route.js',
]

const errors = []

for (const routePath of checkedRoutes) {
  const absolutePath = path.join(projectRoot, routePath)
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Не найден маршрут: ${routePath}`)
    continue
  }

  const content = fs.readFileSync(absolutePath, 'utf8')

  if (/success\s*:\s*false/.test(content) && !/error\s*:/.test(content)) {
    errors.push(`${routePath}: найден success:false без error`)
  }

  if (/return\s*\{\s*\}/.test(content)) {
    errors.push(`${routePath}: найден return {} вместо HTTP-ответа`)
  }
}

if (errors.length) {
  console.error('[verify:location-api-contracts] FAIL')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('[verify:location-api-contracts] OK')
console.log(`- проверено маршрутов: ${checkedRoutes.length}`)
