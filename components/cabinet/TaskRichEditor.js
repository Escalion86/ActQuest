import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

import { sendImage } from '@helpers/cloudinary'

const FONT_OPTIONS = [
  { value: '', label: 'Шрифт по умолчанию' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: '"Futura PT", sans-serif', label: 'Futura PT' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
]

const SLASH_COMMANDS = [
  { id: 'h2', label: 'Заголовок 2', aliases: ['h2', 'heading', 'title'] },
  { id: 'h3', label: 'Заголовок 3', aliases: ['h3', 'subtitle'] },
  {
    id: 'paragraph',
    label: 'Обычный текст',
    aliases: ['text', 'p', 'paragraph'],
  },
  {
    id: 'bulletList',
    label: 'Маркированный список',
    aliases: ['list', 'ul', 'bullet'],
  },
  {
    id: 'orderedList',
    label: 'Нумерованный список',
    aliases: ['ol', 'ordered', 'number'],
  },
  { id: 'blockquote', label: 'Цитата', aliases: ['quote', 'blockquote'] },
  { id: 'codeBlock', label: 'Код-блок', aliases: ['code', 'snippet'] },
]

const ESCALIONCLOUD_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ESCALIONCLOUD_PUBLIC_ORIGIN ||
  'https://escalioncloud.ru'

const extractUrlCandidates = (value) => {
  if (!value) return []

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
      value.path,
      value.location,
      ...(Array.isArray(value.files) ? value.files : []),
      ...(Array.isArray(value.urls) ? value.urls : []),
      ...(Array.isArray(value.data) ? value.data : []),
    ].flatMap((item) => extractUrlCandidates(item))
  }

  return []
}

const normalizeUploadedUrl = (value) => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`
  if (/^\/uploads\//i.test(trimmed))
    return `${ESCALIONCLOUD_PUBLIC_ORIGIN}${trimmed}`
  if (/^uploads\//i.test(trimmed))
    return `${ESCALIONCLOUD_PUBLIC_ORIGIN}/${trimmed}`

  return ''
}

const detectUploadModeByFile = (file, fallbackMode = 'image') => {
  const mime = typeof file?.type === 'string' ? file.type.toLowerCase() : ''
  if (mime.startsWith('audio/')) {
    return 'audio'
  }

  const name = typeof file?.name === 'string' ? file.name.toLowerCase() : ''
  if (/\.(mp3|wav|ogg|aac|m4a|flac|opus|weba)$/i.test(name)) {
    return 'audio'
  }

  return fallbackMode === 'audio' ? 'audio' : 'image'
}

const escapeHtmlAttribute = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const buildAudioHtml = (url, title = 'Аудио') => {
  const safeUrl = escapeHtmlAttribute(url)
  const safeTitle = escapeHtmlAttribute(title)

  return `<audio-message src="${safeUrl}" title="${safeTitle}"></audio-message><p></p>`
}

const formatAudioClock = (seconds) => {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value < 0) return '0:00'
  const total = Math.floor(value)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const AudioMessageNodeView = ({ node, updateAttributes, editor }) => {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)

  const src = typeof node?.attrs?.src === 'string' ? node.attrs.src : ''
  const title =
    typeof node?.attrs?.title === 'string' && node.attrs.title.trim()
      ? node.attrs.title.trim()
      : 'Аудио'

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    }
    const onTime = () =>
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onVolume = () =>
      setVolume(Number.isFinite(audio.volume) ? audio.volume : 1)

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onPause)
    audio.addEventListener('volumechange', onVolume)

    onLoaded()
    onVolume()

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onPause)
      audio.removeEventListener('volumechange', onVolume)
    }
  }, [src])

  const progress =
    duration > 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0

  const handleTogglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      const editorRoot = editor?.view?.dom
      if (editorRoot instanceof HTMLElement) {
        editorRoot
          .querySelectorAll('audio[data-aq-audio-native="true"]')
          .forEach((nodeElement) => {
            if (
              nodeElement instanceof HTMLAudioElement &&
              nodeElement !== audio
            ) {
              nodeElement.pause()
            }
          })
      }
      void audio.play().catch(() => {})
      return
    }

    audio.pause()
  }

  const handleSeek = (event) => {
    const audio = audioRef.current
    if (!audio) return
    const percent = Number(event.target.value)
    if (!Number.isFinite(percent)) return
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
    audio.currentTime = (percent / 100) * audio.duration
  }

  const handleVolume = (event) => {
    const audio = audioRef.current
    if (!audio) return
    const nextVolume = Number(event.target.value)
    audio.volume = Math.min(
      1,
      Math.max(0, Number.isFinite(nextVolume) ? nextVolume : 1),
    )
  }

  const handleRename = () => {
    const nextTitle = window.prompt('Введите название аудио', title)
    if (nextTitle === null) return
    updateAttributes({ title: nextTitle.trim() || 'Аудио' })
  }

  return (
    <NodeViewWrapper
      as="div"
      className="aq-audio-message aq-audio-message--custom"
      data-aq-audio-node="true"
    >
      <div className="aq-audio-message__shell" contentEditable={false}>
        <button
          type="button"
          className={`aq-audio-message__play ${isPlaying ? 'is-playing' : ''}`}
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
        >
          <span className="aq-audio-message__play-icon" />
          <span className="aq-audio-message__pause-icon" />
        </button>

        <div className="aq-audio-message__body">
          <div className="aq-audio-message__wave">
            <div
              className="aq-audio-message__wave-progress"
              style={{ width: `${progress}%` }}
            />
            <input
              className="aq-audio-message__seek"
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              aria-label="Перемотка"
            />
          </div>
          <div className="aq-audio-message__meta">
            <button
              type="button"
              className="aq-audio-message__title"
              onDoubleClick={handleRename}
              title="Двойной клик для переименования"
            >
              {title}
            </button>
            <span className="aq-audio-message__time">
              {isPlaying
                ? formatAudioClock(currentTime)
                : formatAudioClock(duration || currentTime)}
            </span>
          </div>
        </div>

        <div className="aq-audio-message__volume-wrap">
          <span className="aq-audio-message__volume-icon" aria-hidden="true">
            {volume <= 0.01 ? '🔇' : volume < 0.55 ? '🔉' : '🔊'}
          </span>
          <input
            className="aq-audio-message__volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolume}
            aria-label="Громкость"
          />
        </div>
      </div>

      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={src}
        draggable="false"
        className="aq-audio-message__native"
        data-aq-audio-native="true"
      />
    </NodeViewWrapper>
  )
}

const dedupeMedia = (media = []) => {
  const seen = new Set()
  return media.filter((item) => {
    const key = `${item.type}:${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const extractMediaFromHtml = (html) => {
  const source = typeof html === 'string' ? html : ''
  const results = []

  const imageRegex = /<img[^>]*\ssrc="([^"]+)"[^>]*>/gi
  let match = imageRegex.exec(source)
  while (match) {
    if (match[1]) {
      results.push({ type: 'image', url: match[1] })
    }
    match = imageRegex.exec(source)
  }

  const audioMessageRegex = /<audio-message[^>]*\ssrc="([^"]+)"[^>]*>/gi
  match = audioMessageRegex.exec(source)
  while (match) {
    if (match[1]) {
      results.push({ type: 'audio', url: match[1] })
    }
    match = audioMessageRegex.exec(source)
  }

  const audioRegex = /<audio[^>]*\ssrc="([^"]+)"[^>]*>/gi
  match = audioRegex.exec(source)
  while (match) {
    if (match[1]) {
      results.push({ type: 'audio', url: match[1] })
    }
    match = audioRegex.exec(source)
  }

  return dedupeMedia(results)
}

