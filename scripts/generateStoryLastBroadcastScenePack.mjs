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
const apply = hasFlag('apply')
const checkOnly = hasFlag('check-only')
const prepare = apply || hasFlag('prepare')
const force = hasFlag('force')
const skipVoiceCheck = hasFlag('skip-voice-check')
const requestDelayMs = Math.max(0, Number(getArgument('delay', '700')) || 0)
const requestLimit = Math.max(0, Number(getArgument('limit', '0')) || 0)
const apiBase = (
  getArgument('api-base') || 'https://api.elevenlabs.io'
).replace(/\/+$/, '')

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const outputFormat =
  getArgument('format') || manifest.generation.outputFormat || 'mp3_44100_128'
const outputRoot = path.resolve(
  getArgument('output') || path.join(manifest.audioRoot, 'scenes'),
)
const maxCharacters = Number(
  manifest.generation.maxCharactersPerRequest || 2000,
)
const selectedSceneNumbers = new Set(
  getArgument('scene')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter(Number.isFinite),
)

const selectedScenes = manifest.scenes.filter(
  (scene) =>
    selectedSceneNumbers.size === 0 || selectedSceneNumbers.has(scene.number),
)
if (
  selectedSceneNumbers.size > 0 &&
  selectedScenes.length !== selectedSceneNumbers.size
) {
  const found = new Set(selectedScenes.map((scene) => scene.number))
  const missing = [...selectedSceneNumbers].filter((number) => !found.has(number))
  throw new Error(`Не найдены сцены: ${missing.join(', ')}`)
}

const pad = (value, width = 2) => String(value).padStart(width, '0')
const normalizeFileStem = (value) =>
  value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

const stableSeed = (value) =>
  crypto.createHash('sha256').update(value).digest().readUInt32BE(0)

const extensionForFormat = (format) => {
  if (format.startsWith('mp3_')) return 'mp3'
  if (format.startsWith('opus_')) return 'opus'
  if (format.startsWith('wav_')) return 'wav'
  if (format.startsWith('pcm_')) return 'pcm'
  throw new Error(`Неизвестный output format: ${format}`)
}

const audioExtension = extensionForFormat(outputFormat)
const extractSfxIds = (text) => text.match(/SFX-\d+[A-Z]?/g) || []

const splitInputs = (inputs) => {
  const chunks = []
  let chunk = []
  let characters = 0
  inputs.forEach((input) => {
    if (input.text.length > maxCharacters) {
      throw new Error(
        `Реплика «${input.speaker}» длиннее ${maxCharacters} символов`,
      )
    }
    if (chunk.length > 0 && characters + input.text.length > maxCharacters) {
      chunks.push(chunk)
      chunk = []
      characters = 0
    }
    chunk.push(input)
    characters += input.text.length
  })
  if (chunk.length > 0) chunks.push(chunk)
  return chunks
}

const buildPayload = (inputs) => {
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
  return payload
}

const buildScenePlan = (scene) => {
  const sceneStem = `${pad(scene.number)}_${normalizeFileStem(scene.file)}`
  const directory = path.join(outputRoot, sceneStem)
  const voiceDirectory = path.join(directory, 'voice')
  const sfxDirectory = path.join(directory, 'sfx')
  const jobs = []
  const timeline = []
  const sfxIds = new Set()
  let pendingInputs = []

  const addVoiceJob = (inputs, options = {}) => {
    splitInputs(inputs).forEach((chunk) => {
      const number = jobs.length + 1
      const roles = [...new Set(chunk.map((input) => input.role))]
      const roleStem = roles.join('-') || 'voice'
      const fileName = `voice_${pad(number)}_${roleStem}.${audioExtension}`
      const payload = buildPayload(chunk)
      const job = {
        key: `${sceneStem}-voice-${pad(number)}`,
        sceneNumber: scene.number,
        number,
        inputs: chunk,
        payload,
        characters: chunk.reduce((sum, input) => sum + input.text.length, 0),
        fileName,
        relativePath: path.join('voice', fileName).replaceAll('\\', '/'),
        audioPath: path.join(voiceDirectory, fileName),
        metadataPath: path.join(
          voiceDirectory,
          fileName.replace(/\.[^.]+$/, '.json'),
        ),
        sharedAsset: options.sharedAsset || null,
      }
      jobs.push(job)
      timeline.push({ kind: 'voice', job })
    })
  }

  const flushVoice = () => {
    if (pendingInputs.length === 0) return
    addVoiceJob(pendingInputs)
    pendingInputs = []
  }

  scene.timeline.forEach((item) => {
    if (item.kind === 'voice' && item.generate !== false) {
      pendingInputs.push(item)
      return
    }

    flushVoice()
    if (item.kind === 'cue') {
      extractSfxIds(item.text).forEach((id) => sfxIds.add(id))
      timeline.push({ kind: 'cue', text: item.text })
      return
    }

    if (item.kind === 'voice' && item.sharedAsset) {
      const shared = manifest.sharedAssets[item.sharedAsset]
      if (!shared) {
        throw new Error(`Не найдена мастер-вставка ${item.sharedAsset}`)
      }
      shared.composition
        .filter((part) => part.kind === 'sfx')
        .forEach((part) => sfxIds.add(part.id))
      addVoiceJob(
        [
          {
            role: shared.voiceRole,
            speaker: manifest.voices[shared.voiceRole].name,
            text: shared.voiceText,
          },
        ],
        { sharedAsset: item.sharedAsset },
      )
    }
  })
  flushVoice()

  return {
    scene,
    sceneStem,
    directory,
    voiceDirectory,
    sfxDirectory,
    jobs,
    timeline,
    sfxIds: [...sfxIds],
  }
}

