import { useEffect, useState } from 'react'
import './App.css'

type Tab = 'today' | 'log' | 'history' | 'progress'

type Block = {
  id: string
  name: string
  weeks: 4
  startDate: string
}

type PlannedSet = { kg: number | null; reps: number; rpeCap?: number }
type PlannedItem = {
  id: string
  name: string
  detail: string
  kind: 'warmup' | 'skill' | 'acl' | 'main' | 'accessory' | 'metcon' | 'engine'
  meta?: string
  sets?: PlannedSet[]
  adjustable: boolean
}

type PlannedDay = {
  date: string
  week: 1 | 2 | 3 | 4
  title: string
  summary: string
  items: PlannedItem[]
  fuel: {
    kcal: number
    proteinG: number
    carbEmphasis: 'Lower' | 'Moderate' | 'Moderate-high' | 'High' | 'Very high'
    fluidL: number
  }
}

type Checkin = {
  date: string
  sleep: 1 | 2 | 3 | 4 | 5
  soreness: 1 | 2 | 3 | 4 | 5
  overall: 1 | 2 | 3 | 4 | 5
  note?: string
}

type LoggedSet = {
  itemId: string
  index: number
  kg: number
  reps: number
  rpe: number | null
  at: string
}

type Session = {
  date: string
  dayTitle: string
  readiness: number
  sets: LoggedSet[]
  durationMin: number
  prs: string[]
  note?: string
}

type AppState = {
  checkins: Record<string, Checkin>
  sessions: Session[]
  activeDate: string
  activeStartedAt: string | null
  activeSets: LoggedSet[]
  restStartedAt: string | null
  queued: number
}

const storageKey = 'sb.v1'
const tabs: Tab[] = ['today', 'log', 'history', 'progress']
const restSeconds = 180

const block: Block = {
  id: 'block-1',
  name: 'Block 1 — Build the Athlete + ACL RTS',
  weeks: 4,
  startDate: '2026-08-17',
}

