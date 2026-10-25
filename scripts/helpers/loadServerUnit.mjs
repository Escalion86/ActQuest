import fs from 'node:fs'
import vm from 'node:vm'

// Исполняем исходные серверные функции с подменой только внешних зависимостей.
// Это позволяет проверять обработчики без запуска Next.js и подключения к БД.
export const loadServerUnit = (path, bindings, exports) => {
  const source = fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace(/^export default \w+\s*;?\r?$/gm, '')
    .replace(/^export /gm, '')
  return vm.runInNewContext(`${source}\n;({${exports.join(',')}})`, {
    console, process, Date, Math, Number, String, Boolean, Array, Object, Map, Set,
    JSON, Promise, Error, RegExp, structuredClone, setTimeout, clearTimeout,
    setInterval, clearInterval, ...bindings,
  }, { filename: path })
}
