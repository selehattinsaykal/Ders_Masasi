import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import { cx } from '../lib/format'

/** Bağlantı ve görsellerde yalnızca güvenli adres türlerine izin verir. */
function safeUrl(url: string): string {
  if (/^(https?:|mailto:|#)/i.test(url)) return url
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(url)) return url
  return ''
}

export default function MarkdownImpl({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx('md', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        urlTransform={safeUrl}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
          img: ({ node: _node, ...props }) => <img loading="lazy" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