const AudioMessage = Node.create({
  name: 'audioMessage',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: '' },
      title: { default: '' },
      mime: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'audio-message' }]
  },

  renderHTML({ HTMLAttributes }) {
    const title =
      typeof HTMLAttributes.title === 'string' &&
      HTMLAttributes.title.trim().length > 0
        ? HTMLAttributes.title.trim()
        : 'Аудио'

    return [
      'audio-message',
      mergeAttributes(HTMLAttributes, {
        class: 'aq-audio-message',
        draggable: 'false',
      }),
      [
        'div',
        { class: 'aq-audio-message__meta', 'aria-hidden': 'true' },
        ['span', { class: 'aq-audio-message__dot' }],
        ['span', { class: 'aq-audio-message__title' }, title],
      ],
      [
        'audio',
        {
          controls: 'true',
          preload: 'metadata',
          src: HTMLAttributes.src || '',
          draggable: 'false',
        },
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioMessageNodeView)
  },
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const ResizableImageNodeView = ({ node, selected, updateAttributes, editor }) => {
  const imageRef = useRef(null)
  const resizeStateRef = useRef(null)
  const frameRef = useRef(null)

  const src = typeof node?.attrs?.src === 'string' ? node.attrs.src : ''
  const alt = typeof node?.attrs?.alt === 'string' ? node.attrs.alt : ''
  const width = Number(node?.attrs?.width)
  const height = Number(node?.attrs?.height)

  const normalizedWidth = Number.isFinite(width) && width > 0 ? width : null
  const normalizedHeight = Number.isFinite(height) && height > 0 ? height : null

  const applySize = useCallback(
    (nextWidth, nextHeight) => {
      updateAttributes({
        width: Math.round(clamp(nextWidth, 80, 1400)),
        height: Math.round(clamp(nextHeight, 60, 1200)),
      })
    },
    [updateAttributes]
  )

  const startResize = useCallback(
    (event, corner) => {
      if (!editor?.isEditable) return
      if (!(event.target instanceof HTMLElement)) return

      event.preventDefault()
      event.stopPropagation()

      const imageElement = imageRef.current
      if (!imageElement) return

      const rect = imageElement.getBoundingClientRect()
      const startWidth = normalizedWidth || rect.width || imageElement.naturalWidth || 320
      const startHeight = normalizedHeight || rect.height || imageElement.naturalHeight || 180
      const aspect = startWidth > 0 && startHeight > 0 ? startWidth / startHeight : 1

      resizeStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startWidth,
        aspect,
        corner,
      }

      const onMove = (moveEvent) => {
        const state = resizeStateRef.current
        if (!state) return

        const horizontalSign = state.corner.includes('e') ? 1 : -1
        const verticalSign = state.corner.includes('s') ? 1 : -1

        const deltaX = (moveEvent.clientX - state.startX) * horizontalSign
        const deltaY = (moveEvent.clientY - state.startY) * verticalSign
        const widthByY = deltaY * state.aspect
        const deltaWidth = Math.abs(deltaX) >= Math.abs(widthByY) ? deltaX : widthByY
        const nextWidth = clamp(state.startWidth + deltaWidth, 80, 1400)
        const nextHeight = clamp(nextWidth / (state.aspect || 1), 60, 1200)

        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current)
        }
        frameRef.current = requestAnimationFrame(() => {
          applySize(nextWidth, nextHeight)
        })
      }

      const finish = () => {
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current)
          frameRef.current = null
        }
        resizeStateRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
    },
    [applySize, editor?.isEditable, normalizedHeight, normalizedWidth]
  )

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      resizeStateRef.current = null
    }
  }, [])

  return (
    <NodeViewWrapper
      as="div"
      className={`aq-image-node ${selected ? 'aq-image-node--selected' : ''}`}
      data-aq-image-node="true"
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        loading="lazy"
        draggable="false"
        className="aq-image-node__image"
        style={{
          width: normalizedWidth ? `${normalizedWidth}px` : undefined,
          height: normalizedHeight ? `${normalizedHeight}px` : undefined,
        }}
      />

      {editor?.isEditable && selected ? (
        <>
          <button type="button" className="aq-image-node__handle aq-image-node__handle--nw" onPointerDown={(event) => startResize(event, 'nw')} aria-label="Изменить размер изображения" />
          <button type="button" className="aq-image-node__handle aq-image-node__handle--ne" onPointerDown={(event) => startResize(event, 'ne')} aria-label="Изменить размер изображения" />
          <button type="button" className="aq-image-node__handle aq-image-node__handle--sw" onPointerDown={(event) => startResize(event, 'sw')} aria-label="Изменить размер изображения" />
          <button type="button" className="aq-image-node__handle aq-image-node__handle--se" onPointerDown={(event) => startResize(event, 'se')} aria-label="Изменить размер изображения" />
        </>
      ) : null}
    </NodeViewWrapper>
  )
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute('width')
          const parsed = Number(attr)
          return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
        },
        renderHTML: (attributes) =>
          attributes.width && Number(attributes.width) > 0
            ? { width: String(Math.round(Number(attributes.width))) }
            : {},
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute('height')
          const parsed = Number(attr)
          return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
        },
        renderHTML: (attributes) =>
          attributes.height && Number(attributes.height) > 0
            ? { height: String(Math.round(Number(attributes.height))) }
            : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView)
  },
})

