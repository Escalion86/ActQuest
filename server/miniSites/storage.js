import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { configuration, validSlug, inside, fail, LIMITS, MiniSiteError, hasControl } from '@server/miniSites/config'
import { extractArchive } from '@server/miniSites/archive'
import { directory, createDirectory, readableFile } from '@server/miniSites/permissions'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const exists = async filename => { try { return await fs.lstat(filename) } catch (error) { if (error.code === 'ENOENT') return null; throw error } }
async function safeRoot(config) {
  // В user namespace системный / может отображаться с UID overflow вместо 0.
  const systemUid = (await fs.lstat(path.parse(config.root).root)).uid
  let current = config.root
  while (current !== path.dirname(current)) {
    const info = await fs.lstat(current)
    if (info.isSymbolicLink()) fail('Символические ссылки в пути MINI_SITES_ROOT запрещены.', 503)
    if (![systemUid, process.getuid()].includes(info.uid) || ((info.mode & 0o022) && !(info.mode & 0o1000))) fail('Родительские каталоги MINI_SITES_ROOT должны быть защищены от подмены.', 503)
    current = path.dirname(current)
  }
  config.gid = (await directory(config.root)).gid
  const real = await fs.realpath(config.root)
  const project = await fs.realpath(process.cwd())
  if (inside(project, real) || inside(real, project)) fail('Хранилище должно находиться вне проекта.', 503)
  for (const name of ['active', 'states', 'versions', 'staging']) if (await exists(path.join(config.root, name))) await directory(path.join(config.root, name), config.gid)
}
async function syncDirectory(filename) {
  const handle = await fs.open(filename, 'r')
  try { await handle.sync() } finally { await handle.close() }
}
async function writeJson(filename, data, gid) {
  const handle = await fs.open(filename, 'wx', 0o640)
  try { await readableFile(handle, gid); await handle.writeFile(JSON.stringify(data)); await handle.sync() } finally { await handle.close() }
}
async function stateFor(config, slug) {
  const link = path.join(config.root, 'active', slug)
  for (let attempt = 0; attempt < 3; attempt++) {
    const info = await exists(link)
    if (!info) return null
    if (!info.isSymbolicLink()) fail('Нарушена структура хранилища.', 503)
    const target = await fs.readlink(link)
    if (!target.startsWith('../states/') || !UUID.test(target.slice('../states/'.length))) fail('Нарушена структура хранилища.', 503)
    const folder = path.join(config.root, 'states', target.slice('../states/'.length))
    try {
      await directory(folder, config.gid)
      const meta = path.join(folder, 'state.json')
      const stat = await fs.lstat(meta)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) fail('Нарушены метаданные хранилища.', 503)
      const state = JSON.parse(await fs.readFile(meta, 'utf8'))
      if (state.slug !== slug || typeof state.enabled !== 'boolean' || !UUID.test(state.current?.id) || (state.previous && !UUID.test(state.previous.id))) fail('Нарушены метаданные хранилища.', 503)
      return { state, folder }
    } catch (error) { if (error.code === 'ENOENT' && attempt < 2) continue; throw error }
  }
}
function projectSite(config, state) {
  return { slug: state.slug, name: state.name, enabled: state.enabled, url: `https://${state.slug}.${config.domain}`, createdAt: state.createdAt, updatedAt: state.updatedAt, versionAt: state.current.createdAt, fileCount: state.current.fileCount, bytes: state.current.bytes, canRollback: Boolean(state.previous) }
}
export async function listSites() {
  let config
  try { config = configuration(); await safeRoot(config) } catch (error) {
    return { configured: false, configurationError: error instanceof MiniSiteError ? error.message : 'Подготовьте доступный защищённый MINI_SITES_ROOT вне проекта.', sites: [] }
  }
  const entries = await exists(path.join(config.root, 'active')) ? await fs.readdir(path.join(config.root, 'active')) : []
  const sites = []
  for (const slug of entries) {
    if (slug.startsWith('.')) continue
    validSlug(slug, config)
    const record = await stateFor(config, slug)
    if (record) sites.push(projectSite(config, record.state))
  }
  return { configured: true, configurationError: null, sites: sites.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }
}
// Логический объём всех файлов, включая оставшиеся после аварии staging/версии.
async function diskUsage(folder) {
  let bytes = 0
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name)
    const info = await fs.lstat(filename)
    if (info.isSymbolicLink()) continue
    if (info.isDirectory()) bytes += await diskUsage(filename)
    else if (info.isFile()) bytes += info.size
    else fail('В хранилище обнаружен специальный файл.', 503)
  }
  return bytes
}
async function diskSpace(config, bytes = 0) {
  const stats = await fs.statfs(config.root)
  if (stats.bavail * stats.bsize < config.reserve + bytes) fail('Недостаточно свободного диска с учётом резерва.', 507)
}
async function locked(config, run) {
  await safeRoot(config)
  const lock = path.join(config.root, '.lock')
  try { await createDirectory(lock, config.gid) } catch (error) {
    if (error.code === 'EEXIST') fail('Другая операция уже выполняется. Повторите позже; зависшую блокировку снимает оператор.', 409)
    throw error
  }
  try {
    await writeJson(path.join(lock, 'owner.json'), { pid: process.pid, startedAt: new Date().toISOString() }, config.gid)
    for (const name of ['active', 'states', 'versions', 'staging']) {
      const folder = path.join(config.root, name)
      if (!(await exists(folder))) await createDirectory(folder, config.gid)
      await directory(folder, config.gid)
    }
    return await run()
  } finally { await fs.rm(lock, { recursive: true, force: true }) }
}

