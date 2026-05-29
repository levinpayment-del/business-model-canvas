import React, { useState, useEffect, useRef, useCallback } from 'react'

const SUPABASE_URL = 'https://sepknqienhtyzjtqdqbt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_8cHUxuJWiOto2KBd0Ll6Cw_vTEr3kCW'

const USERS = ['עוז', 'נעמה', 'ערן']
const USER_COLORS = [
  { bg: '#EEF4FF', color: '#1e40af', border: '#93c5fd' },
  { bg: '#F0FDF4', color: '#166534', border: '#86efac' },
  { bg: '#FFF7ED', color: '#9a3412', border: '#fdba74' },
]

const SECTIONS = [
  { k: 'kp',   label: 'שותפים מרכזיים',  hint: 'מי הם שותפיך?',           area: 'kp'   },
  { k: 'ka',   label: 'פעילויות מרכזיות', hint: 'מה אתם עושים הכי טוב?',   area: 'ka'   },
  { k: 'kr',   label: 'משאבים מרכזיים',  hint: 'אילו נכסים דרושים?',       area: 'kr'   },
  { k: 'vp',   label: 'הצעת ערך',        hint: 'איזה ערך אתם מספקים?',     area: 'vp'   },
  { k: 'cr',   label: 'קשרי לקוחות',     hint: 'איך מתקשרים עם לקוחות?',  area: 'cr'   },
  { k: 'cs',   label: 'פלחי לקוחות',     hint: 'מי הם הלקוחות שלכם?',      area: 'cs'   },
  { k: 'ch',   label: 'ערוצי הפצה',      hint: 'איך מגיעים ללקוחות?',      area: 'ch'   },
  { k: 'cost', label: 'מבנה עלויות',     hint: 'מהן העלויות העיקריות?',    area: 'cost' },
  { k: 'rev',  label: 'זרמי הכנסה',      hint: 'איך מרוויחים כסף?',        area: 'rev'  },
]

const EMPTY_STATE = () => {
  const notes = {}
  SECTIONS.forEach(s => notes[s.k] = [])
  return { notes, conns: [] }
}

