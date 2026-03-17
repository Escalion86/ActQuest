import mongoose from 'mongoose'

import usersSchema from '@schemas/usersSchema'
import phoneVerificationsSchema from '@schemas/phoneVerificationsSchema'

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
      'PhoneVerifications',
      mongoose.Schema(phoneVerificationsSchema, { timestamps: true }),
    )
  }

  return globalConnections.global.asPromise()
}

export default dbConnectGlobal
