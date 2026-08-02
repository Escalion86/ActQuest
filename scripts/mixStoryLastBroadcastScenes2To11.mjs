import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const scenesRoot =
  'D:/ActQuest/Сюжеты/Последний эфир/audio/scenes'
const sceneNumbers = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} завершился с кодом ${result.status}\n${result.stderr || result.stdout}`,
    )
  }
  return result
}

const probeDuration = (filePath) => {
  const result = run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ])
  return Number(result.stdout.trim())
}

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

const findOnlyVoice = (sceneDirectory) => {
  const voiceDirectory = path.join(sceneDirectory, 'voice')
  const files = fs
    .readdirSync(voiceDirectory)
    .filter((file) => /^voice_.*\.mp3$/i.test(file))
  if (files.length !== 1) {
    throw new Error(
      `В ${voiceDirectory} ожидался один голосовой MP3, найдено ${files.length}`,
    )
  }
  return path.join(voiceDirectory, files[0])
}

const measureLoudness = (filePath) => {
  const result = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    'loudnorm=I=-15.8:TP=-1.5:LRA=11:print_format=json',
    '-f',
    'null',
    'NUL',
  ])
  const match = result.stderr.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error(`Не удалось измерить громкость ${filePath}`)
  return JSON.parse(match[0])
}

const verifyLoudness = (filePath) => {
  const measured = measureLoudness(filePath)
  return {
    integratedLufs: Number(measured.input_i),
    truePeakDbtp: Number(measured.input_tp),
    lraLu: Number(measured.input_lra),
    durationSeconds: probeDuration(filePath),
  }
}

const finalizeMix = (premaster, master, game) => {
  const measured = measureLoudness(premaster)
  const filter = [
    'loudnorm=I=-15.8:TP=-1.5:LRA=11',
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':')

  run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    premaster,
    '-af',
    filter,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_s24le',
    master,
  ])
  run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-i',
    master,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '256k',
    '-ar',
    '48000',
    '-ac',
    '2',
    game,
  ])
}

const mixSimpleScene = (sceneDirectory, premaster) => {
  const background = path.join(
    sceneDirectory,
    'sfx',
    'sfx_03_reception_corridor_bed.mp3',
  )
  const voice = findOnlyVoice(sceneDirectory)
  const voiceStart = 0.7
  const voiceDuration = probeDuration(voice)
  const duration = voiceStart + voiceDuration + 1
  const fadeOutStart = duration - 1

  const filter = [
    `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${duration.toFixed(3)},volume=12dB,afade=t=in:st=0:d=0.7,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=1[bg]`,
    '[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=700:all=1[voice]',
    `[bg][voice]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,atrim=0:${duration.toFixed(3)}[aout]`,
  ].join(';')

  run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-stream_loop',
    '-1',
    '-i',
    background,
    '-i',
    voice,
    '-filter_complex',
    filter,
    '-map',
    '[aout]',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    premaster,
  ])

  return {
    duration,
    timeline: [
      ['00:00.000', 'Фон приёмной и коридора, fade in 0,7 с.'],
      ['00:00.700', 'Начинается голосовой блок.'],
      [
        `${(voiceStart + voiceDuration).toFixed(3)} с`,
        'Заканчивается голосовой блок; остаётся атмосферный хвост.',
      ],
      [`${fadeOutStart.toFixed(3)} с`, 'Начинается fade out фона длительностью 1 с.'],
    ],
    balance: [
      'Голос оставлен на исходном уровне.',
      'Очень тихий исходный фон коридора усилен на 12 dB и остаётся заметно тише речи.',
    ],
  }
}

const mixSceneSix = (sceneDirectory, premaster) => {
  const background = path.join(
    sceneDirectory,
    'sfx',
    'sfx_03_reception_corridor_bed.mp3',
  )
  const cough = path.join(
    sceneDirectory,
    'sfx',
    'sfx_09a_two_soft_dry_throat_clears_behind_glass.mp3',
  )
  const chair = path.join(
    sceneDirectory,
    'sfx',
    'sfx_09b_studio_chair_creak.mp3',
  )
  const voiceDirectory = path.join(sceneDirectory, 'voice')
  const voiceOne = path.join(voiceDirectory, 'voice_01_detective-marina.mp3')
  const voiceArtem = path.join(voiceDirectory, 'voice_02_artem.mp3')
  const voiceThree = path.join(voiceDirectory, 'voice_03_marina-detective.mp3')

  const voiceOneStart = 0.7
  const coughStart = voiceOneStart + probeDuration(voiceOne) + 0.35
  const artemStart = coughStart + probeDuration(cough) + 0.25
  const chairStart = artemStart + probeDuration(voiceArtem) + 0.15
  const voiceThreeStart = chairStart + probeDuration(chair) + 0.4
  const duration = voiceThreeStart + probeDuration(voiceThree) + 1
  const fadeOutStart = duration - 1
  const delay = (seconds) => Math.round(seconds * 1000)
  const lineEffect =
    'highpass=f=120,lowpass=f=6500,pan=mono|c0=0.5*c0+0.5*c1,aformat=sample_fmts=fltp:channel_layouts=stereo'

  const filter = [
    `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${duration.toFixed(3)},volume=12dB,afade=t=in:st=0:d=0.7,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=1[bg]`,
    `[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay(voiceOneStart)}:all=1[v1]`,
    `[2:a]aresample=48000,${lineEffect},volume=-11dB,adelay=${delay(coughStart)}:all=1[cough]`,
    `[3:a]aresample=48000,${lineEffect},volume=-4dB,adelay=${delay(artemStart)}:all=1[artem]`,
    `[4:a]aresample=48000,${lineEffect},volume=-10dB,adelay=${delay(chairStart)}:all=1[chair]`,
    `[5:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${delay(voiceThreeStart)}:all=1[v3]`,
    `[bg][v1][cough][artem][chair][v3]amix=inputs=6:duration=longest:dropout_transition=0:normalize=0,atrim=0:${duration.toFixed(3)}[aout]`,
  ].join(';')

  run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'warning',
    '-stream_loop',
    '-1',
    '-i',
    background,
    '-i',
    voiceOne,
    '-i',
    cough,
    '-i',
    voiceArtem,
    '-i',
    chair,
    '-i',
    voiceThree,
    '-filter_complex',
    filter,
    '-map',
    '[aout]',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    premaster,
  ])

  return {
    duration,
    timeline: [
      ['00:00.000', 'Фон приёмной и коридора, fade in 0,7 с.'],
      ['00:00.700', 'Первый голосовой блок детектива и Марины.'],
      [`${coughStart.toFixed(3)} с`, 'Два покашливания из воспроизводимой записи.'],
      [`${artemStart.toFixed(3)} с`, 'Реплика Артёма из INS-01.'],
      [`${chairStart.toFixed(3)} с`, 'Скрип студийного кресла из INS-01.'],
      [`${voiceThreeStart.toFixed(3)} с`, 'Реакция Марины и продолжение допроса.'],
      [`${fadeOutStart.toFixed(3)} с`, 'Fade out фоновой атмосферы длительностью 1 с.'],
    ],
    balance: [
      'Основной диалог оставлен на исходном уровне.',
      'Фон коридора усилен на 12 dB относительно очень тихого исходника.',
      'Вставка INS-01 переведена в моно по центру, ограничена полосой 120–6500 Гц и сделана тише основного разговора.',
      'Покашливания приглушены на 11 dB, голос Артёма — на 4 dB, скрип кресла — на 10 dB.',
    ],
  }
}

const writeMixNotes = ({
  notesPath,
  title,
  timeline,
  balance,
  masterName,
  gameName,
  premasterName,
  stats,
}) => {
  const lines = [
    `# Фактическое сведение: ${title}`,
    '',
    '## Таймлайн',
    '',
    '| Время | Событие |',
    '| --- | --- |',
    ...timeline.map(([time, event]) => `| ${time} | ${event} |`),
    '',
    '## Баланс исходников',
    '',
    ...balance.map((item) => `- ${item}`),
    '- Все дорожки сведены в 48 кГц, stereo.',
    '',
    '## Финальные параметры',
    '',
    `- Длительность: ${stats.durationSeconds.toFixed(3)} с.`,
    `- Интегральная громкость: ${stats.integratedLufs.toFixed(1)} LUFS.`,
    `- Максимальный true peak: ${stats.truePeakDbtp.toFixed(1)} dBTP.`,
    `- Диапазон громкости LRA: ${stats.lraLu.toFixed(1)} LU.`,
    `- Мастер: \`${masterName}\`, PCM 48 кГц/24 bit.`,
    `- Игровой файл: \`${gameName}\`, MP3 256 kbps, 48 кГц.`,
    `- Промежуточный float-мастер: \`${premasterName}\`.`,
    '',
  ]
  fs.writeFileSync(notesPath, lines.join('\n'), 'utf8')
}

