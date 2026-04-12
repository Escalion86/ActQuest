/* eslint-disable no-console */
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

const applyEnvLines = (fileContent) => {
  String(fileContent || '')
    .split(/\r?\n/g)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return
      }

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) {
        return
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      if (!key) {
        return
      }

      let value = trimmed.slice(separatorIndex + 1).trim()
      if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
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
    if (fs.existsSync(envFilePath)) {
      const raw = fs.readFileSync(envFilePath, 'utf8')
      applyEnvLines(raw)
    }
  }
} catch (_error) {
  // dotenv optional
}

const LEGACY_DB_NAME_BY_LOCATION = {
  dev: process.env.MONGODB_DEV_DBNAME,
  krsk: process.env.MONGODB_KRSK_DBNAME,
  nrsk: process.env.MONGODB_NRSK_DBNAME,
  ekb: process.env.MONGODB_EKB_DBNAME,
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const result = {
    apply: false,
    scope: 'global', // global | legacy | all
    location: null,
  }

  args.forEach((arg) => {
    if (arg === '--apply') {
      result.apply = true
      return
    }

    if (arg.startsWith('--scope=')) {
      const value = arg.replace('--scope=', '').trim().toLowerCase()
      if (value === 'global' || value === 'legacy' || value === 'all') {
        result.scope = value
      }
      return
    }

    if (arg.startsWith('--location=')) {
      result.location = arg.replace('--location=', '').trim().toLowerCase()
    }
  })

  return result
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
    const locations = location ? [location] : Object.keys(LEGACY_DB_NAME_BY_LOCATION)
    locations.forEach((loc) => {
      const dbName = LEGACY_DB_NAME_BY_LOCATION[loc]
      if (!dbName) {
        console.log(`[legacy:${loc}] Пропущено: DBNAME не задан`)
        return
      }
      targets.push({ label: `legacy:${loc}:${dbName}`, dbName })
    })
  }

  return targets
}

const countSnapshotCaptainMembers = async (gamesCollection) => {
  const result = await gamesCollection
    .aggregate([
      { $match: { 'result.teamsUsers.role': 'capitan' } },
      { $unwind: '$result.teamsUsers' },
      { $match: { 'result.teamsUsers.role': 'capitan' } },
      { $count: 'count' },
    ])
    .toArray()

  return Number(result?.[0]?.count || 0)
}

const runForDb = async ({ label, dbName, apply }) => {
  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, { dbName })
    .asPromise()

  try {
    const teamsUsersCollection = connection.collection('teamsusers')
    const gamesCollection = connection.collection('games')

    const teamsUsersCaptainCountBefore = await teamsUsersCollection.countDocuments({
      role: 'capitan',
    })
    const gamesWithSnapshotCaptainBefore = await gamesCollection.countDocuments({
      'result.teamsUsers.role': 'capitan',
    })
    const snapshotCaptainMembersBefore =
      await countSnapshotCaptainMembers(gamesCollection)

    if (!apply) {
      console.log(`[${label}] dry-run`)
      console.log(`  teamsusers.role='capitan': ${teamsUsersCaptainCountBefore}`)
      console.log(
        `  games с result.teamsUsers.role='capitan': ${gamesWithSnapshotCaptainBefore}`,
      )
      console.log(
        `  result.teamsUsers элементов role='capitan': ${snapshotCaptainMembersBefore}`,
      )
      return {
        label,
        apply,
        teamsUsersUpdated: 0,
        gamesUpdated: 0,
        teamsUsersCaptainCountBefore,
        teamsUsersCaptainCountAfter: teamsUsersCaptainCountBefore,
        gamesWithSnapshotCaptainBefore,
        gamesWithSnapshotCaptainAfter: gamesWithSnapshotCaptainBefore,
        snapshotCaptainMembersBefore,
        snapshotCaptainMembersAfter: snapshotCaptainMembersBefore,
      }
    }

    const teamsUsersUpdateResult = await teamsUsersCollection.updateMany(
      { role: 'capitan' },
      { $set: { role: 'captain' } },
    )

    const gamesUpdateResult = await gamesCollection.updateMany(
      { 'result.teamsUsers.role': 'capitan' },
      { $set: { 'result.teamsUsers.$[member].role': 'captain' } },
      { arrayFilters: [{ 'member.role': 'capitan' }] },
    )

    const teamsUsersCaptainCountAfter = await teamsUsersCollection.countDocuments({
      role: 'capitan',
    })
    const gamesWithSnapshotCaptainAfter = await gamesCollection.countDocuments({
      'result.teamsUsers.role': 'capitan',
    })
    const snapshotCaptainMembersAfter =
      await countSnapshotCaptainMembers(gamesCollection)

    console.log(`[${label}] apply`)
    console.log(
      `  teamsusers обновлено: ${Number(teamsUsersUpdateResult.modifiedCount || 0)}`,
    )
    console.log(
      `  games (snapshot) обновлено: ${Number(gamesUpdateResult.modifiedCount || 0)}`,
    )
    console.log(
      `  остаток teamsusers.role='capitan': ${teamsUsersCaptainCountAfter}`,
    )
    console.log(
      `  остаток games с result.teamsUsers.role='capitan': ${gamesWithSnapshotCaptainAfter}`,
    )
    console.log(
      `  остаток result.teamsUsers элементов role='capitan': ${snapshotCaptainMembersAfter}`,
    )

    return {
      label,
      apply,
      teamsUsersUpdated: Number(teamsUsersUpdateResult.modifiedCount || 0),
      gamesUpdated: Number(gamesUpdateResult.modifiedCount || 0),
      teamsUsersCaptainCountBefore,
      teamsUsersCaptainCountAfter,
      gamesWithSnapshotCaptainBefore,
      gamesWithSnapshotCaptainAfter,
      snapshotCaptainMembersBefore,
      snapshotCaptainMembersAfter,
    }
  } finally {
    await connection.close()
  }
}

