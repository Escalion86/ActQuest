'use client'

import { memo, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { sendImage } from '@helpers/cloudinary'
import {
  getStoryMediaByType,
  setStoryMediaByType,
} from '@helpers/storyCoverMedia'

const ESCALIONCLOUD_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ESCALIONCLOUD_PUBLIC_ORIGIN ||
  'https://cloud.escalion.ru'
const MAX_VIDEO_SIZE_BYTES = 40 * 1024 * 1024

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

const createVideoId = () =>
  `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const fileTitle = (file) =>
  String(file?.name || 'Новое видео').replace(/\.[^.]+$/, '')

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

const StoryVideoEditor = ({ media, onChange, directory, disabled, label }) => {
  const fileInputRef = useRef(null)
  const replaceIndexRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const videoMedia = useMemo(
    () => getStoryMediaByType(media, 'video'),
    [media],
  )

  const commitVideo = (nextVideo) => {
    onChange(setStoryMediaByType(media, 'video', nextVideo))
  }

  const requestUpload = (replaceIndex = null) => {
    if (disabled || isUploading) return
    replaceIndexRef.current = replaceIndex
    setUploadError('')
    fileInputRef.current?.click()
  }

  const handleUpload = async (file) => {
    if (!file || disabled || isUploading) return
    if (Number(file.size) > MAX_VIDEO_SIZE_BYTES) {
      setUploadError('Видео слишком большое. Максимальный размер: 40 МБ.')
      return
    }
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
      (message) => setUploadError(message || 'Не удалось загрузить видео'),
    )

    setIsUploading(false)
    if (!uploadResult) return

    const url = extractUrlCandidates(uploadResult)
      .map(normalizeUploadedUrl)
      .find(Boolean)
    if (!url) {
      setUploadError('Сервер не вернул ссылку на видеофайл')
      return
    }

    if (
      Number.isInteger(replacementIndex) &&
      replacementIndex >= 0 &&
      replacementIndex < videoMedia.length
    ) {
      commitVideo(
        videoMedia.map((item, index) =>
          index === replacementIndex
            ? {
                ...item,
                url,
                mime: file.type || item.mime || 'video/mp4',
                size: Number(file.size) || 0,
                duration: 0,
                path: '',
              }
            : item,
        ),
      )
      return
    }

    commitVideo([
      ...videoMedia,
      {
        id: createVideoId(),
        type: 'video',
        url,
        mime: file.type || 'video/mp4',
        size: Number(file.size) || 0,
        duration: 0,
        path: '',
        title: fileTitle(file),
      },
    ])
  }

  const moveVideo = (fromIndex, toIndex) => {
    if (
      disabled ||
      toIndex < 0 ||
      toIndex >= videoMedia.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const nextVideo = [...videoMedia]
    const [selected] = nextVideo.splice(fromIndex, 1)
    nextVideo.splice(toIndex, 0, selected)
    commitVideo(nextVideo)
  }

  const removeVideo = (index) => {
    if (disabled) return
    const title = videoMedia[index]?.title || `Видео ${index + 1}`
    if (!window.confirm(`Удалить видео «${title}» из сценария?`)) return
    commitVideo(videoMedia.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-500/30 dark:bg-violet-500/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Видео показываются игроку в указанном порядке после текста сцены.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || isUploading}
          onClick={() => requestUpload()}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? 'Загрузка…' : 'Добавить видео'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.m4v,.ogv"
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
        {videoMedia.length > 0 ? (
          videoMedia.map((item, index) => {
            const duration = formatDuration(item.duration)
            const size = formatSize(item.size)
            return (
              <article
                key={item.id || item.url || index}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Видео {index + 1}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={disabled || index === 0} onClick={() => moveVideo(index, index - 1)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-35 dark:border-slate-600">Выше</button>
                    <button type="button" disabled={disabled || index === videoMedia.length - 1} onClick={() => moveVideo(index, index + 1)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-35 dark:border-slate-600">Ниже</button>
                    <button type="button" disabled={disabled || isUploading} onClick={() => requestUpload(index)} className="rounded-lg border border-violet-300 px-2.5 py-1 text-xs font-semibold text-violet-700 disabled:opacity-35 dark:border-violet-500/40 dark:text-violet-200">Заменить</button>
                    <button type="button" disabled={disabled} onClick={() => removeVideo(index)} className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-600 disabled:opacity-35 dark:border-rose-500/40 dark:text-rose-200">Удалить</button>
                  </div>
                </div>
                <label className="mt-3 grid gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Название
                  <input
                    value={item.title || ''}
                    disabled={disabled}
                    onChange={(event) => commitVideo(videoMedia.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: event.target.value } : entry))}
                    className={fieldClassName}
                    placeholder={`Видео ${index + 1}`}
                  />
                </label>
                <video
                  controls
                  preload="metadata"
                  src={item.url}
                  className="mt-3 max-h-80 w-full rounded-xl bg-black object-contain"
                />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  {duration ? <span>{duration}</span> : null}
                  {size ? <span>{size}</span> : null}
                  {item.mime ? <span>{item.mime}</span> : null}
                  {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">Открыть файл</a> : null}
                </div>
              </article>
            )
          })
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Для этой сцены видео пока не добавлено.
          </p>
        )}
      </div>
    </section>
  )
}

StoryVideoEditor.propTypes = {
  media: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func.isRequired,
  directory: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
}

StoryVideoEditor.defaultProps = {
  media: [],
  disabled: false,
  label: 'Видеофайлы сцены',
}

export default memo(StoryVideoEditor)
