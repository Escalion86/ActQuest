/* eslint-disable no-console */
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

const DEFAULT_FROM_HOST = 'escalioncloud.ru'
const DEFAULT_TO_ORIGIN = 'https://cloud.escalion.ru'

const loadEnvFromFile = (filePath, override = false) => {
  if (!fs.existsSync(filePath)) return

  const fileContent = fs.readFileSync(filePath, 'utf8')
  fileContent.split(/\r?\n/g).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) return

    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key) return

    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (override || typeof process.env[key] === 'undefined') {
      process.env[key] = value
    }
  })
}

try {
  const envLocalPath = path.resolve(process.cwd(), '.env.local')
  const envPath = path.resolve(process.cwd(), '.env')
  const envFilePath = fs.existsSync(envLocalPath) ? envLocalPath : envPath

  try {
    const dotenv = require('dotenv')
    if (fs.existsSync(envFilePath)) {
      dotenv.config({ path: envFilePath, override: true })
    }
  } catch (_dotenvError) {
    loadEnvFromFile(envFilePath, true)
  }
} catch (_error) {
  // dotenv optional
}

const resolveEnvTemplates = () => {
  const templatePattern = /\$\{([A-Z0-9_]+)\}/gi

  Object.keys(process.env).forEach((envKey) => {
    const rawValue = process.env[envKey]
    if (typeof rawValue !== 'string' || !rawValue.includes('${')) return

    let resolved = rawValue
    let safety = 0
    while (resolved.includes('${') && safety < 10) {
      safety += 1
      resolved = resolved.replace(templatePattern, (_, key) => {
        const replacement = process.env[key]
        return typeof replacement === 'string' ? replacement : ''
      })
    }

    process.env[envKey] = resolved
  })
}

resolveEnvTemplates()

const DB_NAME_BY_LOCATION = {
  dev: process.env.MONGODB_DEV_DBNAME,
  krsk: process.env.MONGODB_KRSK_DBNAME,
  nrsk: process.env.MONGODB_NRSK_DBNAME,
  ekb: process.env.MONGODB_EKB_DBNAME,
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const npmConfig = process.env
  const envLimit = Number(npmConfig.npm_config_limit || '')
  const envApply = String(npmConfig.npm_config_apply || '').toLowerCase()
  const parsed = {
    apply:
      typeof npmConfig.npm_config_apply !== 'undefined' &&
      envApply !== 'false' &&
      envApply !== '0',
    scope: ['global', 'legacy', 'all'].includes(npmConfig.npm_config_scope)
      ? npmConfig.npm_config_scope
      : 'all',
    location: npmConfig.npm_config_location || null,
    collection: npmConfig.npm_config_collection || null,
    limit: Number.isFinite(envLimit) && envLimit > 0 ? envLimit : null,
    fromHost: npmConfig.npm_config_from_host || DEFAULT_FROM_HOST,
    toOrigin: (npmConfig.npm_config_to_origin || DEFAULT_TO_ORIGIN).replace(
      /\/+$/g,
      '',
    ),
  }

  args.forEach((arg) => {
    if (arg === '--apply') {
      parsed.apply = true
      return
    }

    if (arg.startsWith('--scope=')) {
      const value = arg.replace('--scope=', '').trim().toLowerCase()
      if (['global', 'legacy', 'all'].includes(value)) {
        parsed.scope = value
      }
      return
    }

    if (arg.startsWith('--location=')) {
      parsed.location = arg.replace('--location=', '').trim().toLowerCase()
      return
    }

    if (arg.startsWith('--collection=')) {
      parsed.collection = arg.replace('--collection=', '').trim()
      return
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.replace('--limit=', '').trim())
      if (Number.isFinite(value) && value > 0) {
        parsed.limit = value
      }
      return
    }

    if (arg.startsWith('--from-host=')) {
      const value = arg.replace('--from-host=', '').trim()
      if (value) parsed.fromHost = value
      return
    }

    if (arg.startsWith('--to-origin=')) {
      const value = arg.replace('--to-origin=', '').trim().replace(/\/+$/g, '')
      if (value) parsed.toOrigin = value
    }
  })

  return parsed
}

