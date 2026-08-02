import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const storyRoot = 'D:/ActQuest/Сюжеты/Последний эфир'
const scenesRoot = path.join(storyRoot, 'audio', 'scenes')
const audioManifestPath = path.join(
  projectRoot,
  'data',
  'storyLastBroadcastAudioManifest.json',
)
const outputManifestPath = path.join(
  projectRoot,
  'data',
  'storyLastBroadcastMediaManifest.json',
)

const loadEnv = (fileName) => {
  const filePath = path.resolve(projectRoot, fileName)
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnv('.env.local')
loadEnv('.env')

const apply = process.argv.includes('--apply')
const apiUrl = process.env.ESCALIONCLOUD_API_URL || 'https://cloud.escalion.ru/api'
const project =
  String(process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest').trim() ||
  'actquest'
const password = String(process.env.ESCALIONCLOUD_PASSWORD || '').trim()
const remoteRoot = `${project}/story-last-broadcast`

if (!password) throw new Error('Не задан ESCALIONCLOUD_PASSWORD')

const audioManifest = JSON.parse(fs.readFileSync(audioManifestPath, 'utf8'))
const previousManifest = fs.existsSync(outputManifestPath)
  ? JSON.parse(fs.readFileSync(outputManifestPath, 'utf8'))
  : null

const imageMaps = {
  cover: {
    game: 'cover-with-logo-stylized.png',
  },
  characters: {
    char_marina_lebedeva: '01-characters/marina-lebedeva.png',
    char_gleb_orlov: '01-characters/gleb-orlov.png',
    char_kirill_anokhin: '01-characters/kirill-anokhin.png',
    char_vera_zimina: '01-characters/vera-zimina.png',
    char_denis_karelin: '01-characters/denis-karelin.png',
    char_tamara_vorontsova: '01-characters/tamara-vorontsova.png',
    char_pavel_rogozov: '01-characters/pavel-rogozov.png',
  },
  locations: {
    loc_reception: '02-locations/reception-corridor.png',
    loc_studio_b: '02-locations/studio-b.png',
    loc_newsroom: '02-locations/newsroom-archive.png',
    loc_control_room: '02-locations/control-room.png',
    loc_loading_dock: '02-locations/loading-dock.png',
    loc_cafe: '02-locations/cafe-shum.png',
    loc_police_lab: '02-locations/mobile-lab.png',
  },
  items: {
    item_smartwatch: '03-items/smartwatch.png',
    item_audio_2005: '03-items/audio-2005.png',
    item_audio_1721: '03-items/soundcheck-1721.png',
    item_trophy: '03-items/golden-microphone-trophy.png',
  },
  endings: {
    ending_perfect_case: '04-finale/perfect-ending.png',
  },
}

const safeName = (value) =>
  String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

const findSceneDirectory = (number) => {
  const prefix = `${String(number).padStart(2, '0')}_`
  const matches = fs
    .readdirSync(scenesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
  if (matches.length !== 1) {
    throw new Error(`Для сцены ${number} найдено папок: ${matches.length}`)
  }
  return path.join(scenesRoot, matches[0].name)
}

const findGameAudio = (number) => {
  const mixDirectory = path.join(findSceneDirectory(number), 'mix')
  const matches = fs
    .readdirSync(mixDirectory)
    .filter((file) => /_game_.*\.mp3$/i.test(file))
  if (matches.length !== 1) {
    throw new Error(`Для сцены ${number} найдено игровых MP3: ${matches.length}`)
  }
  return path.join(mixDirectory, matches[0])
}

const probeDuration = (filePath) => {
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`ffprobe: ${result.stderr}`)
  return Number(Number(result.stdout.trim()).toFixed(3))
}

const jobs = []
for (const [group, values] of Object.entries(imageMaps)) {
  for (const [id, relativePath] of Object.entries(values)) {
    const localPath = path.join(storyRoot, relativePath)
    jobs.push({
      key: `image:${group}:${id}`,
      group,
      id,
      localPath,
      directory: `${remoteRoot}/images/${group}`,
      fileName: `${safeName(id)}.png`,
      type: 'image',
      mime: 'image/png',
      duration: 0,
      title: id,
    })
  }
}

for (const scene of audioManifest.scenes) {
  const targetId = String(scene.target?.id || `scene-${scene.number}`)
  jobs.push({
    key: `audio:${scene.number}:${scene.target?.type || 'scene'}:${targetId}`,
    group: 'scenes',
    id: targetId,
    sceneNumber: scene.number,
    target: scene.target,
    localPath: findGameAudio(scene.number),
    directory: `${remoteRoot}/audio/scenes`,
    fileName: `${String(scene.number).padStart(2, '0')}_${safeName(targetId)}.mp3`,
    type: 'audio',
    mime: 'audio/mpeg',
    duration: probeDuration(findGameAudio(scene.number)),
    title: scene.title,
  })
}

for (const job of jobs) {
  if (!fs.existsSync(job.localPath)) throw new Error(`Нет файла ${job.localPath}`)
  job.size = fs.statSync(job.localPath).size
}

const previousByKey = new Map(
  (previousManifest?.files || []).map((file) => [file.key, file]),
)
const results = []
let uploaded = 0
let skipped = 0

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const uploadRequest = async (job) => {
  let lastError = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const formData = new FormData()
      formData.append('directory', job.directory)
      formData.append('fileName', job.fileName)
      formData.append(
        'files',
        await fs.openAsBlob(job.localPath, { type: job.mime }),
        job.fileName,
      )
      return await fetch(apiUrl, {
        method: 'POST',
        headers: { 'x-api-password': password },
        body: formData,
      })
    } catch (error) {
      lastError = error
      if (attempt < 4) {
        console.log(`  повтор ${attempt}/3 после ошибки сети: ${job.key}`)
        await delay(attempt * 1500)
      }
    }
  }
  throw lastError
}