const days: PlannedDay[] = [
  {
    date: '2026-08-17',
    week: 1,
    title: 'Force / + Landing',
    summary: 'Squat force, landing quality, and controlled unilateral work.',
    fuel: { kcal: 2800, proteinG: 200, carbEmphasis: 'High', fluidL: 3.5 },
    items: [
      {
        id: 'mon-warmup',
        name: 'Prep series',
        detail: 'Bike 5 min · hip flow · ankle rocks',
        kind: 'warmup',
        meta: '10 MIN',
        adjustable: false,
      },
      {
        id: 'mon-landing',
        name: 'Landing mechanics',
        detail: 'Snap-down + box landing · stick every rep',
        kind: 'acl',
        meta: 'GATED',
        sets: [
          { kg: 0, reps: 5 },
          { kg: 0, reps: 5 },
        ],
        adjustable: false,
      },
      {
        id: 'mon-squat',
        name: 'Back squat',
        detail: '5 × 5 · ramp bar/60/80/100/110',
        kind: 'main',
        meta: 'RPE 8 CAP',
        sets: [
          { kg: 125, reps: 5, rpeCap: 8 },
          { kg: 125, reps: 5, rpeCap: 8 },
          { kg: 125, reps: 5, rpeCap: 8 },
          { kg: 125, reps: 5, rpeCap: 8 },
          { kg: 125, reps: 5, rpeCap: 8 },
        ],
        adjustable: true,
      },
      {
        id: 'mon-rdl',
        name: 'Romanian deadlift',
        detail: '2 × 8 · hamstring tension, no reach',
        kind: 'accessory',
        meta: 'RPE 7',
        sets: [
          { kg: 100, reps: 8, rpeCap: 7 },
          { kg: 100, reps: 8, rpeCap: 7 },
        ],
        adjustable: false,
      },
      {
        id: 'mon-split',
        name: 'Rear-foot split squat',
        detail: '3 × 8 each · knee tracks clean',
        kind: 'accessory',
        meta: 'QUALITY',
        adjustable: false,
      },
      {
        id: 'mon-engine',
        name: 'Zone 2 flush',
        detail: 'Bike easy nasal breathing',
        kind: 'engine',
        meta: '12 MIN',
        adjustable: false,
      },
    ],
  },
  {
    date: '2026-08-18',
    week: 1,
    title: 'Gymnastics',
    summary: 'Strict positions, scap control, and low-fatigue skill volume.',
    fuel: { kcal: 2750, proteinG: 200, carbEmphasis: 'Moderate-high', fluidL: 3.2 },
    items: [
      { id: 'tue-scap', name: 'Scap prep', detail: 'Hangs · hollow · arch', kind: 'skill', meta: '12 MIN', adjustable: false },
      { id: 'tue-pull', name: 'Strict pull-up', detail: '5 × 4 · perfect ribs', kind: 'skill', meta: 'RPE 7', adjustable: false },
      { id: 'tue-hsw', name: 'Handstand walk', detail: 'Skill lanes · stop before fatigue', kind: 'skill', meta: '18 MIN', adjustable: false },
    ],
  },
  {
    date: '2026-08-19',
    week: 1,
    title: 'Power + Engine',
    summary: 'Clean speed, controlled barbell cycling, and aerobic finish.',
    fuel: { kcal: 3100, proteinG: 200, carbEmphasis: 'Very high', fluidL: 3.8 },
    items: [
      { id: 'wed-clean', name: 'Clean pull + clean', detail: '6 × 2 · fast extension', kind: 'main', meta: 'RPE 7', sets: [{ kg: 105, reps: 2 }, { kg: 105, reps: 2 }, { kg: 105, reps: 2 }, { kg: 105, reps: 2 }, { kg: 105, reps: 2 }, { kg: 105, reps: 2 }], adjustable: true },
      { id: 'wed-engine', name: 'Bike intervals', detail: '6 rounds · 90 hard / 90 easy', kind: 'engine', meta: '18 MIN', adjustable: false },
    ],
  },
  {
    date: '2026-08-20',
    week: 1,
    title: 'ACL RTS',
    summary: 'Return-to-sport gate, landing mechanics, and tissue tolerance.',
    fuel: { kcal: 2550, proteinG: 200, carbEmphasis: 'Lower', fluidL: 3 },
    items: [
      { id: 'thu-gate', name: 'ACL gate', detail: 'No pain, swelling, instability, or mechanics drop', kind: 'acl', meta: 'GATED', adjustable: false },
      { id: 'thu-hop', name: 'Hop and stick', detail: '3 × 5 each side', kind: 'acl', meta: 'QUALITY', adjustable: false },
    ],
  },
  {
    date: '2026-08-21',
    week: 1,
    title: 'Snatch / + Upper',
    summary: 'Snatch timing, upper push-pull strength, and gymnastics touch.',
    fuel: { kcal: 3100, proteinG: 200, carbEmphasis: 'Very high', fluidL: 3.8 },
    items: [
      { id: 'fri-snatch', name: 'Snatch complex', detail: 'Power snatch + hang snatch', kind: 'main', meta: 'RPE 7', sets: [{ kg: 70, reps: 2 }, { kg: 72.5, reps: 2 }, { kg: 75, reps: 2 }, { kg: 75, reps: 2 }], adjustable: true },
      { id: 'fri-press', name: 'Strict press', detail: '4 × 6', kind: 'main', meta: 'RPE 8', sets: [{ kg: 62.5, reps: 6 }, { kg: 62.5, reps: 6 }, { kg: 62.5, reps: 6 }, { kg: 62.5, reps: 6 }], adjustable: true },
    ],
  },
  {
    date: '2026-08-22',
    week: 1,
    title: 'CrossFit',
    summary: 'Mixed-modal work with pacing discipline and clean mechanics.',
    fuel: { kcal: 2900, proteinG: 200, carbEmphasis: 'High', fluidL: 3.6 },
    items: [
      { id: 'sat-metcon', name: 'Mixed modal piece', detail: 'Row · burpee · wall ball', kind: 'metcon', meta: '18 MIN', adjustable: false },
      { id: 'sat-carry', name: 'Carry finisher', detail: 'Farmer carry steady', kind: 'engine', meta: '10 MIN', adjustable: false },
    ],
  },
  {
    date: '2026-08-23',
    week: 1,
    title: 'Off',
    summary: 'Walk, tissue care, and readiness reset.',
    fuel: { kcal: 2450, proteinG: 200, carbEmphasis: 'Moderate', fluidL: 3 },
    items: [
      { id: 'sun-walk', name: 'Walk', detail: 'Easy pace, no target', kind: 'engine', meta: '30 MIN', adjustable: false },
      { id: 'sun-mobility', name: 'Mobility', detail: 'Hips, ankles, T-spine', kind: 'skill', meta: '12 MIN', adjustable: false },
    ],
  },
]

