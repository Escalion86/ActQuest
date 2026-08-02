import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = 'D:/ActQuest/Сюжеты/Последний эфир/audio/scenes'
const firstScene = path.join(root, '01_00_prologue_last_broadcast')
const scenes = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    number: Number(entry.name.slice(0, 2)),
    name: entry.name,
    directory: path.join(root, entry.name),
  }))
  .filter((scene) => scene.number >= 12 && scene.number <= 52)
  .sort((a, b) => a.number - b.number)

const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} завершился с кодом ${result.status}\n${result.stderr || result.stdout}`,
    )
  }
  return result
}

const durationCache = new Map()
const durationOf = (file) => {
  if (!durationCache.has(file)) {
    const result = run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ])
    durationCache.set(file, Number(result.stdout.trim()))
  }
  return durationCache.get(file)
}

const voices = (scene) =>
  fs
    .readdirSync(path.join(scene.directory, 'voice'))
    .filter((file) => /^voice_.*\.mp3$/i.test(file))
    .sort()
    .map((file) => path.join(scene.directory, 'voice', file))

const sfx = (scene, fragment) => {
  const directory = path.join(scene.directory, 'sfx')
  const match = fs
    .readdirSync(directory)
    .find((file) => file.toLowerCase().includes(fragment.toLowerCase()))
  if (!match) throw new Error(`В ${scene.name} не найден SFX ${fragment}`)
  return path.join(directory, match)
}

const canonicalIns = {
  cough: path.join(
    firstScene,
    'sfx',
    'sfx_09a_two_soft_dry_throat_clears_behind_glass.mp3',
  ),
  artem: path.join(firstScene, 'voice', 'voice_02_artem.mp3'),
  chair: path.join(firstScene, 'sfx', 'sfx_09b_studio_chair_creak.mp3'),
}

const alignmentCache = new Map()
const alignmentFor = (voiceFile) => {
  if (!alignmentCache.has(voiceFile)) {
    const metadata = JSON.parse(
      fs.readFileSync(voiceFile.replace(/\.mp3$/i, '.json'), 'utf8'),
    )
    const alignment = metadata.normalizedAlignment || metadata.alignment
    if (!alignment) throw new Error(`Нет alignment для ${voiceFile}`)
    alignmentCache.set(voiceFile, {
      text: alignment.characters.join(''),
      starts: alignment.character_start_times_seconds,
      ends: alignment.character_end_times_seconds,
    })
  }
  return alignmentCache.get(voiceFile)
}

const phraseTime = (voiceFile, phrase, edge = 'start') => {
  const alignment = alignmentFor(voiceFile)
  const index = alignment.text.toLowerCase().indexOf(phrase.toLowerCase())
  if (index < 0) throw new Error(`В ${voiceFile} не найдена фраза «${phrase}»`)
  return edge === 'end'
    ? alignment.ends[index + phrase.length - 1]
    : alignment.starts[index]
}

const trackEnd = (track) =>
  track.start + (track.trim ?? durationOf(track.file))

const addIns = (tracks, start, options = {}) => {
  const extraGain = options.extraGain || 0
  const pan = options.pan || 0
  const panFilter = pan ? `,stereotools=balance_out=${pan}` : ''
  const common = options.lineEffect
    ? ',highpass=f=120,lowpass=f=6500'
    : ''
  tracks.push({
    file: canonicalIns.cough,
    start,
    gain: -10 + extraGain,
    filter: `${common}${panFilter}`,
    label: options.label ? `${options.label}: два кашля` : 'INS-01: два кашля',
  })
  const artemStart = start + durationOf(canonicalIns.cough) + 0.25
  tracks.push({
    file: canonicalIns.artem,
    start: artemStart,
    gain: -4 + extraGain,
    filter: `${common}${panFilter}`,
    label: options.label ? `${options.label}: голос Артёма` : 'INS-01: голос Артёма',
  })
  const chairStart = artemStart + durationOf(canonicalIns.artem) + 0.15
  tracks.push({
    file: canonicalIns.chair,
    start: chairStart,
    gain: -8 + extraGain,
    filter: `${common}${panFilter}`,
    label: options.label ? `${options.label}: скрип кресла` : 'INS-01: скрип кресла',
  })
  return chairStart + durationOf(canonicalIns.chair)
}

const backgrounds = {
  studio: { fragment: 'sfx_04_', gain: 28 },
  newsroom: { fragment: 'sfx_07_', gain: 20 },
  control: { fragment: 'sfx_08_', gain: 5, filter: ',highpass=f=80' },
  dock: { fragment: 'sfx_10_', gain: -5 },
  cafe: { fragment: 'sfx_12_', gain: 10 },
  lab: { fragment: 'sfx_13_', gain: 15 },
  ending: { fragment: 'sfx_01_', gain: 8 },
  endingFull: { fragment: 'sfx_01_', gain: 10 },
}

const simpleBackgroundByScene = (number) => {
  if (number <= 16) return backgrounds.studio
  if (number <= 26) return backgrounds.newsroom
  if (number <= 33) return backgrounds.control
  if (number <= 38) return backgrounds.dock
  if (number <= 42) return backgrounds.cafe
  if (number <= 46) return backgrounds.lab
  return backgrounds.ending
}

const simplePlan = (scene, options = {}) => {
  const [voice] = voices(scene)
  const voiceStart = options.voiceStart ?? 0.7
  const tail = options.tail ?? 1
  const tracks = [{ file: voice, start: voiceStart, gain: 0, label: 'Голосовой блок' }]
  return {
    background: options.background || simpleBackgroundByScene(scene.number),
    tracks,
    duration: voiceStart + durationOf(voice) + tail,
    notes: options.notes || [],
  }
}

const buildPlan = (scene) => {
  const files = voices(scene)
  if (
    [13, 14, 17, 18, 19, 20, 22, 23, 24, 27, 28, 29, 30, 31, 34, 35, 36, 37, 39, 40, 41, 42, 43, 48, 50].includes(
      scene.number,
    )
  ) {
    return simplePlan(scene, {
      voiceStart: scene.number >= 48 ? 1 : 0.7,
      tail: scene.number >= 48 ? 2 : 1,
      notes:
        scene.number >= 48
          ? ['Финал оставлен голосовым; фон радиостанции очень тихий.']
          : [],
    })
  }

  if (scene.number === 12) {
    const lock = sfx(scene, 'sfx_05b_')
    const voiceStart = 0.7 + durationOf(lock) + 0.3
    return {
      background: backgrounds.studio,
      tracks: [
        { file: lock, start: 0.7, gain: 3, label: 'Тихий сброс магнитного замка' },
        { file: files[0], start: voiceStart, gain: 0, label: 'Голосовой блок' },
      ],
      duration: voiceStart + durationOf(files[0]) + 1,
      notes: ['Сброс магнитного замка предшествует первой фразе.'],
    }
  }

  if (scene.number === 15) {
    const start = 0.7
    return {
      background: backgrounds.studio,
      tracks: [
        { file: files[0], start, gain: 0, label: 'Голосовой блок' },
        {
          file: sfx(scene, 'sfx_06a_'),
          start: start + phraseTime(files[0], 'включила режим ON AIR', 'end'),
          gain: -8,
          label: 'Включение ON AIR',
        },
        {
          file: sfx(scene, 'sfx_06b_'),
          start: start + phraseTime(files[0], 'удерживал дверь', 'end'),
          gain: -8,
          label: 'Срабатывание магнитного замка',
        },
      ],
      duration: start + durationOf(files[0]) + 1,
      notes: ['Эффекты двери расставлены по временной разметке слов.'],
    }
  }

  if (scene.number === 16) {
    const start = 0.7
    return {
      background: backgrounds.studio,
      tracks: [
        { file: files[0], start, gain: 0, label: 'Голосовой блок' },
        {
          file: sfx(scene, 'sfx_14b_'),
          start: start + phraseTime(files[0], '19:51', 'end'),
          gain: 0,
          trim: 0.35,
          label: 'Короткое подтверждение журнала проходов',
        },
      ],
      duration: start + durationOf(files[0]) + 1,
      notes: ['Подтверждение сокращено до 0,35 с, чтобы сохранить паузу перед выводом.'],
    }
  }

  if (scene.number === 21) {
    const tracks = [{ file: files[0], start: 0.7, gain: 0, label: 'Вопрос детектива' }]
    const insStart = 0.7 + durationOf(files[0]) + 0.3
    const insEnd = addIns(tracks, insStart, { lineEffect: true })
    const secondStart = insEnd + 0.6
    tracks.push({ file: files[1], start: secondStart, gain: 0, label: 'Реакция Глеба' })
    return {
      background: backgrounds.newsroom,
      tracks,
      duration: secondStart + durationOf(files[1]) + 1,
      notes: ['INS-01 вставлен целиком; после скрипа выдержано 0,6 с.'],
    }
  }

  if (scene.number === 25) {
    const firstStart = 0.7
    const confirmStart = firstStart + durationOf(files[0]) + 0.2
    const secondStart = confirmStart + durationOf(sfx(scene, 'sfx_14b_')) + 0.25
    return {
      background: backgrounds.newsroom,
      tracks: [
        { file: files[0], start: firstStart, gain: 0, label: 'Поиск черновика' },
        { file: sfx(scene, 'sfx_14a_'), start: firstStart, gain: 1, label: 'Поиск в облачной корзине' },
        { file: sfx(scene, 'sfx_14b_'), start: confirmStart, gain: 0, label: 'Найденный черновик' },
        { file: files[1], start: secondStart, gain: 0, label: 'Цитата Артёма и вывод' },
      ],
      duration: secondStart + durationOf(files[1]) + 1,
      notes: ['Перед цитатой Артёма оставлена пауза 0,25 с после сигнала.'],
    }
  }

  if ([26, 46].includes(scene.number)) {
    const start = 0.7
    const phrase = scene.number === 26 ? '3,2 миллиона рублей' : 'совпадают с раной'
    return {
      background: simpleBackgroundByScene(scene.number),
      tracks: [
        { file: files[0], start, gain: 0, label: 'Голосовой блок' },
        {
          file: sfx(scene, 'sfx_14b_'),
          start: start + phraseTime(files[0], phrase, 'end'),
          gain: 0,
          label: 'Подтверждение совпадения',
        },
      ],
      duration: start + durationOf(files[0]) + 1,
      notes: ['Сигнал подтверждения поставлен сразу после ключевой фразы.'],
    }
  }

  if (scene.number === 32) {
    const start = 0.7
    return {
      background: backgrounds.control,
      tracks: [
        { file: files[0], start, gain: 0, label: 'Голосовой блок' },
        {
          file: sfx(scene, 'sfx_14a_'),
          start: start + phraseTime(files[0], 'открываю очередь'),
          gain: 2,
          label: 'Проверка очереди «Эхо-9»',
        },
        {
          file: sfx(scene, 'sfx_14b_'),
          start: start + phraseTime(files[0], 'совпадает с дневным архивом', 'end'),
          gain: 0,
          label: 'Совпадение контрольной суммы',
        },
      ],
      duration: start + durationOf(files[0]) + 1,
      notes: ['Цифровые эффекты привязаны к соответствующим фразам.'],
    }
  }

  if (scene.number === 33) {
    const tracks = [{ file: files[0], start: 0.7, gain: 0, label: 'Обнаружение soundcheck' }]
    const insStart = 0.7 + durationOf(files[0]) + 0.35
    const insEnd = addIns(tracks, insStart)
    const thirdStart = insEnd + 0.5
    tracks.push({ file: files[2], start: thirdStart, gain: 0, label: 'Вывод детектива' })
    return {
      background: backgrounds.control,
      tracks,
      duration: thirdStart + durationOf(files[2]) + 1,
      notes: ['Оригинальный INS-01 воспроизведён без телефонной фильтрации.'],
    }
  }

  if (scene.number === 38) {
    const start = 0.7
    return {
      background: backgrounds.dock,
      tracks: [
        { file: files[0], start, gain: 0, label: 'Голосовой блок' },
        {
          file: sfx(scene, 'sfx_11a_'),
          start: start + phraseTime(files[0], 'раздвигаю тканевые баннеры'),
          gain: 12,
          label: 'Шорох тканевых баннеров',
        },
        {
          file: sfx(scene, 'sfx_11b_'),
          start: start + phraseTime(files[0], 'лежит бронзовая награда', 'end'),
          gain: -8,
          label: 'Контакт награды с коробкой',
        },
      ],
      duration: start + durationOf(files[0]) + 1,
      notes: ['Шорох и контакт награды расставлены по словам описания обыска.'],
    }
  }

  if (scene.number === 44) {
    const start = 0.7
    return {
      background: backgrounds.lab,
      tracks: [
        { file: files[0], start, gain: 0, label: 'Голосовой блок' },
        {
          file: sfx(scene, 'sfx_14a_'),
          start: start + phraseTime(files[0], 'эксперту', 'end'),
          gain: 2,
          label: 'Экспорт данных часов',
        },
        {
          file: sfx(scene, 'sfx_14b_'),
          start: start + phraseTime(files[0], '19:43:18', 'end'),
          gain: 0,
          label: 'Фиксация времени смерти',
        },
      ],
      duration: start + durationOf(files[0]) + 1,
      notes: ['Экспорт и подтверждение времени привязаны к разметке речи.'],
    }
  }

  if (scene.number === 45) {
    const tracks = [{ file: files[0], start: 0.7, gain: 0, label: 'Сравнение записей' }]
    const firstStart = 0.7 + durationOf(files[0]) + 0.35
    const firstEnd = addIns(tracks, firstStart, { pan: -0.35, label: '17:21' })
    const secondStart = firstEnd + 0.25
    const secondEnd = addIns(tracks, secondStart, { pan: 0.35, label: '20:05' })
    const confirmStart = secondEnd + 0.25
    tracks.push({ file: sfx(scene, 'sfx_14b_'), start: confirmStart, gain: 0, label: 'Побитовое совпадение' })
    return {
      background: backgrounds.lab,
      tracks,
      duration: confirmStart + durationOf(sfx(scene, 'sfx_14b_')) + 1,
      notes: ['Один и тот же INS-01 воспроизведён слева и справа с паузой 0,25 с.'],
    }
  }

  if (scene.number === 47) {
    const tracks = []
    const starts = [1]
    for (let index = 1; index < files.length; index += 1) {
      starts.push(starts[index - 1] + durationOf(files[index - 1]) + (index === 4 ? 0.8 : 0.7))
    }
    files.forEach((file, index) =>
      tracks.push({ file, start: starts[index], gain: 0, label: `Реконструкция, блок ${index + 1}` }),
    )
    tracks.push({
      file: sfx(scene, 'sfx_17_'),
      start: starts[0] + phraseTime(files[0], '19:43:18', 'end'),
      gain: -12,
      label: 'Сдержанный удар бронзовой наградой',
    })
    addIns(tracks, starts[1] + phraseTime(files[1], 'два кашля Глеба и скрип кресла'), {
      extraGain: -9,
      label: 'Тихая реконструкция INS-01',
    })
    tracks.push({
      file: sfx(scene, 'sfx_06a_'),
      start: starts[2] + phraseTime(files[2], 'Режим ON AIR', 'end'),
      gain: -8,
      label: 'Включение ON AIR',
    })
    tracks.push({
      file: sfx(scene, 'sfx_06b_'),
      start: starts[2] + phraseTime(files[2], 'электромагнитный замок', 'end'),
      gain: -8,
      label: 'Срабатывание замка',
    })
    const trainStart = Math.max(
      0,
      starts[4] + phraseTime(files[4], 'Ночной поезд ушёл без неё') - 1,
    )
    const duration = starts[4] + durationOf(files[4]) + 3
    tracks.push({
      file: sfx(scene, 'sfx_15_'),
      start: trainStart,
      gain: -17,
      loop: true,
      trim: duration - trainStart,
      filter: ',afade=t=in:st=0:d=1,afade=t=out:st=' + (duration - trainStart - 2).toFixed(3) + ':d=2',
      label: 'Отправление последнего поезда',
    })
    return {
      background: backgrounds.endingFull,
      tracks,
      duration,
      notes: ['Пять блоков реконструкции разделены паузами; финальный поезд продолжается 3 с после речи.'],
    }
  }

  if (scene.number === 49) {
    const firstStart = 1
    const secondStart = firstStart + durationOf(files[0]) + 0.6
    const duration = secondStart + durationOf(files[1]) + 2
    const trainStart = firstStart + phraseTime(files[0], 'она уезжает')
    return {
      background: backgrounds.ending,
      tracks: [
        { file: files[0], start: firstStart, gain: 0, label: 'Верное имя без доказательств' },
        { file: files[1], start: secondStart, gain: 0, label: 'Последствия ошибки' },
        {
          file: sfx(scene, 'sfx_15_'),
          start: trainStart,
          gain: -17,
          loop: true,
          trim: duration - trainStart,
          filter: ',afade=t=in:st=0:d=0.8,afade=t=out:st=' + (duration - trainStart - 1.5).toFixed(3) + ':d=1.5',
          label: 'Уходящий поезд',
        },
      ],
      duration,
      notes: ['Поезд открыт на словах «она уезжает» и оставлен на 2 с после речи.'],
    }
  }

  if (scene.number === 51) {
    const firstStart = 1
    const scanStart = firstStart + durationOf(files[0]) + 0.15
    const secondStart = scanStart + 1.1 + 0.35
    return {
      background: backgrounds.ending,
      tracks: [
        { file: files[0], start: firstStart, gain: 0, label: 'Ошибочное обвинение' },
        {
          file: sfx(scene, 'sfx_14a_'),
          start: scanStart,
          gain: -2,
          trim: 1.1,
          filter: ',afade=t=out:st=1.08:d=0.02',
          label: 'Оборванная очистка архива',
        },
        { file: files[1], start: secondStart, gain: 0, label: 'Последствия ошибочного обвинения' },
      ],
      duration: secondStart + durationOf(files[1]) + 2,
      notes: ['SFX очистки архива резко обрывается без сигнала подтверждения.'],
    }
  }

  if (scene.number === 52) {
    const phone = sfx(scene, 'sfx_16_')
    const phoneStart = 0.8
    const voiceStart = phoneStart + durationOf(phone) + 0.4
    const duration = voiceStart + durationOf(files[0]) + 2.5
    const trainStart = voiceStart + phraseTime(files[0], 'садится в поезд')
    return {
      background: backgrounds.endingFull,
      tracks: [
        { file: phone, start: phoneStart, gain: -12, label: 'Телефон недоступен' },
        { file: files[0], start: voiceStart, gain: 0, label: 'Истечение времени' },
        {
          file: sfx(scene, 'sfx_15_'),
          start: trainStart,
          gain: -17,
          loop: true,
          trim: duration - trainStart,
          filter: ',afade=t=in:st=0:d=0.8,afade=t=out:st=' + (duration - trainStart - 2).toFixed(3) + ':d=2',
          label: 'Отправление поезда',
        },
      ],
      duration,
      notes: ['После сигнала недоступности оставлено 0,4 с; поезд продолжается 2,5 с после речи.'],
    }
  }

  throw new Error(`Для сцены ${scene.number} не задан монтажный план`)
}

const measure = (file) => {
  const result = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'loudnorm=I=-15.8:TP=-1.5:LRA=11:print_format=json',
    '-f',
    'null',
    'NUL',
  ])
  const match = result.stderr.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error(`Не удалось измерить ${file}`)
  return JSON.parse(match[0])
}

const render = (scene, plan) => {
  const mixDirectory = path.join(scene.directory, 'mix')
  fs.mkdirSync(mixDirectory, { recursive: true })
  const premaster = path.join(mixDirectory, `${scene.name}_premaster_float.wav`)
  const master = path.join(mixDirectory, `${scene.name}_master_48k_24bit.wav`)
  const game = path.join(mixDirectory, `${scene.name}_game_256k.mp3`)
  const background = sfx(scene, plan.background.fragment)
  const args = ['-y', '-hide_banner', '-loglevel', 'warning', '-stream_loop', '-1', '-i', background]
  for (const track of plan.tracks) {
    if (track.loop) args.push('-stream_loop', '-1')
    args.push('-i', track.file)
  }
  const fadeOut = Math.max(0, plan.duration - 1)
  const filters = [
    `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${plan.duration.toFixed(3)},volume=${plan.background.gain}dB${plan.background.filter || ''},afade=t=in:st=0:d=0.7,afade=t=out:st=${fadeOut.toFixed(3)}:d=1[bg]`,
  ]
  plan.tracks.forEach((track, index) => {
    const trim = track.trim ? `,atrim=0:${track.trim.toFixed(3)}` : ''
    filters.push(
      `[${index + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo${trim},volume=${track.gain || 0}dB${track.filter || ''},adelay=${Math.round(track.start * 1000)}:all=1[t${index}]`,
    )
  })
  const labels = ['[bg]', ...plan.tracks.map((_, index) => `[t${index}]`)].join('')
  filters.push(
    `${labels}amix=inputs=${plan.tracks.length + 1}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${plan.duration.toFixed(3)}[aout]`,
  )
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[aout]',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-c:a',
    'pcm_f32le',
    premaster,
  )
  run('ffmpeg', args)

  const measured = measure(premaster)
  const loudnorm = [
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
    loudnorm,
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
  const final = measure(game)
  const stats = {
    integratedLufs: Number(final.input_i),
    truePeakDbtp: Number(final.input_tp),
    lraLu: Number(final.input_lra),
    durationSeconds: durationOf(game),
  }
  if (Math.abs(stats.integratedLufs + 16) > 0.4 || stats.truePeakDbtp > -1) {
    throw new Error(`Сцена ${scene.number} не прошла контроль: ${JSON.stringify(stats)}`)
  }

  const title = fs
    .readFileSync(path.join(scene.directory, 'МОНТАЖ.md'), 'utf8')
    .split(/\r?\n/, 1)[0]
    .replace(/^#\s*/, '')
  const timeline = plan.tracks
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((track) => `| ${track.start.toFixed(3)} с | ${track.label} |`)
  const notes = [
    `# Фактическое сведение: ${title}`,
    '',
    '## Таймлайн',
    '',
    '| Время | Событие |',
    '| --- | --- |',
    '| 0.000 с | Начинается фон локации, fade in 0,7 с. |',
    ...timeline,
    `| ${(plan.duration - 1).toFixed(3)} с | Fade out фоновой атмосферы. |`,
    `| ${plan.duration.toFixed(3)} с | Конец сцены. |`,
    '',
    '## Особенности',
    '',
    ...(plan.notes.length ? plan.notes : ['Фон удерживается заметно тише речи.']).map(
      (note) => `- ${note}`,
    ),
    '- Все дорожки сведены в 48 кГц, stereo.',
    '',
    '## Финальные параметры',
    '',
    `- Длительность: ${stats.durationSeconds.toFixed(3)} с.`,
    `- Интегральная громкость: ${stats.integratedLufs.toFixed(2)} LUFS.`,
    `- Максимальный true peak: ${stats.truePeakDbtp.toFixed(2)} dBTP.`,
    `- Диапазон громкости LRA: ${stats.lraLu.toFixed(2)} LU.`,
    `- Мастер: \`${path.basename(master)}\`, PCM 48 кГц/24 bit.`,
    `- Игровой файл: \`${path.basename(game)}\`, MP3 256 kbps.`,
    `- Промежуточный float-мастер: \`${path.basename(premaster)}\`.`,
    '',
  ]
  fs.writeFileSync(path.join(mixDirectory, 'СВЕДЕНИЕ.md'), notes.join('\n'), 'utf8')
  return { scene: scene.number, name: scene.name, game, ...stats }
}

const results = []
for (const [index, scene] of scenes.entries()) {
  console.log(`[${index + 1}/${scenes.length}] Сведение ${scene.name}`)
  results.push(render(scene, buildPlan(scene)))
}
console.log(JSON.stringify({ completed: true, scenes: results }, null, 2))
