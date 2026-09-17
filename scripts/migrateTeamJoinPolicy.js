const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const isApply = process.argv.includes('--apply')

const loadEnv = (fileName) => {
  const filePath = path.resolve(process.cwd(), fileName)
  if (!fs.existsSync(filePath)) return

  fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const separator = trimmed.indexOf('=')
      if (separator <= 0) return

      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
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

const buildMigrationFilter = () => ({
  open: false,
  joinPolicy: { $ne: 'closed' },
})

const buildMigrationUpdate = () => ({
  $set: { joinPolicy: 'closed' },
})

const run = async () => {
  loadEnv('.env.local')
  loadEnv('.env')

  if (!process.env.MONGODB_URI || !process.env.MONGODB_GLOBAL_DBNAME) {
    throw new Error('Не заданы MONGODB_URI или MONGODB_GLOBAL_DBNAME')
  }

  const connection = await mongoose
    .createConnection(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_GLOBAL_DBNAME,
    })
    .asPromise()

  try {
    const teams = connection.collection('teams')
    const filter = buildMigrationFilter()
    const matchingCount = await teams.countDocuments(filter)
    const sample = await teams
      .find(filter, { projection: { _id: 1, name: 1, open: 1, joinPolicy: 1 } })
      .sort({ _id: 1 })
      .limit(20)
      .toArray()

    console.log(`Режим: ${isApply ? 'APPLY' : 'DRY-RUN'}`)
    console.log(`База: ${process.env.MONGODB_GLOBAL_DBNAME}`)
    console.log(`Команд для обновления: ${matchingCount}`)

    if (sample.length > 0) {
      console.log('Пример команд:')
      sample.forEach((team) => {
        console.log(
          `- ${String(team._id)} · ${team.name || 'Без названия'} · joinPolicy=${team.joinPolicy ?? 'не задан'}`,
        )
      })
    }

    if (!isApply) {
      console.log('Изменения не записаны. Для применения добавьте --apply.')
      return
    }

    if (matchingCount === 0) {
      console.log('Миграция не требуется.')
      return
    }

    const result = await teams.updateMany(filter, buildMigrationUpdate())
    console.log(`Обновлено команд: ${Number(result.modifiedCount) || 0}`)
  } finally {
    await connection.close()
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Ошибка миграции режима вступления в команды')
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = {
  buildMigrationFilter,
  buildMigrationUpdate,
}
