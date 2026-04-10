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

import Modal from '@components/Modal'
import SystemPromptMdEditor from '@components/cabinet/SystemPromptMdEditor'
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
  {
    id: 'frameBox',
    label: 'Рамка',
    aliases: ['frame', 'box', 'рамка'],
  },
  { id: 'blockquote', label: 'Цитата', aliases: ['quote', 'blockquote'] },
  { id: 'codeBlock', label: 'Код-блок', aliases: ['code', 'snippet'] },
]

const ESCALIONCLOUD_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ESCALIONCLOUD_PUBLIC_ORIGIN ||
  'https://escalioncloud.ru'
const MAX_VIDEO_SIZE_BYTES = 40 * 1024 * 1024
const DEFAULT_PICKER_COLOR = '#111827'
const NO_COLOR_TOKEN = '__no_color__'
const AI_SYSTEM_PROMPTS_SECTION = 'task_rich_editor'
const AI_UI_QUESTIONS_PREFIX = 'AQ_UI_QUESTIONS'

const getEditorViewSafe = (editorInstance) => {
  if (!editorInstance) return null
  try {
    return editorInstance.view ?? null
  } catch {
    return null
  }
}

const isEditorEmptySafe = (editorInstance) => {
  if (!editorInstance) return false
  try {
    return Boolean(editorInstance.isEmpty)
  } catch {
    return false
  }
}

const getEditorPlainTextSafe = (editorInstance) => {
  if (!editorInstance) return ''
  try {
    return String(editorInstance.getText?.() || '')
  } catch {
    return ''
  }
}

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
  if (mime.startsWith('video/')) {
    return 'video'
  }
  if (mime.startsWith('audio/')) {
    return 'audio'
  }

  const name = typeof file?.name === 'string' ? file.name.toLowerCase() : ''
  if (/\.(mp4|webm|ogv|mov|m4v|avi|mkv)$/i.test(name)) {
    return 'video'
  }
  if (/\.(mp3|wav|ogg|aac|m4a|flac|opus|weba)$/i.test(name)) {
    return 'audio'
  }

  if (fallbackMode === 'video') {
    return 'video'
  }

  return fallbackMode === 'audio' ? 'audio' : 'image'
}

const escapeHtmlAttribute = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const escapeHtmlText = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const containsHtmlLikeTag = (value) =>
  /<([a-z][\w-]*)(\s[^>]*)?>/i.test(String(value || ''))

const plainTextToEditorHtml = (value) => {
  const normalizedText = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u00A0', ' ')
    .trim()

  if (!normalizedText) {
    return '<p></p>'
  }

  return normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtmlText(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const normalizeEditorInputValue = (value) => {
  const source = typeof value === 'string' ? value : ''
  if (!source.trim()) {
    return '<p></p>'
  }

  if (containsHtmlLikeTag(source)) {
    return source
  }

  return plainTextToEditorHtml(source)
}

const htmlToPlainText = (html) => {
  const source = String(html || '')
  if (!source.trim()) return ''

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return source.replace(/<[^>]*>/g, ' ')
  }

  try {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(source, 'text/html')
    return (doc.body?.textContent || '').trim()
  } catch {
    return source.replace(/<[^>]*>/g, ' ').trim()
  }
}

const normalizeTextWhitespace = (value) =>
  String(value || '')
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u00A0', ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const buildCurrentTextForAiPrompt = (currentHtml) => {
  const source = String(currentHtml || '')
  if (!source.trim()) return ''

  const prepared = source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')

  return normalizeTextWhitespace(htmlToPlainText(prepared))
}

const buildAiRequestContent = ({ currentHtml, includeCurrentText, prompt }) => {
  const currentText = includeCurrentText
    ? buildCurrentTextForAiPrompt(currentHtml)
    : ''
  const cleanPrompt = normalizeTextWhitespace(prompt)

  return [currentText, cleanPrompt].filter(Boolean).join('\n\n')
}

const isSafeLinkHref = (value) => /^https?:\/\/\S+$/i.test(String(value || ''))

const sanitizeAiHtmlPreview = (html) => {
  const source = String(html || '')
  if (!source.trim()) return ''

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return source.replace(/<[^>]*>/g, '')
  }

  try {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(source, 'text/html')
    const allowedTags = new Set(['b', 'br', 'i', 'u', 'del', 'strong', 'em', 'a'])

    const allElements = Array.from(doc.body.querySelectorAll('*'))
    allElements.forEach((element) => {
      const tagName = String(element.tagName || '').toLowerCase()
      if (!allowedTags.has(tagName)) {
        element.replaceWith(...Array.from(element.childNodes))
        return
      }

      if (tagName !== 'a') {
        Array.from(element.attributes).forEach((attribute) => {
          element.removeAttribute(attribute.name)
        })
        return
      }

      const href = String(element.getAttribute('href') || '').trim()
      if (!isSafeLinkHref(href)) {
        element.removeAttribute('href')
        element.removeAttribute('target')
        element.removeAttribute('rel')
        return
      }

      element.setAttribute('href', href)
      element.setAttribute('target', '_blank')
      element.setAttribute('rel', 'noopener noreferrer')

      Array.from(element.attributes).forEach((attribute) => {
        if (!['href', 'target', 'rel'].includes(attribute.name.toLowerCase())) {
          element.removeAttribute(attribute.name)
        }
      })
    })

    return doc.body.innerHTML
  } catch {
    return source.replace(/<[^>]*>/g, '')
  }
}

