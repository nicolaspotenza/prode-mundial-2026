import { Home, Trophy, ListOrdered, GitBranch, BarChart3 } from 'lucide-react'

const TABS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'grupos', label: 'Grupos', Icon: Trophy },
  { id: 'fase', label: 'Fase', Icon: ListOrdered },
  { id: 'llaves', label: 'Llaves', Icon: GitBranch },
  { id: 'ranking', label: 'Ranking', Icon: BarChart3 },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ id, label, Icon }) => {
          const on = active === id
          return (
            <li key={id} className="flex-1">
              <button
                onClick={() => onChange(id)}
                aria-current={on ? 'page' : undefined}
                className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-xs transition
                  ${on ? 'text-pitch' : 'text-white/50 hover:text-white/80'}`}
              >
                <Icon size={20} strokeWidth={on ? 2.5 : 2} />
                <span className={on ? 'font-semibold' : ''}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
