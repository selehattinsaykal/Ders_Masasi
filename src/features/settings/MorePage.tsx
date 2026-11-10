import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { MORE_ITEMS } from '../../ui/Layout'
import { PageHeader } from '../../ui/kit'

/** Telefonda alt çubuğa sığmayan sayfalar. */
export default function MorePage() {
  return (
    <>
      <PageHeader title="Daha fazla" />
      <ul className="overflow-hidden rounded-xl border border-line bg-surface">
        {MORE_ITEMS.map((it) => {
          const Icon = it.icon
          return (
            <li key={it.to} className="border-b border-line last:border-b-0">
              <Link to={it.to} className="flex min-h-14 items-center gap-3 px-4 font-semibold hover:bg-sunken">
                <Icon size={20} className="text-pen" />
                <span className="flex-1">{it.label}</span>
                <ChevronRight size={18} className="text-soft" />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
