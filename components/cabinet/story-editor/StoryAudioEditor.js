'use client'

import { memo, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { sendImage } from '@helpers/cloudinary'
import pauseOtherAudioElements from '@helpers/audioPlayback'
import {
  getStoryAudioMedia,
  setStoryAudioMedia,
} from '@helpers/storyCoverMedia'

const ESCALIONCLOUD_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ESCALIONCLOUD_PUBLIC_ORIGIN ||
  'https://cloud.escalion.ru'

const fieldClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60'

const extractUrlCandidates = (value) => {
  if (!value) return []
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (Array.isArray(value)) return value.flatMap(extractUrlCandidates)
  if (typeof value !== 'object') return []

  return [
    value.url,
    value.secure_url,
    value.src,
    value.fileUrl,
    value.path,
    value.location,
    value.files,
    value.urls,
    value.data,
  ].flatMap(extractUrlCandidates)
}

const normalizeUploadedUrl = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (/^\/\//.test(normalized)) return `https:${normalized}`
  if (/^\/uploads\//i.test(normalized)) {
    return `${ESCALIONCLOUD_PUBLIC_ORIGIN}${normalized}`
  }
  if (/^uploads\//i.test(normalized)) {
    return `${ESCALIONCLOUD_PUBLIC_ORIGIN}/${normalized}`
  }
  return ''
}

const createAudioId = () =>
  `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const fileTitle = (file) =>
  String(file?.name || 'Новая аудиодорожка').replace(/\.[^.]+$/, '')

const formatDuration = (value) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0))
  if (!totalSeconds) return ''
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

const formatSize = (value) => {
  const bytes = Math.max(0, Number(value) || 0)
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

const StoryAudioEditor = ({
  media,
  onChange,
  directory,
  disabled,
  label,
}) => {
  const fileInputRef = useRef(null)
  const replaceIndexRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const audioMedia = useMemo(() => getStoryAudioMedia(media), [media])

  const commitAudio = (nextAudio) => {
    onChange(setStoryAudioMedia(media, nextAudio))
  }

  const requestUpload = (replaceIndex = null) => {
    if (disabled || isUploading) return
    replaceIndexRef.current = replaceIndex
    setUploadError('')
    fileInputRef.current?.click()
  }

  const handleUpload = async (file) => {
    if (!file || disabled || isUploading) return
    const replacementIndex = replaceIndexRef.current
    replaceIndexRef.current = null
    setIsUploading(true)
    setUploadError('')

    const uploadResult = await sendImage(
      file,
      null,
      directory,
      null,
      process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest',
      (message) => setUploadError(message || 'Не удалось загрузить аудио'),
    )

    setIsUploading(false)
    if (!uploadResult) return

    const url = extractUrlCandidates(uploadResult)
      .map(normalizeUploadedUrl)
      .find(Boolean)
    if (!url) {
      setUploadError('Сервер не вернул ссылку на аудиофайл')
      return
    }

    if (
      Number.isInteger(replacementIndex) &&
      replacementIndex >= 0 &&
      replacementIndex < audioMedia.length
    ) {
      commitAudio(
        audioMedia.map((item, index) =>
          index === replacementIndex
            ? {
                ...item,
                url,
                mime: file.type || item.mime || 'audio/mpeg',
                size: Number(file.size) || 0,
                duration: 0,
                path: '',
              }
            : item,
        ),
      )
      return
    }

    commitAudio([
      ...audioMedia,
      {
        id: createAudioId(),
        type: 'audio',
        url,
        mime: file.type || 'audio/mpeg',
        size: Number(file.size) || 0,
        duration: 0,
        path: '',
        title: fileTitle(file),
      },
    ])
  }

  const moveAudio = (fromIndex, toIndex) => {
    if (
      disabled ||
      toIndex < 0 ||
      toIndex >= audioMedia.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const nextAudio = [...audioMedia]
    const [selected] = nextAudio.splice(fromIndex, 1)
    nextAudio.splice(toIndex, 0, selected)
    commitAudio(nextAudio)
  }

  const removeAudio = (index) => {
    if (disabled) return
    const title = audioMedia[index]?.title || `Дорожка ${index + 1}`
    if (!window.confirm(`Удалить аудиодорожку «${title}» из сценария?`)) return
    commitAudio(audioMedia.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Дорожки воспроизводятся игроку в указанном порядке после текста сцены.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => requestUpload()}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? 'Загрузка…' : 'Добавить аудио'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.opus"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void handleUpload(file)
        }}
      />

      {uploadError ? (
        <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {uploadError}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {audioMedia.length > 0 ? (
          audioMedia.map((item, index) => {
            const duration = formatDuration(item.duration)
            const size = formatSize(item.size)
            return (
              <article
                key={item.id || item.url || index}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                    Дорожка {index + 1}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={disabled || index === 0} onClick={() => moveAudio(index, index - 1)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-35 dark:border-slate-600">Выше</button>
                    <button type="button" disabled={disabled || index === audioMedia.length - 1} onClick={() => moveAudio(index, index + 1)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-35 dark:border-slate-600">Ниже</button>
                    <button type="button" disabled={disabled || isUploading} onClick={() => requestUpload(index)} className="rounded-lg border border-cyan-300 px-2.5 py-1 text-xs font-semibold text-cyan-700 disabled:opacity-35 dark:border-cyan-500/40 dark:text-cyan-200">Заменить</button>
                    <button type="button" disabled={disabled} onClick={() => removeAudio(index)} className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-600 disabled:opacity-35 dark:border-rose-500/40 dark:text-rose-200">Удалить</button>
                  </div>
                </div>
                <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Название
                  <input
                    value={item.title || ''}
                    disabled={disabled}
                    onChange={(event) => commitAudio(audioMedia.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry))}
                    className={fieldClassName}
                    placeholder={`Дорожка ${index + 1}`}
                  />
                </label>
                <audio
                  controls
                  preload="metadata"
                  src={item.url}
                  onPlay={(event) => pauseOtherAudioElements(event.currentTarget)}
                  className="mt-3 w-full"
                />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  {duration ? <span>{duration}</span> : null}
                  {size ? <span>{size}</span> : null}
                  {item.mime ? <span>{item.mime}</span> : null}
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300">Открыть файл</a> : null}
                </div>
              </article>
            )
          })
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Для этой сцены аудиодорожки пока не добавлены.
          </p>
        )}
      </div>
    </section>
  )
}

StoryAudioEditor.propTypes = {
  media: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func.isRequired,
  directory: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
}

StoryAudioEditor.defaultProps = {
  media: [],
  disabled: false,
  label: 'Аудиодорожки сцены',
}

export default memo(StoryAudioEditor)
