import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import { sendImage } from '@helpers/cloudinary'

const INPUT_ACCEPT_TYPES =
  'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/*'

const normalizeImages = (images) =>
  (Array.isArray(images) ? images : [])
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

const moveToFirst = (items, index) => {
  if (!Array.isArray(items) || index <= 0 || index >= items.length) {
    return items
  }

  const next = [...items]
  const [selected] = next.splice(index, 1)
  next.unshift(selected)
  return next
}

const moveItem = (items, fromIndex, toIndex) => {
  if (
    !Array.isArray(items) ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items
  }

  const next = [...items]
  const [selected] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, selected)
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
  onPreviewClick,
  directory,
  imageName,
  project,
  label,
  disabled,
  maxImages,
  previewShape,
  uploadLabel,
}) => {
  const fileInputRef = useRef(null)
  const dragStateRef = useRef({
    pointerId: null,
    fromIndex: -1,
    currentIndex: -1,
    active: false,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState(-1)

  const normalizedImages = useMemo(() => normalizeImages(images), [images])
  const isCirclePreview = previewShape === 'circle'
  const isSquarePreview = previewShape === 'square'
  const resolvedUploadLabel =
    typeof uploadLabel === 'string' && uploadLabel.trim()
      ? uploadLabel.trim()
      : isSquarePreview
        ? 'Загрузить обложку'
        : 'Загрузить фото'

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia(
      '(hover: none), (pointer: coarse), (any-hover: none), (any-pointer: coarse)'
    )

    const applyState = () => {
      setIsTouchLikeDevice(Boolean(mediaQuery.matches))
    }

    applyState()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', applyState)
      return () => {
        mediaQuery.removeEventListener('change', applyState)
      }
    }

    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(applyState)
      return () => {
        mediaQuery.removeListener(applyState)
      }
    }

    return undefined
  }, [])

  const handleRemove = (index) => {
    const next = normalizedImages.filter((_, itemIndex) => itemIndex !== index)
    onChange(next)
  }

  const handleSetMain = (index) => {
    const next = moveToFirst(normalizedImages, index)
    onChange(next)
  }

  const stopDrag = (pointerId) => {
    if (!dragStateRef.current.active) return
    if (
      typeof pointerId === 'number' &&
      dragStateRef.current.pointerId !== pointerId
    ) {
      return
    }

    dragStateRef.current = {
      pointerId: null,
      fromIndex: -1,
      currentIndex: -1,
      active: false,
    }
    setDraggingIndex(-1)
  }

  const handleDragHandlePointerDown = (index, event) => {
    if (disabled || normalizedImages.length < 2) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    if (event.cancelable) {
      event.preventDefault()
    }
    event.stopPropagation()

    dragStateRef.current = {
      pointerId: event.pointerId,
      fromIndex: index,
      currentIndex: index,
      active: true,
    }
    setDraggingIndex(index)

    if (event.currentTarget?.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ignore unsupported browsers
      }
    }
  }

  const handleGridPointerMove = (event) => {
    if (!dragStateRef.current.active) return
    if (dragStateRef.current.pointerId !== event.pointerId) return

    if (event.cancelable) {
      event.preventDefault()
    }

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.('[data-image-index]')
    if (!target) return

    const nextIndex = Number.parseInt(
      target.getAttribute('data-image-index') || '',
      10
    )
    if (!Number.isInteger(nextIndex)) return
    if (nextIndex === dragStateRef.current.currentIndex) return

    const reordered = moveItem(
      normalizedImages,
      dragStateRef.current.currentIndex,
      nextIndex
    )
    dragStateRef.current.currentIndex = nextIndex
    setDraggingIndex(nextIndex)
    onChange(reordered)
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
      new Set(
        extractUrlCandidates(uploadResult)
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      )
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
        <div
          onPointerMove={handleGridPointerMove}
          onPointerUp={(event) => stopDrag(event.pointerId)}
          onPointerCancel={(event) => stopDrag(event.pointerId)}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') {
              stopDrag(event.pointerId)
            }
          }}
          className={
            isCirclePreview
              ? 'flex flex-wrap gap-3'
              : isSquarePreview
              ? 'flex flex-wrap gap-3'
              : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
          }
        >
          {normalizedImages.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              data-image-index={index}
              className={`group overflow-hidden border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
                isCirclePreview
                  ? 'rounded-full h-28 w-28'
                  : isSquarePreview
                  ? 'rounded-xl h-40 w-40'
                  : 'rounded-xl'
              }`}
            >
              <div className="relative">
                {onPreviewClick ? (
                  <button
                    type="button"
                    onClick={() => onPreviewClick(imageUrl, index)}
                    className="block w-full cursor-zoom-in p-0 text-left"
                    title="Открыть изображение"
                    aria-label="Открыть изображение"
                  >
                    <img
                      src={imageUrl}
                      alt={`uploaded-${index + 1}`}
                      className={`object-cover ${
                        isCirclePreview
                          ? 'h-28 w-28 rounded-full'
                          : isSquarePreview
                          ? 'h-40 w-40'
                          : 'h-28 w-full'
                      }`}
                    />
                  </button>
                ) : (
                  <img
                    src={imageUrl}
                    alt={`uploaded-${index + 1}`}
                    className={`object-cover ${
                      isCirclePreview
                        ? 'h-28 w-28 rounded-full'
                        : isSquarePreview
                        ? 'h-40 w-40'
                        : 'h-28 w-full'
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className={`absolute right-2 top-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-rose-300 bg-rose-50/90 text-rose-600 shadow-sm transition hover:bg-rose-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-400/40 dark:bg-slate-900/80 dark:text-rose-300 ${
                    isTouchLikeDevice
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Удалить изображение"
                  aria-label="Удалить изображение"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.75 5.5h12.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7.25 5.5V4.75A1.75 1.75 0 019 3h2a1.75 1.75 0 011.75 1.75v.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6.5 7.5v7a2 2 0 002 2h3a2 2 0 002-2v-7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8.75 9.25v4.5M11.25 9.25v4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              {normalizedImages.length > 1 && (
                <div className="space-y-2 p-2">
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
                      onPointerDown={(event) =>
                        handleDragHandlePointerDown(index, event)
                      }
                      onPointerUp={(event) => stopDrag(event.pointerId)}
                      onPointerCancel={(event) => stopDrag(event.pointerId)}
                      disabled={disabled}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 ${
                        draggingIndex === index ? 'bg-slate-100 dark:bg-slate-800' : ''
                      }`}
                      title="Перетащить"
                      aria-label="Перетащить"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path d="M6 4.75a1.25 1.25 0 112.5 0A1.25 1.25 0 016 4.75zm0 5.25a1.25 1.25 0 112.5 0A1.25 1.25 0 016 10zm0 5.25a1.25 1.25 0 112.5 0A1.25 1.25 0 016 15.25zm5.5-10.5a1.25 1.25 0 112.5 0 1.25 1.25 0 01-2.5 0zm0 5.25a1.25 1.25 0 112.5 0 1.25 1.25 0 01-2.5 0zm0 5.25a1.25 1.25 0 112.5 0 1.25 1.25 0 01-2.5 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        isCirclePreview ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="inline-flex h-28 w-28 cursor-pointer items-center justify-center rounded-full border border-dashed border-primary/50 bg-slate-50 p-3 text-center text-xs font-semibold text-primary transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#00D1FF]/70 dark:bg-[#070015]/90 dark:text-[#bdf4ff] dark:shadow-[0_0_0_1px_rgba(0,209,255,0.2)] dark:hover:bg-[#00D1FF]/12 dark:hover:text-[#e9fbff]"
          >
            {isUploading ? 'Загрузка…' : resolvedUploadLabel}
          </button>
        ) : isSquarePreview ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="inline-flex h-40 w-40 cursor-pointer items-center justify-center rounded-xl border border-dashed border-primary/50 bg-slate-50 p-3 text-center text-xs font-semibold text-primary transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#00D1FF]/70 dark:bg-[#070015]/90 dark:text-[#bdf4ff] dark:shadow-[0_0_0_1px_rgba(0,209,255,0.2)] dark:hover:bg-[#00D1FF]/12 dark:hover:text-[#e9fbff]"
          >
            {isUploading ? 'Загрузка…' : resolvedUploadLabel}
          </button>
        ) : (
          <p className="text-sm text-slate-500">Изображения отсутствуют.</p>
        )
      )}

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
        {normalizedImages.length < maxImages && !((isCirclePreview || isSquarePreview) && normalizedImages.length === 0) && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="inline-flex cursor-pointer justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isUploading ? 'Загрузка...' : resolvedUploadLabel}
          </button>
        )}
        {maxImages > 1 && (
          <span className="text-xs text-slate-500">
            {normalizedImages.length}/{maxImages}
          </span>
        )}
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
  onPreviewClick: PropTypes.func,
  directory: PropTypes.string,
  imageName: PropTypes.string,
  project: PropTypes.string,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  maxImages: PropTypes.number,
  previewShape: PropTypes.oneOf(['rect', 'circle', 'square']),
  uploadLabel: PropTypes.string,
}

ImagesInput.defaultProps = {
  images: [],
  onChange: () => {},
  onPreviewClick: null,
  directory: 'temp',
  imageName: null,
  project: process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest',
  label: null,
  disabled: false,
  maxImages: 10,
  previewShape: 'rect',
  uploadLabel: null,
}

export default ImagesInput
