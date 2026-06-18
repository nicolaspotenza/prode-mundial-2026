import { useEffect, useState } from 'react'
import { storage } from '../lib/storage.js'

export async function aliasExists(alias) {
  const users = (await storage.get('users')) || []
  return users.some((u) => u.alias.toLowerCase() === alias.trim().toLowerCase())
}

export async function registerOrSelectAlias(alias) {
  const name = alias.trim()
  const users = (await storage.get('users')) || []
  let user = users.find((u) => u.alias.toLowerCase() === name.toLowerCase())
  if (!user) {
    user = {
      alias: name,
      puntosGrupos: 0,
      puntosEliminatorias: 0,
      totalPuntos: 0,
      fechaRegistro: new Date().toISOString(),
    }
    users.push(user)
    await storage.set('users', users)
  }
  await storage.set('current_user', user.alias, false)
  return user
}

export function useCurrentUser() {
  const [alias, setAlias] = useState(undefined) // undefined = cargando, null = sin alias

  useEffect(() => {
    storage.get('current_user', false).then((a) => setAlias(a ?? null))
  }, [])

  const register = async (a) => {
    const u = await registerOrSelectAlias(a)
    setAlias(u.alias)
    return u
  }
  const change = async () => {
    await storage.set('current_user', null, false)
    setAlias(null)
  }

  return { alias, register, change }
}
