import { useState, useEffect, useRef } from 'react'
import { RefreshCw, UserCog, CloudUpload } from 'lucide-react'
import { useCurrentUser } from './hooks/useCurrentUser.js'
import { useSync } from './hooks/useSync.js'
import { storage } from './lib/storage.js'
import { hasLocalData, migrateLocalToRemote, autoMigrateIfNeeded } from './lib/migrate.js'
import BottomNav from './components/BottomNav.jsx'
import MatchDetail from './components/MatchDetail.jsx'
import Skeleton from './components/Skeleton.jsx'
import Onboarding from './views/Onboarding.jsx'
import Home from './views/Home.jsx'
import GruposStandings from './views/GruposStandings.jsx'
import FaseGrupos from './views/FaseGrupos.jsx'
import Bracket from './views/Bracket.jsx'
import Ranking from './views/Ranking.jsx'

const TITLES = {
  home: 'Inicio',
  grupos: 'Tabla de Grupos',
  fase: 'Fase de Grupos',
  llaves: 'Clasificados',
  ranking: 'Ranking',
}

export default function App() {
  const { alias, register, change } = useCurrentUser()
  const { syncing, lastSync, tick, runSync } = useSync()
  const [tab, setTab] = useState('home')
  const [openMatch, setOpenMatch] = useState(null)
  const [canMigrate, setCanMigrate] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const autoTried = useRef(false)

  const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD

  // El botón manual es solo un respaldo: lo mostramos si quedan datos varados.
  useEffect(() => {
    setCanMigrate(Boolean(isProd && hasLocalData()))
  }, [isProd])

  // Auto-migración: un amigo que apostó antes de Upstash tiene sus datos varados en el
  // localStorage de este teléfono. Apenas el primer sync siembra `matches` (tick > 0), los
  // subimos solos al backend para que al entrar con su alias vea todo. Corre una sola vez y
  // es no destructivo; si falla, dejamos el botón manual como respaldo.
  useEffect(() => {
    if (!isProd || tick === 0 || autoTried.current || !hasLocalData()) return
    autoTried.current = true
    ;(async () => {
      try {
        const matches = (await storage.get('matches')) || []
        await autoMigrateIfNeeded({ storage, matches })
        setCanMigrate(false)
        await runSync()
      } catch {
        /* el botón manual queda disponible como respaldo */
      }
    })()
  }, [isProd, tick, runSync])

  const migrate = async () => {
    if (migrating) return
    if (!confirm('¿Mudar tus datos guardados en este dispositivo al ranking compartido? No se pisa nada que ya esté en la nube.')) return
    setMigrating(true)
    try {
      const matches = (await storage.get('matches')) || []
      const r = await migrateLocalToRemote({ storage, matches })
      alert(`Listo. Migrados: ${r.migratedUsers} jugador(es), ${r.gruposAdded} pronósticos de grupos y ${r.llavesAdded} de llaves.`)
      setCanMigrate(false)
      await runSync()
    } catch (e) {
      alert('No se pudo migrar: ' + (e?.message || e))
    } finally {
      setMigrating(false)
    }
  }

  if (alias === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (alias === null) {
    return <Onboarding onRegister={register} />
  }

  const ready = tick > 0
  const props = { alias, tick, lastSync, onOpenMatch: setOpenMatch }

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-20">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.08] bg-bg/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="font-head text-lg font-bold leading-none">{TITLES[tab]}</h1>
          <p className="text-xs text-white/40">Hola, {alias}</p>
        </div>
        <div className="flex items-center gap-1">
          {canMigrate && (
            <button
              onClick={migrate}
              disabled={migrating}
              aria-label="Mudar mis datos a la nube"
              title="Mudar mis datos de este dispositivo al ranking compartido"
              className="rounded-full p-2 hover:bg-white/10"
            >
              <CloudUpload size={18} className={migrating ? 'animate-pulse text-pitch' : 'text-trophy'} />
            </button>
          )}
          <button onClick={runSync} aria-label="Actualizar" className="rounded-full p-2 hover:bg-white/10">
            <RefreshCw size={18} className={syncing ? 'animate-spin text-pitch' : 'text-white/60'} />
          </button>
          <button
            onClick={() => {
              if (confirm('¿Cambiar de alias? Perderás el acceso local a tus datos desde este dispositivo (los datos en la nube se conservan).')) change()
            }}
            aria-label="Cambiar alias"
            className="rounded-full p-2 hover:bg-white/10"
          >
            <UserCog size={18} className="text-white/60" />
          </button>
        </div>
      </header>

      <main className="p-4">
        {!ready ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {tab === 'home' && <Home {...props} />}
            {tab === 'grupos' && <GruposStandings {...props} />}
            {tab === 'fase' && <FaseGrupos {...props} />}
            {tab === 'llaves' && <Bracket {...props} />}
            {tab === 'ranking' && <Ranking {...props} />}
          </>
        )}
      </main>

      {openMatch && (
        <MatchDetail
          match={openMatch}
          alias={alias}
          onClose={() => setOpenMatch(null)}
        />
      )}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