const ToolbarButton = ({ label, isActive, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
      isActive
        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-100'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
    } disabled:cursor-not-allowed disabled:opacity-50`}
  >
    {label}
  </button>
)

ToolbarButton.propTypes = {
  label: PropTypes.string.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
}

ToolbarButton.defaultProps = {
  isActive: false,
  disabled: false,
}

const TaskRichEditor = ({
  value,
  onChange,
  directory,
  disabled,
  placeholder,
}) => {
  const fileInputRef = useRef(null)
  const editorContentWrapperRef = useRef(null)
  const uploadModeRef = useRef('image')
  const [uploadMode, setUploadMode] = useState('image')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedColor, setSelectedColor] = useState('#111827')
  const [slashMenu, setSlashMenu] = useState({
    isOpen: false,
    from: 0,
    to: 0,
    query: '',
    top: 0,
    left: 0,
    selectedIndex: 0,
  })

  const normalizedValue = typeof value === 'string' ? value : ''

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
      }),
      TextStyle,
      Color,
      FontFamily,
      AudioMessage,
    ],
    [],
  )

  const propagateEditorState = useCallback(
    (editorInstance) => {
      const html = editorInstance.getHTML()
      const plainText = editorInstance.getText()
      const media = extractMediaFromHtml(html)
      onChange({ html, plainText, media })
    },
    [onChange],
  )

  const editor = useEditor(
    {
      extensions,
      content: normalizedValue || '<p></p>',
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            'ProseMirror prose prose-slate max-w-none min-h-[220px] px-5 py-4 text-[15px] leading-5 text-slate-800 focus:outline-none dark:prose-invert dark:text-slate-100',
        },
      },
      onUpdate: ({ editor: nextEditor }) => {
        propagateEditorState(nextEditor)
      },
    },
    [extensions, disabled],
  )

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() === normalizedValue) return
    editor.commands.setContent(normalizedValue || '<p></p>', false)
  }, [editor, normalizedValue])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  const filteredSlashCommands = useMemo(() => {
    const query = slashMenu.query.trim().toLowerCase()
    if (!query) return SLASH_COMMANDS

    return SLASH_COMMANDS.filter((item) =>
      [item.label, ...item.aliases].some((candidate) =>
        candidate.toLowerCase().includes(query),
      ),
    )
  }, [slashMenu.query])

  const runSlashCommand = useCallback(
    (commandId) => {
      if (!editor || disabled) return
      const { from, to } = slashMenu
      if (from > 0 && to >= from) {
        editor.chain().focus().deleteRange({ from, to }).run()
      }

      const chain = editor.chain().focus()
      if (commandId === 'h2') chain.toggleHeading({ level: 2 }).run()
      else if (commandId === 'h3') chain.toggleHeading({ level: 3 }).run()
      else if (commandId === 'paragraph') chain.setParagraph().run()
      else if (commandId === 'bulletList') chain.toggleBulletList().run()
      else if (commandId === 'orderedList') chain.toggleOrderedList().run()
      else if (commandId === 'blockquote') chain.toggleBlockquote().run()
      else if (commandId === 'codeBlock') chain.toggleCodeBlock().run()

      setSlashMenu((prev) => ({
        ...prev,
        isOpen: false,
        selectedIndex: 0,
        query: '',
      }))
      propagateEditorState(editor)
    },
    [disabled, editor, propagateEditorState, slashMenu],
  )

  const closeSlashMenu = useCallback(() => {
    setSlashMenu((prev) =>
      prev.isOpen || prev.query || prev.selectedIndex !== 0
        ? { ...prev, isOpen: false, selectedIndex: 0, query: '' }
        : prev,
    )
  }, [])

  useEffect(() => {
    if (!editor) return undefined

    const syncSlashMenu = () => {
      if (disabled) {
        closeSlashMenu()
        return
      }

      const { state, view } = editor
      const { selection } = state
      if (!selection.empty) {
        closeSlashMenu()
        return
      }

      const cursorPos = selection.from
      const startOfBlock = selection.$from.start()
      const textBeforeCursor = state.doc.textBetween(
        startOfBlock,
        cursorPos,
        '\n',
        '\0',
      )
      const slashMatch = textBeforeCursor.match(
        /(?:^|\s)\/([A-Za-zА-Яа-я0-9-]*)$/,
      )
      if (!slashMatch) {
        closeSlashMenu()
        return
      }

      const slashToken = `/${slashMatch[1] || ''}`
      const slashIndex = textBeforeCursor.lastIndexOf(slashToken)
      if (slashIndex < 0) {
        closeSlashMenu()
        return
      }

      const slashFrom = cursorPos - (textBeforeCursor.length - slashIndex)
      let coords
      try {
        coords = view.coordsAtPos(cursorPos)
      } catch (error) {
        closeSlashMenu()
        return
      }

      const wrapperRect =
        editorContentWrapperRef.current?.getBoundingClientRect()
      if (!coords || !wrapperRect) {
        closeSlashMenu()
        return
      }

      const relativeTop = Math.max(8, coords.bottom - wrapperRect.top + 6)
      const relativeLeft = Math.max(8, coords.left - wrapperRect.left)

      setSlashMenu((prev) => ({
        ...prev,
        isOpen: true,
        from: slashFrom,
        to: cursorPos,
        query: slashMatch[1] || '',
        top: relativeTop,
        left: relativeLeft,
        selectedIndex:
          prev.query === (slashMatch[1] || '') ? prev.selectedIndex : 0,
      }))
    }

    const transactionHandler = () => {
      syncSlashMenu()
    }

    editor.on('selectionUpdate', transactionHandler)
    editor.on('transaction', transactionHandler)
    syncSlashMenu()

    return () => {
      editor.off('selectionUpdate', transactionHandler)
      editor.off('transaction', transactionHandler)
    }
  }, [disabled, editor])

  const handleEditorKeyDown = useCallback(
    (event) => {
      if (!slashMenu.isOpen) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex:
            filteredSlashCommands.length > 0
              ? (prev.selectedIndex + 1) % filteredSlashCommands.length
              : 0,
        }))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex:
            filteredSlashCommands.length > 0
              ? (prev.selectedIndex - 1 + filteredSlashCommands.length) %
                filteredSlashCommands.length
              : 0,
        }))
      } else if (event.key === 'Enter') {
        if (filteredSlashCommands.length === 0) return
        event.preventDefault()
        const command = filteredSlashCommands[slashMenu.selectedIndex]
        if (command?.id) runSlashCommand(command.id)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashMenu()
      }
    },
    [
      closeSlashMenu,
      filteredSlashCommands,
      runSlashCommand,
      slashMenu.isOpen,
      slashMenu.selectedIndex,
    ],
  )

  useEffect(() => {
    if (!editor || disabled) return undefined

    const view = editor.view
    if (!view?.dom) return undefined

    const resolveAudioMessagePos = (targetNode) => {
      if (!(targetNode instanceof HTMLElement)) return null
      const wrapper = targetNode.closest('audio-message')
      if (!(wrapper instanceof HTMLElement)) return null

      let pos
      try {
        pos = view.posAtDOM(wrapper, 0)
      } catch {
        return null
      }

      const candidates = [pos, pos - 1, pos + 1].filter(
        (candidate) => Number.isInteger(candidate) && candidate >= 0,
      )

      for (const candidate of candidates) {
        const node = view.state.doc.nodeAt(candidate)
        if (node?.type?.name === 'audioMessage') {
          return candidate
        }
      }

      return null
    }

    const handleDoubleClick = (event) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      const pos = resolveAudioMessagePos(target)
      if (pos === null) return

      event.preventDefault()

      const node = view.state.doc.nodeAt(pos)
      if (!node || node.type.name !== 'audioMessage') return

      const currentTitle =
        typeof node.attrs?.title === 'string' && node.attrs.title.trim()
          ? node.attrs.title.trim()
          : 'Аудио'
      const nextTitle = window.prompt('Введите название аудио', currentTitle)
      if (nextTitle === null) return

      const normalizedTitle = nextTitle.trim() || 'Аудио'
      if (normalizedTitle === currentTitle) return

      const tr = view.state.tr
      tr.setSelection(NodeSelection.create(view.state.doc, pos))
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        title: normalizedTitle,
      })
      view.dispatch(tr)
      propagateEditorState(editor)
    }

    view.dom.addEventListener('dblclick', handleDoubleClick)
    return () => {
      view.dom.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [disabled, editor, propagateEditorState])

  const forceAppendHtmlToEditor = useCallback(
    (htmlFragment) => {
      if (!editor || !htmlFragment) return false

      const currentHtml = editor.getHTML()
      const hasOnlyEmptyParagraph = currentHtml === '<p></p>'
      const nextHtml = hasOnlyEmptyParagraph
        ? htmlFragment
        : `${currentHtml}${htmlFragment}`

      editor.commands.setContent(nextHtml, true)
      return true
    },
    [editor],
  )

  const triggerFileInput = useCallback(
    (mode) => {
      if (disabled || isUploading) return
      uploadModeRef.current = mode
      setUploadMode(mode)
      setUploadError('')
      if (fileInputRef.current) {
        fileInputRef.current.accept = mode === 'audio' ? 'audio/*' : 'image/*'
      }
      fileInputRef.current?.click()
    },
    [disabled, isUploading],
  )

  const handleFileUpload = useCallback(
    async (file, modeOverride) => {
      if (!file || !editor || disabled || isUploading) return
      const fallbackMode = modeOverride || uploadModeRef.current || uploadMode
      const resolvedMode = detectUploadModeByFile(file, fallbackMode)

      setUploadError('')
      setIsUploading(true)

      const uploadResult = await sendImage(
        file,
        null,
        directory,
        null,
        process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest',
        (message) => setUploadError(message || 'Не удалось загрузить файл'),
      )

      setIsUploading(false)
      if (!uploadResult) return

      const uploadedUrls = Array.from(
        new Set(
          extractUrlCandidates(uploadResult)
            .map((candidate) =>
              normalizeUploadedUrl(
                typeof candidate === 'string' ? candidate.trim() : '',
              ),
            )
            .filter(Boolean),
        ),
      )

      if (uploadedUrls.length === 0) {
        console.warn('[TaskRichEditor] Upload result has no usable URL', {
          mode: resolvedMode,
          fileName: file?.name || null,
          fileType: file?.type || null,
          uploadResult,
        })
        setUploadError('Сервер не вернул ссылку на файл')
        return
      }

      const url = uploadedUrls[0]
      if (resolvedMode === 'audio') {
        const audioHtml = buildAudioHtml(url, file.name || 'Аудио')
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'audioMessage',
            attrs: {
              src: url,
              title: file.name || 'Аудио',
              mime: file.type || '',
            },
          })
          .insertContent({ type: 'paragraph' })
          .run()

        const nextHtml = editor.getHTML()
        if (!nextHtml.includes(url)) {
          forceAppendHtmlToEditor(audioHtml)
        }
      } else {
        editor
          .chain()
          .focus()
          .setImage({
            src: url,
            alt: file.name || 'Изображение задания',
          })
          .insertContent({ type: 'paragraph' })
          .run()

        const nextHtml = editor.getHTML()
        if (!nextHtml.includes(url)) {
          const safeUrl = escapeHtmlAttribute(url)
          const safeAlt = escapeHtmlAttribute(
            file.name || 'Изображение задания',
          )
          forceAppendHtmlToEditor(
            `<p><img src="${safeUrl}" alt="${safeAlt}" loading="lazy"></p><p></p>`,
          )
        }
      }

      propagateEditorState(editor)
    },
    [
      directory,
      disabled,
      editor,
      forceAppendHtmlToEditor,
      isUploading,
      propagateEditorState,
      uploadMode,
    ],
  )

  const clearFormatting = useCallback(() => {
    if (!editor || disabled) return
    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }, [disabled, editor])

  if (!editor) {
    return (
      <div className="px-4 py-3 text-sm bg-white border rounded-xl border-slate-200 text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        Загрузка редактора...
      </div>
    )
  }

  return (
    <>
      <div className="relative overflow-visible bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200/80 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/60">
          <select
            value={
              editor.isActive('heading', { level: 2 })
                ? 'h2'
                : editor.isActive('heading', { level: 3 })
                  ? 'h3'
                  : 'p'
            }
            onChange={(event) => {
              const nextBlock = event.target.value
              if (nextBlock === 'h2')
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              else if (nextBlock === 'h3')
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              else editor.chain().focus().setParagraph().run()
            }}
            disabled={disabled}
            className="px-2 py-1 text-xs font-medium bg-white border rounded-lg border-slate-200 text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            aria-label="Тип блока"
          >
            <option value="p">Текст</option>
            <option value="h2">Заголовок 2</option>
            <option value="h3">Заголовок 3</option>
          </select>

          <ToolbarButton
            label="B"
            isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="I"
            isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="U"
            isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="• List"
            isActive={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="1. List"
            isActive={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="Ссылка"
            isActive={editor.isActive('link')}
            onClick={() => {
              if (disabled) return
              const currentHref = editor.getAttributes('link').href || ''
              const nextHref = window.prompt('Введите ссылку', currentHref)
              if (nextHref === null) return
              const normalizedHref = nextHref.trim()
              if (!normalizedHref) {
                editor.chain().focus().unsetLink().run()
                return
              }
              editor.chain().focus().setLink({ href: normalizedHref }).run()
            }}
            disabled={disabled}
          />

          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />

          <select
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(event) => {
              const nextFont = event.target.value
              if (!nextFont) {
                editor.chain().focus().unsetFontFamily().run()
                return
              }
              editor.chain().focus().setFontFamily(nextFont).run()
            }}
            disabled={disabled}
            className="px-2 py-1 text-xs bg-white border rounded-lg border-slate-200 text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            aria-label="Шрифт"
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 px-2 py-1 text-xs bg-white border rounded-lg border-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100">
            Цвет
            <input
              type="color"
              value={selectedColor}
              disabled={disabled}
              onChange={(event) => {
                const color = event.target.value
                setSelectedColor(color)
                editor.chain().focus().setColor(color).run()
              }}
              className="w-6 h-5 p-0 bg-transparent cursor-pointer"
              aria-label="Цвет текста"
            />
          </label>

          <ToolbarButton
            label={
              isUploading && uploadMode === 'image' ? 'Загрузка...' : 'Картинка'
            }
            onClick={() => triggerFileInput('image')}
            disabled={disabled || isUploading}
          />
          <ToolbarButton
            label={
              isUploading && uploadMode === 'audio' ? 'Загрузка...' : 'Аудио'
            }
            onClick={() => triggerFileInput('audio')}
            disabled={disabled || isUploading}
          />
          <ToolbarButton
            label="Очистить"
            onClick={clearFormatting}
            disabled={disabled}
          />
        </div>

        <p className="px-4 py-2 text-xs border-b border-slate-200/70 text-slate-500 dark:border-slate-700 dark:text-slate-300">
          Введите `/` для быстрых блоков: заголовки, списки, цитата, code block.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={uploadMode === 'audio' ? 'audio/*' : 'image/*'}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            void handleFileUpload(file, uploadModeRef.current)
            event.target.value = ''
          }}
        />

        <div
          ref={editorContentWrapperRef}
          className="relative"
          onKeyDown={handleEditorKeyDown}
        >
          <EditorContent editor={editor} />

          {editor.isEmpty && placeholder ? (
            <p className="absolute text-sm pointer-events-none left-5 top-4 text-slate-400 dark:text-slate-500">
              {placeholder}
            </p>
          ) : null}

          {slashMenu.isOpen ? (
            <div
              className="absolute z-20 w-64 p-1 bg-white border shadow-xl rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900"
              style={{
                top: slashMenu.top,
                left: slashMenu.left,
                maxWidth: 'calc(100% - 16px)',
              }}
            >
              {filteredSlashCommands.length > 0 ? (
                filteredSlashCommands.map((command, index) => (
                  <button
                    key={command.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      runSlashCommand(command.id)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      index === slashMenu.selectedIndex
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{command.label}</span>
                    <span className="text-[10px] uppercase text-slate-400">
                      /{command.aliases[0]}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2.5 py-2 text-xs text-slate-500 dark:text-slate-300">
                  Команд не найдено
                </p>
              )}
            </div>
          ) : null}
        </div>

        {uploadError ? (
          <p className="px-3 py-2 text-xs border-t border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            {uploadError}
          </p>
        ) : null}
      </div>

      <style jsx global>{`
        .ProseMirror p {
          margin: 0;
        }

        .ProseMirror h2 {
          margin: 0.4rem 0 0.35rem;
          font-size: 1.35rem;
          line-height: 1.35;
          font-weight: 700;
          color: #0f172a;
        }

        .ProseMirror h3 {
          margin: 0.35rem 0 0.3rem;
          font-size: 1.15rem;
          line-height: 1.35;
          font-weight: 700;
          color: #1e293b;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          margin: 0.35rem 0;
          padding-left: 1.25rem;
        }

        .ProseMirror ul {
          list-style: disc outside !important;
        }

        .ProseMirror ol {
          list-style: decimal outside !important;
        }

        .ProseMirror li {
          display: list-item;
        }

        .ProseMirror li::marker {
          color: currentColor;
        }

        .ProseMirror blockquote {
          margin: 0.45rem 0;
          border-left: 3px solid rgba(14, 165, 233, 0.9);
          border-radius: 10px;
          background: linear-gradient(
            120deg,
            rgba(14, 165, 233, 0.12),
            rgba(59, 130, 246, 0.06)
          );
          padding: 0.55rem 0.75rem;
          color: #0f3b67;
        }

        .ProseMirror pre {
          margin: 0.45rem 0;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: #0f172a;
          padding: 0.7rem 0.8rem;
          color: #e2e8f0;
        }

        .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .ProseMirror img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 12px 0;
          border-radius: 12px;
        }

        .ProseMirror .aq-image-node {
          position: relative;
          display: inline-block;
          margin: 12px 0;
          line-height: 0;
        }

        .ProseMirror .aq-image-node__image {
          display: block;
          max-width: min(100%, 1400px);
          height: auto;
          border-radius: 12px;
          outline: 1px solid transparent;
          transition: outline-color 0.15s ease;
        }

        .ProseMirror .aq-image-node--selected .aq-image-node__image {
          outline: 2px dashed rgba(56, 189, 248, 0.95);
          outline-offset: 2px;
        }

        .ProseMirror .aq-image-node__handle {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          border: 1px solid #0f172a;
          background: #22d3ee;
          padding: 0;
          z-index: 3;
        }

        .ProseMirror .aq-image-node__handle--nw {
          top: -6px;
          left: -6px;
          cursor: nwse-resize;
        }

        .ProseMirror .aq-image-node__handle--ne {
          top: -6px;
          right: -6px;
          cursor: nesw-resize;
        }

        .ProseMirror .aq-image-node__handle--sw {
          bottom: -6px;
          left: -6px;
          cursor: nesw-resize;
        }

        .ProseMirror .aq-image-node__handle--se {
          bottom: -6px;
          right: -6px;
          cursor: nwse-resize;
        }

        .ProseMirror .aq-audio-message,
        .ProseMirror audio-message {
          display: block;
          margin: 12px 0;
          max-width: 560px;
          border-radius: 16px;
          border: 1px solid rgba(0, 221, 255, 0.3);
          background: linear-gradient(
            132deg,
            rgba(8, 30, 68, 0.95),
            rgba(16, 23, 53, 0.95) 52%,
            rgba(24, 16, 58, 0.95)
          );
          box-shadow:
            0 0 0 1px rgba(0, 221, 255, 0.08),
            0 12px 32px rgba(2, 6, 23, 0.28);
          padding: 11px 12px;
          color: #e7f9ff;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__shell {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr) 88px;
          align-items: center;
          gap: 10px;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__play {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          background: radial-gradient(
            circle at 30% 30%,
            #a78bfa,
            #818cf8 52%,
            #6366f1 100%
          );
          box-shadow:
            0 0 0 1px rgba(224, 231, 255, 0.28),
            0 8px 18px rgba(99, 102, 241, 0.36);
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__play-icon {
          width: 0;
          height: 0;
          border-top: 7px solid transparent;
          border-bottom: 7px solid transparent;
          border-left: 11px solid #0f172a;
          margin-left: 2px;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__pause-icon {
          display: none;
          width: 12px;
          height: 14px;
          background: linear-gradient(
            to right,
            #0f172a 0 4px,
            transparent 4px 8px,
            #0f172a 8px 12px
          );
        }

        .ProseMirror
          .aq-audio-message--custom
          .aq-audio-message__play.is-playing
          .aq-audio-message__play-icon {
          display: none;
        }

        .ProseMirror
          .aq-audio-message--custom
          .aq-audio-message__play.is-playing
          .aq-audio-message__pause-icon {
          display: block;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__body {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__wave {
          position: relative;
          height: 6px;
          margin-top: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(148, 163, 184, 0.22);
        }

        .ProseMirror
          .aq-audio-message--custom
          .aq-audio-message__wave-progress {
          position: absolute;
          inset: 0 auto 0 0;
          width: 0;
          background: linear-gradient(90deg, #22d3ee, #38bdf8);
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__seek {
          position: absolute;
          inset: 0;
          width: 100%;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }

        .ProseMirror .aq-audio-message__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 4;
          margin-bottom: 0;
        }

        .ProseMirror .aq-audio-message__dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22d3ee;
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.24);
        }

        .ProseMirror .aq-audio-message__title {
          min-width: 0;
          border: 0;
          background: transparent;
          padding: 0;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 600;
          color: #dbeafe;
          letter-spacing: 0.01em;
          cursor: text;
        }

        .ProseMirror .aq-audio-message__time {
          flex: 0 0 auto;
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          color: #cbd5e1;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__volume-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__volume-icon {
          font-size: 12px;
          line-height: 1;
          opacity: 0.85;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__volume {
          width: 62px;
          accent-color: #22d3ee;
          cursor: pointer;
        }

        .ProseMirror .aq-audio-message--custom .aq-audio-message__native {
          display: none;
        }

        .ProseMirror .aq-audio-message audio,
        .ProseMirror audio-message audio {
          width: 100%;
          height: 36px;
          border-radius: 10px;
          filter: saturate(1.08) contrast(1.02);
        }

        .ProseMirror .aq-audio-message audio::-webkit-media-controls-panel,
        .ProseMirror audio-message audio::-webkit-media-controls-panel {
          background: rgba(15, 23, 42, 0.28);
        }

        .ProseMirror .aq-audio-message audio::-webkit-media-controls-enclosure,
        .ProseMirror audio-message audio::-webkit-media-controls-enclosure {
          border-radius: 10px;
        }

        .dark .ProseMirror .aq-audio-message,
        .dark .ProseMirror audio-message {
          border-color: rgba(0, 221, 255, 0.34);
          background: linear-gradient(
            132deg,
            rgba(8, 30, 68, 0.95),
            rgba(15, 23, 42, 0.95) 52%,
            rgba(30, 27, 75, 0.95)
          );
        }

        .dark .ProseMirror .aq-audio-message__title {
          color: #e0f2fe;
        }

        .dark .ProseMirror .aq-audio-message--custom .aq-audio-message__play {
          background: radial-gradient(
            circle at 30% 30%,
            #c4b5fd,
            #818cf8 55%,
            #4f46e5 100%
          );
        }

        .dark .ProseMirror .aq-image-node--selected .aq-image-node__image {
          outline-color: rgba(103, 232, 249, 0.95);
        }

        .dark .ProseMirror .aq-image-node__handle {
          border-color: #e2e8f0;
          background: #67e8f9;
        }

        .dark .ProseMirror h2,
        .dark .ProseMirror h3 {
          color: #f8fafc;
        }

        .dark .ProseMirror blockquote {
          border-left-color: rgba(56, 189, 248, 0.9);
          background: linear-gradient(
            120deg,
            rgba(14, 116, 144, 0.35),
            rgba(30, 58, 138, 0.2)
          );
          color: #dbeafe;
        }
      `}</style>
    </>
  )
}

TaskRichEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  directory: PropTypes.string,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
}

TaskRichEditor.defaultProps = {
  value: '',
  onChange: () => {},
  directory: 'games/draft/tasks/draft/editor',
  disabled: false,
  placeholder: '',
}

export default TaskRichEditor
