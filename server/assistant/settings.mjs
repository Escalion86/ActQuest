import { MongoClient } from 'mongodb'

export const AI_SETTINGS_PROJECTION = Object.freeze({ _id: 0, assistantAiEnabled: 1 })
// Тот же singleton SiteSettings, что в кабинете. Только чтение, без индексов и ON-кэша.
export async function readAiSettings(signal, options = {}) {
  const uri = options.uri ?? process.env.MONGODB_URI
  const dbName = options.dbName ?? process.env.MONGODB_GLOBAL_DBNAME
  if (!uri || !dbName) return { assistantAiEnabled: false }
  const Client = options.MongoClient || MongoClient
  let client
  try {
    client = new Client(uri, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000, socketTimeoutMS: 2000, maxPoolSize: 1 })
    const doc = await client.db(dbName).collection('sitesettings').findOne({}, { projection: AI_SETTINGS_PROJECTION, maxTimeMS: 1500, signal })
    return { assistantAiEnabled: doc?.assistantAiEnabled === true }
  } catch {
    return { assistantAiEnabled: false }
  } finally {
    await client?.close().catch(() => {})
  }
}

export async function assistantSettingsResponse(signal) {
  return Response.json(await readAiSettings(signal), { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
