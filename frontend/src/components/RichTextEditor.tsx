import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import styles from './RichTextEditor.module.css'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? '' : editor.getHTML())
    },
  })

  if (!editor) return null

  const btn = (active: boolean) =>
    `${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${btn(editor.isActive('bold'))} ${styles.bold}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={`${btn(editor.isActive('italic'))} ${styles.italic}`}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
          title="Italic"
        >
          I
        </button>
        <div className={styles.divider} />
        <button
          type="button"
          className={btn(editor.isActive('bulletList'))}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run() }}
          title="Bullet list"
        >
          <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
            <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor"/>
            <rect x="4.5" y="0.5" width="9.5" height="2" rx="1" fill="currentColor"/>
            <circle cx="1.5" cy="5.5" r="1.5" fill="currentColor"/>
            <rect x="4.5" y="4.5" width="9.5" height="2" rx="1" fill="currentColor"/>
            <circle cx="1.5" cy="9.5" r="1.5" fill="currentColor"/>
            <rect x="4.5" y="8.5" width="9.5" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
        <button
          type="button"
          className={btn(editor.isActive('orderedList'))}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run() }}
          title="Numbered list"
        >
          <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
            <text x="0" y="3.5" fontSize="4" fontWeight="700" fill="currentColor" fontFamily="inherit">1.</text>
            <rect x="4.5" y="0.5" width="9.5" height="2" rx="1" fill="currentColor"/>
            <text x="0" y="7.5" fontSize="4" fontWeight="700" fill="currentColor" fontFamily="inherit">2.</text>
            <rect x="4.5" y="4.5" width="9.5" height="2" rx="1" fill="currentColor"/>
            <text x="0" y="11.5" fontSize="4" fontWeight="700" fill="currentColor" fontFamily="inherit">3.</text>
            <rect x="4.5" y="8.5" width="9.5" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <EditorContent editor={editor} className={styles.editor} />
    </div>
  )
}
