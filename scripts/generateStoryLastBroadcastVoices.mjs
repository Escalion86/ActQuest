import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

const projectRoot = process.cwd()
const manifestPath = path.join(
  projectRoot,
  'data',
  'storyLastBroadcastAudioManifest.json',
)

const loadEnv = (fileName) => {
  const filePath = path.resolve(projectRoot, fileName)
  if (!fs.existsSync(filePath)) return
  fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const separator = trimmed.indexOf('=')
      if (separator <= 0) return
      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    })
}

loadEnv('.env.local')
loadEnv('.env')

const getArgument = (name, fallback = '') => {
  const inline = process.argv.find((argument) =>
    argument.startsWith(`--${name}=`),
  )
  if (inline) return inline.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] || fallback : fallback
}

const hasFlag = (name) => process.argv.includes(`--${name}`)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const apply = hasFlag('apply')
const force = hasFlag('force')
const skipVoiceCheck = hasFlag('skip-voice-check')
const selectedSceneNumbers = new Set(
  getArgument('scene')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter(Number.isFinite),
)
const requestLimit = Math.max(0, Number(getArgument('limit', '0')) || 0)
const requestDelayMs = Math.max(0, Number(getArgument('delay', '650')) || 0)
const outputFormat =
  getArgument('format') || manifest.generation.outputFormat || 'mp3_44100_128'
const outputRoot = path.resolve(
  getArgument('output') || path.join(manifest.audioRoot, 'voices', 'raw'),
)
const apiBase = (
  getArgument('api-base') || 'https://api.elevenlabs.io'
).replace(/\/+$/, '')
const historyId = getArgument('history-id').trim()
const historyOutput = getArgument('history-output').trim()
const maxCharacters = Number(
  manifest.generation.maxCharactersPerRequest || 2000,
)

const extensionForFormat = (format) => {
  if (format.startsWith('mp3_')) return 'mp3'
  if (format.startsWith('opus_')) return 'opus'
  if (format.startsWith('wav_')) return 'wav'
  if (format.startsWith('pcm_')) return 'pcm'
  if (format.startsWith('ulaw_')) return 'ulaw'
  if (format.startsWith('alaw_')) return 'alaw'
  throw new Error(`Неизвестный output format: ${format}`)
}

const audioExtension = extensionForFormat(outputFormat)
const normalizeFileStem = (value) =>
  value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

const stableSeed = (value) =>
  crypto.createHash('sha256').update(value).digest().readUInt32BE(0)

const contentHash = (payload) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 12)

const buildDialogueChunks = (scene) => {
  const groups = []
  let current = []
  const flush = () => {
    if (current.length > 0) groups.push(current)
    current = []
  }

  scene.timeline.forEach((item) => {
    if (item.kind !== 'voice' || item.generate === false) {
      flush()
      return
    }
    current.push(item)
  })
  flush()

  const chunks = []
  groups.forEach((group) => {
    let chunk = []
    let characters = 0
    group.forEach((item) => {
      const itemCharacters = item.text.length
      if (itemCharacters > maxCharacters) {
        throw new Error(
          `Сцена ${scene.number}: одна реплика длиннее ${maxCharacters} символов`,
        )
      }
      if (chunk.length > 0 && characters + itemCharacters > maxCharacters) {
        chunks.push(chunk)
        chunk = []
        characters = 0
      }
      chunk.push(item)
      characters += itemCharacters
    })
    if (chunk.length > 0) chunks.push(chunk)
  })
  return chunks
}

const createJob = ({ key, directory, inputs, sceneNumber = null }) => {
  const payload = {
    inputs: inputs.map((input) => ({
      text: input.text,
      voice_id: manifest.voices[input.role].voiceId,
    })),
    model_id: manifest.generation.modelId,
    language_code: manifest.generation.languageCode,
    apply_text_normalization: 'auto',
  }
  payload.seed = stableSeed(JSON.stringify(payload))
  const hash = contentHash({ outputFormat, ...payload })
  const baseName = `${normalizeFileStem(key)}-${hash}`
  return {
    key,
    sceneNumber,
    directory,
    inputs,
    payload,
    hash,
    audioPath: path.join(directory, `${baseName}.${audioExtension}`),
    metadataPath: path.join(directory, `${baseName}.json`),
    characters: inputs.reduce((sum, input) => sum + input.text.length, 0),
  }
}

const selectedScenes = manifest.scenes.filter(
  (scene) =>
    selectedSceneNumbers.size === 0 || selectedSceneNumbers.has(scene.number),
)

if (selectedSceneNumbers.size > 0 && selectedScenes.length !== selectedSceneNumbers.size) {
  const found = new Set(selectedScenes.map((scene) => scene.number))
  const missing = [...selectedSceneNumbers].filter((number) => !found.has(number))
  throw new Error(`Не найдены сцены: ${missing.join(', ')}`)
}

const jobs = []
if (selectedSceneNumbers.size === 0 || selectedSceneNumbers.has(1)) {
  const sharedAsset = manifest.sharedAssets['INS-01']
  jobs.push(
    createJob({
      key: 'ins-01-artem-master-voice',
      directory: path.join(outputRoot, 'shared'),
      inputs: [{ role: sharedAsset.voiceRole, text: sharedAsset.voiceText }],
    }),
  )
}