const buildTargets = ({ scope, location }) => {
  const targets = []

  if (scope === 'global' || scope === 'all') {
    if (process.env.MONGODB_GLOBAL_DBNAME) {
      targets.push({
        label: `global:${process.env.MONGODB_GLOBAL_DBNAME}`,
        dbName: process.env.MONGODB_GLOBAL_DBNAME,
      })
    } else {
      console.log('[global] Пропущено: MONGODB_GLOBAL_DBNAME не задан')
    }
  }

  if (scope === 'legacy' || scope === 'all') {
    const locations = location ? [location] : Object.keys(DB_NAME_BY_LOCATION)
    locations.forEach((loc) => {
      const dbName = DB_NAME_BY_LOCATION[loc]
      if (!dbName) {
        console.log(`[legacy:${loc}] Пропущено: DBNAME не задан`)
        return
      }
      targets.push({ label: `legacy:${loc}:${dbName}`, dbName })
    })
  }

  return targets
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const replaceWithCount = (value, searchValue, replacementValue) => {
  if (!value.includes(searchValue)) {
    return { value, count: 0 }
  }

  const parts = value.split(searchValue)
  return {
    value: parts.join(replacementValue),
    count: parts.length - 1,
  }
}

const normalizeUrlString = (value, { fromHost, toOrigin }) => {
  let nextValue = value
  let replacements = 0
  const toHost = toOrigin.replace(/^https?:\/\//i, '')

  ;[
    [`https://${fromHost}`, toOrigin],
    [`http://${fromHost}`, toOrigin],
    [`//${fromHost}`, `//${toHost}`],
  ].forEach(([searchValue, replacementValue]) => {
    const result = replaceWithCount(nextValue, searchValue, replacementValue)
    nextValue = result.value
    replacements += result.count
  })

  const bareHostPattern = new RegExp(
    `(^|[^A-Za-z0-9_.-])${escapeRegExp(fromHost)}`,
    'g',
  )
  nextValue = nextValue.replace(bareHostPattern, (match, prefix) => {
    replacements += 1
    return `${prefix}${toHost}`
  })

  return {
    value: nextValue,
    replacements,
    changed: nextValue !== value,
  }
}

const isPlainObject = (value) => {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const collectStringReplacements = ({
  value,
  pathParts = [],
  replacementsByPath,
  options,
}) => {
  if (typeof value === 'string') {
    const result = normalizeUrlString(value, options)
    if (result.changed && pathParts.length > 0) {
      replacementsByPath[pathParts.join('.')] = {
        value: result.value,
        replacements: result.replacements,
      }
    }
    return result.replacements
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (count, item, index) =>
        count +
        collectStringReplacements({
          value: item,
          pathParts: [...pathParts, String(index)],
          replacementsByPath,
          options,
        }),
      0,
    )
  }

  if (!isPlainObject(value)) {
    return 0
  }

  return Object.entries(value).reduce((count, [key, item]) => {
    if (key === '_id') return count
    if (key.includes('.') || key.startsWith('$')) return count
    return (
      count +
      collectStringReplacements({
        value: item,
        pathParts: [...pathParts, key],
        replacementsByPath,
        options,
      })
    )
  }, 0)
}

const buildSetUpdate = (doc, options) => {
  const replacementsByPath = {}
  const replacements = collectStringReplacements({
    value: doc,
    replacementsByPath,
    options,
  })

  const $set = Object.entries(replacementsByPath).reduce(
    (acc, [fieldPath, item]) => {
      acc[fieldPath] = item.value
      return acc
    },
    {},
  )

  return {
    replacements,
    changedPaths: Object.keys($set).length,
    update: Object.keys($set).length > 0 ? { $set } : null,
  }
}

const listCollections = async (connection, collectionName) => {
  if (collectionName) {
    return [collectionName]
  }

  const collections = await connection.db
    .listCollections({}, { nameOnly: true })
    .toArray()

  return collections
    .map((item) => item.name)
    .filter((name) => name && !name.startsWith('system.'))
    .sort()
}

const runCollection = async ({
  connection,
  collectionName,
  apply,
  limit,
  options,
}) => {
  const collection = connection.collection(collectionName)
  const cursor = collection.find({})

  if (limit) {
    cursor.limit(limit)
  }

  let scanned = 0
  let matched = 0
  let updated = 0
  let replacements = 0
  let changedPaths = 0
  const operations = []

  while (await cursor.hasNext()) {
    const doc = await cursor.next()
    scanned += 1

    const updateInfo = buildSetUpdate(doc, options)
    if (!updateInfo.update) {
      continue
    }

    matched += 1
    replacements += updateInfo.replacements
    changedPaths += updateInfo.changedPaths

    if (!apply) {
      continue
    }

    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: updateInfo.update,
      },
    })

    if (operations.length >= 500) {
      const result = await collection.bulkWrite(operations, { ordered: false })
      updated += Number(result.modifiedCount || 0)
      operations.length = 0
    }
  }

  if (apply && operations.length > 0) {
    const result = await collection.bulkWrite(operations, { ordered: false })
    updated += Number(result.modifiedCount || 0)
  }

  return {
    collectionName,
    scanned,
    matched,
    updated,
    replacements,
    changedPaths,
  }
}

