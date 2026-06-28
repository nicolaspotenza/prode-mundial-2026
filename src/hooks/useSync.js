import { useEffect, useState, useCallback, useRef } from 'react'
import { DATA_CONFIG } from '../config.js'
import { syncWithSources, defaultSources } from '../lib/sources/index.js'
import { applySync } from '../lib/applySync.js'
import { applyKnockout } from '../lib/applyKnockout.js'
import { ensureSeeded } from '../lib/seed.js'
import { storage } from '../lib/storage.js'

export function useSync() {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [tick, setTick] = useState(0) // bump para que los consumidores relean storage
  const liveTimer = useRef(null)

  const runSync = useCallback(async () => {
    setSyncing(true)
    try {
      await ensureSeeded()
      const updates = await syncWithSources(defaultSources())
      const { live } = await applySync(updates)
      // Llaves: detecta ganadores reales de eliminatorias y puntúa (anti-storm: una pasada).
      await applyKnockout(updates)
      setLastSync(await storage.get('last_sync'))
      setTick((t) => t + 1)
      // adaptativo: re-poll rápido solo mientras haya algo en vivo
      clearTimeout(liveTimer.current)
      if (live > 0) liveTimer.current = setTimeout(runSync, DATA_CONFIG.livePollSeconds * 1000)
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    runSync() // al montar, antes de que las vistas muestren datos (gated por tick)
    const onFocus = () => {
      if (document.visibilityState === 'visible') runSync()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    const daily = setInterval(runSync, DATA_CONFIG.syncIntervalHours * 3600 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      clearInterval(daily)
      clearTimeout(liveTimer.current)
    }
  }, [runSync])

  return { syncing, lastSync, tick, runSync }
}