const upload = async (job, index) => {
  const previous = previousByKey.get(job.key)
  if (
    previous?.url &&
    previous.size === job.size &&
    previous.fileName === job.fileName
  ) {
    skipped += 1
    console.log(`[${index + 1}/${jobs.length}] skip ${job.key}`)
    return { ...job, url: previous.url, path: previous.path || '' }
  }

  if (!apply) {
    console.log(`[${index + 1}/${jobs.length}] preview ${job.key}`)
    return { ...job, url: '', path: '' }
  }

  console.log(`[${index + 1}/${jobs.length}] upload ${job.key}`)
  const response = await uploadRequest(job)
  const raw = await response.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = null
  }
  if (!response.ok) {
    throw new Error(`EscalionCloud ${response.status}: ${raw.slice(0, 1000)}`)
  }
  const url = Array.isArray(body)
    ? body[0]
    : Array.isArray(body?.data)
      ? body.data[0]
      : body?.url || body?.data?.url || ''
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error(`EscalionCloud не вернул URL для ${job.key}: ${raw.slice(0, 1000)}`)
  }
  uploaded += 1
  const pathname = new URL(url).pathname.replace(/^\/uploads\//, '')
  return { ...job, url, path: pathname }
}

// Последовательная загрузка предсказуема для облака и упрощает безопасный resume.
for (const [index, job] of jobs.entries()) {
  const result = await upload(job, index)
  results.push(result)
  if (apply) {
    const manifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      project,
      remoteRoot,
      files: results.map((file) => ({
        key: file.key,
        group: file.group,
        id: file.id,
        sceneNumber: file.sceneNumber || null,
        target: file.target || null,
        fileName: file.fileName,
        type: file.type,
        mime: file.mime,
        size: file.size,
        duration: file.duration,
        title: file.title,
        url: file.url,
        path: file.path,
      })),
    }
    fs.writeFileSync(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
}

console.log(
  JSON.stringify(
    {
      completed: true,
      apply,
      total: jobs.length,
      uploaded,
      skipped,
      outputManifestPath,
    },
    null,
    2,
  ),
)
