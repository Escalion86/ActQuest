#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()

const requiredPaths = [
  'app/layout.js',
  'app/page.js',
  'app/not-found.js',
  'app/cabinet/page.js',
  'app/cabinet/games/page.js',
  'app/cabinet/games-upcoming/page.js',
  'app/cabinet/games-past/page.js',
  'app/cabinet/profile/page.js',
  'app/cabinet/teams/page.js',
  'app/cabinet/admin/page.js',
  'app/cabinet/admin/users/page.js',
  'app/cabinet/admin/teams/page.js',
  'app/cabinet/admin/reports/page.js',
  'app/cabinet/admin/transactions/page.js',
  'app/api/auth/[...nextauth]/route.js',
  'app/api/cabinet/games-list/route.js',
  'app/api/cabinet/teams/route.js',
  'app/api/cabinet/user-details/route.js',
  'app/api/public/site-access/route.js',
  'app/api/phone/verify/start/route.js',
  'app/api/[location]/games/[id]/route.js',
  'app/api/[location]/gamesteams/route.js',
]

const forbiddenPaths = [
  'app/api-pilot',
  'app/cabinet-app',
  'app/migration-check',
  'app/legacy-pilot',
  'pages/_app.js',
  'pages/_document.js',
  'pages/cabinet',
  'pages/api/cabinet',
]

function pathExists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath))
}

function readDirSafe(relativePath) {
  const absolute = path.join(projectRoot, relativePath)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, { withFileTypes: true })
}

function countFilesRecursively(relativePath, fileName) {
  const absolute = path.join(projectRoot, relativePath)
  if (!fs.existsSync(absolute)) return 0

  let count = 0
  const stack = [absolute]
  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && entry.name === fileName) {
        count += 1
      }
    }
  }
  return count
}

const errors = []

for (const routePath of requiredPaths) {
  if (!pathExists(routePath)) {
    errors.push(`Отсутствует обязательный маршрут/файл: ${routePath}`)
  }
}

for (const legacyPath of forbiddenPaths) {
  if (pathExists(legacyPath)) {
    errors.push(`Найден legacy/fallback путь, который должен быть удалён: ${legacyPath}`)
  }
}

const appPageCount = countFilesRecursively('app', 'page.js')
const apiRouteCount = countFilesRecursively('app/api', 'route.js')
if (appPageCount < 10) {
  errors.push(`Подозрительно мало app-страниц: найдено ${appPageCount} page.js`)
}
if (apiRouteCount < 20) {
  errors.push(`Подозрительно мало app-api обработчиков: найдено ${apiRouteCount} route.js`)
}

const appRootEntries = readDirSafe('app')
if (!appRootEntries.length) {
  errors.push('Папка app пуста или недоступна')
}

if (errors.length) {
  console.error('[smoke:app] FAIL')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log('[smoke:app] OK')
console.log(`- page.js файлов в app: ${appPageCount}`)
console.log(`- route.js файлов в app/api: ${apiRouteCount}`)