const main = async () => {
  const { apply, scope, location } = parseArgs()

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI не задан')
  }

  const targets = buildTargets({ scope, location })
  if (targets.length === 0) {
    throw new Error('Нет баз данных для обработки')
  }

  console.log(`Режим: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Scope: ${scope}${location ? ` (location=${location})` : ''}`)
  console.log(`Целевые БД: ${targets.length}`)

  const summaries = []
  for (const target of targets) {
    const summary = await runForDb({
      label: target.label,
      dbName: target.dbName,
      apply,
    })
    summaries.push(summary)
  }

  const totals = summaries.reduce(
    (acc, item) => {
      acc.teamsUsersUpdated += item.teamsUsersUpdated
      acc.gamesUpdated += item.gamesUpdated
      acc.teamsUsersCaptainBefore += item.teamsUsersCaptainCountBefore
      acc.teamsUsersCaptainAfter += item.teamsUsersCaptainCountAfter
      acc.gamesWithSnapshotCaptainBefore += item.gamesWithSnapshotCaptainBefore
      acc.gamesWithSnapshotCaptainAfter += item.gamesWithSnapshotCaptainAfter
      acc.snapshotCaptainMembersBefore += item.snapshotCaptainMembersBefore
      acc.snapshotCaptainMembersAfter += item.snapshotCaptainMembersAfter
      return acc
    },
    {
      teamsUsersUpdated: 0,
      gamesUpdated: 0,
      teamsUsersCaptainBefore: 0,
      teamsUsersCaptainAfter: 0,
      gamesWithSnapshotCaptainBefore: 0,
      gamesWithSnapshotCaptainAfter: 0,
      snapshotCaptainMembersBefore: 0,
      snapshotCaptainMembersAfter: 0,
    },
  )

  console.log('---')
  console.log('Итог:')
  console.log(`  teamsusers обновлено: ${totals.teamsUsersUpdated}`)
  console.log(`  games snapshot обновлено: ${totals.gamesUpdated}`)
  console.log(
    `  teamsusers role='capitan' было/стало: ${totals.teamsUsersCaptainBefore}/${totals.teamsUsersCaptainAfter}`,
  )
  console.log(
    `  games с snapshot role='capitan' было/стало: ${totals.gamesWithSnapshotCaptainBefore}/${totals.gamesWithSnapshotCaptainAfter}`,
  )
  console.log(
    `  snapshot элементов role='capitan' было/стало: ${totals.snapshotCaptainMembersBefore}/${totals.snapshotCaptainMembersAfter}`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Ошибка нормализации роли капитана в БД')
    console.error(error)
    process.exit(1)
  })
