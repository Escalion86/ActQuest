import mongoose from 'mongoose'

import teamsSchema from '@schemas/teamsSchema'
import teamsUsersSchema from '@schemas/teamsUsersSchema'
import gamesTeamsSchema from '@schemas/gamesTeamsSchema'
import usersGamesPaymentsSchema from '@schemas/usersGamesPaymentsSchema'
import lastCommandsSchema from '@schemas/lastCommandsSchema'
import usersSchema from '@schemas/usersSchema'
import siteSettingsSchema from '@schemas/siteSettingsSchema'
import gamesSchema from '@schemas/gamesSchema'

import checkLocationValid from '@server/checkLocationValid'

let connections = global.mongoose

if (!connections) {
  connections = global.mongoose = {}
}

async function dbConnect(location) {
  if (!checkLocationValid(location)) {
    console.log('invalid location (dbConnect)', location)
    return
  }

  var dbName
  if (location === 'krsk') dbName = process.env.MONGODB_KRSK_DBNAME
  if (location === 'nrsk') dbName = process.env.MONGODB_NRSK_DBNAME
  if (location === 'ekb') dbName = process.env.MONGODB_EKB_DBNAME
  if (location === 'dev') dbName = process.env.MONGODB_DEV_DBNAME

  if (!connections[location]) {
    console.log('')
    console.log('------------------------------')
    console.log('dbConnect: создаем соединение', location)
    console.log('------------------------------')
    console.log('')
    connections[location] = mongoose.createConnection(process.env.MONGODB_URI, {
      dbName,
    })
    connections[location].model(
      'Games',
      mongoose.Schema(gamesSchema, { timestamps: true })
    )
    connections[location].model(
      'GamesTeams',
      mongoose.Schema(gamesTeamsSchema, { timestamps: true })
    )
    connections[location].model(
      'LastCommands',
      mongoose.Schema(lastCommandsSchema, { timestamps: true })
    )
    connections[location].model(
      'SiteSettings',
      mongoose.Schema(siteSettingsSchema)
    )
    connections[location].model(
      'Teams',
      mongoose.Schema(teamsSchema, { timestamps: true })
    )
    connections[location].model(
      'TeamsUsers',
      mongoose.Schema(teamsUsersSchema, { timestamps: true })
    )
    connections[location].model(
      'UsersGamesPayments',
      mongoose.Schema(usersGamesPaymentsSchema, { timestamps: true })
    )
    connections[location].model(
      'Users',
      mongoose.Schema(usersSchema, { timestamps: true })
    )
  }

  return connections[location].asPromise()
}

export default dbConnect

// // const fs = require('fs');
// var mongoose = require('mongoose')

// // var tunnel = require('tunnel-ssh')

// // var globalTunnel = require('global-tunnel')
// // globalTunnel.initialize({
// //   host: '185.185.70.20',
// //   port: 27017,
// //   // sockets: 50 // optional pool size for each http and https
// // })
// // // const autoIncrement = require('mongoose-auto-increment')

// // var config = {
// //   username: 'root',
// //   password: 'Magister86',
// //   host: '185.185.70.20',
// //   port: 22,
// //   // agent : process.env.SSH_AUTH_SOCK,
// //   // privateKey:require('fs').readFileSync('/Users/myusername/.ssh/id_rsa'),

// //   // dstHost: 'localhost',
// //   dstPort: 27017,
// //   // localHost: '127.0.0.1',

// //   // localPort: 27017,
// // }

// // // const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.0ogkw.mongodb.net/${process.env.MONGODB_DBNAME}?retryWrites=true&w=majority`
// // // const MONGODB_URI = process.env.MONGODB_URI
// // // if (!MONGODB_URI) {
// // //   throw new Error(
// // //     'Please define the MONGODB_URI environment variable inside .env.local'
// // //   )
// // // }

// // // let dbUser = fs.readFileSync(process.env.DB_USER);
// // // let dbPassword = fs.readFileSync(process.env.DB_PASSWORD);

// // /**
// //  * Global is used here to maintain a cached connection across hot reloads
// //  * in development. This prevents connections growing exponentially
// //  * during API Route usage.
// //  */
// // let cached = global.mongoose

// // if (!cached) {
// //   cached = global.mongoose = { conn: null, promise: null }
// // }

