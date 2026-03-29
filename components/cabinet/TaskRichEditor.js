import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import { Node, mergeAttributes } from '@tiptap/core'

import { sendImage } from '@helpers/cloudinary'

const FONT_OPTIONS = [
  { value: '', label: 'Шрифт по умолчанию' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: '"Futura PT", sans-serif', label: 'Futura PT' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Courier New", monospace', label: 'Courier New' },
]

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

  return dedupeMedia(results)
}

const AudioMessage = Node.create({
  name: 'audioMessage',
  group: 'block',
  atom: true,
  draggable: true,

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
      typeof HTMLAttributes.title === 'string' && HTMLAttributes.title.trim().length > 0
        ? HTMLAttributes.title.trim()
        : 'Аудио'

    return [
      'audio-message',
      mergeAttributes(HTMLAttributes, {
        class: 'aq-audio-message',
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
        },
      ],
    ]
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
  const [uploadMode, setUploadMode] = useState('image')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedColor, setSelectedColor] = useState('#111827')

  const normalizedValue = typeof value === 'string' ? value : ''

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      TextStyle,
      Color,
      FontFamily,
      AudioMessage,
    ],
    []
  )

  const propagateEditorState = useCallback(
    (editorInstance) => {
      const html = editorInstance.getHTML()
      const plainText = editorInstance.getText()
      const media = extractMediaFromHtml(html)
      onChange({ html, plainText, media })
    },
    [onChange]
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
            'prose prose-slate max-w-none min-h-[180px] rounded-b-xl px-4 py-3 text-sm focus:outline-none dark:prose-invert',
        },
      },
      onUpdate: ({ editor: nextEditor }) => {
        propagateEditorState(nextEditor)
      },
    },
    [extensions, disabled]
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

  const triggerFileInput = useCallback(
    (mode) => {
      if (disabled || isUploading) return
      setUploadMode(mode)
      setUploadError('')
      fileInputRef.current?.click()
    },
    [disabled, isUploading]
  )

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file || !editor || disabled || isUploading) return

      setUploadError('')
      setIsUploading(true)

      const uploadResult = await sendImage(
        file,
        null,
        directory,
        null,
        process.env.NEXT_PUBLIC_ESCALIONCLOUD_PROJECT || 'actquest',
        (message) => setUploadError(message || 'Не удалось загрузить файл')
      )

      setIsUploading(false)
      if (!uploadResult) return

      const uploadedUrls = Array.from(
        new Set(
          extractUrlCandidates(uploadResult)
            .map((candidate) =>
              typeof candidate === 'string' ? candidate.trim() : ''
            )
            .filter(Boolean)
        )
      )

      if (uploadedUrls.length === 0) {
        setUploadError('Сервер не вернул ссылку на файл')
        return
      }

      const url = uploadedUrls[0]
      if (uploadMode === 'audio') {
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
      }

      propagateEditorState(editor)
    },
    [directory, disabled, editor, isUploading, propagateEditorState, uploadMode]
  )

  const clearFormatting = useCallback(() => {
    if (!editor || disabled) return
    editor.chain().focus().clearNodes().unsetAllMarks().run()
  }, [disabled, editor])

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        Загрузка редактора...
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
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
          label="S"
          isActive={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
        />

        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />

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
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
          aria-label="Шрифт"
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100">
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
            className="h-5 w-6 cursor-pointer bg-transparent p-0"
            aria-label="Цвет текста"
          />
        </label>

        <ToolbarButton
          label="Очистить"
          onClick={clearFormatting}
          disabled={disabled}
        />

        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />

        <ToolbarButton
          label={isUploading && uploadMode === 'image' ? 'Загрузка...' : 'Картинка'}
          onClick={() => triggerFileInput('image')}
          disabled={disabled || isUploading}
        />
        <ToolbarButton
          label={isUploading && uploadMode === 'audio' ? 'Загрузка...' : 'Аудио'}
          onClick={() => triggerFileInput('audio')}
          disabled={disabled || isUploading}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept={uploadMode === 'audio' ? 'audio/*' : 'image/*'}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            void handleFileUpload(file)
            event.target.value = ''
          }}
        />
        </div>

        <EditorContent editor={editor} />

        {uploadError ? (
          <p className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            {uploadError}
          </p>
        ) : null}

        {!normalizedValue && placeholder ? (
          <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">
            {placeholder}
          </p>
        ) : null}
      </div>

      <style jsx global>{`
        .ProseMirror img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 12px 0;
          border-radius: 12px;
        }

        .ProseMirror .aq-audio-message,
        .ProseMirror audio-message {
          display: block;
          margin: 12px 0;
          border-radius: 14px;
          border: 1px solid rgba(37, 99, 235, 0.25);
          background: rgba(219, 234, 254, 0.45);
          padding: 10px 12px;
        }

        .ProseMirror .aq-audio-message__meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #1d4ed8;
        }

        .ProseMirror .aq-audio-message__dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #2563eb;
        }

        .ProseMirror .aq-audio-message audio,
        .ProseMirror audio-message audio {
          width: 100%;
        }

        .dark .ProseMirror .aq-audio-message,
        .dark .ProseMirror audio-message {
          border-color: rgba(96, 165, 250, 0.4);
          background: rgba(30, 58, 138, 0.25);
        }

        .dark .ProseMirror .aq-audio-message__meta {
          color: #bfdbfe;
        }

        .dark .ProseMirror .aq-audio-message__dot {
          background: #93c5fd;
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
