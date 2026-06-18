// Función serverless de Vercel: almacenamiento compartido respaldado por Upstash Redis
// (REST). Provee persistencia clave-valor compartida entre todos los dispositivos, así
// el ranking y los pronósticos de todos los jugadores se ven en cualquier celular.
//
// Variables de entorno (las inyecta la integración Upstash/KV del Marketplace de Vercel):
//   KV_REST_API_URL / KV_REST_API_TOKEN  (o UPSTASH_REDIS_REST_URL / _TOKEN)
//
// Contrato:
//   GET  /api/storage?key=foo        -> { value: <parsed JSON | null> }
//   POST /api/storage  {key, value}  -> { ok: true }

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

const PREFIX = 'prode:'

async function redis(command) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  })
  if (!r.ok) throw new Error(`upstash ${r.status}`)
  const data = await r.json()
  return data.result
}

export default async function handler(req, res) {
  if (!URL || !TOKEN) {
    res.status(500).json({ error: 'storage backend not configured (missing KV_REST_API_URL/TOKEN)' })
    return
  }

  try {
    if (req.method === 'GET') {
      const key = req.query.key
      if (!key) {
        res.status(400).json({ error: 'missing key' })
        return
      }
      const raw = await redis(['GET', PREFIX + key])
      res.status(200).json({ value: raw == null ? null : JSON.parse(raw) })
      return
    }

    if (req.method === 'POST') {
      // El body puede llegar ya parseado (Vercel) o como string.
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const { key, value } = body
      if (!key) {
        res.status(400).json({ error: 'missing key' })
        return
      }
      await redis(['SET', PREFIX + key, JSON.stringify(value)])
      res.status(200).json({ ok: true })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'method not allowed' })
  } catch (e) {
    res.status(502).json({ error: 'storage backend error', detail: String(e?.message || e) })
  }
}