const runForDb = async ({ target, args }) => {
  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, { dbName: target.dbName })
    .asPromise()

  try {
    const collectionNames = await listCollections(connection, args.collection)
    console.log(`[${target.label}] коллекций к проверке: ${collectionNames.length}`)

    const summaries = []
    for (const collectionName of collectionNames) {
      const summary = await runCollection({
        connection,
        collectionName,
        apply: args.apply,
        limit: args.limit,
        options: {
          fromHost: args.fromHost,
          toOrigin: args.toOrigin,
        },
      })

      summaries.push(summary)
      if (summary.matched > 0) {
        console.log(
          `[${target.label}] ${collectionName}: документов ${summary.matched}, путей ${summary.changedPaths}, замен ${summary.replacements}, обновлено ${summary.updated}`,
        )
      }
    }

    return summaries.reduce(
      (acc, summary) => {
        acc.scanned += summary.scanned
        acc.matched += summary.matched
        acc.updated += summary.updated
        acc.replacements += summary.replacements
        acc.changedPaths += summary.changedPaths
        return acc
      },
      {
        label: target.label,
        scanned: 0,
        matched: 0,
        updated: 0,
        replacements: 0,
        changedPaths: 0,
      },
    )
  } finally {
    await connection.close()
  }
}

const main = async () => {
  const args = parseArgs()

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI не задан')
  }

  const targets = buildTargets(args)
  if (targets.length === 0) {
    throw new Error('Нет баз данных для обработки')
  }

  console.log(`Режим: ${args.apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Scope: ${args.scope}${args.location ? ` (${args.location})` : ''}`)
  console.log(`Замена: ${args.fromHost} -> ${args.toOrigin}`)
  console.log(`Целевые БД: ${targets.length}`)
  if (args.collection) {
    console.log(`Коллекция: ${args.collection}`)
  }
  if (args.limit) {
    console.log(`Лимит на коллекцию: ${args.limit}`)
  }
  console.log('---')

  const summaries = []
  for (const target of targets) {
    summaries.push(await runForDb({ target, args }))
  }

  const totals = summaries.reduce(
    (acc, summary) => {
      acc.scanned += summary.scanned
      acc.matched += summary.matched
      acc.updated += summary.updated
      acc.replacements += summary.replacements
      acc.changedPaths += summary.changedPaths
      return acc
    },
    {
      scanned: 0,
      matched: 0,
      updated: 0,
      replacements: 0,
      changedPaths: 0,
    },
  )

  console.log('---')
  console.log('Итог:')
  console.log(`  проверено документов: ${totals.scanned}`)
  console.log(`  документов с заменами: ${totals.matched}`)
  console.log(`  измененных путей: ${totals.changedPaths}`)
  console.log(`  замен строк: ${totals.replacements}`)
  console.log(`  обновлено документов: ${totals.updated}`)

  if (!args.apply && totals.matched > 0) {
    console.log('Dry-run завершен. Для записи изменений запустите с --apply.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Ошибка миграции ссылок EscalionCloud')
    console.error(error)
    process.exit(1)
  })