const scenePlans = selectedScenes.map(buildScenePlan)
const sharedCanonicalJobs = new Map()
const sharedAliasJobs = []
scenePlans.flatMap((plan) => plan.jobs).forEach((job) => {
  if (!job.sharedAsset) return
  const canonical = sharedCanonicalJobs.get(job.sharedAsset)
  if (canonical) {
    job.aliasOf = canonical
    sharedAliasJobs.push(job)
  } else {
    sharedCanonicalJobs.set(job.sharedAsset, job)
  }
})
const allJobs = scenePlans
  .flatMap((plan) => plan.jobs)
  .filter((job) => !job.aliasOf)
const selectedJobs = requestLimit > 0 ? allJobs.slice(0, requestLimit) : allJobs
const totalCharacters = selectedJobs.reduce((sum, job) => sum + job.characters, 0)
const pendingJobs = selectedJobs.filter((job) => {
  if (force) return true
  return !(fs.existsSync(job.audioPath) && fs.existsSync(job.metadataPath))
})
const pendingCharacters = pendingJobs.reduce(
  (sum, job) => sum + job.characters,
  0,
)

const describeInputs = (inputs) =>
  inputs
    .map(
      (input) =>
        `- **${input.speaker || manifest.voices[input.role].name}:** ${input.text}`,
    )
    .join('\n')

