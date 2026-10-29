import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  isTeamNameConflict,
  prepareRegularTeamName,
  teamNameConflictResponse,
  TEAM_NAME_CONFLICT_CODE,
} from '../server/teamNameUniqueness.js'

const createModel = (teams = []) => ({
  collection: { createIndex: async () => 'regular_team_name_key_unique' },
  exists: async (filter) => teams.find((team) =>
    team.kind !== 'personal' &&
    filter.location.test(team.location) &&
    filter.name.test(team.name) &&
    (!filter._id || team._id !== filter._id.$ne),
  ),
})

const prepare = (TeamsModel, name, location = 'krsk', teamId) =>
  prepareRegularTeamName({ TeamsModel, name, location, teamId })

const occupied = [{ _id: 'one', name: 'Искатели', location: 'krsk' }]

test('создание дубля в том же городе запрещено, включая старые записи без ключа', async () => {
  await assert.rejects(prepare(createModel(occupied), 'Искатели'), {
    code: TEAM_NAME_CONFLICT_CODE,
  })
})

test('регистр и пробелы по краям не позволяют обойти проверку', async () => {
  await assert.rejects(prepare(createModel(occupied), '  ИСКАТЕЛИ  '), {
    code: TEAM_NAME_CONFLICT_CODE,
  })
  await assert.rejects(prepare(createModel([
    { name: '  ИСКАТЕЛИ  ', name_lowered: 'устарело', location: ' KRSK ' },
  ]), 'Искатели'), { code: TEAM_NAME_CONFLICT_CODE })
})

test('одинаковое название в другом городе разрешено', async () => {
  const result = await prepare(createModel(occupied), 'Искатели', 'nrsk')
  assert.equal(result.location, 'nrsk')
  assert.notEqual(result.nameKey, JSON.stringify(['krsk', 'искатели']))
})

test('сохранение собственного названия разрешено', async () => {
  const result = await prepare(createModel(occupied), 'ИСКАТЕЛИ', 'krsk', 'one')
  assert.equal(result.name_lowered, 'искатели')
})

test('переименование в название другой команды запрещено', async () => {
  await assert.rejects(prepare(createModel(occupied), 'Искатели', 'krsk', 'two'), {
    code: TEAM_NAME_CONFLICT_CODE,
  })
})

test('перенос в город, где название занято, запрещён', async () => {
  await assert.rejects(prepare(createModel([
    ...occupied,
    { _id: 'two', name: 'Искатели', location: 'nrsk' },
  ]), 'Искатели', 'nrsk', 'one'), { code: TEAM_NAME_CONFLICT_CODE })
})

test('системные персональные команды не занимают название', async () => {
  await prepare(createModel([
    { name: 'Искатели', location: 'krsk', kind: 'personal' },
  ]), 'Искатели')
})

test('символы регулярных выражений сравниваются буквально', async () => {
  await prepare(createModel([{ name: 'ААА', location: 'krsk' }]), '.*')
  await assert.rejects(prepare(createModel([
    { name: 'А+ [Б] (В)? .* $^ \\', location: 'krsk' },
  ]), 'А+ [Б] (В)? .* $^ \\'), { code: TEAM_NAME_CONFLICT_CODE })
})

test('название и город обязательны', async () => {
  await assert.rejects(prepare(createModel(), '   '))
  await assert.rejects(prepare(createModel(), 'Команда', ''))
})

test('индекс создаётся один раз до проверки и повторяется после ошибки', async () => {
  let attempts = 0
  const model = createModel()
  model.collection.createIndex = async (keys, options) => {
    attempts += 1
    assert.deepEqual(keys, { nameKey: 1 })
    assert.equal(options.unique, true)
    assert.deepEqual(options.partialFilterExpression, { nameKey: { $type: 'string' } })
    if (attempts === 1) throw new Error('Индекс недоступен')
  }
  await assert.rejects(prepare(model, 'Первая'))
  await Promise.all([prepare(model, 'Вторая'), prepare(model, 'Третья')])
  assert.equal(attempts, 2)
})

