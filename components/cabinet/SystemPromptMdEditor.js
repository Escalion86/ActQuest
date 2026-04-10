import { useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

import { htmlToMarkdown, markdownToHtml } from '@helpers/promptMarkdown'

const ToolbarButton = ({ label, onClick, isActive, disabled }) => (
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
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  disabled: PropTypes.bool,
}

ToolbarButton.defaultProps = {
  isActive: false,
  disabled: false,
}

const SystemPromptMdEditor = ({ valueMd, onChange, disabled, placeholder }) => {
  const normalizedMd = typeof valueMd === 'string' ? valueMd : ''
  const normalizedHtml = useMemo(() => markdownToHtml(normalizedMd), [normalizedMd])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
        }),
        Link.configure({
          autolink: true,
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
      ],
      content: normalizedHtml,
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            'ProseMirror aq-rich-text-base max-w-none min-h-[180px] px-4 py-3 text-slate-800 focus:outline-none dark:text-slate-100',
        },
      },
      onUpdate: ({ editor: instance }) => {
        const html = instance.getHTML()
        const md = htmlToMarkdown(html)
        onChange({
          markdown: md,
          html,
          plainText: instance.getText(),
        })
      },
    },
    [disabled],
  )

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() === normalizedHtml) return
    editor.commands.setContent(normalizedHtml, false)
  }, [editor, normalizedHtml])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        Загрузка редактора...
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <ToolbarButton
          label="H2"
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
        />
        <ToolbarButton
          label="H3"
          isActive={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
        />
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
          label="S"
          isActive={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
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
          label="Quote"
          isActive={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label="Code"
          isActive={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label="Link"
          isActive={editor.isActive('link')}
          onClick={() => {
            if (disabled) return
            const currentHref = editor.getAttributes('link').href || ''
            const nextHref = window.prompt('Введите ссылку', currentHref)
            if (nextHref === null) return
            const normalizedHref = String(nextHref).trim()
            if (!normalizedHref) {
              editor.chain().focus().unsetLink().run()
              return
            }
            editor.chain().focus().setLink({ href: normalizedHref }).run()
          }}
          disabled={disabled}
        />
      </div>

      <div className="relative max-h-[34vh] overflow-y-auto">
        <EditorContent editor={editor} />
        {editor.isEmpty && placeholder ? (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400 dark:text-slate-500">
            {placeholder}
          </p>
        ) : null}
      </div>
    </div>
  )
}

SystemPromptMdEditor.propTypes = {
  valueMd: PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
}

SystemPromptMdEditor.defaultProps = {
  valueMd: '',
  onChange: () => {},
  disabled: false,
  placeholder: '',
}

export default SystemPromptMdEditor
