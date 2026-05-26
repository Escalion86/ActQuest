/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

try {
  require('dotenv').config()
} catch (_error) {
  // optional
}

const loadEnvFromFile = (filePath) => {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const index = trimmed.indexOf('=')
    if (index <= 0) return

    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value
    }
  })
}

const resolveEnvTemplates = () => {
  const pattern = /\$\{([A-Z0-9_]+)\}/gi

  Object.keys(process.env).forEach((envKey) => {
    const rawValue = process.env[envKey]
    if (typeof rawValue !== 'string' || !rawValue.includes('${')) {
      return
    }

    let resolved = rawValue
    let safety = 0
    while (resolved.includes('${') && safety < 10) {
      safety += 1
      resolved = resolved.replace(pattern, (_, key) => {
        const replacement = process.env[key]
        return typeof replacement === 'string' ? replacement : ''
      })
    }
    process.env[envKey] = resolved
  })
}

loadEnvFromFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFromFile(path.resolve(process.cwd(), '.env'))
resolveEnvTemplates()

const parseArgs = () => {
  const args = process.argv.slice(2)
  return {
    apply: args.includes('--apply'),
  }
}

const ensurePreconditions = () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI не задан')
  }
  if (!process.env.MONGODB_GLOBAL_DBNAME) {
    throw new Error('MONGODB_GLOBAL_DBNAME не задан')
  }
}

const buildUserPatch = (user) => {
  const role =
    typeof user?.role === 'string' ? user.role.trim().toLowerCase() : ''

  const patch = {}

  if (role === 'moder') {
    patch.canBeGameModerator = true
    patch.role = 'client'
  }

  if (role === 'agent') {
    patch.canBeGameAgent = true
    patch.role = 'client'
  }

  return patch
}

const run = async () => {
  const options = parseArgs()
  ensurePreconditions()

  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
    })
    .asPromise()

  try {
    const users = connection.collection('users')
    const cursor = users.find({
      role: { $in: ['moder', 'agent'] },
    })

    const candidates = await cursor.toArray()
    const planned = candidates
      .map((user) => {
        const patch = buildUserPatch(user)
        const patchKeys = Object.keys(patch)
        if (patchKeys.length === 0) {
          return null
        }

        return {
          _id: user._id,
          name: typeof user?.name === 'string' ? user.name : '',
          role: typeof user?.role === 'string' ? user.role : '',
          patch,
        }
      })
      .filter(Boolean)

    const summary = {
      mode: options.apply ? 'apply' : 'dry-run',
      totalCandidates: candidates.length,
      totalPlanned: planned.length,
      moderatorsToConvert: planned.filter((item) => item.role === 'moder').length,
      agentsToConvert: planned.filter((item) => item.role === 'agent').length,
    }

    console.log('[migrateGameAssignmentRoles] summary', summary)

    planned.slice(0, 20).forEach((item) => {
      console.log('[migrateGameAssignmentRoles] planned-user', {
        _id: String(item._id),
        name: item.name,
        role: item.role,
        patch: item.patch,
      })
    })

    if (!options.apply) {
      console.log(
        '[migrateGameAssignmentRoles] dry-run завершён. Для применения используйте --apply',
      )
      return
    }

    let modifiedCount = 0
    for (const item of planned) {
      const result = await users.updateOne(
        { _id: item._id },
        { $set: item.patch },
      )
      modifiedCount += Number(result.modifiedCount || 0)
    }

    console.log('[migrateGameAssignmentRoles] apply complete', {
      planned: planned.length,
      modifiedCount,
    })
  } finally {
    await connection.close()
  }
}

run().catch((error) => {
  console.error('[migrateGameAssignmentRoles] failed', error)
  process.exitCode = 1
})