const buildInstructions = (plan) => {
  const { scene } = plan
  const lines = [
    `# ${pad(scene.number)}. ${scene.title}`,
    '',
    `- **Локация:** ${scene.location || 'не указана'}`,
    `- **Назначение:** ${scene.target?.type || 'scene'} / ${scene.target?.id || '—'}`,
    `- **Модель голосов:** ${manifest.generation.modelId}`,
    `- **Формат исходников:** ${outputFormat}`,
    '',
    '## Рекомендуемые базовые параметры проекта',
    '',
    '- Рабочая частота проекта: 48 кГц, stereo.',
    '- Речь: ориентир −16 LUFS integrated, true peak не выше −1 dBTP.',
    '- Постоянный фон под речью: обычно −30…−26 dB; точные указания сцены важнее этого ориентира.',
    '- Точечные SFX: начните с −18…−12 dB и подстройте на слух, не перекрывая слова.',
    '- На стыках используйте короткие fade 10–30 мс; для фоновых дорожек соблюдайте fade из сценария.',
    '- Финальный экспорт после сведения: WAV 48 кГц/24 bit для мастера, MP3 192–256 kbps для игры.',
    '',
    '## Последовательность монтажа',
    '',
  ]

  plan.timeline.forEach((item, index) => {
    const step = index + 1
    if (item.kind === 'cue') {
      lines.push(`${step}. **Режиссёрская/монтажная команда:** ${item.text}`)
    } else {
      const sharedLabel = item.job.sharedAsset
        ? ` — голосовая часть ${item.job.sharedAsset}`
        : ''
      lines.push(
        `${step}. Поставить \`${item.job.relativePath}\`${sharedLabel}.`,
      )
    }
  })

  const sharedJobs = plan.jobs.filter((job) => job.sharedAsset)
  sharedJobs.forEach((job) => {
    const shared = manifest.sharedAssets[job.sharedAsset]
    lines.push('', `## Состав вставки ${job.sharedAsset}`, '')
    shared.composition.forEach((part, index) => {
      if (part.kind === 'sfx') {
        const sfx = manifest.sfx[part.id]
        lines.push(
          `${index + 1}. SFX \`sfx/${sfx.file}\` — ${sfx.title}.`,
        )
      } else if (part.kind === 'silence') {
        lines.push(`${index + 1}. Тишина ${part.seconds} с.`)
      } else if (part.kind === 'voice') {
        lines.push(`${index + 1}. Голос \`${job.relativePath}\`.`)
      }
    })
  })

  lines.push('', '## Голосовые блоки и исходный текст', '')
  plan.jobs.forEach((job) => {
    lines.push(
      `### ${job.relativePath}`,
      '',
      `Символов: ${job.characters}. Голоса: ${[
        ...new Set(job.inputs.map((input) => input.speaker)),
      ].join(', ')}.`,
      '',
      describeInputs(job.inputs),
      '',
    )
  })

  lines.push('## SFX этой сцены', '')
  if (plan.sfxIds.length === 0) {
    lines.push('В этой сцене отдельные SFX не предусмотрены.', '')
  } else {
    plan.sfxIds.forEach((id) => {
      const sfx = manifest.sfx[id]
      lines.push(`- **${id}:** \`sfx/${sfx.file}\` — ${sfx.title}.`)
    })
    lines.push('')
  }

  lines.push(
    '## Контроль перед экспортом',
    '',
    '- Проверьте, что ни один SFX не маскирует согласные и окончания слов.',
    '- Прослушайте сцену в наушниках и на обычном динамике.',
    '- Уберите щелчки на монтажных стыках и проверьте отсутствие клиппинга.',
    '- Сохраните несжатый мастер отдельно от игрового MP3.',
    '',
  )
  return `${lines.join('\n')}\n`
}

