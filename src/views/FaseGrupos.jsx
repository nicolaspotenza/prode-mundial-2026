import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { GRUPOS } from '../data/groups.js'
import { useStored } from '../hooks/useStored.js'
import { getGroupPredictions, setGroupPrediction } from '../lib/predictions.js'
import MatchCard from '../components/MatchCard.jsx'

const GRUPO_IDS = Object.keys(GRUPOS)

export default function FaseGrupos({ alias, tick, onOpenMatch }) {
  const matches = useStored('matches', tick) || []
  const [grupo, setGrupo] = useState(GRUPO_IDS[0])
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getGroupPredictions(alias).then(setPreds)
  }, [alias, tick])

  const groupMatches = useMemo(() => matches.filter((m) => m.grupo === grupo), [matches, grupo])
  const predFor = (matchId) => preds.find((p) => p.matchId === matchId)

  const handlePredict = async (matchId, a, b) => {
    const list = await setGroupPrediction(alias, matchId, a, b)
    setPreds([...list])
  }

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {GRUPO_IDS.map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className={`h-9 min-w-9 shrink-0 rounded-lg px-3 font-head font-semibold transition
              ${g === grupo ? 'bg-pitch text-bg' : 'bg-surface text-white/60'}`}
          >
            {g}
          </button>
        ))}
      </div>

      <motion.div layout className="space-y-2">
        {groupMatches.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <MatchCard
              match={m}
              prediction={predFor(m.id)}
              onPredict={(a, b) => handlePredict(m.id, a, b)}
              onOpen={() => onOpenMatch(m)}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
