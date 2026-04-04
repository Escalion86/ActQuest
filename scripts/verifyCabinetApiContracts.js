#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()
const cabinetApiRoot = path.join(projectRoot, 'app', 'api', 'cabinet')

function walkRouteFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkRouteFiles(fullPath, result)
      continue
    }
    if (entry.isFile() && entry.name === 'route.js') {
      result.push(fullPath)
    }
  }
  return result
}

function fileRelative(absolutePath) {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, '/')
}

function hasJsonWithStatus(content) {
  return /NextResponse\.json\([\s\S]*?\{\s*status\s*:\s*\d{3}\s*\}[\s\S]*?\)/m.test(content)
}

function hasFailureWithoutError(content) {
  const failureBlocks = content.match(
    /NextResponse\.json\(\s*\{[\s\S]*?success\s*:\s*false[\s\S]*?\}\s*(,\s*\{[\s\S]*?\})?\s*\)/gm,
  )
  if (!failureBlocks) {
    return false
  }

  return failureBlocks.some((block) => !/error\s*:/.test(block))
}

function main() {
  if (!fs.existsSync(cabinetApiRoot)) {
    console.error('[verify:api-contracts] FAIL')
    console.error('- Не найдена папка app/api/cabinet')
    process.exit(1)
  }

  const routeFiles = walkRouteFiles(cabinetApiRoot)
  const errors = []

  for (const routeFile of routeFiles) {
    const content = fs.readFileSync(routeFile, 'utf8')
    const routeLabel = fileRelative(routeFile)

    if (!/success\s*:/.test(content)) {
      errors.push(`${routeLabel}: отсутствует поле success в ответах`)
    }

    if (/success\s*:\s*false/.test(content)) {
      if (!/status\s*:\s*\d{3}/.test(content)) {
        errors.push(`${routeLabel}: есть success:false без явного HTTP status`)
      }
      if (hasFailureWithoutError(content)) {
        errors.push(`${routeLabel}: найден success:false без поля error`)
      }
    }

    if (/NextResponse\.json\(/.test(content) && !hasJsonWithStatus(content)) {
      errors.push(`${routeLabel}: ответы NextResponse.json без явных status-кодов`)
    }

    if (/res\.status\(/.test(content) || /res\.json\(/.test(content)) {
      errors.push(`${routeLabel}: найден legacy-стиль res.status/res.json в app route`)
    }
  }

  if (errors.length) {
    console.error('[verify:api-contracts] FAIL')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log('[verify:api-contracts] OK')
  console.log(`- проверено cabinet route.js файлов: ${routeFiles.length}`)
}

main()