export async function mutateSite({ action, slug, name, archive, signal = AbortSignal.timeout(LIMITS.timeout) }) {
  const config = configuration()
  validSlug(slug, config)
  if (!['create', 'replace', 'enable', 'disable', 'rollback'].includes(action)) fail('Неизвестное действие.')
  if (action === 'create' && (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || hasControl(name))) fail('Укажите название длиной до 100 символов.')
  await locked(config, async () => {
    if (signal.aborted) fail('Операция прервана или истекло время.', 408)
    const old = await stateFor(config, slug)
    if (action === 'create' && old) fail('Этот slug уже занят.', 409)
    if (action !== 'create' && !old) fail('Мини-сайт не найден.', 404)
    const now = new Date().toISOString()
    const state = old ? { ...old.state, updatedAt: now } : { slug, name: name.trim(), enabled: true, createdAt: now, updatedAt: now, previous: null }
    const id = randomUUID()
    const staging = path.join(config.root, 'staging', id)
    const version = path.join(config.root, 'versions', id)
    const snapshot = path.join(config.root, 'states', id)
    const pendingLink = path.join(config.root, 'active', '.' + id)
    let moved = false, committed = false
    try {
      let budget = await diskUsage(config.root)
      if (budget + 65536 > config.quota) fail('Превышена общая квота хранилища с учётом временной версии.', 413)
      await diskSpace(config, 65536)
      if (action === 'create' || action === 'replace') {
        // Резерв проверяется до распаковки и по каждому фактически полученному чанку.
        await diskSpace(config, LIMITS.unpacked + 65536)
        await createDirectory(staging, config.gid)
        const publicFolder = path.join(staging, 'public')
        await createDirectory(publicFolder, config.gid)
        const result = await extractArchive(archive, publicFolder, { signal, gid: config.gid, onBytes: async bytes => {
          budget += bytes
          if (budget + 65536 > config.quota) fail('Превышена общая квота хранилища с учётом временной версии.', 413)
          await diskSpace(config, bytes + 65536)
        } })
        await syncDirectory(publicFolder)
        await fs.rename(staging, version); moved = true
        await directory(version, config.gid)
        await directory(path.join(version, 'public'), config.gid)
        await syncDirectory(path.dirname(version))
        state.previous = state.current || null
        state.current = { id, ...result, createdAt: now }
      } else if (action === 'rollback') {
        if (!state.previous) fail('Предыдущая версия отсутствует.', 409)
        ;[state.current, state.previous] = [state.previous, state.current]
      } else state.enabled = action === 'enable'
      await directory(path.join(config.root, 'versions', state.current.id), config.gid)
      await directory(path.join(config.root, 'versions', state.current.id, 'public'), config.gid)
      await createDirectory(snapshot, config.gid)
      await writeJson(path.join(snapshot, 'state.json'), state, config.gid)
      if (state.enabled) await fs.symlink(`../../versions/${state.current.id}/public`, path.join(snapshot, 'public'))
      await syncDirectory(snapshot)
      await syncDirectory(path.dirname(snapshot))
      await fs.symlink(`../states/${id}`, pendingLink)
      if (signal.aborted) fail('Операция прервана или истекло время.', 408)
      // Единственная точка фиксации одновременно меняет метаданные и публичную выдачу.
      await fs.rename(pendingLink, path.join(config.root, 'active', slug)); committed = true
      await syncDirectory(path.join(config.root, 'active'))
      // Уборка только замещённого состояния и третьей версии собственного сайта.
      if (old) {
        await fs.rm(old.folder, { recursive: true, force: true })
        const retained = new Set([state.current.id, state.previous?.id])
        for (const item of [old.state.current, old.state.previous]) if (item && !retained.has(item.id)) await fs.rm(path.join(config.root, 'versions', item.id), { recursive: true, force: true })
      }
    } catch (error) {
      // После commit ошибка fsync/очистки не отменяет уже опубликованное состояние.
      if (committed) console.error('[mini-sites] Состояние опубликовано, требуется проверка диска/очистки:', error.code || 'IO')
      else throw error
    } finally {
      await fs.rm(staging, { recursive: true, force: true })
      await fs.rm(pendingLink, { force: true })
      if (!committed) {
        await fs.rm(snapshot, { recursive: true, force: true })
        if (moved) await fs.rm(version, { recursive: true, force: true })
      }
    }
  })
  return listSites()
}
