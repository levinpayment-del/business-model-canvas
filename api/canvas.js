import { kv } from '@vercel/kv'

const KEY = 'canvas'

const EMPTY = () => {
  const notes = {}
  for (const k of ['kp','ka','kr','vp','cr','cs','ch','cost','rev']) notes[k] = []
  return { notes, conns: [] }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    try {
      const data = await kv.get(KEY)
      return res.status(200).json(data || EMPTY())
    } catch (e) {
      return res.status(200).json(EMPTY())
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body
      if (!body || !body.notes) return res.status(400).json({ error: 'Invalid data' })
      await kv.set(KEY, body)
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