const prepareScenePack = () => {
  fs.mkdirSync(outputRoot, { recursive: true })
  scenePlans.forEach((plan) => {
    fs.mkdirSync(plan.voiceDirectory, { recursive: true })
    fs.mkdirSync(plan.sfxDirectory, { recursive: true })
    plan.sfxIds.forEach((id) => {
      const sfx = manifest.sfx[id]
      if (!sfx) throw new Error(`Не найдено описание ${id}`)
      const source = path.join(manifest.audioRoot, 'sfx', sfx.file)
      const target = path.join(plan.sfxDirectory, sfx.file)
      if (!fs.existsSync(source)) {
        throw new Error(`Не найден SFX-файл: ${source}`)
      }
      fs.copyFileSync(source, target)
    })
    fs.writeFileSync(
      path.join(plan.directory, 'МОНТАЖ.md'),
      buildInstructions(plan),
      'utf8',
    )
  })

  const indexLines = [
    '# «Последний эфир» — пакет голосов и монтажных сценариев',
    '',
    `Сцен: ${scenePlans.length}. Голосовых API-блоков: ${allJobs.length}. Файлов в папках сцен: ${scenePlans.flatMap((plan) => plan.jobs).length}.`,
    `Всего символов: ${allJobs.reduce((sum, job) => sum + job.characters, 0)}.`,
    '',
    'Каждая папка содержит:',
    '',
    '- `voice/` — сгенерированные голосовые блоки и JSON-метаданные;',
    '- `sfx/` — копии необходимых эффектов;',
    '- `МОНТАЖ.md` — точная последовательность и параметры сведения.',
    '',
    '## Сцены',
    '',
    ...scenePlans.map(
      (plan) =>
        `- [${pad(plan.scene.number)}. ${plan.scene.title}](<${plan.sceneStem}/МОНТАЖ.md>)`,
    ),
    '',
  ]
  fs.writeFileSync(path.join(outputRoot, 'README.md'), indexLines.join('\n'), 'utf8')
  fs.writeFileSync(
    path.join(outputRoot, 'scene-pack-manifest.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        modelId: manifest.generation.modelId,
        outputFormat,
        scenes: scenePlans.map((plan) => ({
          number: plan.scene.number,
          title: plan.scene.title,
          directory: plan.sceneStem,
          jobs: plan.jobs.map((job) => ({
            key: job.key,
            file: job.relativePath,
            characters: job.characters,
            speakers: job.inputs.map((input) => input.speaker),
            copiedFromShared: job.aliasOf?.sharedAsset || null,
          })),
          sfx: plan.sfxIds,
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

console.log(
  JSON.stringify(
    {
      mode: apply
        ? 'apply'
        : checkOnly
          ? 'check-only'
          : prepare
            ? 'prepare'
            : 'dry-run',
      apiBase,
      modelId: manifest.generation.modelId,
      outputFormat,
      outputRoot,
      scenes: scenePlans.length,
      requests: selectedJobs.length,
      characters: totalCharacters,
      pendingRequests: pendingJobs.length,
      pendingCharacters,
    },
    null,
    2,
  ),
)

if (prepare) {
  prepareScenePack()
  console.log(`Структура сцен подготовлена: ${outputRoot}`)
}

if (!apply && !checkOnly) {
  console.log(
    prepare
      ? 'Аудио не генерировалось. Для запуска API добавьте --apply.'
      : 'Это предварительная проверка без записи файлов и расхода кредитов.',
  )
  process.exit(0)
}

const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
if (!apiKey) {
  throw new Error('Не задан ELEVENLABS_API_KEY в .env.local.')
}

const authHeaders = { 'xi-api-key': apiKey }
const subscriptionResponse = await fetch(`${apiBase}/v1/user/subscription`, {
  headers: authHeaders,
})
if (!subscriptionResponse.ok) {
  const details = (await subscriptionResponse.text()).slice(0, 800)
  throw new Error(
    `Не удалось проверить подписку: ${subscriptionResponse.status} ${details}`,
  )
}
const subscription = await subscriptionResponse.json()
const characterLimit = Number(subscription.character_limit)
const characterCount = Number(subscription.character_count)
const charactersRemaining = characterLimit - characterCount
console.log(
  JSON.stringify(
    {
      subscription: subscription.tier || null,
      characterLimit,
      characterCount,
      charactersRemaining,
      requestedCharacters: pendingCharacters,
    },
    null,
    2,
  ),
)
if (
  Number.isFinite(charactersRemaining) &&
  charactersRemaining < pendingCharacters
) {
  throw new Error(
    `Недостаточно кредитов: доступно ${charactersRemaining}, требуется ${pendingCharacters}.`,
  )
}

if (!skipVoiceCheck) {
  console.log('Проверяю сохранённые голоса...')
  for (const [role, voice] of Object.entries(manifest.voices)) {
    const response = await fetch(
      `${apiBase}/v1/voices/${encodeURIComponent(voice.voiceId)}`,
      { headers: authHeaders },
    )
    if (!response.ok) {
      const details = (await response.text()).slice(0, 800)
      throw new Error(
        `Голос «${voice.name}» недоступен: ${response.status} ${details}`,
      )
    }
    const remoteVoice = await response.json()
    console.log(`  ${voice.name}: ${remoteVoice.name || role}`)
  }
}

if (checkOnly) {
  console.log('Проверка API и доступных кредитов завершена без генерации.')
  process.exit(0)
}

let generated = 0
let skipped = 0
for (const [index, job] of selectedJobs.entries()) {
  const audioExists = fs.existsSync(job.audioPath)
  const metadataExists = fs.existsSync(job.metadataPath)
  if (!force && audioExists && metadataExists) {
    console.log(`[${index + 1}/${selectedJobs.length}] skip ${job.key}`)
    skipped += 1
    continue
  }
  if (!force && audioExists !== metadataExists) {
    throw new Error(
      `Неполный результат ${job.key}. Проверьте ${job.audioPath} и ${job.metadataPath}.`,
    )
  }

  console.log(
    `[${index + 1}/${selectedJobs.length}] generate ${job.key} (${job.characters} символов)`,
  )
  const url = new URL(`${apiBase}/v1/text-to-dialogue/with-timestamps`)
  url.searchParams.set('output_format', outputFormat)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
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

for (const alias of sharedAliasJobs) {
  const canonical = alias.aliasOf
  if (!fs.existsSync(canonical.audioPath) || !fs.existsSync(canonical.metadataPath)) {
    continue
  }
  fs.copyFileSync(canonical.audioPath, alias.audioPath)
  const canonicalMetadata = JSON.parse(
    fs.readFileSync(canonical.metadataPath, 'utf8'),
  )
  fs.writeFileSync(
    alias.metadataPath,
    `${JSON.stringify(
      {
        ...canonicalMetadata,
        key: alias.key,
        sceneNumber: alias.sceneNumber,
        copiedFrom: canonical.audioPath,
        sharedAsset: alias.sharedAsset,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
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