const defaultCheckin: Checkin = {
  date: days[0].date,
  sleep: 4,
  soreness: 3,
  overall: 4,
  note: '',
}

const defaultState: AppState = {
  checkins: { [days[0].date]: defaultCheckin },
  sessions: [],
  activeDate: days[0].date,
  activeStartedAt: null,
  activeSets: [],
  restStartedAt: null,
  queued: 0,
}

const sleepWords = ['Broken', 'Light', 'Fair', 'Solid', 'Deep']
const sorenessWords = ['None', 'Mild', 'Moderate', 'High', 'Severe']
const overallWords = ['Flat', 'Low', 'Fine', 'Good', 'Sharp']

function readState(): AppState {
  const saved = window.localStorage.getItem(storageKey)

  if (!saved) {
    return defaultState
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AppState>

    return {
      ...defaultState,
      ...parsed,
      checkins: { ...defaultState.checkins, ...parsed.checkins },
      sessions: parsed.sessions ?? [],
      activeSets: parsed.activeSets ?? [],
    }
  } catch {
    return defaultState
  }
}

function readInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '')

  return tabs.includes(hash as Tab) ? (hash as Tab) : 'today'
}

function roundTo2_5(value: number) {
  return Math.round(value / 2.5) * 2.5
}

function formatKg(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—'
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function readinessScore(checkin: Checkin) {
  return Math.min(100, Math.round(((checkin.sleep + checkin.overall + (6 - checkin.soreness)) / 15) * 100) + 5)
}

function adjustmentFor(score: number) {
  if (score >= 75) {
    return 0
  }

  if (score >= 60) {
    return -0.04
  }

  return -0.08
}

function adjustedKg(set: PlannedSet | undefined, item: PlannedItem, adjustment: number) {
  if (!set || set.kg === null) {
    return null
  }

  return item.adjustable ? roundTo2_5(set.kg * (1 + adjustment)) : set.kg
}

function dateLabel(date: string) {
  const value = new Date(`${date}T12:00:00`)
  const weekday = value.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const day = value.toLocaleDateString('en-US', { day: '2-digit' })
  const month = value.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()

  return `${weekday} ${day} ${month}`
}

function sessionNote(session: Session) {
  const squatSets = session.sets.filter((set) => set.itemId === 'mon-squat')
  const top = squatSets[0]

  if (!top) {
    return session.note ?? 'Session completed. Landing quality logged.'
  }

  return `Squat ${formatKg(top.kg)} × ${top.reps} × ${squatSets.length}. Landing quality good.`
}

function App() {
  const [state, setState] = useState<AppState>(() => readState())
  const [tab, setTab] = useState<Tab>(() => readInitialTab())
  const [tick, setTick] = useState(() => Number(new Date()))
  const [overrideKey, setOverrideKey] = useState<string | null>(null)
  const day = days.find((item) => item.date === state.activeDate) ?? days[0]
  const checkin = state.checkins[day.date] ?? { ...defaultCheckin, date: day.date }
  const score = readinessScore(checkin)
  const adjustment = adjustmentFor(score)
  const mainItem = day.items.find((item) => item.adjustable && item.sets?.length) ?? day.items.find((item) => item.sets?.length)
  const mainSet = mainItem?.sets?.[0]
  const mainTarget = mainItem && mainSet ? adjustedKg(mainSet, mainItem, adjustment) : null
  const loggedKeySet = new Set(state.activeSets.map((set) => `${set.itemId}:${set.index}`))
  const setRows = day.items.flatMap((item) =>
    (item.sets ?? []).map((set, index) => ({
      item,
      set,
      index,
      key: `${item.id}:${index}`,
      targetKg: adjustedKg(set, item, adjustment),
    })),
  )
  const doneCount = state.activeSets.length
  const nextRow = setRows.find((row) => row.item.id === mainItem?.id && !loggedKeySet.has(row.key))
  const restRemaining = state.restStartedAt
    ? Math.max(0, restSeconds - Math.floor((tick - Number(new Date(state.restStartedAt))) / 1000))
    : 0
  const verdict = adjustment === 0
    ? {
        badge: 'PLAN HELD',
        copy: 'Sleep and soreness are inside range. Run the block as written.',
      }
    : {
        badge: `${Math.abs(Math.round(adjustment * 100))}% ADJUSTED`,
        copy: `Targets pulled back ${Math.abs(Math.round(adjustment * 100))}%. Skill work and landing quality stay intact.`,
      }
  const plannedSquat = [125, 127.5, 130, 132.5]
  const actualSquat = state.sessions
    .flatMap((session) => session.sets.filter((set) => set.itemId === 'mon-squat').slice(0, 1))
    .map((set) => set.kg)
  const maxProgressKg = Math.max(...plannedSquat, ...actualSquat, 1)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick(Number(new Date()))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  function selectTab(next: Tab) {
    setTab(next)
    window.history.replaceState(null, '', `#${next}`)
  }

  function patchCheckin(next: Partial<Checkin>) {
    setState((current) => ({
      ...current,
      checkins: {
        ...current.checkins,
        [day.date]: { ...checkin, ...next, date: day.date },
      },
      queued: current.queued + 1,
    }))
  }

  function beginSession() {
    setState((current) => ({
      ...current,
      activeDate: day.date,
      activeStartedAt: current.activeStartedAt ?? new Date().toISOString(),
      queued: current.queued + 1,
    }))
    selectTab('log')
  }

  function logSet(row: { item: PlannedItem; set: PlannedSet; index: number; key: string; targetKg: number | null }) {
    if (loggedKeySet.has(row.key) || row.targetKg === null) {
      return
    }

    const targetKg = row.targetKg

    if (targetKg === null) {
      return
    }

    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      activeStartedAt: current.activeStartedAt ?? now,
      activeSets: [
        ...current.activeSets,
        {
          itemId: row.item.id,
          index: row.index,
          kg: targetKg,
          reps: row.set.reps,
          rpe: row.set.rpeCap ?? null,
          at: now,
        },
      ],
      restStartedAt: now,
      queued: current.queued + 1,
    }))
  }

  function adjustLoggedSet(itemId: string, index: number, delta: number) {
    setState((current) => ({
      ...current,
      activeSets: current.activeSets.map((set) =>
        set.itemId === itemId && set.index === index
          ? { ...set, kg: Math.max(0, roundTo2_5(set.kg + delta)) }
          : set,
      ),
      queued: current.queued + 1,
    }))
  }

  function finishSession() {
    const finishedAt = new Date()
    const startedAt = state.activeStartedAt ? Number(new Date(state.activeStartedAt)) : Number(finishedAt)
    const session: Session = {
      date: finishedAt.toISOString(),
      dayTitle: day.title,
      readiness: score,
      sets: state.activeSets,
      durationMin: Math.max(1, Math.round((Number(finishedAt) - startedAt) / 60000)),
      prs: [],
    }

    setState((current) => ({
      ...current,
      sessions: [session, ...current.sessions],
      activeStartedAt: null,
      activeSets: [],
      restStartedAt: null,
      queued: current.queued + 1,
    }))
    selectTab('history')
  }

  return (
    <main className="app">
      <section className="screen">
        {tab === 'today' && (
          <TodayScreen
            adjustment={adjustment}
            beginSession={beginSession}
            checkin={checkin}
            day={day}
            mainItem={mainItem}
            mainTarget={mainTarget}
            patchCheckin={patchCheckin}
            score={score}
            verdict={verdict}
          />
        )}

        {tab === 'log' && (
          <LogScreen
            activeSets={state.activeSets}
            adjustment={adjustment}
            adjustLoggedSet={adjustLoggedSet}
            day={day}
            doneCount={doneCount}
            finishSession={finishSession}
            logSet={logSet}
            loggedKeySet={loggedKeySet}
            mainItem={mainItem}
            nextKey={nextRow?.key}
            overrideKey={overrideKey}
            restRemaining={restRemaining}
            setOverrideKey={setOverrideKey}
            setRows={setRows}
            totalSets={setRows.length}
          />
        )}

        {tab === 'history' && <HistoryScreen sessions={state.sessions} />}

        {tab === 'progress' && (
          <ProgressScreen actualSquat={actualSquat} maxProgressKg={maxProgressKg} plannedSquat={plannedSquat} />
        )}
      </section>

      <nav className="tabbar" aria-label="Primary navigation">
        {tabs.map((item) => (
          <button className={tab === item ? 'active' : ''} key={item} onClick={() => selectTab(item)} type="button">
            {item}
          </button>
        ))}
      </nav>
    </main>
  )
}

