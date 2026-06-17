import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GRUPOS } from '../data/groups.js'
import { useStored } from '../hooks/useStored.js'
import { getGroupPredictions, setGroupPrediction } from '../lib/predictions.js'
import MatchCard from '../components/MatchCard.jsx'
import ScoringInfo from '../components/ScoringInfo.jsx'

const GRUPO_IDS = Object.keys(GRUPOS)

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 240 : -240, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -240 : 240, opacity: 0 }),
}

export default function FaseGrupos({ alias, tick, onOpenMatch }) {
  const matches = useStored('matches', tick) || []
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getGroupPredictions(alias).then(setPreds)
  }, [alias, tick])

  const grupo = GRUPO_IDS[index]
  const groupMatches = useMemo(() => matches.filter((m) => m.grupo === grupo), [matches, grupo])
  const predFor = (matchId) => preds.find((p) => p.matchId === matchId)

  const goto = (next) => {
    const clamped = Math.max(0, Math.min(GRUPO_IDS.length - 1, next))
    if (clamped === index) return
    setDirection(clamped > index ? 1 : -1)
    setIndex(clamped)
  }

  const handlePredict = async (matchId, a, b) => {
    const list = await setGroupPrediction(alias, matchId, a, b)
    setPreds([...list])
  }

  // cuántos partidos del grupo ya tienen pronóstico cargado
  const doneCount = groupMatches.filter((m) => {
    const p = predFor(m.id)
    return p?.pronosticoA != null && p?.pronosticoB != null
  }).length

  return (
    <div className="space-y-3">
      <ScoringInfo variant="grupos" />

      {/* chips de salto directo */}
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {GRUPO_IDS.map((g, i) => (
          <button
            key={g}
            onClick={() => goto(i)}
            className={`h-9 min-w-9 shrink-0 rounded-lg px-3 font-head font-semibold transition
              ${i === index ? 'bg-pitch text-bg' : 'bg-surface text-white/60'}`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* barra de navegación del carrusel */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => goto(index - 1)}
          disabled={index === 0}
          aria-label="Grupo anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-white/70 transition hover:text-white disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <span className="font-head text-lg font-bold">Grupo {grupo}</span>
          <span className="ml-2 text-xs text-white/40">
            {doneCount}/{groupMatches.length} cargados
          </span>
        </div>
        <button
          onClick={() => goto(index + 1)}
          disabled={index === GRUPO_IDS.length - 1}
          aria-label="Grupo siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-white/70 transition hover:text-white disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* slide del grupo: swipe horizontal */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={grupo}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.x < -80 || velocity.x < -500) goto(index + 1)
              else if (offset.x > 80 || velocity.x > 500) goto(index - 1)
            }}
            className="space-y-2"
          >
            {groupMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predFor(m.id)}
                onPredict={(a, b) => handlePredict(m.id, a, b)}
                onOpen={() => onOpenMatch(m)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="text-center text-xs text-white/30">Deslizá para cambiar de grupo</p>
    </div>
  )
}
