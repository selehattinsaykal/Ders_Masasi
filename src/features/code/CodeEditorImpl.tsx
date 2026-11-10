import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import { indentUnit } from '@codemirror/language'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { useMemo } from 'react'
import { isDark } from '../../lib/theme'

export default function CodeEditorImpl({
  value,
  onChange,
  onRun,
  readOnly,
  minHeight = '180px',
}: {
  value: string
  onChange: (v: string) => void
  onRun?: () => void
  readOnly?: boolean
  minHeight?: string
}) {
  const extensions = useMemo(
    () => [
      python(),
      indentUnit.of('    '),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRun?.()
            return true
          },
        },
        indentWithTab,
      ]),
    ],
    [onRun],
  )
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={isDark() ? 'dark' : 'light'}
      readOnly={readOnly}
      minHeight={minHeight}
      maxHeight="60vh"
      basicSetup={{ tabSize: 4, foldGutter: false, highlightActiveLine: !readOnly }}
      style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }}
      aria-label="Python kodu"
    />
  )
}
