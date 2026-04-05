import mongoose from 'mongoose'

import usersSchema from '@schemas/usersSchema'
import phoneVerificationsSchema from '@schemas/phoneVerificationsSchema'
import gamesSchema from '@schemas/gamesSchema'
import gamesTeamsSchema from '@schemas/gamesTeamsSchema'
import teamsSchema from '@schemas/teamsSchema'
import teamsUsersSchema from '@schemas/teamsUsersSchema'
import siteSettingsSchema from '@schemas/siteSettingsSchema'
import lastCommandsSchema from '@schemas/lastCommandsSchema'
import usersGamesPaymentsSchema from '@schemas/usersGamesPaymentsSchema'
import notificationsSchema from '@schemas/notificationsSchema'
import gamesPaymentsSchema from '@schemas/gamesPaymentsSchema'
import transactionsSchema from '@schemas/transactionsSchema'
import seasonsSchema from '@schemas/seasonsSchema'
import siteEventsSchema from '@schemas/siteEventsSchema'

let globalConnections = global.mongooseGlobal

if (!globalConnections) {
  globalConnections = global.mongooseGlobal = {}
}

const ensureModel = (connection, name, schemaFactory) => {
  const hasModel = Boolean(connection.models?.[name])
  if (!hasModel) {
    return connection.model(name, schemaFactory())
  }

  if (process.env.NODE_ENV === 'production') {
    return connection.model(name)
  }

  // In dev Next.js keeps a warm process and mongoose models can stay stale after
  // schema edits. Re-create model to pick up enum/field changes without restart.
  connection.deleteModel(name)
  return connection.model(name, schemaFactory())
}

async function dbConnectGlobal() {
  const dbName = process.env.MONGODB_GLOBAL_DBNAME
  const mongoUri = process.env.MONGODB_URI

  if (!dbName) {
    console.log('MONGODB_GLOBAL_DBNAME is not set')
    return null
  }

  if (!mongoUri) {
    console.log('MONGODB_URI is not set')
    return null
  }

  if (!globalConnections.global) {
    console.log('')
    console.log('------------------------------')
    console.log('dbConnectGlobal: создаем соединение')
    console.log('------------------------------')
    console.log('')

    globalConnections.global = mongoose.createConnection(mongoUri, {
      dbName,
    })

    ensureModel(globalConnections.global, 'Users', () =>
      mongoose.Schema(usersSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'Games', () =>
      mongoose.Schema(gamesSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'GamesTeams', () =>
      mongoose.Schema(gamesTeamsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'Teams', () =>
      mongoose.Schema(teamsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'TeamsUsers', () =>
      mongoose.Schema(teamsUsersSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'SiteSettings', () =>
      mongoose.Schema(siteSettingsSchema),
    )
    ensureModel(globalConnections.global, 'LastCommands', () =>
      mongoose.Schema(lastCommandsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'UsersGamesPayments', () =>
      mongoose.Schema(usersGamesPaymentsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'Notifications', () =>
      mongoose.Schema(notificationsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'GamesPayments', () =>
      mongoose.Schema(gamesPaymentsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'PhoneVerifications', () =>
      mongoose.Schema(phoneVerificationsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'Transactions', () =>
      mongoose.Schema(transactionsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'Seasons', () =>
      mongoose.Schema(seasonsSchema, { timestamps: true }),
    )
    ensureModel(globalConnections.global, 'SiteEvents', () =>
      mongoose.Schema(siteEventsSchema, { timestamps: true }),
    )
  }

  ensureModel(globalConnections.global, 'Games', () =>
    mongoose.Schema(gamesSchema, { timestamps: true }),
  )
  ensureModel(globalConnections.global, 'Seasons', () =>
    mongoose.Schema(seasonsSchema, { timestamps: true }),
  )
  ensureModel(globalConnections.global, 'SiteEvents', () =>
    mongoose.Schema(siteEventsSchema, { timestamps: true }),
  )

  return globalConnections.global.asPromise()
}

export default dbConnectGlobal
