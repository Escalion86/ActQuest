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

let globalConnections = global.mongooseGlobal

if (!globalConnections) {
  globalConnections = global.mongooseGlobal = {}
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

    globalConnections.global.model(
      'Users',
      mongoose.Schema(usersSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'Games',
      mongoose.Schema(gamesSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'GamesTeams',
      mongoose.Schema(gamesTeamsSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'Teams',
      mongoose.Schema(teamsSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'TeamsUsers',
      mongoose.Schema(teamsUsersSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'SiteSettings',
      mongoose.Schema(siteSettingsSchema),
    )
    globalConnections.global.model(
      'LastCommands',
      mongoose.Schema(lastCommandsSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'UsersGamesPayments',
      mongoose.Schema(usersGamesPaymentsSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'Notifications',
      mongoose.Schema(notificationsSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'GamesPayments',
      mongoose.Schema(gamesPaymentsSchema, { timestamps: true }),
    )
    globalConnections.global.model(
      'PhoneVerifications',
      mongoose.Schema(phoneVerificationsSchema, { timestamps: true }),
    )
  }

  return globalConnections.global.asPromise()
}

export default dbConnectGlobal
