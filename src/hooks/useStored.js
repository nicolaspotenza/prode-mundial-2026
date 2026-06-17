import { useEffect, useState } from 'react'
import { storage } from '../lib/storage.js'

// Lee una key del storage y la vuelve a leer cuando cambia `dep` (p. ej. el tick de sync).
export function useStored(key, dep) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    let active = true
    storage.get(key).then((v) => {
      if (active) setValue(v)
    })
    return () => {
      active = false
    }
  }, [key, dep])
  return value
}
