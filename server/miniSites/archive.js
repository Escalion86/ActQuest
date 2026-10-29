import yauzl from 'yauzl'
import fs from 'node:fs/promises'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import { directory, createDirectory, readableFile } from '@server/miniSites/permissions'
import { LIMITS, fail, MiniSiteError, hasControl } from '@server/miniSites/config'

const extensions = new Set('html htm css js mjs json svg png jpg jpeg gif webp avif ico bmp woff woff2 ttf otf eot mp3 wav ogg m4a aac flac mp4 webm ogv mov txt xml webmanifest map vtt'.split(' '))
const forbidden = /^(?:package(?:-lock)?\.json|npm-shrinkwrap\.json|composer\.(?:json|lock)|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|dockerfile|makefile|web\.config|nginx\.conf|tsconfig\.json|jsconfig\.json|.*\.config\.(?:js|mjs|json))$/i
function entryPath(entry) {
  const name = entry.fileName
  if (!name || name.length > 240 || (/[\\:%?#]/.test(name) || hasControl(name)) || name.startsWith('/') || name.normalize('NFC') !== name) fail('ZIP содержит небезопасное имя файла.')
  const directory = name.endsWith('/')
  const parts = (directory ? name.slice(0, -1) : name).split('/')
  if (parts.length > 16 || parts.some(p => !p || p.startsWith('.') || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) fail('ZIP содержит неоднозначный путь или скрытый файл.')
  const mode = (entry.externalFileAttributes >>> 16) & 0xf000
  if ((mode && mode !== (directory ? 0x4000 : 0x8000)) || (entry.generalPurposeBitFlag & 65) || ![0, 8].includes(entry.compressionMethod)) fail('ZIP содержит ссылку, специальный файл, шифрование или неподдержанный метод.')
  if (!directory && (forbidden.test(parts.at(-1)) || !extensions.has(path.posix.extname(name).slice(1).toLowerCase()))) fail('Разрешены только статические HTML, JS, CSS и ресурсы; серверные проекты и архивы запрещены.')
  return { name: parts.join('/'), directory, entry }
}

export async function extractArchive(buffer, destination, { signal, onBytes, gid }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > LIMITS.archive) fail('ZIP должен быть не больше 20 МиБ.', 413)
  const zip = await new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, archive) => error ? reject(new MiniSiteError('Повреждённый ZIP.')) : resolve(archive)))
  let stream
  const abort = () => { stream?.destroy(new MiniSiteError('Операция прервана или истекло время.', 408)); zip.close() }
  const checkAbort = () => { if (signal.aborted) fail('Операция прервана или истекло время.', 408) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    checkAbort()
    // Полный каталог проверяется до создания файлов. Данные читаются по одному потоком.
    const entries = await new Promise((resolve, reject) => {
      const list = []
      const aborted = () => reject(new MiniSiteError('Операция прервана или истекло время.', 408))
      signal.addEventListener('abort', aborted, { once: true })
      const finish = (error) => { signal.removeEventListener('abort', aborted); error ? reject(error) : resolve(list) }
      zip.once('error', () => finish(new MiniSiteError('Повреждённый ZIP.')))
      zip.once('end', () => finish())
      zip.on('entry', entry => {
        try {
          if (list.length >= LIMITS.entries) fail('В ZIP разрешено не больше 1000 записей.', 413)
          const item = entryPath(entry)
          if (entry.uncompressedSize > LIMITS.file) fail('Файл превышает 20 МиБ.', 413)
          list.push(item); zip.readEntry()
        } catch (error) { finish(error) }
      })
      zip.readEntry()
    })
    const names = new Map()
    for (const item of entries) {
      const key = item.name.toLowerCase()
      if (names.has(key)) fail('ZIP содержит дубликаты или коллизии регистра.')
      names.set(key, item.directory)
    }
    for (const item of entries) {
      const parts = item.name.toLowerCase().split('/')
      for (let i = 1; i < parts.length; i++) if (names.get(parts.slice(0, i).join('/')) === false) fail('Коллизия файла и каталога в ZIP.')
    }
    const files = entries.filter(item => !item.directory)
    let prefix = ''
    if (!files.some(item => item.name === 'index.html')) {
      const wrapper = files[0]?.name.split('/')[0]
      if (!wrapper || !files.some(item => item.name === `${wrapper}/index.html`) || entries.some(item => item.name !== wrapper && !item.name.startsWith(wrapper + '/'))) fail('Нужен index.html в корне или единственной общей папке ZIP.')
      prefix = wrapper + '/'
    }
    if (files.reduce((sum, item) => sum + item.entry.uncompressedSize, 0) > LIMITS.unpacked) fail('Распаковка превышает 100 МиБ.', 413)
    let bytes = 0
    const directories = new Set([destination])
    for (const item of files) {
      checkAbort()
      const filename = path.join(destination, item.name.slice(prefix.length))
      let nested = destination
      for (const part of path.relative(destination, path.dirname(filename)).split(path.sep).filter(Boolean)) {
        nested = path.join(nested, part)
        try { await directory(nested, gid) } catch (error) { if (error.code !== 'ENOENT') throw error; await createDirectory(nested, gid) }
      }
      let parent = path.dirname(filename)
      while (parent !== path.dirname(destination)) { directories.add(parent); if (parent === destination) break; parent = path.dirname(parent) }
      const handle = await fs.open(filename, 'wx', 0o640)
      let size = 0, crc = 0
      try {
        await readableFile(handle, gid)
        stream = await new Promise((resolve, reject) => zip.openReadStream(item.entry, (error, value) => error ? reject(new MiniSiteError('Не удалось прочитать ZIP.')) : resolve(value)))
        for await (const chunk of stream) {
          checkAbort(); size += chunk.length; bytes += chunk.length
          if (size > LIMITS.file || bytes > LIMITS.unpacked) fail('Превышен фактический размер распаковки.', 413)
          await onBytes(chunk.length)
          crc = crc32(chunk, crc)
          await handle.writeFile(chunk)
        }
        if (size !== item.entry.uncompressedSize || crc !== item.entry.crc32) fail('Размер или CRC файла ZIP не совпадает.')
        await handle.sync()
      } finally { stream?.destroy(); stream = null; await handle.close() }
    }
    for (const folder of [...directories].sort((a, b) => b.length - a.length)) {
      checkAbort()
      const handle = await fs.open(folder, 'r')
      try { await handle.sync() } finally { await handle.close() }
    }
    return { fileCount: files.length, bytes }
  } catch (error) {
    if (error instanceof MiniSiteError || ['ENOSPC', 'EDQUOT', 'EIO', 'EACCES'].includes(error.code)) throw error
    throw new MiniSiteError('Повреждённый или неподдержанный ZIP.')
  } finally { signal.removeEventListener('abort', abort); zip.close() }
}
