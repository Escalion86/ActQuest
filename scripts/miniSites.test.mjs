import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, rm, readlink, mkdir, symlink, chmod } from 'node:fs/promises'
import path from 'node:path'
import { fixture, zip, upload, action, loader } from './miniSites.fixture.mjs'
// Хранилище рассчитано на POSIX: uid/gid, setgid, симлинки и fsync каталогов.
// HTTP/auth-проверки ниже выполняются на всех платформах.
const storageTest = (name, run) => test(name, {
  skip: process.platform === 'win32' ? 'Нужна POSIX-файловая система (Linux/WSL)' : false,
}, run)
const get = api => api.GET(new Request('http://localhost/api/cabinet/admin/mini-sites'))
const data = async response => { const json = await response.json(); assert.equal(response.status, 200, JSON.stringify(json)); assert.equal(json.success, true); return json.data }
const visible = root => readFile(path.join(root, 'active/test-site/public/index.html'), 'utf8')

storageTest('публикация, wrapper/JS/CSS/SVG, повторное чтение, замена, откат и enabled', async () => {
  const f = await fixture()
  try {
    const api = f.api()
    assert.deepEqual((await data(await get(api))).sites, [])
    const archive = zip([{ name: 'bundle/index.html', text: '<h1>Первый</h1>' }, { name: 'bundle/app.js', text: 'const Node = "browser"' }, { name: 'bundle/style.css', text: 'body{color:red}' }, { name: 'bundle/image.svg', text: '<svg/>' }])
    const created = await data(await api.POST(upload(archive)))
    assert.equal(created.sites[0].url, 'https://test-site.actquest.ru')
    assert.equal(created.sites[0].fileCount, 4)
    assert.match(await visible(f.root), /Первый/)
    assert.equal((await data(await get(loader(f.env, { 'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => ({ user: { role: 'admin' } }) }, '@server/auth/authOptions': { authOptions: {} } })('@app/api/cabinet/admin/mini-sites/route')))).sites.length, 1)
    await data(await api.POST(upload(zip([{ name: 'index.html', text: 'Второй' }]), { action: 'replace', slug: 'test-site' })))
    assert.equal((await data(await get(api))).sites[0].url, created.sites[0].url)
    await data(await api.PATCH(action('test-site', 'disable')))
    await assert.rejects(visible(f.root), { code: 'ENOENT' })
    await data(await api.PATCH(action('test-site', 'rollback')))
    assert.equal((await data(await get(api))).sites[0].enabled, false)
    await data(await api.PATCH(action('test-site', 'enable')))
    assert.match(await visible(f.root), /Первый/)
    await data(await api.PATCH(action('test-site', 'rollback')))
    assert.equal(await visible(f.root), 'Второй')
    assert.equal((await readdir(path.join(f.root, 'versions'))).length, 2)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('реальные handlers: роли и CSRF проверяются до чтения тела и диска', async () => {
  const f = await fixture({ MINI_SITES_ROOT: '/nonexistent-must-not-read' })
  try {
    const api = f.api()
    for (const role of [null, 'moder', 'client', 'ADMIN']) {
      f.role(role)
      for (const method of ['GET', 'POST', 'PATCH']) {
        const request = { headers: new Headers(), get body() { throw Error('Тело прочитано до auth') } }
        assert.equal((await api[method](request)).status, 403)
      }
    }
    for (const role of ['admin', 'dev']) {
      f.role(role)
      for (const origin of ['', 'null', 'https://test-site.actquest.ru', 'http://actquest.ru', 'https://evil.example']) {
        assert.equal((await api.POST(upload(zip(), undefined, { Origin: origin }))).status, 403)
        assert.equal((await api.PATCH(action('test-site', 'disable', {}, { Origin: origin }))).status, 403)
      }
    }
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('вредоносные архивы отклоняются и предыдущая публикация не повреждается', async () => {
  const f = await fixture()
  try {
    const api = f.api(); await data(await api.POST(upload()))
    const old = await readlink(path.join(f.root, 'active/test-site'))
    const cases = [Buffer.from('not zip'), zip([{ name: 'no.html' }]), ...['../index.html', '/index.html', 'C:/index.html', 'a\\index.html', '.env', 'package.json', 'archive.zip', 'script.php', 'index.html.', 'a//b.html', 'a/./b.html'].map(name => zip([{ name: 'index.html' }, { name }])), zip([{ name: 'index.html', mode: 0o120777 }]), zip([{ name: 'index.html', mode: 0o020666 }]), zip([{ name: 'index.html' }, { name: 'index.html' }]), zip([{ name: 'index.html' }, { name: 'INDEX.html' }]), zip([{ name: 'index.html' }, { name: 'a.js' }, { name: 'a.js/b.css' }])]
    for (const archive of cases) {
      const response = await api.POST(upload(archive, { action: 'replace', slug: 'test-site' }))
      assert.ok(response.status >= 400, 'архив принят ошибочно')
      assert.equal(await readlink(path.join(f.root, 'active/test-site')), old)
      assert.match(await visible(f.root), /Первый/)
      assert.deepEqual(await readdir(path.join(f.root, 'staging')), [])
    }
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('конкурентные операции и дубль slug', async () => {
  const f = await fixture()
  try {
    const api = f.api()
    const responses = await Promise.all([api.POST(upload()), api.POST(upload())])
    assert.equal(responses.filter(r => r.status === 200).length, 1)
    assert.ok(responses.some(r => r.status === 409))
    assert.match(await visible(f.root), /Первый/)
    assert.equal((await api.POST(upload())).status, 409)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('опасные конфиги и симлинки fail-closed', async () => {
  for (const config of [{ MINI_SITES_ROOT: '' }, { MINI_SITES_ROOT: process.cwd() }, { MINI_SITES_ROOT: '/' }, { MINI_SITES_BASE_DOMAIN: 'actquest.ru/path' }, { NEXTAUTH_URL: '' }, { NEXTAUTH_URL: 'https://test-site.actquest.ru' }]) {
    const f = await fixture(config)
    try { assert.ok((await f.api().POST(upload())).status >= 400) } finally { await rm(f.root, { recursive: true, force: true }) }
  }
  const f = await fixture()
  try {
    await mkdir(path.join(f.root, 'target')); await symlink(path.join(f.root, 'target'), path.join(f.root, 'staging'))
    assert.ok((await f.api().POST(upload())).status >= 400)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('реальные байты HTTP: chunked, поддельный Content-Length, oversize, abort и таймаут', async () => {
  const f = await fixture()
  try {
    const { PATCH, POST } = f.api()
    const { boundedBody } = f.load('@server/miniSites/http')
    function streamRequest(chunks, length) {
      let cancelled = false
      return { get cancelled() { return cancelled }, request: new Request('http://localhost', { method: 'POST', duplex: 'half', headers: length === undefined ? {} : { 'Content-Length': length }, body: new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk)); controller.close() }, cancel() { cancelled = true } }) }) }
    }
    for (const length of [undefined, '1', '100']) {
      const { request } = streamRequest([3, 5, 9], length)
      await assert.rejects(boundedBody(request, 10, AbortSignal.timeout(500)), error => error.status === 413)
    }
    await assert.rejects(boundedBody(streamRequest([2], '3').request, 10, AbortSignal.timeout(500)), error => error.status === 400)
    assert.equal((await boundedBody(streamRequest([3, 4]).request, 10, AbortSignal.timeout(500))).length, 7)
    let cancelled = false
    const stalled = new Request('http://localhost', { method: 'POST', duplex: 'half', body: new ReadableStream({ cancel() { cancelled = true } }) })
    const alive = setTimeout(() => {}, 200)
    await assert.rejects(boundedBody(stalled, 10, AbortSignal.timeout(30)), error => error.status === 408)
    clearTimeout(alive); assert.equal(cancelled, true)
    const controller = new AbortController(); controller.abort()
    assert.equal((await POST(new Request('http://localhost', { method: 'POST', signal: controller.signal, headers: { Origin: 'https://actquest.ru', 'Content-Type': 'multipart/form-data; boundary=test' }, body: 'abc' }))).status, 408)
    assert.equal((await PATCH(action('test-site', 'disable', {}, { 'Content-Length': '100000' }))).status, 413)
    // Настоящий oversized stream через POST; Origin и формат корректны, содержимое не успеет стать formData.
    const large = new Request('http://localhost', { method: 'POST', duplex: 'half', headers: { Origin: 'https://actquest.ru', 'Content-Type': 'multipart/form-data; boundary=test', 'Content-Length': '1' }, body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(21 * 1024 * 1024)); c.close() } }) })
    assert.equal((await POST(large)).status, 413)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('allowlist полей, типы, служебные slug, Host/forwarding не влияют на доверие', async () => {
  const f = await fixture()
  try {
    const api = f.api()
    for (const slug of ['www', 'api', 'kronosserver', 'kronosfinal', 'admin', 'cloud', 'sites', 'mail', 'UPPER', '-abc', 'abc-', 'a.b', '../site', 'a'.repeat(64)]) assert.equal((await api.POST(upload(zip(), { action: 'create', slug, name: 'test' }))).status, 400)
    assert.equal((await api.POST(upload(zip(), { action: 'create', slug: 'a', name: 'test', enabled: 'true' }))).status, 400)
    assert.equal((await api.PATCH(action('a', 'enable', { enabled: true }))).status, 400)
    assert.equal((await api.PATCH(action('a', 'create'))).status, 400)
    assert.equal((await api.PATCH(action('a', 'enable', {}, { 'Content-Type': 'text/plain' }))).status, 415)
    assert.equal((await api.POST(action('a', 'enable'))).status, 415)
    const form = new FormData(); for (const value of ['a', 'b']) form.append('slug', value); form.append('action', 'create')
    assert.equal((await api.POST(new Request('http://localhost', { method: 'POST', headers: { Origin: 'https://actquest.ru' }, body: form }))).status, 400)
    const result = await data(await api.POST(upload(zip(), undefined, { Host: 'evil.test', 'X-Forwarded-Host': 'evil.test', 'X-Forwarded-Proto': 'http' })))
    assert.equal(result.sites[0].url, 'https://test-site.actquest.ru')
    const res = await get(api)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.ok(!JSON.stringify(await res.json()).includes(f.root))
    assert.equal((await api.PATCH(action('test-site', 'enable', {}, { Origin: 'https://evil.test', 'X-Forwarded-Host': 'actquest.ru' }))).status, 403)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('лимиты распаковки, записи, CRC, методы, шифрование, фактический размер и cleanup', async () => {
  const f = await fixture()
  try {
    const api = f.api(); await data(await api.POST(upload()))
    const base = zip(); const central = base.indexOf(Buffer.from('504b0102', 'hex'))
    const encrypted = Buffer.from(base); encrypted.writeUInt16LE(1, central + 8)
    const unsupported = Buffer.from(base); unsupported.writeUInt16LE(12, central + 10)
    const crc = Buffer.from(base); crc.writeUInt32LE(123, central + 16)
    const fakeSmall = Buffer.from(zip([{ name: 'index.html', text: 'x'.repeat(10000) }])); const c = fakeSmall.indexOf(Buffer.from('504b0102', 'hex')); fakeSmall.writeUInt32LE(1, c + 24)
    const nul = Buffer.from(zip([{ name: 'index.html' }, { name: 'nXl.txt' }])); for (let i = nul.indexOf('nXl.txt'); i !== -1; i = nul.indexOf('nXl.txt', i + 1)) nul[i + 1] = 0
    const archives = [encrypted, unsupported, crc, fakeSmall, nul,
      zip([{ name: 'index.html', text: 'a'.repeat(20 * 1024 * 1024 + 1) }]),
      zip([{ name: 'index.html' }, ...Array.from({ length: 1000 }, (_, i) => ({ name: `f${i}.txt` }))]),
      zip([{ name: 'index.html' }, ...Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.txt`, text: 'a'.repeat(18 * 1024 * 1024) }))]),
    ]
    for (const archive of archives) {
      assert.ok((await api.POST(upload(archive, { action: 'replace', slug: 'test-site' }))).status >= 400)
      assert.match(await visible(f.root), /Первый/)
      assert.deepEqual(await readdir(path.join(f.root, 'staging')), [])
      assert.equal((await readdir(path.join(f.root, 'versions'))).length, 1)
    }
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('квота временного пика, резерв диска и настоящий ENOSPC при записи', async () => {
  const fs = await import('node:fs/promises')
  let noSpace = false, lowSpace = false, renameFailure = false
  const storageFs = { ...fs, statfs: async (...args) => lowSpace ? { bavail: 1, bsize: 1 } : fs.statfs(...args), open: async (filename, ...args) => {
    const handle = await fs.open(filename, ...args)
    if (!filename.endsWith('index.html')) return handle
    return { chmod: mode => handle.chmod(mode), stat: () => handle.stat(), writeFile: async (...values) => { if (noSpace) throw Object.assign(Error('disk full'), { code: 'ENOSPC' }); return handle.writeFile(...values) }, sync: () => handle.sync(), close: () => handle.close() }
  }, rename: async (from, to) => { if (renameFailure && to.endsWith('active/test-site')) throw Object.assign(Error('rename failed'), { code: 'EIO' }); return fs.rename(from, to) } }
  const f = await fixture({}, { 'node:fs/promises': storageFs })
  try {
    const api = f.api(); await data(await api.POST(upload()))
    const old = await readlink(path.join(f.root, 'active/test-site'))
    noSpace = true
    assert.equal((await api.POST(upload(zip(), { action: 'replace', slug: 'test-site' }))).status, 507)
    noSpace = false; lowSpace = true
    assert.equal((await api.POST(upload(zip(), { action: 'replace', slug: 'test-site' }))).status, 507)
    lowSpace = false; renameFailure = true
    assert.equal((await api.POST(upload(zip(), { action: 'replace', slug: 'test-site' }))).status, 503)
    renameFailure = false
    f.env.MINI_SITES_QUOTA_BYTES = '65540'
    assert.equal((await api.POST(upload(zip(), { action: 'replace', slug: 'test-site' }))).status, 413)
    assert.equal(await readlink(path.join(f.root, 'active/test-site')), old)
    assert.match(await visible(f.root), /Первый/)
    assert.deepEqual(await readdir(path.join(f.root, 'staging')), [])
    assert.equal((await readdir(path.join(f.root, 'versions'))).length, 1)
    assert.equal((await readdir(path.join(f.root, 'states'))).length, 1)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('только активная и предыдущая версии; выключенная замена; lock без автоперехвата', async () => {
  const f = await fixture()
  try {
    const api = f.api(); await data(await api.POST(upload()))
    for (let i = 2; i <= 4; i++) await data(await api.POST(upload(zip([{ name: 'index.html', text: `Версия ${i}` }]), { action: 'replace', slug: 'test-site' })))
    assert.equal((await readdir(path.join(f.root, 'versions'))).length, 2)
    assert.equal((await readdir(path.join(f.root, 'states'))).length, 1)
    await data(await api.PATCH(action('test-site', 'disable')))
    await data(await api.POST(upload(zip(), { action: 'replace', slug: 'test-site' })))
    assert.equal((await data(await get(api))).sites[0].enabled, false)
    await assert.rejects(visible(f.root), { code: 'ENOENT' })
    await mkdir(path.join(f.root, '.lock'))
    assert.equal((await api.PATCH(action('test-site', 'enable'))).status, 409)
    assert.ok((await readdir(f.root)).includes('.lock'))
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('серверная страница: guest redirect и роли, без чтения диска до auth', async () => {
  for (const role of [null, 'client', 'moder', 'admin', 'dev']) {
    const session = role ? { user: { role } } : null
    let reads = 0
    const f = await fixture({}, {
      'next-auth': { getServerSession: async () => session },
      'next/navigation': { redirect: url => { throw new Error(`redirect:${url}`) } },
      '@server/miniSites/storage': { listSites: async () => { reads++; return { configured: true, sites: [] } } },
      '@components/cabinet/app-router/MiniSitesPageClient': () => null,
    })
    try {
      const page = f.load('@app/cabinet/admin/mini-sites/page').default
      if (role === 'admin' || role === 'dev') { assert.ok(await page()); assert.equal(reads, 1) }
      else { await assert.rejects(page(), error => role === null ? error.message.startsWith('redirect:/cabinet/login?callbackUrl=') : error.message === 'redirect:/cabinet'); assert.equal(reads, 0) }
    } finally { await rm(f.root, { recursive: true, force: true }) }
  }
})

storageTest('abort во время распаковки убирает staging и сохраняет текущую версию', async () => {
  const fs = await import('node:fs/promises')
  const controller = new AbortController(); let interrupt = false
  const storageFs = { ...fs, open: async (filename, ...args) => {
    const handle = await fs.open(filename, ...args)
    if (!filename.endsWith('index.html')) return handle
    return { chmod: mode => handle.chmod(mode), stat: () => handle.stat(), writeFile: async (...values) => { if (interrupt) controller.abort(); return handle.writeFile(...values) }, sync: () => handle.sync(), close: () => handle.close() }
  } }
  const f = await fixture({}, { 'node:fs/promises': storageFs })
  try {
    await data(await f.api().POST(upload()))
    const old = await readlink(path.join(f.root, 'active/test-site'))
    interrupt = true
    await assert.rejects(f.store().mutateSite({ action: 'replace', slug: 'test-site', archive: zip([{ name: 'index.html', text: 'z'.repeat(1024 * 1024) }]), signal: controller.signal }), error => error.status === 408)
    assert.equal(await readlink(path.join(f.root, 'active/test-site')), old)
    assert.deepEqual(await readdir(path.join(f.root, 'staging')), [])
    assert.equal((await readdir(path.join(f.root, 'versions'))).length, 1)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})


storageTest('опасные права root/родителя и root-symlink отклоняются', async () => {
  const f = await fixture()
  try {
    await chmod(f.root, 0o777)
    assert.equal((await f.api().POST(upload())).status, 503)
    await chmod(f.root, 0o750)
    const link = path.join(f.root, 'linked')
    await mkdir(path.join(f.root, 'real'), { mode: 0o750 })
    await symlink(path.join(f.root, 'real'), link)
    f.env.MINI_SITES_ROOT = link
    assert.equal((await f.api().POST(upload())).status, 503)
    f.env.MINI_SITES_ROOT = path.join(f.root, 'real')
    await chmod(f.root, 0o777)
    assert.equal((await f.api().POST(upload())).status, 503)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('root и все существующие service dirs требуют setgid и group r-x до распаковки', async () => {
  for (const target of ['', 'staging', 'states', 'versions', 'active']) {
    for (const mode of [0o750, 0o2700, 0o2740, 0o2710]) {
      const f = await fixture()
      try {
        const folder = target ? path.join(f.root, target) : f.root
        if (target) await mkdir(folder)
        await chmod(folder, mode)
        const response = await f.api().POST(upload())
        assert.equal(response.status, 503, `${target || 'root'} ${mode.toString(8)}`)
        assert.match((await response.json()).error, /setgid/)
        assert.ok(!(await readdir(f.root)).includes('.lock'))
        if (target === 'staging') assert.deepEqual(await readdir(folder), [])
      } finally { await rm(f.root, { recursive: true, force: true }) }
    }
  }
})

storageTest('несовпадающий gid служебного каталога отклоняется до записи', async () => {
  const fs = await import('node:fs/promises'); let wrong = ''
  const f = await fixture({}, { 'node:fs/promises': { ...fs, lstat: async filename => {
    const info = await fs.lstat(filename)
    if (wrong && filename === wrong) Object.defineProperty(info, 'gid', { value: info.gid + 1 })
    return info
  } } })
  try {
    for (const name of ['staging', 'states', 'versions', 'active']) { await mkdir(path.join(f.root, name)); await chmod(path.join(f.root, name), 0o2750) }
    for (const name of ['staging', 'states', 'versions', 'active']) {
      wrong = path.join(f.root, name)
      assert.equal((await f.api().POST(upload())).status, 503)
      assert.ok(!(await readdir(f.root)).includes('.lock'))
    }
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

storageTest('фактическое наследование root gid и прав у файлов/директорий, в том числе после rename', async () => {
  const fs = await import('node:fs/promises')
  const f = await fixture()
  try {
    await data(await f.api().POST(upload(zip([{ name: 'index.html' }, { name: 'assets/deep/app.js', text: 'console.log("ok")' }]))))
    const gid = (await fs.lstat(f.root)).gid
    let files = 0, directories = 0
    async function check(folder) {
      const info = await fs.lstat(folder)
      assert.equal(info.gid, gid, folder)
      if (info.isSymbolicLink()) return
      if (info.isDirectory()) {
        directories++; assert.equal(info.mode & 0o2750, 0o2750, folder); assert.equal(info.mode & 0o022, 0)
        for (const name of await readdir(folder)) await check(path.join(folder, name))
      } else { files++; assert.equal(info.mode & 0o040, 0o040, folder); assert.equal(info.mode & 0o022, 0) }
    }
    await check(f.root)
    assert.ok(files >= 3); assert.ok(directories >= 9)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})
