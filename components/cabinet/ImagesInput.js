import { useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { sendImage } from '@helpers/cloudinary'

const INPUT_ACCEPT_TYPES =
  'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/*'

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')

const normalizeImages = (images) =>
  (Array.isArray(images) ? images : []).map(toTrimmedString).filter(Boolean)

const moveToFirst = (items, index) => {
  if (!Array.isArray(items) || index <= 0 || index >= items.length) {
    return items
  }

  const next = [...items]
  const [selected] = next.splice(index, 1)
  next.unshift(selected)
  return next
}

const extractUrlCandidates = (value) => {
  if (!value) {
    return []
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractUrlCandidates(item))
  }

  if (typeof value === 'object') {
    return [
      value.url,
      value.secure_url,
      value.src,
      value.fileUrl,
      value.imageUrl,
      value.path,
      value.location,
      ...(Array.isArray(value.files) ? value.files : []),
      ...(Array.isArray(value.urls) ? value.urls : []),
      ...(Array.isArray(value.data) ? value.data : []),
    ].flatMap((item) => extractUrlCandidates(item))
  }

  return []
}

const ImagesInput = ({
  images,
  onChange,
  directory,
  imageName,
  project,
  label,
  disabled,
  maxImages,
}) => {
  const fileInputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [urlValue, setUrlValue] = useState('')

  const normalizedImages = useMemo(() => normalizeImages(images), [images])

  const handleRemove = (index) => {
    const next = normalizedImages.filter((_, itemIndex) => itemIndex !== index)
    onChange(next)
  }

  const handleSetMain = (index) => {
    const next = moveToFirst(normalizedImages, index)
    onChange(next)
  }

  const handleAddUrl = () => {
    const nextUrl = toTrimmedString(urlValue)
    if (!nextUrl) {
      return
    }

    if (normalizedImages.includes(nextUrl)) {
      setUrlValue('')
      return
    }

    const next = [...normalizedImages, nextUrl].slice(0, maxImages)
    onChange(next)
    setUrlValue('')
  }

  const handleUpload = async (file) => {
    if (!file || disabled || isUploading) {
      return
    }

    setUploadError(null)
    setIsUploading(true)

    const uploadResult = await sendImage(
      file,
      null,
      directory,
      imageName,
      project,
      (message) => setUploadError(message || 'Ошибка загрузки изображения')
    )

    setIsUploading(false)

    if (!uploadResult) {
      return
    }

    const uploadedUrls = Array.from(
      new Set(extractUrlCandidates(uploadResult).map(toTrimmedString).filter(Boolean))
    )

    if (uploadedUrls.length === 0) {
      setUploadError('Сервер не вернул ссылку на изображение')
      return
    }

    const next = Array.from(new Set([...normalizedImages, ...uploadedUrls])).slice(0, maxImages)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {label ? <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h5> : null}

      {normalizedImages.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {normalizedImages.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            >
              <img
                src={imageUrl}
                alt={`uploaded-${index + 1}`}
                className="h-28 w-full object-cover"
              />
              <div className="space-y-2 p-2">
                <p className="break-all text-[10px] text-slate-500">{imageUrl}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetMain(index)}
                    disabled={disabled || index === 0}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {index === 0 ? 'Главная' : 'Сделать главной'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    disabled={disabled}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Изображения отсутствуют.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={urlValue}
          onChange={(event) => setUrlValue(event.target.value)}
          placeholder="Добавить ссылку на изображение"
          disabled={disabled || normalizedImages.length >= maxImages}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:disabled:bg-slate-800"
        />
        <button
          type="button"
          onClick={handleAddUrl}
          disabled={disabled || !toTrimmedString(urlValue) || normalizedImages.length >= maxImages}
          className="inline-flex justify-center rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:hover:bg-violet-500/10"
        >
          Добавить ссылку
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={INPUT_ACCEPT_TYPES}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            handleUpload(file)
            event.target.value = ''
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading || normalizedImages.length >= maxImages}
          className="inline-flex justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? 'Загрузка...' : 'Загрузить фото'}
        </button>
        <span className="text-xs text-slate-500">
          {normalizedImages.length}/{maxImages}
        </span>
      </div>

      {uploadError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {uploadError}
        </p>
      ) : null}
    </div>
  )
}

ImagesInput.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func,
  directory: PropTypes.string,
  imageName: PropTypes.string,
  project: PropTypes.string,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  maxImages: PropTypes.number,
}

ImagesInput.defaultProps = {
  images: [],
  onChange: () => {},
  directory: 'temp',
  imageName: null,
  project: process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest',
  label: null,
  disabled: false,
  maxImages: 10,
}

export default ImagesInput