selectedScenes.forEach((scene) => {
  const chunks = buildDialogueChunks(scene)
  chunks.forEach((inputs, index) => {
    const stem = normalizeFileStem(scene.file || `scene-${scene.number}`)
    jobs.push(
      createJob({
        key: `${String(scene.number).padStart(2, '0')}-${stem}-part-${String(index + 1).padStart(2, '0')}`,
        directory: path.join(
          outputRoot,
          `${String(scene.number).padStart(2, '0')}-${stem}`,
        ),
        inputs,
        sceneNumber: scene.number,
      }),
    )
  })
})

const selectedJobs = requestLimit > 0 ? jobs.slice(0, requestLimit) : jobs
const totalsByRole = {}
selectedJobs.forEach((job) => {
  job.inputs.forEach((input) => {
    totalsByRole[input.role] = (totalsByRole[input.role] || 0) + input.text.length
  })
})

console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      model: manifest.generation.modelId,
      outputFormat,
      outputRoot,
      historyId: historyId || null,
      scenes: selectedScenes.length,
      requests: selectedJobs.length,
      characters: selectedJobs.reduce((sum, job) => sum + job.characters, 0),
      charactersByRole: Object.fromEntries(
        Object.entries(totalsByRole).map(([role, characters]) => [
          manifest.voices[role].name,
          characters,
        ]),
      ),
    },
    null,
    2,
  ),
)

if (!apply) {
  console.log(
    'Это только предварительная проверка. Для платной генерации добавьте --apply.',
  )
  process.exit(0)
}

const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
if (!apiKey) {
  throw new Error(
    'Не задан ELEVENLABS_API_KEY. Добавьте его локально в .env.local и не публикуйте файл.',
  )
}

const requestHeaders = {
  'Content-Type': 'application/json',
  'xi-api-key': apiKey,
}

if (historyId) {
  if (!historyOutput) {
    throw new Error(
      'Для загрузки из истории задайте --history-output=<путь к файлу>.',
    )
  }

  const targetPath = path.resolve(historyOutput)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  const response = await fetch(
    `${apiBase}/v1/history/${encodeURIComponent(historyId)}/audio`,
    {
      headers: {
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
    },
  )
  if (!response.ok) {
    const details = (await response.text()).slice(0, 1500)
    throw new Error(
      `Не удалось загрузить генерацию ${historyId}: ${response.status} ${details}`,
    )
  }

  const tempPath = `${targetPath}.tmp`
  fs.writeFileSync(tempPath, Buffer.from(await response.arrayBuffer()))
  fs.renameSync(tempPath, targetPath)
  console.log(
    JSON.stringify(
      {
        completed: true,
        historyId,
        output: targetPath,
        bytes: fs.statSync(targetPath).size,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

if (!skipVoiceCheck) {
  console.log('Проверяю доступность сохранённых голосов...')
  for (const [role, voice] of Object.entries(manifest.voices)) {
    const response = await fetch(
      `${apiBase}/v1/voices/${encodeURIComponent(voice.voiceId)}`,
      { headers: { 'xi-api-key': apiKey } },
    )
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500)
      throw new Error(
        `Голос «${voice.name}» (${voice.voiceId}) недоступен: ${response.status} ${details}`,
      )
    }
    const remoteVoice = await response.json()
    console.log(`  ${voice.name}: ${remoteVoice.name || role} (${voice.voiceId})`)
  }
}

let generated = 0
let skipped = 0

for (const [index, job] of selectedJobs.entries()) {
  fs.mkdirSync(job.directory, { recursive: true })
  if (!force && fs.existsSync(job.audioPath) && fs.existsSync(job.metadataPath)) {
    console.log(`[${index + 1}/${selectedJobs.length}] skip ${job.key}`)
    skipped += 1
    continue
  }

  console.log(
    `[${index + 1}/${selectedJobs.length}] generate ${job.key} (${job.characters} символов)`,
  )
  const url = new URL(
    `${apiBase}/v1/text-to-dialogue/with-timestamps`,
  )
  url.searchParams.set('output_format', outputFormat)

  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(job.payload),
  })
  if (!response.ok) {
    const details = (await response.text()).slice(0, 1500)
    throw new Error(
      `ElevenLabs отклонил ${job.key}: ${response.status} ${details}`,
    )
  }

  const result = await response.json()
  if (!result.audio_base64) {
    throw new Error(`ElevenLabs не вернул audio_base64 для ${job.key}`)
  }

  const audioTempPath = `${job.audioPath}.tmp`
  const metadataTempPath = `${job.metadataPath}.tmp`
  fs.writeFileSync(audioTempPath, Buffer.from(result.audio_base64, 'base64'))
  fs.writeFileSync(
    metadataTempPath,
    `${JSON.stringify(
      {
        key: job.key,
        sceneNumber: job.sceneNumber,
        hash: job.hash,
        generatedAt: new Date().toISOString(),
        requestId:
          response.headers.get('request-id') ||
          response.headers.get('x-request-id') ||
          null,
        modelId: manifest.generation.modelId,
        outputFormat,
        characters: job.characters,
        inputs: job.inputs,
        voiceSegments: result.voice_segments || [],
        alignment: result.alignment || null,
        normalizedAlignment: result.normalized_alignment || null,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  fs.renameSync(audioTempPath, job.audioPath)
  fs.renameSync(metadataTempPath, job.metadataPath)
  generated += 1

  if (requestDelayMs > 0 && index + 1 < selectedJobs.length) {
    await delay(requestDelayMs)
  }
}

console.log(
  JSON.stringify(
    {
      completed: true,
      generated,
      skipped,
      outputRoot,
    },
    null,
    2,
  ),
)