test('ошибки дублирования ключа переводятся в понятный конфликт', () => {
  assert.equal(isTeamNameConflict({ code: 11000, keyPattern: { nameKey: 1 } }), true)
  assert.equal(isTeamNameConflict({ code: 11000, keyPattern: { ownerUserId: 1 } }), false)
  assert.equal(isTeamNameConflict({ code: 11000, message: 'regular_team_name_key_unique' }), true)
  assert.equal(isTeamNameConflict(new Error('Другая ошибка')), false)
  assert.equal(teamNameConflictResponse().code, TEAM_NAME_CONFLICT_CODE)
  assert.equal(teamNameConflictResponse().success, false)
})

test('обработчики кабинета возвращают 409, учитывают город команды и не записывают дубли', async () => {
  // Выполняем настоящие обработчики, заменяя только инфраструктуру и сессию.
  const teams = [
    { _id: 'one', name: 'Искатели', location: 'krsk' },
    { _id: 'two', name: 'Вторая', location: 'krsk' },
    { _id: 'three', name: 'Искатели', location: 'nrsk' },
  ]
  const model = createModel(teams)
  const query = (value) => ({ select: () => ({ lean: async () => value }) })
  model.findById = (id) => query(teams.find((team) => team._id === id))
  let writes = 0
  model.create = async (fields) => {
    writes += 1
    const team = { _id: `created-${writes}`, ...fields }
    teams.push(team)
    return team
  }
  model.findByIdAndUpdate = (id, update) => {
    writes += 1
    const team = teams.find((item) => item._id === id)
    Object.assign(team, update.$set)
    return query(team)
  }
  const memberships = {
    create: async () => {},
    findOne: () => query({ _id: 'captain-membership' }),
  }
  let session = { user: { _id: 'user', role: 'client', location: 'nrsk' } }
  const dependencies = {
    NextResponse: { json: (data, options) => ({ ...options, data }) },
    getServerSession: async () => session,
    authOptions: {},
    LOCATIONS: { krsk: {}, nrsk: {} },
    fetchTeamsForCabinet: async () => [],
    dbConnectGlobal: async () => ({
      model: (name) => name === 'Teams' ? model : memberships,
    }),
    logSiteEvent: async () => {},
    toStringId: (value) => value == null ? '' : String(value),
    TEAM_ROLE_CAPTAIN: 'captain',
    canCreateTeamForRole: () => true,
    countRegularTeamMemberships: async () => 0,
    hasReachedRegularTeamLimit: () => false,
    normalizeTeamJoinPolicy: () => 'open',
    teamCanBeJoinedById: () => true,
    getCaptainRoleQuery: () => 'captain',
    isTeamNameConflict,
    prepareRegularTeamName,
    teamNameConflictResponse,
  }
  const load = async (path, handler) => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8')
    const executable = source
      .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*\n/g, '')
      .replace(/export async function/g, 'async function')
    return new Function(...Object.keys(dependencies), `${executable}\nreturn ${handler}`)(
      ...Object.values(dependencies),
    )
  }
  const POST = await load('../app/api/cabinet/teams/route.js', 'POST')
  const PUT = await load('../app/api/cabinet/teams/[id]/route.js', 'PUT')
  const request = (data) => ({ json: async () => ({ data }) })
  const update = (id, data) => PUT(request(data), { params: Promise.resolve({ id }) })

  const duplicate = await POST(request({ name: ' ИСКАТЕЛИ ', location: 'krsk' }))
  assert.equal(duplicate.status, 409)
  assert.equal(duplicate.data.code, TEAM_NAME_CONFLICT_CODE)
  assert.equal(writes, 0)

  // Город сессии отличается от города редактируемой команды.
  const renamed = await update('two', { name: 'Искатели' })
  assert.equal(renamed.status, 409)
  assert.equal(writes, 0)
  assert.equal(teams[1].name, 'Вторая')

  const moved = await update('one', { name: 'Искатели', location: 'nrsk' })
  assert.equal(moved.status, 409)
  assert.equal(writes, 0)

  const ownName = await update('one', { name: 'Искатели' })
  assert.equal(ownName.status, 200)
  assert.equal(ownName.data.data.location, 'krsk')
  assert.equal(writes, 1)

  const created = await POST(request({ name: 'Вторая', location: 'krsk' }))
  assert.equal(created.status, 201)
  assert.equal(created.data.data.location, 'nrsk')
  assert.equal(writes, 2)

  session = { user: { _id: 'admin', role: 'admin', location: 'nrsk' } }
  const adminRename = await update('two', { name: 'Искатели' })
  assert.equal(adminRename.status, 409)
  assert.equal(writes, 2)

  // Конфликт, возникший после предварительной проверки, также становится 409.
  model.create = async () => {
    const error = new Error('Дублирование ключа')
    error.code = 11000
    error.keyPattern = { nameKey: 1 }
    throw error
  }
  assert.equal((await POST(request({ name: 'Гонка' }))).status, 409)
  model.findByIdAndUpdate = () => {
    const error = new Error('Дублирование ключа')
    error.code = 11000
    error.keyPattern = { nameKey: 1 }
    throw error
  }
  assert.equal((await update('two', { name: 'Гонка' })).status, 409)
})

