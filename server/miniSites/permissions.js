import fs from 'node:fs/promises'
import { fail } from '@server/miniSites/config'

// GID корня — единственная группа чтения. setgid обязателен даже при primary gid.
export async function directory(filename, expectedGid) {
  const info = await fs.lstat(filename)
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o022) || (info.mode & 0o2750) !== 0o2750 || (expectedGid !== undefined && info.gid !== expectedGid)) {
    fail('Хранилищу нужны каталоги владельца приложения с setgid, группой корня хранилища и правами 2750 (group r-x, без чужой записи).', 503)
  }
  return info
}
export async function createDirectory(filename, gid) {
  await fs.mkdir(filename, { mode: 0o2750 })
  try {
    // Меняем только только что созданный собственный каталог, не существующие пути.
    await fs.chmod(filename, 0o2750)
    await directory(filename, gid)
  } catch (error) { await fs.rmdir(filename); throw error }
}
export async function readableFile(handle, gid) {
  await handle.chmod(0o640)
  const info = await handle.stat()
  if (!info.isFile() || info.uid !== process.getuid() || info.gid !== gid || (info.mode & 0o022) || !(info.mode & 0o040)) fail('Новый файл не унаследовал безопасную группу чтения хранилища.', 503)
}