const results = []
for (const sceneNumber of sceneNumbers) {
  const sceneDirectory = findSceneDirectory(sceneNumber)
  const sceneName = path.basename(sceneDirectory)
  const mixDirectory = path.join(sceneDirectory, 'mix')
  fs.mkdirSync(mixDirectory, { recursive: true })
  const baseName = sceneName
  const premaster = path.join(mixDirectory, `${baseName}_premaster_float.wav`)
  const master = path.join(mixDirectory, `${baseName}_master_48k_24bit.wav`)
  const game = path.join(mixDirectory, `${baseName}_game_256k.mp3`)
  const notesPath = path.join(mixDirectory, 'СВЕДЕНИЕ.md')

  console.log(`[${sceneNumber}/11] Сведение ${sceneName}`)
  const mix =
    sceneNumber === 6
      ? mixSceneSix(sceneDirectory, premaster)
      : mixSimpleScene(sceneDirectory, premaster)
  finalizeMix(premaster, master, game)
  const stats = verifyLoudness(game)
  if (
    Math.abs(stats.integratedLufs - -16) > 0.4 ||
    stats.truePeakDbtp > -1
  ) {
    throw new Error(
      `Сцена ${sceneNumber} не прошла контроль: ${JSON.stringify(stats)}`,
    )
  }

  const montageTitle = fs
    .readFileSync(path.join(sceneDirectory, 'МОНТАЖ.md'), 'utf8')
    .split(/\r?\n/, 1)[0]
    .replace(/^#\s*/, '')
  writeMixNotes({
    notesPath,
    title: montageTitle,
    timeline: mix.timeline,
    balance: mix.balance,
    masterName: path.basename(master),
    gameName: path.basename(game),
    premasterName: path.basename(premaster),
    stats,
  })
  results.push({ sceneNumber, sceneName, ...stats, game })
}

console.log(JSON.stringify({ completed: true, scenes: results }, null, 2))
