const copy = (value) => structuredClone(value)
const read = (doc, path) => path.split('.').reduce((value, key) => value?.[key], doc)
const equal = (a, b) => a instanceof Date || b instanceof Date
  ? new Date(a).getTime() === new Date(b).getTime()
  : JSON.stringify(a) === JSON.stringify(b)
const match = (doc, filter) => Object.entries(filter).every(([key, value]) => {
  if (key === '$or') return value.some((entry) => match(doc, entry))
  const actual = read(doc, key)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('$gt' in value) return actual > value.$gt
    if ('$lte' in value) return actual <= value.$lte
    if ('$exists' in value) return (actual !== undefined) === value.$exists
    if ('$in' in value) return value.$in.some((item) => equal(actual, item))
  }
  return value === null ? actual == null : equal(actual, value)
})
const set = (doc, path, value, remove = false) => {
  const keys = path.split('.')
  const last = keys.pop()
  for (const key of keys) { doc[key] ||= {}; doc = doc[key] }
  if (remove) delete doc[last]
  else doc[last] = copy(value)
}
const query = (execute) => {
  let promise
  const run = () => promise ||= Promise.resolve().then(execute)
  return { lean: run, select() { return this }, then: (yes, no) => run().then(yes, no) }
}

export const memoryGameDb = (initial) => {
  const models = {}
  const db = { model: (name) => {
    if (models[name]) return models[name]
    const docs = copy(initial[name] || [])
    const model = {
      modelName: name, db, docs, writes: [], failUpdate: null,
      find: (filter = {}) => query(() => copy(docs.filter((doc) => match(doc, filter)))),
      findById: (id) => query(() => copy(docs.find((doc) => String(doc._id) === String(id)) || null)),
      findOne: (filter) => query(() => copy(docs.find((doc) => match(doc, filter)) || null)),
      findOneAndUpdate: (filter, update, options = {}) => query(() => {
        if (model.failUpdate?.(filter, update)) throw new Error('Искусственный сбой записи')
        const doc = docs.find((item) => match(item, filter))
        if (!doc) return null
        const before = copy(doc)
        for (const [key, value] of Object.entries(update.$set || update)) {
          if (!key.startsWith('$')) set(doc, key, value)
        }
        for (const key of Object.keys(update.$unset || {})) set(doc, key, null, true)
        model.writes.push({ filter: copy(filter), update: copy(update) })
        return copy(options.returnDocument === 'after' ? doc : before)
      }),
      findByIdAndUpdate: (id, update, options) => model.findOneAndUpdate({ _id: id }, update, options),
      updateOne: async (filter, update) => {
        const result = await model.findOneAndUpdate(filter, update)
        return { matchedCount: result ? 1 : 0, modifiedCount: result ? 1 : 0 }
      },
      updateMany: async () => ({ matchedCount: 0, modifiedCount: 0 }),
    }
    models[name] = model
    return model
  } }
  return db
}