test('проверка с настоящей MongoDB: записи, гонки и освобождение названий', {
  skip: !process.env.TEAM_NAME_TEST_MONGODB_URI,
}, async () => {
  const { default: mongoose } = await import('mongoose')
  const schemaSource = await readFile(new URL('../schemas/teamsSchema.js', import.meta.url), 'utf8')
  const resolvedSchemaSource = schemaSource.replace(/'@helpers\/([^']+)'/g,
    (_, name) => JSON.stringify(new URL(`../helpers/${name}.js`, import.meta.url).href),
  )
  const { default: schemaDefinition } = await import(
    `data:text/javascript;base64,${Buffer.from(resolvedSchemaSource).toString('base64')}`
  )
  const connection = await mongoose.createConnection(process.env.TEAM_NAME_TEST_MONGODB_URI, {
    dbName: 'actquest_team_name_test',
  }).asPromise()
  const collectionName = `teams_${new mongoose.Types.ObjectId()}`
  const model = connection.model('Teams', new mongoose.Schema(schemaDefinition), collectionName)
  const collection = model.collection
  const create = async (name, location = 'krsk') => {
    const fields = await prepare(model, name, location)
    const team = await model.create(fields)
    assert.equal(team.nameKey, fields.nameKey)
    return team._id
  }
  const rename = async (teamId, name, location = 'krsk') => {
    const fields = await prepare(model, name, location, teamId)
    await model.findByIdAndUpdate(teamId, { $set: fields })
  }
  try {
    // Существующий дубль не мешает созданию частичного индекса.
    await collection.insertMany([
      { name: 'Старая', location: 'krsk' },
      { name: 'Старая', location: 'krsk' },
      { name: 'Игрок', location: 'krsk', kind: 'personal' },
    ])
    await assert.rejects(create(' старая '), { code: TEAM_NAME_CONFLICT_CODE })
    await create('Игрок')
    const firstId = await create('Искатели')
    await assert.rejects(create('ИСКАТЕЛИ'), { code: TEAM_NAME_CONFLICT_CODE })
    await create('Искатели', 'nrsk')
    await rename(firstId, 'Искатели')
    const secondId = await create('Вторая')
    await assert.rejects(rename(secondId, 'Искатели'), { code: TEAM_NAME_CONFLICT_CODE })
    await assert.rejects(rename(firstId, 'Искатели', 'nrsk'), { code: TEAM_NAME_CONFLICT_CODE })
    await rename(firstId, 'Свободная')
    await create('Искатели')
    await collection.deleteOne({ _id: firstId })
    await create('Свободная')

    // Оба запроса прошли предварительную проверку до первой записи.
    const fields = await Promise.all([
      prepare(model, 'Одновременная'), prepare(model, 'ОДНОВРЕМЕННАЯ'),
    ])
    const writes = await Promise.allSettled(fields.map((data) => model.create(data)))
    assert.equal(writes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(writes.filter((result) => isTeamNameConflict(result.reason)).length, 1)
    assert.equal(await collection.countDocuments({ nameKey: fields[0].nameKey }), 1)

    const renameIds = await Promise.all([create('Третья'), create('Четвёртая')])
    const renameFields = await Promise.all(renameIds.map((teamId) =>
      prepare(model, 'Общее имя', 'krsk', teamId),
    ))
    const renames = await Promise.allSettled(renameIds.map((teamId, index) =>
      model.findByIdAndUpdate(teamId, { $set: renameFields[index] }),
    ))
    assert.equal(renames.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(renames.filter((result) => isTeamNameConflict(result.reason)).length, 1)
  } finally {
    await collection.drop()
    await connection.close()
  }
})
