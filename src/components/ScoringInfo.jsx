import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, ChevronDown } from 'lucide-react'

const GRUPOS_RULES = [
  { pts: '+10', label: 'Resultado exacto', desc: 'acertás el marcador completo' },
  { pts: '+5', label: 'Ganador o empate', desc: 'acertás quién gana (o el empate), sin importar los goles' },
  { pts: '+2', label: 'Goles de un equipo', desc: 'por cada equipo cuyo marcador acertaste' },
]

const GRUPOS_EXAMPLES = [
  'Real 3-0, pronóstico 3-0 → +10 (exacto)',
  'Real 3-0, pronóstico 3-1 → +5 (ganador)',
  'Real 3-0, pronóstico 0-0 → +2 (goles de un equipo)',
]

const ELIM_RULES = [
  { pts: '+20', label: 'Ganador del cruce', desc: 'el equipo que hiciste avanzar es el que realmente ganó el cruce' },
  { pts: '0', label: 'Incorrecto o vacío', desc: 'no se predicen marcadores, solo quién avanza' },
]

const SUMMARY = {
  grupos: 'Exacto +10 · Ganador +5 · Goles +2',
  eliminatorias: 'Ganador del cruce +20',
}

export default function ScoringInfo({ variant = 'grupos' }) {
  const [open, setOpen] = useState(false)
  const rules = variant === 'grupos' ? GRUPOS_RULES : ELIM_RULES

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Info size={16} className="shrink-0 text-pitch" />
        <span className="flex-1 text-sm">
          <span className="font-semibold">Cómo se suman los puntos</span>
          <span className="ml-2 text-xs text-white/40">{SUMMARY[variant]}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-3 pb-3">
              {rules.map((r) => (
                <div key={r.label} className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-6 min-w-[2.75rem] items-center justify-center rounded-md px-1 font-head text-sm font-bold tabular-nums
                      ${r.pts === '0' ? 'bg-white/10 text-white/60' : 'bg-trophy/20 text-trophy'}`}
                  >
                    {r.pts}
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold">{r.label}</span>
                    <span className="text-white/50"> — {r.desc}</span>
                  </span>
                </div>
              ))}

              {variant === 'grupos' && (
                <div className="mt-2 rounded-lg bg-bg/60 p-2">
                  <p className="mb-1 text-xs font-semibold text-white/60">
                    Los puntos no se acumulan: vale solo el mayor que apliques.
                  </p>
                  <ul className="space-y-0.5 text-xs text-white/50">
                    {GRUPOS_EXAMPLES.map((ex) => (
                      <li key={ex}>• {ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              {variant === 'eliminatorias' && (
                <p className="mt-1 rounded-lg bg-bg/60 p-2 text-xs text-white/50">
                  Cada acierto vale +20 en cualquier ronda: Dieciseisavos, Octavos, Cuartos, Semis o Final.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