async function dbGet() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/canvas?id=eq.main&select=data`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  })
  const rows = await res.json()
  if (rows && rows.length > 0) return rows[0].data
  return EMPTY_STATE()
}

async function dbSet(data) {
  await fetch(`${SUPABASE_URL}/rest/v1/canvas?id=eq.main`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() })
  })
}

export default function App() {
  const [me, setMe] = useState(0)
  const [state, setState] = useState(EMPTY_STATE())
  const [connectMode, setConnectMode] = useState(false)
  const [srcId, setSrcId] = useState(null)
  const [hint, setHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('טוען...')
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const inputRefs = useRef({})
  const saveTimeout = useRef(null)

  const fetchState = useCallback(async () => {
    try {
      const data = await dbGet()
      setState(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev
        return data
      })
      setStatus('מסונכרן ✓')
    } catch (e) {
      setStatus('שגיאת חיבור')
    }
  }, [])

  const saveState = useCallback(async (newState) => {
    setSaving(true)
    try {
      await dbSet(newState)
      setStatus('נשמר ✓')
    } catch (e) {
      setStatus('שגיאה בשמירה')
    }
    setSaving(false)
  }, [])

  const debouncedSave = useCallback((newState) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveState(newState), 500)
  }, [saveState])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [fetchState])

  useEffect(() => { drawLines() }, [state, connectMode, srcId])

  function addNote(k) {
    const el = inputRefs.current[k]
    if (!el) return
    const v = el.value.trim()
    if (!v) return
    el.value = ''
    const newState = {
      ...state,
      notes: { ...state.notes, [k]: [...(state.notes[k] || []), { t: v, u: me, id: Date.now() }] }
    }
    setState(newState)
    debouncedSave(newState)
  }

  function delNote(k, id) {
    const newState = {
      notes: { ...state.notes, [k]: state.notes[k].filter(n => n.id !== id) },
      conns: state.conns.filter(c => c.a !== id && c.b !== id)
    }
    setState(newState)
    debouncedSave(newState)
  }

  function noteClick(id) {
    if (!connectMode) return
    if (!srcId) {
      setSrcId(id)
      const note = findNote(id)
      setHint(`נבחר: "${note?.t || ''}" — לחץ על רעיון שני לחיבור`)
    } else {
      if (srcId === id) { setSrcId(null); setHint('לחץ על רעיון ראשון לחיבור'); return }
      const exists = state.conns.findIndex(c => (c.a === srcId && c.b === id) || (c.a === id && c.b === srcId))
      let newConns
      if (exists >= 0) {
        newConns = state.conns.filter((_, i) => i !== exists)
        setHint('קישור הוסר. לחץ על רעיון נוסף.')
      } else {
        newConns = [...state.conns, { a: srcId, b: id, id: Date.now() }]
        setHint('קישור נוצר! לחץ על רעיון נוסף.')
      }
      const newState = { ...state, conns: newConns }
      setState(newState)
      debouncedSave(newState)
      setSrcId(null)
    }
  }

  function findNote(id) {
    for (const k of Object.keys(state.notes)) {
      const n = state.notes[k]?.find(n => n.id === id)
      if (n) return n
    }
    return null
  }

  function connCount(id) { return state.conns.filter(c => c.a === id || c.b === id).length }
  function connectedTo(id) { return state.conns.filter(c => c.a === id || c.b === id).map(c => c.a === id ? c.b : c.a) }

  function getCenter(id) {
    const el = document.querySelector(`[data-note-id="${id}"]`)
    const wrap = canvasRef.current
    if (!el || !wrap) return null
    const er = el.getBoundingClientRect()
    const wr = wrap.getBoundingClientRect()
    return { x: er.left - wr.left + er.width / 2, y: er.top - wr.top + er.height / 2 }
  }

  function drawLines() {
    const svg = svgRef.current
    const wrap = canvasRef.current
    if (!svg || !wrap) return
    svg.innerHTML = ''
    svg.setAttribute('viewBox', `0 0 ${wrap.offsetWidth} ${wrap.offsetHeight}`)
    state.conns.forEach(conn => {
      const p1 = getCenter(conn.a), p2 = getCenter(conn.b)
      if (!p1 || !p2) return
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
      const dx = p2.x - p1.x, dy = p2.y - p1.y
      const cx = mx - dy * 0.25, cy = my + dx * 0.25
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`)
      path.setAttribute('stroke', '#a855f7')
      path.setAttribute('stroke-width', '1.5')
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke-dasharray', '4 3')
      path.setAttribute('opacity', '0.7')
      svg.appendChild(path)
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', mx - dy * 0.125)
      dot.setAttribute('cy', my + dx * 0.125)
      dot.setAttribute('r', '3')
      dot.setAttribute('fill', '#a855f7')
      dot.setAttribute('opacity', '0.85')
      svg.appendChild(dot)
    })
  }

  useEffect(() => {
    window.addEventListener('resize', drawLines)
    return () => window.removeEventListener('resize', drawLines)
  }, [state])

  const srcConnected = srcId ? connectedTo(srcId) : []

  return (
    <div style={{ padding: '16px', direction: 'rtl', fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>לוח מודל עסקי</span>
        <span style={{ fontSize: 11, color: '#888' }}>אתה:</span>
        {USERS.map((name, i) => (
          <button key={i} onClick={() => setMe(i)} style={{
            padding: '4px 12px', borderRadius: 20,
            border: me === i ? `1.5px solid ${USER_COLORS[i].border}` : '1px solid #ddd',
            background: me === i ? USER_COLORS[i].bg : '#fff',
            color: me === i ? USER_COLORS[i].color : '#666',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
          }}>{name}</button>
        ))}
        <button onClick={() => {
          const next = !connectMode
          setConnectMode(next)
          setSrcId(null)
          setHint(next ? 'לחץ על רעיון ראשון לחיבור' : '')
        }} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px',
          borderRadius: 20, border: connectMode ? '1.5px solid #d8b4fe' : '1px solid #ddd',
          background: connectMode ? '#FDF4FF' : '#fff',
          color: connectMode ? '#7e22ce' : '#666',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
        }}>🔗 קישור בין רעיונות</button>
        <span style={{ fontSize: 11, color: saving ? '#f59e0b' : '#22c55e' }}>{status}</span>
      </div>

      {connectMode && hint && (
        <div style={{
          fontSize: 12, color: '#7e22ce', background: '#FDF4FF',
          border: '1px solid #e9d5ff', borderRadius: 8, padding: '6px 10px', marginBottom: 8
        }}>{hint}</div>
      )}

      <div ref={canvasRef} style={{ position: 'relative' }}>
        <svg ref={svgRef} style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gridTemplateRows: '1fr 1fr auto', gap: 6, position: 'relative' }}>
          {SECTIONS.map(sec => (
            <Cell key={sec.k} sec={sec} notes={state.notes[sec.k] || []}
              connectMode={connectMode} srcId={srcId} srcConnected={srcConnected}
              onNoteClick={noteClick} onDelNote={delNote} onAddNote={addNote}
              inputRef={el => inputRefs.current[sec.k] = el} connCount={connCount} />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#aaa', marginTop: 10, textAlign: 'right' }}>
        שינויים נשמרים אוטומטית ומסתנכרנים לכל חברי הצוות כל 3 שניות
      </div>
    </div>
  )
}

function Cell({ sec, notes, connectMode, srcId, srcConnected, onNoteClick, onDelNote, onAddNote, inputRef, connCount }) {
  const areaStyle = {
    kp:   { gridColumn: '9/11', gridRow: '1/3' },
    ka:   { gridColumn: '7/9',  gridRow: '1' },
    kr:   { gridColumn: '7/9',  gridRow: '2' },
    vp:   { gridColumn: '5/7',  gridRow: '1/3' },
    cr:   { gridColumn: '3/5',  gridRow: '1' },
    cs:   { gridColumn: '3/5',  gridRow: '2' },
    ch:   { gridColumn: '1/3',  gridRow: '1/3' },
    cost: { gridColumn: '6/11', gridRow: '3' },
    rev:  { gridColumn: '1/6',  gridRow: '3' },
  }
  return (
    <div style={{
      ...areaStyle[sec.area], background: '#fff',
      border: connectMode ? '1px solid #e9d5ff' : '1px solid #e5e7eb',
      borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 5,
      minHeight: ['kp','vp','ch'].includes(sec.area) ? 240 : ['cost','rev'].includes(sec.area) ? 80 : 120,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textAlign: 'right' }}>{sec.label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, overflowY: 'auto', maxHeight: 180 }}>
        {notes.map(note => {
          const isSrc = note.id === srcId
          const isConnected = srcId && srcConnected.includes(note.id)
          const cnt = connCount(note.id)
          const uc = [
            { bg: '#EEF4FF', color: '#1e40af' },
            { bg: '#F0FDF4', color: '#166534' },
            { bg: '#FFF7ED', color: '#9a3412' },
          ][note.u]
          return (
            <div key={note.id} data-note-id={note.id} onClick={() => onNoteClick(note.id)} style={{
              fontSize: 11, lineHeight: 1.45, padding: '4px 6px 4px 20px', borderRadius: 5,
              position: 'relative', textAlign: 'right', direction: 'rtl', wordBreak: 'break-word',
              cursor: connectMode ? 'pointer' : 'default', background: uc.bg, color: uc.color,
              outline: isSrc ? '2.5px solid #a855f7' : isConnected ? '2px solid #22c55e' : 'none',
              outlineOffset: 1,
            }}>
              <span style={{ fontSize: 9, opacity: 0.65, fontWeight: 600, display: 'block', marginBottom: 1 }}>{USERS[note.u]}</span>
              {note.t}
              {cnt > 0 && (
                <span style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 600, background: '#a855f7', color: '#fff', borderRadius: 10, padding: '1px 4px', lineHeight: 1.4 }}>{cnt}</span>
              )}
              {!connectMode && (
                <button onClick={e => { e.stopPropagation(); onDelNote(sec.k, note.id) }} style={{ position: 'absolute', left: cnt > 0 ? 20 : 2, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'inherit', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, borderRadius: 3 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0} aria-label="מחק">×</button>
              )}
            </div>
          )
        })}
      </div>
      {!connectMode && (
        <div style={{ display: 'flex', gap: 3, flexDirection: 'row-reverse' }}>
          <input ref={inputRef} type="text" placeholder={sec.hint} dir="rtl"
            onKeyDown={e => e.key === 'Enter' && onAddNote(sec.k)}
            style={{ flex: 1, fontSize: 11, padding: '3px 6px', border: '1px solid #e5e7eb', borderRadius: 5, background: '#f9fafb', color: '#1a1a1a', fontFamily: 'inherit', direction: 'rtl', textAlign: 'right', outline: 'none', minWidth: 0 }} />
          <button onClick={() => onAddNote(sec.k)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 14, color: '#666', lineHeight: 1 }}>+</button>
        </div>
      )}
    </div>
  )
}