const formatAiTextToPreviewHtml = (value) => {
  const raw = String(value || '')
  if (!raw.trim()) return ''

  const escaped = escapeHtmlText(raw).replace(/\r\n?/g, '\n')

  const withFormatting = escaped
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<i>$1</i>')
    .replace(/--(.+?)--/g, '<del>$1</del>')
    .replace(/<<([^<>\s]+)>>/g, (match, url) => {
      if (!isSafeLinkHref(url)) return match
      const safeHref = escapeHtmlAttribute(url)
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeHref}</a>`
    })
    .replace(/\n/g, '<br>')

  return sanitizeAiHtmlPreview(withFormatting)
}

const requestJson = async (url, options = {}, fallbackErrorMessage) => {
  const response = await fetch(url, options)
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.success !== true) {
    throw new Error(
      (typeof json?.error === 'string' && json.error) ||
        fallbackErrorMessage ||
        'Запрос завершился с ошибкой',
    )
  }
  return json
}

const AI_UI_QUESTIONS_INSTRUCTIONS = `
Если тебе НЕ хватает данных, верни УТОЧНЯЮЩИЕ ВОПРОСЫ в строгом формате:
${AI_UI_QUESTIONS_PREFIX}
\`\`\`json
{
  "title": "Уточните параметры",
  "questions": [
    {
      "id": "game_type",
      "label": "Тип игры",
      "type": "single_choice",
      "control": "radio",
      "required": true,
      "options": [
        { "value": "classic", "label": "Классика" },
        { "value": "photo", "label": "Фотоквест" }
      ]
    }
  ]
}
\`\`\`

Правила:
- Если задаешь вопросы, не добавляй обычный текст вне этого формата.
- "type" допустим: "single_choice" или "text".
- Для "single_choice" всегда передавай options.
- "control" для выбора: "radio" или "select".
- После получения ответов верни финальный результат задания обычным текстом.
`.trim()

const extractAiQuestionsPayload = (responseText) => {
  const source = String(responseText || '').trim()
  if (!source || !source.includes(AI_UI_QUESTIONS_PREFIX)) {
    return null
  }

  const fencedMatch = source.match(/```json\s*([\s\S]*?)```/i)
  const rawJson = fencedMatch?.[1]
    ? fencedMatch[1]
    : source.replace(AI_UI_QUESTIONS_PREFIX, '').trim()

  try {
    return JSON.parse(rawJson)
  } catch {
    return null
  }
}

const normalizeAiQuestions = (payload) => {
  if (!payload || typeof payload !== 'object') return null
  const rawQuestions = Array.isArray(payload.questions) ? payload.questions : []
  const questions = rawQuestions
    .map((question, index) => {
      const id =
        typeof question?.id === 'string' && question.id.trim()
          ? question.id.trim()
          : `question_${index + 1}`
      const label =
        typeof question?.label === 'string' && question.label.trim()
          ? question.label.trim()
          : `Вопрос ${index + 1}`
      const type = question?.type === 'text' ? 'text' : 'single_choice'
      const control =
        question?.control === 'radio' || question?.control === 'select'
          ? question.control
          : 'select'
      const options =
        type === 'single_choice'
          ? (Array.isArray(question?.options) ? question.options : [])
              .map((option, optionIndex) => {
                const value =
                  typeof option?.value === 'string' && option.value.trim()
                    ? option.value.trim()
                    : `option_${optionIndex + 1}`
                const optionLabel =
                  typeof option?.label === 'string' && option.label.trim()
                    ? option.label.trim()
                    : value
                return { value, label: optionLabel }
              })
              .filter((option) => Boolean(option.value))
          : []

      if (type === 'single_choice' && options.length === 0) {
        return null
      }

      return {
        id,
        label,
        type,
        control,
        required: question?.required !== false,
        options,
      }
    })
    .filter(Boolean)

  if (questions.length === 0) return null
  return {
    title:
      typeof payload?.title === 'string' && payload.title.trim()
        ? payload.title.trim()
        : 'Уточните параметры',
    questions,
  }
}

const buildAnswersMessage = (questionsPayload, answersMap = {}) => {
  if (!questionsPayload?.questions?.length) return ''
  const lines = questionsPayload.questions.map((question) => {
    const rawAnswer =
      typeof answersMap?.[question.id] === 'string' ? answersMap[question.id] : ''
    const normalizedAnswer = rawAnswer.trim()
    return `- ${question.label}: ${normalizedAnswer || 'Не указано'}`
  })
  return `Ответы на уточняющие вопросы:\n${lines.join('\n')}`
}

const toHexColor = (value) => {
  const source = String(value || '').trim()
  if (!source) return ''

  const shortHexMatch = source.match(/^#([0-9a-f]{3})$/i)
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }

  const fullHexMatch = source.match(/^#([0-9a-f]{6})$/i)
  if (fullHexMatch) {
    return `#${fullHexMatch[1].toLowerCase()}`
  }

  const rgbMatch = source.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i,
  )
  if (rgbMatch) {
    const values = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((item) =>
      Number(item),
    )
    if (values.some((item) => !Number.isFinite(item) || item < 0 || item > 255)) {
      return ''
    }
    return `#${values.map((item) => item.toString(16).padStart(2, '0')).join('')}`
  }

  return ''
}

const buildAudioHtml = (url, title = 'Аудио') => {
  const safeUrl = escapeHtmlAttribute(url)
  const safeTitle = escapeHtmlAttribute(title)

  return `<audio-message src="${safeUrl}" title="${safeTitle}"></audio-message><p></p>`
}

const buildVideoHtml = (url, title = 'Видео') => {
  const safeUrl = escapeHtmlAttribute(url)
  const safeTitle = escapeHtmlAttribute(title)

  return `<video-message src="${safeUrl}" title="${safeTitle}"></video-message><p></p>`
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
      const editorRoot = getEditorViewSafe(editor)?.dom
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

  const videoMessageRegex = /<video-message[^>]*\ssrc="([^"]+)"[^>]*>/gi
  match = videoMessageRegex.exec(source)
  while (match) {
    if (match[1]) {
      results.push({ type: 'video', url: match[1] })
    }
    match = videoMessageRegex.exec(source)
  }

  const videoRegex = /<video[^>]*\ssrc="([^"]+)"[^>]*>/gi
  match = videoRegex.exec(source)
  while (match) {
    if (match[1]) {
      results.push({ type: 'video', url: match[1] })
    }
    match = videoRegex.exec(source)
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

const VideoMessage = Node.create({
  name: 'videoMessage',
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
    return [{ tag: 'video-message' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video-message',
      mergeAttributes(HTMLAttributes, {
        class: 'aq-video-message',
        draggable: 'false',
      }),
      [
        'video',
        {
          controls: 'true',
          preload: 'metadata',
          src: HTMLAttributes.src || '',
          playsinline: 'true',
          draggable: 'false',
        },
      ],
    ]
  },
})

const FrameBox = Node.create({
  name: 'frameBox',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.aq-frame-box' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'aq-frame-box',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertFrameBox:
        () =>
        ({ state, commands }) => {
          const { selection } = state
          if (!selection.empty) {
            return commands.wrapIn(this.name)
          }

          return commands.insertContent({
            type: this.name,
            content: [{ type: 'paragraph' }],
          })
        },
    }
  },
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const ResizableImageNodeView = ({
  node,
  selected,
  updateAttributes,
  editor,
}) => {
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
    [updateAttributes],
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
      const startWidth =
        normalizedWidth || rect.width || imageElement.naturalWidth || 320
      const startHeight =
        normalizedHeight || rect.height || imageElement.naturalHeight || 180
      const aspect =
        startWidth > 0 && startHeight > 0 ? startWidth / startHeight : 1

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
        const deltaWidth =
          Math.abs(deltaX) >= Math.abs(widthByY) ? deltaX : widthByY
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
    [applySize, editor?.isEditable, normalizedHeight, normalizedWidth],
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
          <button
            type="button"
            className="aq-image-node__handle aq-image-node__handle--nw"
            onPointerDown={(event) => startResize(event, 'nw')}
            aria-label="Изменить размер изображения"
          />
          <button
            type="button"
            className="aq-image-node__handle aq-image-node__handle--ne"
            onPointerDown={(event) => startResize(event, 'ne')}
            aria-label="Изменить размер изображения"
          />
          <button
            type="button"
            className="aq-image-node__handle aq-image-node__handle--sw"
            onPointerDown={(event) => startResize(event, 'sw')}
            aria-label="Изменить размер изображения"
          />
          <button
            type="button"
            className="aq-image-node__handle aq-image-node__handle--se"
            onPointerDown={(event) => startResize(event, 'se')}
            aria-label="Изменить размер изображения"
          />
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
          return Number.isFinite(parsed) && parsed > 0
            ? Math.round(parsed)
            : null
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
          return Number.isFinite(parsed) && parsed > 0
            ? Math.round(parsed)
            : null
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
  contentMaxHeight,
}) => {
  const fileInputRef = useRef(null)
  const editorContentWrapperRef = useRef(null)
  const uploadModeRef = useRef('image')
  const [uploadMode, setUploadMode] = useState('image')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedColor, setSelectedColor] = useState(DEFAULT_PICKER_COLOR)
  const [isColorActive, setIsColorActive] = useState(false)
  const [isMixedColorSelection, setIsMixedColorSelection] = useState(false)
  const [toolbarState, setToolbarState] = useState({
    blockType: 'p',
    bold: false,
    italic: false,
    strike: false,
    underline: false,
    frameBox: false,
    bulletList: false,
    orderedList: false,
    link: false,
    fontFamily: '',
  })
  const [slashMenu, setSlashMenu] = useState({
    isOpen: false,
    from: 0,
    to: 0,
    query: '',
    top: 0,
    left: 0,
    selectedIndex: 0,
  })
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiIncludeCurrentText, setAiIncludeCurrentText] = useState(true)
  const [aiUseDeepReasoning, setAiUseDeepReasoning] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiPreviewHtml, setAiPreviewHtml] = useState('')
  const [aiSystemPrompts, setAiSystemPrompts] = useState([])
  const [selectedAiSystemPromptId, setSelectedAiSystemPromptId] = useState('')
  const [isAiSystemPromptsLoading, setIsAiSystemPromptsLoading] = useState(false)
  const [aiSystemPromptsError, setAiSystemPromptsError] = useState('')
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false)
  const [systemPromptModalMode, setSystemPromptModalMode] = useState('create')
  const [systemPromptTitleDraft, setSystemPromptTitleDraft] = useState('')
  const [systemPromptMdDraft, setSystemPromptMdDraft] = useState('')
  const [systemPromptModalError, setSystemPromptModalError] = useState('')
  const [isSystemPromptSaving, setIsSystemPromptSaving] = useState(false)
  const [isSystemPromptDeleting, setIsSystemPromptDeleting] = useState(false)
  const [aiConversationHistory, setAiConversationHistory] = useState([])
  const [aiQuestionsPayload, setAiQuestionsPayload] = useState(null)
  const [aiQuestionsAnswers, setAiQuestionsAnswers] = useState({})

  const normalizedValue = typeof value === 'string' ? value : ''
  const normalizedContentValue = useMemo(
    () => normalizeEditorInputValue(normalizedValue),
    [normalizedValue],
  )

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
      VideoMessage,
      FrameBox,
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
      content: normalizedContentValue,
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            'ProseMirror aq-rich-text-base max-w-none min-h-[220px] px-5 py-4 text-slate-800 focus:outline-none dark:text-slate-100',
        },
      },
      onUpdate: ({ editor: nextEditor }) => {
        propagateEditorState(nextEditor)
      },
    },
    [extensions, disabled],
  )
  const hasCurrentEditorText = getEditorPlainTextSafe(editor).trim().length > 0
  const selectedAiSystemPrompt = useMemo(
    () =>
      aiSystemPrompts.find(
        (item) =>
          String(item?.id || '').trim() ===
          String(selectedAiSystemPromptId || '').trim(),
      ) || null,
    [aiSystemPrompts, selectedAiSystemPromptId],
  )

  const loadAiSystemPrompts = useCallback(async () => {
    setIsAiSystemPromptsLoading(true)
    setAiSystemPromptsError('')
    try {
      const json = await requestJson(
        `/api/cabinet/ai-system-prompts?section=${encodeURIComponent(
          AI_SYSTEM_PROMPTS_SECTION,
        )}`,
        { cache: 'no-store' },
        'Не удалось загрузить системные промпты',
      )

      const items = Array.isArray(json?.data) ? json.data : []
      setAiSystemPrompts(items)
      setSelectedAiSystemPromptId((prev) => {
        const prevId = String(prev || '').trim()
        if (prevId && items.some((item) => String(item?.id || '') === prevId)) {
          return prevId
        }
        return ''
      })
    } catch (error) {
      setAiSystemPrompts([])
      setAiSystemPromptsError(
        error?.message || 'Не удалось загрузить системные промпты',
      )
    } finally {
      setIsAiSystemPromptsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() === normalizedContentValue) return
    editor.commands.setContent(normalizedContentValue, false)
  }, [editor, normalizedContentValue])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return undefined

    const readToolbarState = () => ({
      blockType: editor.isActive('heading', { level: 2 })
        ? 'h2'
        : editor.isActive('heading', { level: 3 })
          ? 'h3'
          : 'p',
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      underline: editor.isActive('underline'),
      frameBox: editor.isActive('frameBox'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      link: editor.isActive('link'),
      fontFamily: editor.getAttributes('textStyle').fontFamily || '',
    })

    const readColorState = () => {
      const { selection, doc } = editor.state

      if (selection.empty) {
        const cursorColor = toHexColor(editor.getAttributes('textStyle').color)
        return {
          color: cursorColor || DEFAULT_PICKER_COLOR,
          active: Boolean(cursorColor),
          mixed: false,
        }
      }

      const colors = new Set()
      let hasText = false

      doc.nodesBetween(selection.from, selection.to, (node) => {
        if (!node?.isText || !node.text) return
        hasText = true

        const textStyleMark = node.marks.find(
          (mark) =>
            mark?.type?.name === 'textStyle' &&
            typeof mark?.attrs?.color === 'string' &&
            mark.attrs.color.trim() !== '',
        )
        const normalized = toHexColor(textStyleMark?.attrs?.color || '')
        colors.add(normalized || NO_COLOR_TOKEN)
      })

      if (!hasText) {
        const fallbackColor = toHexColor(editor.getAttributes('textStyle').color)
        return {
          color: fallbackColor || DEFAULT_PICKER_COLOR,
          active: Boolean(fallbackColor),
          mixed: false,
        }
      }

      if (colors.size === 1) {
        const [singleColor] = Array.from(colors)
        if (singleColor === NO_COLOR_TOKEN) {
          return {
            color: DEFAULT_PICKER_COLOR,
            active: false,
            mixed: false,
          }
        }
        return {
          color: singleColor || DEFAULT_PICKER_COLOR,
          active: Boolean(singleColor),
          mixed: false,
        }
      }

      return {
        color: selectedColor,
        active: false,
        mixed: true,
      }
    }

    const syncToolbarState = () => {
      const nextState = readToolbarState()
      const nextColorState = readColorState()
      setToolbarState((prev) => {
        const isSame =
          prev.blockType === nextState.blockType &&
          prev.bold === nextState.bold &&
          prev.italic === nextState.italic &&
          prev.strike === nextState.strike &&
          prev.underline === nextState.underline &&
          prev.frameBox === nextState.frameBox &&
          prev.bulletList === nextState.bulletList &&
          prev.orderedList === nextState.orderedList &&
          prev.link === nextState.link &&
          prev.fontFamily === nextState.fontFamily

        return isSame ? prev : nextState
      })
      setIsMixedColorSelection(nextColorState.mixed)
      setIsColorActive(nextColorState.active)
      if (!nextColorState.mixed && nextColorState.color !== selectedColor) {
        setSelectedColor(nextColorState.color)
      }
    }

    syncToolbarState()

    editor.on('selectionUpdate', syncToolbarState)
    editor.on('transaction', syncToolbarState)
    editor.on('focus', syncToolbarState)
    editor.on('blur', syncToolbarState)

    return () => {
      editor.off('selectionUpdate', syncToolbarState)
      editor.off('transaction', syncToolbarState)
      editor.off('focus', syncToolbarState)
      editor.off('blur', syncToolbarState)
    }
  }, [editor, selectedColor])

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
      else if (commandId === 'frameBox') chain.insertFrameBox().run()
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
      } catch {
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

    const view = getEditorViewSafe(editor)
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
        if (mode === 'audio') {
          fileInputRef.current.accept = 'audio/*'
        } else if (mode === 'video') {
          fileInputRef.current.accept = 'video/*'
        } else {
          fileInputRef.current.accept = 'image/*'
        }
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

      if (resolvedMode === 'video' && Number(file.size) > MAX_VIDEO_SIZE_BYTES) {
        setUploadError('Видео слишком большое. Максимальный размер: 40 МБ.')
        return
      }

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
      } else if (resolvedMode === 'video') {
        const videoHtml = buildVideoHtml(url, file.name || 'Видео')
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'videoMessage',
            attrs: {
              src: url,
              title: file.name || 'Видео',
              mime: file.type || '',
            },
          })
          .insertContent({ type: 'paragraph' })
          .run()

        const nextHtml = editor.getHTML()
        if (!nextHtml.includes(url)) {
          forceAppendHtmlToEditor(videoHtml)
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

  const openAiModal = useCallback(() => {
    if (disabled) return
    setAiIncludeCurrentText(hasCurrentEditorText)
    setIsAiModalOpen(true)
    setAiError('')
    setAiPreviewHtml('')
    void loadAiSystemPrompts()
  }, [disabled, hasCurrentEditorText, loadAiSystemPrompts])

  const closeAiModal = useCallback(() => {
    if (isAiLoading) return
    setIsAiModalOpen(false)
    setAiError('')
  }, [isAiLoading])

  const requestAiRewrite = useCallback(
    async ({ overrideUserContent = '' } = {}) => {
      if (disabled || isAiLoading) return

      const currentHtml = editor?.getHTML?.() || ''
      const content =
        typeof overrideUserContent === 'string' && overrideUserContent.trim()
          ? overrideUserContent.trim()
          : buildAiRequestContent({
              currentHtml,
              includeCurrentText: aiIncludeCurrentText,
              prompt: aiPrompt,
            })

      if (!content) {
        setAiError('Введите запрос или включите передачу текущего текста.')
        setAiPreviewHtml('')
        return
      }

      const systemPromptParts = []
      const baseSystemPrompt =
        typeof selectedAiSystemPrompt?.promptMd === 'string'
          ? selectedAiSystemPrompt.promptMd.trim()
          : ''
      if (baseSystemPrompt) {
        systemPromptParts.push(baseSystemPrompt)
      }
      systemPromptParts.push(AI_UI_QUESTIONS_INSTRUCTIONS)
      const effectiveSystemPrompt = systemPromptParts.join('\n\n')

      const messages = [
        {
          role: 'system',
          content: effectiveSystemPrompt,
        },
        ...aiConversationHistory,
        {
          role: 'user',
          content,
        },
      ]

      setIsAiLoading(true)
      setAiError('')

      try {
        const result = await requestJson(
          '/api/deepseek',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages,
              deep: aiUseDeepReasoning,
            }),
          },
          'Не удалось получить ответ от ИИ',
        )

        const aiText =
          typeof result?.data?.choices?.[0]?.message?.content === 'string'
            ? result.data.choices[0].message.content.trim()
            : ''

        if (!aiText) {
          throw new Error('Не удалось получить ответ от ИИ')
        }

        const parsedQuestions = normalizeAiQuestions(extractAiQuestionsPayload(aiText))
        if (parsedQuestions) {
          setAiQuestionsPayload(parsedQuestions)
          setAiQuestionsAnswers((prev) => {
            const nextAnswers = {}
            parsedQuestions.questions.forEach((question) => {
              const existing =
                typeof prev?.[question.id] === 'string' ? prev[question.id] : ''
              if (existing.trim()) {
                nextAnswers[question.id] = existing
                return
              }
              if (question.type === 'single_choice' && question.options.length > 0) {
                nextAnswers[question.id] = question.options[0].value
              } else {
                nextAnswers[question.id] = ''
              }
            })
            return nextAnswers
          })
          setAiPreviewHtml('')
        } else {
          const nextPreviewHtml = formatAiTextToPreviewHtml(aiText)
          if (!nextPreviewHtml) {
            throw new Error('Не удалось получить ответ от ИИ')
          }
          setAiQuestionsPayload(null)
          setAiQuestionsAnswers({})
          setAiPreviewHtml(nextPreviewHtml)
        }

        setAiConversationHistory((prev) => [
          ...prev,
          { role: 'user', content },
          { role: 'assistant', content: aiText },
        ])
      } catch (error) {
        setAiError(error?.message || 'Не удалось получить ответ от ИИ')
        setAiPreviewHtml('')
      } finally {
        setIsAiLoading(false)
      }
    },
    [
      aiConversationHistory,
      aiIncludeCurrentText,
      aiPrompt,
      aiUseDeepReasoning,
      disabled,
      editor,
      isAiLoading,
      selectedAiSystemPrompt?.promptMd,
    ],
  )

  const applyAiPreviewToEditor = useCallback(() => {
    if (!editor || disabled || !aiPreviewHtml) return
    editor.commands.setContent(aiPreviewHtml, true)
    propagateEditorState(editor)
    setIsAiModalOpen(false)
    setAiError('')
  }, [aiPreviewHtml, disabled, editor, propagateEditorState])

  const submitAiQuestionsAnswers = useCallback(async () => {
    if (!aiQuestionsPayload?.questions?.length) return
    const missingRequired = aiQuestionsPayload.questions.find((question) => {
      if (!question.required) return false
      const answer =
        typeof aiQuestionsAnswers?.[question.id] === 'string'
          ? aiQuestionsAnswers[question.id].trim()
          : ''
      return !answer
    })

    if (missingRequired) {
      setAiError(`Заполните поле «${missingRequired.label}».`)
      return
    }

    const answersMessage = buildAnswersMessage(aiQuestionsPayload, aiQuestionsAnswers)
    if (!answersMessage) {
      setAiError('Не удалось собрать уточнения для ИИ.')
      return
    }

    setAiQuestionsPayload(null)
    await requestAiRewrite({ overrideUserContent: answersMessage })
  }, [aiQuestionsAnswers, aiQuestionsPayload, requestAiRewrite])

  const resetAiConversationContext = useCallback(() => {
    setAiConversationHistory([])
    setAiQuestionsPayload(null)
    setAiQuestionsAnswers({})
    setAiPreviewHtml('')
    setAiError('')
  }, [])

  const openCreateSystemPromptModal = useCallback(() => {
    setSystemPromptModalMode('create')
    setSystemPromptTitleDraft('')
    setSystemPromptMdDraft('')
    setSystemPromptModalError('')
    setIsSystemPromptModalOpen(true)
  }, [])

  const openEditSystemPromptModal = useCallback(() => {
    if (!selectedAiSystemPrompt) return
    setSystemPromptModalMode('edit')
    setSystemPromptTitleDraft(selectedAiSystemPrompt.title || '')
    setSystemPromptMdDraft(selectedAiSystemPrompt.promptMd || '')
    setSystemPromptModalError('')
    setIsSystemPromptModalOpen(true)
  }, [selectedAiSystemPrompt])

  const closeSystemPromptModal = useCallback(() => {
    if (isSystemPromptSaving || isSystemPromptDeleting) return
    setIsSystemPromptModalOpen(false)
    setSystemPromptModalError('')
  }, [isSystemPromptDeleting, isSystemPromptSaving])

  const saveSystemPrompt = useCallback(async () => {
    if (isSystemPromptSaving || isSystemPromptDeleting) return
    const normalizedTitle = String(systemPromptTitleDraft || '').trim()
    const normalizedPromptMd = String(systemPromptMdDraft || '').trim()

    if (!normalizedTitle) {
      setSystemPromptModalError('Укажите заголовок системного промпта.')
      return
    }
    if (!normalizedPromptMd) {
      setSystemPromptModalError('Введите текст системного промпта.')
      return
    }

    setIsSystemPromptSaving(true)
    setSystemPromptModalError('')

    try {
      const endpoint =
        systemPromptModalMode === 'edit' && selectedAiSystemPrompt?.id
          ? `/api/cabinet/ai-system-prompts/${encodeURIComponent(
              selectedAiSystemPrompt.id,
            )}`
          : '/api/cabinet/ai-system-prompts'
      const method =
        systemPromptModalMode === 'edit' && selectedAiSystemPrompt?.id
          ? 'PUT'
          : 'POST'

      const json = await requestJson(
        endpoint,
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: normalizedTitle,
            promptMd: normalizedPromptMd,
            section: AI_SYSTEM_PROMPTS_SECTION,
          }),
        },
        'Не удалось сохранить системный промпт',
      )

      const savedId = String(json?.data?.id || '').trim()
      await loadAiSystemPrompts()
      if (savedId) {
        setSelectedAiSystemPromptId(savedId)
      }
      setIsSystemPromptModalOpen(false)
    } catch (error) {
      setSystemPromptModalError(
        error?.message || 'Не удалось сохранить системный промпт',
      )
    } finally {
      setIsSystemPromptSaving(false)
    }
  }, [
    isSystemPromptDeleting,
    isSystemPromptSaving,
    loadAiSystemPrompts,
    selectedAiSystemPrompt?.id,
    systemPromptMdDraft,
    systemPromptModalMode,
    systemPromptTitleDraft,
  ])

  const deleteSelectedSystemPrompt = useCallback(async () => {
    if (!selectedAiSystemPrompt?.id || isSystemPromptDeleting) return
    if (typeof window !== 'undefined') {
      const shouldDelete = window.confirm(
        `Удалить системный промпт «${selectedAiSystemPrompt.title || 'Без названия'}»?`,
      )
      if (!shouldDelete) return
    }

    setIsSystemPromptDeleting(true)
    setAiSystemPromptsError('')
    try {
      await requestJson(
        `/api/cabinet/ai-system-prompts/${encodeURIComponent(
          selectedAiSystemPrompt.id,
        )}`,
        { method: 'DELETE' },
        'Не удалось удалить системный промпт',
      )
      await loadAiSystemPrompts()
      setSelectedAiSystemPromptId('')
    } catch (error) {
      setAiSystemPromptsError(
        error?.message || 'Не удалось удалить системный промпт',
      )
    } finally {
      setIsSystemPromptDeleting(false)
    }
  }, [isSystemPromptDeleting, loadAiSystemPrompts, selectedAiSystemPrompt])

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
            value={toolbarState.blockType}
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

          <select
            value={toolbarState.fontFamily}
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

          <ToolbarButton
            label="B"
            isActive={toolbarState.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="I"
            isActive={toolbarState.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="U"
            isActive={toolbarState.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="S"
            isActive={toolbarState.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={disabled}
          />

          <label
            className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition ${
              isMixedColorSelection
                ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-200'
                : isColorActive
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-100'
                  : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100'
            }`}
            title={
              isMixedColorSelection
                ? 'В выделении несколько разных цветов'
                : 'Цвет текста'
            }
          >
            Цвет
            <input
              type="color"
              value={selectedColor}
              disabled={disabled}
              onChange={(event) => {
                const color = event.target.value
                setSelectedColor(color)
                setIsMixedColorSelection(false)
                setIsColorActive(true)
                editor.chain().focus().setColor(color).run()
              }}
              className="w-6 h-5 p-0 bg-transparent cursor-pointer"
              aria-label="Цвет текста"
            />
          </label>
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />

          <ToolbarButton
            label="• List"
            isActive={toolbarState.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="1. List"
            isActive={toolbarState.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
          />
          <ToolbarButton
            label="Рамка"
            isActive={toolbarState.frameBox}
            onClick={() => editor.chain().focus().insertFrameBox().run()}
            disabled={disabled}
          />
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
          <ToolbarButton
            label="Ссылка"
            isActive={toolbarState.link}
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
            label={
              isUploading && uploadMode === 'video' ? 'Загрузка...' : 'Видео'
            }
            onClick={() => triggerFileInput('video')}
            disabled={disabled || isUploading}
          />
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
          <ToolbarButton
            label="Очистить"
            onClick={clearFormatting}
            disabled={disabled}
          />
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
          <ToolbarButton
            label="ИИ"
            onClick={openAiModal}
            disabled={disabled || isAiLoading}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={
            uploadMode === 'audio'
              ? 'audio/*'
              : uploadMode === 'video'
                ? 'video/*'
                : 'image/*'
          }
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            void handleFileUpload(file, uploadModeRef.current)
            event.target.value = ''
          }}
        />

        <div
          ref={editorContentWrapperRef}
          className="relative overflow-y-auto overscroll-contain"
          style={{ maxHeight: contentMaxHeight }}
          onKeyDown={handleEditorKeyDown}
        >
          <EditorContent editor={editor} />

          {isEditorEmptySafe(editor) && placeholder ? (
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

      <Modal
        isOpen={isAiModalOpen}
        title="ИИ-редактирование текста"
        onClose={closeAiModal}
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={requestAiRewrite}
              disabled={isAiLoading}
              className="aq-modal-btn aq-modal-btn-secondary"
            >
              {isAiLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#00D1FF]/35 border-t-[#7A00FF] shadow-[0_0_8px_rgba(0,209,255,0.35)]"
                    aria-hidden="true"
                  />
                  Генерация...
                </span>
              ) : (
                'Сгенерировать'
              )}
            </button>
            <button
              type="button"
              onClick={applyAiPreviewToEditor}
              disabled={isAiLoading || !aiPreviewHtml}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              Подставить в текст
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="aq-ai-system-prompt"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
            >
              Системный промпт
            </label>
            <div className="flex items-center gap-2">
              <select
                id="aq-ai-system-prompt"
                value={selectedAiSystemPromptId}
                onChange={(event) => {
                  const nextId = String(event.target.value || '')
                  setSelectedAiSystemPromptId(nextId)
                  resetAiConversationContext()
                }}
                disabled={isAiLoading || isAiSystemPromptsLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Без системного промпта</option>
                {aiSystemPrompts.map((promptItem) => (
                  <option key={promptItem.id} value={promptItem.id}>
                    {promptItem.title || 'Без названия'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openCreateSystemPromptModal}
                disabled={isAiLoading || isAiSystemPromptsLoading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                title="Добавить системный промпт"
              >
                +
              </button>
              <button
                type="button"
                onClick={openEditSystemPromptModal}
                disabled={
                  isAiLoading || isAiSystemPromptsLoading || !selectedAiSystemPrompt
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                title="Редактировать системный промпт"
              >
                Изм.
              </button>
              <button
                type="button"
                onClick={deleteSelectedSystemPrompt}
                disabled={
                  isAiLoading ||
                  isAiSystemPromptsLoading ||
                  isSystemPromptDeleting ||
                  !selectedAiSystemPrompt
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                title="Удалить системный промпт"
              >
                Удалить
              </button>
            </div>
            {isAiSystemPromptsLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Загружаем системные промпты...
              </p>
            ) : null}
            {aiSystemPromptsError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {aiSystemPromptsError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-xs text-slate-600 dark:text-slate-200">
              Контекст диалога: {aiConversationHistory.length / 2 > 0
                ? `${Math.floor(aiConversationHistory.length / 2)} сообщений`
                : 'пустой'}
            </p>
            <button
              type="button"
              onClick={resetAiConversationContext}
              disabled={isAiLoading || aiConversationHistory.length === 0}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Сбросить контекст
            </button>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="aq-ai-prompt"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
            >
              Запрос к ИИ
            </label>
            <textarea
              id="aq-ai-prompt"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              disabled={isAiLoading}
              placeholder="Например: сократи текст, упростить стиль, исправить ошибки."
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={aiIncludeCurrentText}
                onChange={(event) =>
                  setAiIncludeCurrentText(Boolean(event.target.checked))
                }
                disabled={isAiLoading || !hasCurrentEditorText}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400 dark:border-slate-600"
              />
              Передать текущий текст редактора
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={aiUseDeepReasoning}
                onChange={(event) =>
                  setAiUseDeepReasoning(Boolean(event.target.checked))
                }
                disabled={isAiLoading}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400 dark:border-slate-600"
              />
              Deep-режим (reasoner)
            </label>
          </div>

          {aiError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {aiError}
            </p>
          ) : null}

          {aiQuestionsPayload ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {aiQuestionsPayload.title}
              </p>
              <div className="space-y-3">
                {aiQuestionsPayload.questions.map((question) => (
                  <div key={question.id} className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                      {question.label}
                      {question.required ? (
                        <span className="ml-1 text-rose-500" aria-hidden="true">
                          *
                        </span>
                      ) : null}
                    </p>
                    {question.type === 'text' ? (
                      <input
                        type="text"
                        value={aiQuestionsAnswers?.[question.id] || ''}
                        onChange={(event) =>
                          setAiQuestionsAnswers((prev) => ({
                            ...prev,
                            [question.id]: event.target.value,
                          }))
                        }
                        disabled={isAiLoading}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    ) : question.control === 'radio' ? (
                      <div className="flex flex-wrap items-center gap-3">
                        {question.options.map((option) => (
                          <label
                            key={`${question.id}-${option.value}`}
                            className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                          >
                            <input
                              type="radio"
                              name={`ai-question-${question.id}`}
                              value={option.value}
                              checked={
                                String(aiQuestionsAnswers?.[question.id] || '') ===
                                String(option.value)
                              }
                              onChange={(event) =>
                                setAiQuestionsAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: event.target.value,
                                }))
                              }
                              disabled={isAiLoading}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <select
                        value={aiQuestionsAnswers?.[question.id] || ''}
                        onChange={(event) =>
                          setAiQuestionsAnswers((prev) => ({
                            ...prev,
                            [question.id]: event.target.value,
                          }))
                        }
                        disabled={isAiLoading}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {question.options.map((option) => (
                          <option key={`${question.id}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={submitAiQuestionsAnswers}
                  disabled={isAiLoading}
                  className="aq-modal-btn aq-modal-btn-primary"
                >
                  Отправить уточнения
                </button>
              </div>
            </div>
          ) : null}

          {aiPreviewHtml ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Предпросмотр ответа
              </p>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-100">
                <div
                  className="aq-rich-text-base break-words [&_*]:max-w-full [&_*]:break-words"
                  dangerouslySetInnerHTML={{ __html: aiPreviewHtml }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={isSystemPromptModalOpen}
        title={
          systemPromptModalMode === 'edit'
            ? 'Редактирование системного промпта'
            : 'Новый системный промпт'
        }
        onClose={closeSystemPromptModal}
        compactMobile
        footer={
          <>
            <button
              type="button"
              onClick={saveSystemPrompt}
              disabled={isSystemPromptSaving || isSystemPromptDeleting}
              className="aq-modal-btn aq-modal-btn-primary"
            >
              {isSystemPromptSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="aq-system-prompt-title"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
            >
              Заголовок
            </label>
            <input
              id="aq-system-prompt-title"
              type="text"
              value={systemPromptTitleDraft}
              onChange={(event) => setSystemPromptTitleDraft(event.target.value)}
              disabled={isSystemPromptSaving || isSystemPromptDeleting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Например: Редактор задач ActQuest"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Текст системного промпта (Markdown)
            </p>
            <SystemPromptMdEditor
              valueMd={systemPromptMdDraft}
              disabled={isSystemPromptSaving || isSystemPromptDeleting}
              placeholder="Опишите инструкции для ИИ..."
              onChange={({ markdown }) => {
                setSystemPromptMdDraft(markdown || '')
              }}
            />
          </div>

          {systemPromptModalError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {systemPromptModalError}
            </p>
          ) : null}
        </div>
      </Modal>

      <style jsx global>{`
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

        .ProseMirror .aq-video-message,
        .ProseMirror video-message {
          display: block;
          margin: 12px 0;
          max-width: min(100%, 820px);
        }

        .ProseMirror .aq-video-message video,
        .ProseMirror video-message video {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 12px;
          background: #020617;
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
  contentMaxHeight: PropTypes.string,
}

TaskRichEditor.defaultProps = {
  value: '',
  onChange: () => {},
  directory: 'games/draft/tasks/draft/editor',
  disabled: false,
  placeholder: '',
  contentMaxHeight: '56vh',
}

export default TaskRichEditor
