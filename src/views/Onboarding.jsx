import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { storage } from '../lib/storage.js'

export default function Onboarding({ onRegister }) {
  const [alias, setAlias] = useState('')
  const [users, setUsers] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    storage.get('users').then((u) => setUsers(u || []))
  }, [])

  const trimmed = alias.trim()
  const existing = users.find((u) => u.alias.toLowerCase() === trimmed.toLowerCase())
  const canSubmit = trimmed.length >= 2

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    await onRegister(trimmed)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-surface p-6 shadow-2xl shadow-black/40"
      >
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <Trophy className="text-trophy" size={40} />
          <h1 className="font-head text-3xl font-bold">Prode Mundial 2026</h1>
          <p className="text-sm text-white/60">Elegí tu alias para jugar y competir con tus amigos.</p>
        </div>

        <label htmlFor="alias" className="mb-1 block text-sm font-medium text-white/70">
          Tu alias
        </label>
        <input
          id="alias"
          list="aliases"
          autoComplete="off"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Ej: Rodrigo"
          className="h-12 w-full rounded-xl bg-bg px-4 font-body text-lg focus:outline-none focus:ring-2 focus:ring-pitch"
        />
        <datalist id="aliases">
          {users.map((u) => (
            <option key={u.alias} value={u.alias} />
          ))}
        </datalist>

        {existing ? (
          <p className="mt-2 text-sm text-trophy">
            Este alias ya está en uso. Si es tuyo, continuá para entrar con él. Si querés uno nuevo, elegí otro nombre.
          </p>
        ) : trimmed.length > 0 && trimmed.length < 2 ? (
          <p className="mt-2 text-sm text-white/50">El alias debe tener al menos 2 caracteres.</p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="mt-5 h-12 w-full rounded-xl bg-pitch font-head text-lg font-semibold text-bg
                     transition hover:bg-pitch-dark disabled:opacity-40"
        >
          {existing ? `Entrar como ${existing.alias}` : trimmed ? `Crear alias “${trimmed}”` : 'Entrar'}
        </button>
      </motion.form>
    </div>
  )
}