// // async function dbConnect() {
// //   try {
// //     if (cached.conn) {
// //       console.log('dbConnect: используется текущее соединение')
// //       // console.log('dbConnect: cached.conn', cached.conn)
// //       return cached.conn
// //     }

// //     if (!cached.promise) {
// //       console.log('dbConnect: соединяем')
// //       const opts = {
// //         useNewUrlParser: true,
// //         useUnifiedTopology: true,
// //         bufferCommands: false,
// //         // useFindAndModify: false,
// //       }

// //       // const db = mongoose.connection
// //       // db.on('error', console.error.bind(console, 'connection error: '))
// //       // db.once('open', function () {
// //       //   console.log('Connected successfully')
// //       // })

// //       var server = tunnel(config, function (error, server) {
// //         if (error) {
// //           console.log('SSH connection error: ' + error)
// //         }
// //         cached.promise = mongoose
// //           .connect('mongodb://127.0.0.1:27017', opts)
// //           .then((mongoose) => {
// //             return mongoose
// //           })

// //         var db = mongoose.connection
// //         db.on('error', console.error.bind(console, 'DB connection error:'))
// //         db.once('open', function () {
// //           // we're connected!
// //           console.log('DB connection successful')
// //           // console.log(server);
// //         })
// //       })

// //       // cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
// //       //   return mongoose
// //       // })
// //     } else {
// //       console.log('dbConnect: ожидаем соединения (повторно)')
// //     }
// //     cached.conn = await cached.promise
// //     // console.log('cached.conn.connections[0]', cached.conn.connections[0])
// //     // autoIncrement.initialize(cached.conn)
// //     // cached.autoIncrement = autoIncrement
// //     return cached
// //   } catch (error) {
// //     console.log(error)
// //   }
// // }

// // export default dbConnect

// // // const fs = require('fs');
// // const mongoose = require('mongoose')
// // // const autoIncrement = require('mongoose-auto-increment')

// // const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.0ogkw.mongodb.net/${process.env.MONGODB_DBNAME}?retryWrites=true&w=majority`
// const MONGODB_URI = process.env.MONGODB_URI
// if (!MONGODB_URI) {
//   throw new Error(
//     'Please define the MONGODB_URI environment variable inside .env.local'
//   )
// }
// // let dbUser = fs.readFileSync(process.env.DB_USER);
// // let dbPassword = fs.readFileSync(process.env.DB_PASSWORD);

// /**
//  * Global is used here to maintain a cached connection across hot reloads
//  * in development. This prevents connections growing exponentially
//  * during API Route usage.
//  */
// let cached = global.mongoose

// if (!cached) {
//   cached = global.mongoose = { conn: null, promise: null }
// }

// let prevDbConnection

// async function dbConnect(db) {
//   var dbName = process.env.MONGODB_DBNAME
//   if (db === 'nrsk') dbName = process.env.MONGODB_NRSK_DBNAME

//   if (prevDbConnection !== dbName) {
//     console.log('db changed !!')
//     cached = { conn: null, promise: null }
//     await mongoose.disconnect()
//   }

//   if (prevDbConnection !== dbName) {
//     prevDbConnection = dbName
//   }

//   if (cached.conn) {
//     // console.log('dbConnect: используется текущее соединение')
//     // console.log('dbConnect: cached.conn', cached.conn)
//     // console.log('cached :>> ', Object.keys(cached))
//     // console.log('cached.conn :>> ', Object.keys(cached.conn))
//     return cached.conn
//   }

//   if (!cached.promise) {
//     // console.log('dbConnect: соединяем')
//     const opts = {
//       // useNewUrlParser: true,
//       // useUnifiedTopology: true,
//       // bufferCommands: false,
//       // useFindAndModify: false,
//       dbName,
//     }

//     const db = mongoose.connection
//     db.on('error', console.error.bind(console, 'connection error: '))
//     db.once('open', function () {
//       console.log('Connected successfully')
//     })

//     mongoose.set('strictQuery', false)
//     cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
//       return mongoose
//     })
//   } else {
//     console.log('dbConnect: ожидаем соединения (повторно)')
//   }

//   cached.conn = await cached.promise
//   // console.log('cached.conn.connections[0]', cached.conn.connections[0])
//   // autoIncrement.initialize(cached.conn)
//   // cached.autoIncrement = autoIncrement
//   return cached
// }

// export default dbConnect