function TodayScreen({
  adjustment,
  beginSession,
  checkin,
  day,
  mainItem,
  mainTarget,
  patchCheckin,
  score,
  verdict,
}: {
  adjustment: number
  beginSession: () => void
  checkin: Checkin
  day: PlannedDay
  mainItem?: PlannedItem
  mainTarget: number | null
  patchCheckin: (next: Partial<Checkin>) => void
  score: number
  verdict: { badge: string; copy: string }
}) {
  return (
    <>
      <div className="eyebrow-row">
        <span>{block.name.split(' — ')[0]} · WEEK {day.week} · DAY 1</span>
        <span>{dateLabel(day.date)}</span>
      </div>
      <header className="day-head">
        <h1>{day.title}</h1>
        <p>{day.summary}</p>
      </header>

      <section className="target-band">
        <div>
          <p className="micro">Readiness</p>
          <p className="readiness-number">
            {score}<span>/100</span>
          </p>
        </div>
        <div className="target-side">
          <p className="micro">{mainItem?.name ?? 'Target'} · 5 × 5</p>
          <p className="load-number">
            {formatKg(mainTarget)} <span>kg</span>
          </p>
          <span className={adjustment === 0 ? 'badge sage' : 'badge amber'}>{verdict.badge}</span>
        </div>
        <p className="verdict">{verdict.copy}</p>
      </section>

      <section className="checkin">
        <CheckinRow
          label="Sleep"
          value={checkin.sleep}
          words={sleepWords}
          onChange={(sleep) => patchCheckin({ sleep })}
        />
        <CheckinRow
          label="Leg soreness"
          value={checkin.soreness}
          words={sorenessWords}
          onChange={(soreness) => patchCheckin({ soreness })}
        />
        <CheckinRow
          label="Overall"
          value={checkin.overall}
          words={overallWords}
          onChange={(overall) => patchCheckin({ overall })}
        />
      </section>

      <section className="session-list">
        <h2 className="section-label">Session</h2>
        {day.items.map((item, index) => {
          const firstSet = item.sets?.[0]
          const meta = item.adjustable && firstSet
            ? `${formatKg(adjustedKg(firstSet, item, adjustment))} KG`
            : item.meta

          return (
            <div className="session-row" key={item.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{item.name}</strong>
                <p>{item.detail}</p>
              </div>
              <em>{meta}</em>
            </div>
          )
        })}
      </section>

      <section className="acl-note">
        <p>ACL · RETURN TO SPORT</p>
        <span>Do not progress through new pain, swelling, instability, or deteriorating mechanics. Landing quality outranks load.</span>
      </section>

      <section className="fuel-strip">
        <div>
          <p>Fuel</p>
          <strong>{day.fuel.kcal.toLocaleString()}</strong>
          <span>kcal</span>
        </div>
        <div>
          <p>Protein</p>
          <strong>{day.fuel.proteinG}</strong>
          <span>grams</span>
        </div>
        <div>
          <p>Carbs</p>
          <strong>{day.fuel.carbEmphasis}</strong>
          <span>squat day</span>
        </div>
      </section>

      <button className="primary-button" onClick={beginSession} type="button">
        <span>Begin session</span>
        <span>→</span>
      </button>
    </>
  )
}

function CheckinRow({
  label,
  onChange,
  value,
  words,
}: {
  label: string
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void
  value: 1 | 2 | 3 | 4 | 5
  words: string[]
}) {
  return (
    <div className="checkin-row">
      <div>
        <span>{label}</span>
        <strong>{words[value - 1]}</strong>
      </div>
      <div className="pills">
        {([1, 2, 3, 4, 5] as const).map((item) => (
          <button className={value === item ? 'selected' : ''} key={item} onClick={() => onChange(item)} type="button">
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

function LogScreen({
  activeSets,
  adjustment,
  adjustLoggedSet,
  day,
  doneCount,
  finishSession,
  logSet,
  loggedKeySet,
  mainItem,
  nextKey,
  overrideKey,
  restRemaining,
  setOverrideKey,
  setRows,
  totalSets,
}: {
  activeSets: LoggedSet[]
  adjustment: number
  adjustLoggedSet: (itemId: string, index: number, delta: number) => void
  day: PlannedDay
  doneCount: number
  finishSession: () => void
  logSet: (row: { item: PlannedItem; set: PlannedSet; index: number; key: string; targetKg: number | null }) => void
  loggedKeySet: Set<string>
  mainItem?: PlannedItem
  nextKey?: string
  overrideKey: string | null
  restRemaining: number
  setOverrideKey: (key: string | null) => void
  setRows: Array<{ item: PlannedItem; set: PlannedSet; index: number; key: string; targetKg: number | null }>
  totalSets: number
}) {
  const currentItem = mainItem ?? day.items[0]
  const currentIndex = day.items.findIndex((item) => item.id === currentItem.id)
  const remainingItems = day.items.slice(Math.max(0, currentIndex + 1))
  const currentRows = setRows.filter((row) => row.item.id === currentItem.id)

  return (
    <>
      <div className="eyebrow-row">
        <span>ACTIVE · SET {doneCount}/{totalSets}</span>
        <span className={restRemaining > 0 ? 'rest-live' : ''}>REST {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}</span>
      </div>
      <header className="day-head compact">
        <h1>{currentItem.name}</h1>
        <p className="mono-line">
          TARGET {formatKg(setRows.find((row) => row.item.id === currentItem.id)?.targetKg)} KG · RPE 8 CAP
        </p>
        <p>{currentItem.detail}</p>
      </header>

      <section className="set-table">
        <div className="set-head">
          <span>Set</span>
          <span>State</span>
          <span>Kg</span>
          <span>Reps</span>
          <span>RPE</span>
        </div>
        {currentRows.map((row) => {
          const logged = activeSets.find((set) => set.itemId === row.item.id && set.index === row.index)
          const isLogged = Boolean(logged)
          const isNext = row.key === nextKey

          return (
            <div className={`set-row ${isLogged ? 'logged' : ''} ${isNext ? 'next' : ''}`} key={row.key}>
              <button onClick={() => logSet(row)} type="button">{row.index + 1}</button>
              <span>{isLogged ? 'logged' : isNext ? 'up next' : 'pending'}</span>
              <button className="cell-button" onClick={() => setOverrideKey(overrideKey === row.key ? null : row.key)} type="button">
                {formatKg(logged?.kg ?? row.targetKg)}
              </button>
              <button className="cell-button" onClick={() => logSet(row)} type="button">{logged?.reps ?? row.set.reps}</button>
              <button className="cell-button" onClick={() => logSet(row)} type="button">{logged?.rpe ?? '—'}</button>
              {overrideKey === row.key && logged && (
                <div className="stepper">
                  <button onClick={() => adjustLoggedSet(row.item.id, row.index, -2.5)} type="button">−2.5</button>
                  <span>{formatKg(logged.kg)} KG</span>
                  <button onClick={() => adjustLoggedSet(row.item.id, row.index, 2.5)} type="button">+2.5</button>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section className="then-list">
        <h2 className="section-label">Then</h2>
        {remainingItems.map((item) => (
          <div className="then-row" key={item.id}>
            <span>{item.name}</span>
            <em>{item.adjustable ? `${Math.abs(Math.round(adjustment * 100))}% scaled` : item.meta}</em>
          </div>
        ))}
      </section>

      <button className="secondary-button" disabled={!loggedKeySet.size} onClick={finishSession} type="button">
        Finish session
      </button>
    </>
  )
}

function HistoryScreen({ sessions }: { sessions: Session[] }) {
  const weekSessions = sessions.length
  const tonnage = sessions.reduce(
    (total, session) => total + session.sets.reduce((setTotal, set) => setTotal + set.kg * set.reps, 0),
    0,
  )

  return (
    <>
      <div className="eyebrow-row">
        <span>{block.name.split(' — ')[0]} · {block.weeks} WEEKS</span>
        <span>{sessions.length ? 'LOGGED' : 'EMPTY'}</span>
      </div>
      <header className="day-head compact">
        <h1>History</h1>
      </header>
      <section className="history-stats">
        <div>
          <span>Sessions · week</span>
          <strong>{weekSessions}</strong>
        </div>
        <div>
          <span>Tonnage</span>
          <strong>{Math.round(tonnage).toLocaleString()} KG</strong>
        </div>
      </section>
      <section className="history-list">
        {sessions.length ? sessions.map((session) => (
          <article className="history-row" key={session.date}>
            <strong className={session.readiness >= 70 ? 'sage-text' : 'amber-text'}>{session.readiness}</strong>
            <div>
              <div>
                <h2>{session.dayTitle}</h2>
                <time>{dateLabel(session.date.slice(0, 10))}</time>
              </div>
              <p>{sessionNote(session)}</p>
            </div>
          </article>
        )) : <p className="empty">Finished sessions appear here.</p>}
      </section>
    </>
  )
}

function ProgressScreen({
  actualSquat,
  maxProgressKg,
  plannedSquat,
}: {
  actualSquat: number[]
  maxProgressKg: number
  plannedSquat: number[]
}) {
  return (
    <>
      <div className="eyebrow-row">
        <span>TOP SET · BACK SQUAT</span>
        <span>{block.name.split(' — ')[0]}</span>
      </div>
      <header className="day-head compact">
        <h1>Progress</h1>
        <p>Four weeks of Block 1. The line is the plan; the bars are what happened.</p>
      </header>
      <section className="progress-list">
        {plannedSquat.map((kg, index) => {
          const actual = actualSquat[index]
          const displayKg = actual ?? kg
          const future = actual === undefined

          return (
            <div className="progress-row" key={kg}>
              <div>
                <span>Week {index + 1}</span>
                <em>5 × 5</em>
              </div>
              <div className="bar-track">
                <i className={future ? 'future' : ''} style={{ width: `${(displayKg / maxProgressKg) * 100}%` }} />
              </div>
              <strong>{formatKg(displayKg)}</strong>
            </div>
          )
        })}
      </section>
      <section className="also-moving">
        <h2 className="section-label">Also moving</h2>
        <div><span>Clean & jerk</span><strong>+4 KG</strong></div>
        <div><span>Snatch</span><strong>+2.5 KG</strong></div>
        <div><span>Ring muscle-up</span><strong>2 SINGLES</strong></div>
        <div><span>Handstand walk</span><strong>18 M</strong></div>
        <div><span>Bodyweight (7-day)</span><strong>94.6 KG</strong></div>
      </section>
    </>
  )
}

export default App
