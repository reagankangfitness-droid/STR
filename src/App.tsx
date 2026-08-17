import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Tab = 'today' | 'log' | 'history' | 'progress'
type Lift = 'squat' | 'bench' | 'deadlift' | 'press'

type Profile = { name: string; level: 'Novice' | 'Intermediate' | 'Advanced'; units: 'kg' | 'lb' }
type Maxes = { squat: number; bench: number; deadlift: number; press: number }

type PlannedExercise = {
  id: string
  name: string
  category: 'Squat' | 'Bench' | 'Deadlift' | 'Press' | 'Hinge' | 'Pull' | 'Accessory'
  lift?: Lift
  pctOfMax?: number
  sets: number
  reps: number
  rpe?: number
}

type Workout = { id: string; name: string; detail: string; exercises: PlannedExercise[] }

type Checkin = {
  date: string
  overall: 1 | 2 | 3 | 4 | 5
  sleep: 1 | 2 | 3 | 4 | 5
  soreness: 1 | 2 | 3 | 4 | 5
  sorenessArea?: 'Legs' | 'Chest' | 'Back' | 'Shoulders' | 'Full body'
  note?: string
}

type LoggedSet = { exerciseId: string; index: number; kg: number; reps: number; rpe: number | null; at: string }

type Session = {
  id: string
  date: string
  workoutName: string
  readiness: number
  sets: LoggedSet[]
  durationMin: number
  prs: string[]
  note?: string
}

type SyncState = { online: boolean; queued: number }

type StoredState = {
  profile: Profile
  maxes: Maxes
  workouts: Workout[]
  checkin: Checkin
  sessions: Session[]
  sync: SyncState
  activeWorkoutId: string
  activeSets: LoggedSet[]
  activeStartedAt: string | null
  restStartedAt: string | null
  selectedLift: Lift
}

type TargetResult = {
  exercise: PlannedExercise
  kg: number | null
  adj: number
  basis: string
  factors: Array<{ label: string; value: number }>
}

const storageKey = 'sb.v1'
const tabs: Tab[] = ['today', 'log', 'history', 'progress']
const restSeconds = 180

const profile: Profile = { name: 'Reagan', level: 'Intermediate', units: 'kg' }
const maxes: Maxes = { squat: 150, bench: 100, deadlift: 185, press: 65 }

const workouts: Workout[] = [
  {
    id: 'lower-strength',
    name: 'Lower Strength',
    detail: 'Squat focus with hinge volume',
    exercises: [
      { id: 'back-squat', name: 'Back Squat', category: 'Squat', lift: 'squat', pctOfMax: 0.7, sets: 3, reps: 5, rpe: 8 },
      { id: 'romanian-deadlift', name: 'Romanian Deadlift', category: 'Hinge', sets: 3, reps: 8, rpe: 7 },
      { id: 'split-squat', name: 'Split Squat', category: 'Accessory', sets: 3, reps: 8, rpe: 8 },
      { id: 'ham-curl', name: 'Ham Curl', category: 'Accessory', sets: 3, reps: 10, rpe: 8 },
    ],
  },
  {
    id: 'upper-strength',
    name: 'Upper Strength',
    detail: 'Bench, press and upper back',
    exercises: [
      { id: 'bench-press', name: 'Bench Press', category: 'Bench', lift: 'bench', pctOfMax: 0.72, sets: 3, reps: 5, rpe: 8 },
      { id: 'overhead-press', name: 'Overhead Press', category: 'Press', lift: 'press', pctOfMax: 0.73, sets: 3, reps: 5, rpe: 8 },
      { id: 'barbell-row', name: 'Barbell Row', category: 'Pull', sets: 3, reps: 8, rpe: 8 },
      { id: 'upper-accessories', name: 'Accessories', category: 'Accessory', sets: 3, reps: 12, rpe: 8 },
    ],
  },
]

const defaultCheckin: Checkin = {
  date: new Date().toISOString().slice(0, 10),
  overall: 4,
  sleep: 4,
  soreness: 2,
  sorenessArea: 'Legs',
  note: '',
}

const defaultState: StoredState = {
  profile,
  maxes,
  workouts,
  checkin: defaultCheckin,
  sessions: [
    {
      id: 'seed-session-1',
      date: '2026-08-10T10:00:00.000Z',
      workoutName: 'Lower Strength',
      readiness: 82,
      durationMin: 58,
      prs: ['Back Squat top set'],
      sets: [
        { exerciseId: 'back-squat', index: 0, kg: 115, reps: 5, rpe: 8, at: '2026-08-10T10:20:00.000Z' },
        { exerciseId: 'back-squat', index: 1, kg: 115, reps: 5, rpe: 8, at: '2026-08-10T10:24:00.000Z' },
        { exerciseId: 'back-squat', index: 2, kg: 115, reps: 5, rpe: 8.5, at: '2026-08-10T10:28:00.000Z' },
      ],
    },
    {
      id: 'seed-session-2',
      date: '2026-08-13T10:00:00.000Z',
      workoutName: 'Upper Strength',
      readiness: 67,
      durationMin: 52,
      prs: [],
      sets: [
        { exerciseId: 'bench-press', index: 0, kg: 72.5, reps: 5, rpe: 8, at: '2026-08-13T10:20:00.000Z' },
        { exerciseId: 'bench-press', index: 1, kg: 72.5, reps: 5, rpe: 8.5, at: '2026-08-13T10:24:00.000Z' },
      ],
    },
  ],
  sync: { online: true, queued: 1 },
  activeWorkoutId: 'lower-strength',
  activeSets: [],
  activeStartedAt: null,
  restStartedAt: null,
  selectedLift: 'squat',
}

const readouts = {
  overall: ['Flat', 'Low', 'Fine', 'Good', 'Sharp'],
  sleep: ['Broken', 'Light', 'Fair', 'Solid', 'Deep'],
  soreness: ['None', 'Mild', 'Moderate', 'High', 'Severe'],
}

function readState(): StoredState {
  const saved = window.localStorage.getItem(storageKey)

  if (!saved) return defaultState

  try {
    const parsed = JSON.parse(saved) as Partial<StoredState>

    return {
      ...defaultState,
      ...parsed,
      profile: { ...defaultState.profile, ...parsed.profile },
      maxes: { ...defaultState.maxes, ...parsed.maxes },
      workouts: parsed.workouts?.length ? parsed.workouts : defaultState.workouts,
      sync: { ...defaultState.sync, ...parsed.sync },
      sessions: parsed.sessions ?? defaultState.sessions,
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

function scoreCheckin(checkin: Checkin) {
  return Math.round(((checkin.overall + checkin.sleep + (6 - checkin.soreness)) / 15) * 100)
}

function roundTo2_5(value: number) {
  return Math.round(value / 2.5) * 2.5
}

function formatKg(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function isLower(lift: Lift) {
  return lift === 'squat' || lift === 'deadlift'
}

function sorenessMatches(checkin: Checkin, lift: Lift) {
  const area = checkin.sorenessArea ?? 'Legs'
  if (area === 'Full body') return true
  if (area === 'Legs' || area === 'Back') return isLower(lift)
  return !isLower(lift)
}

function groupAdjustment(score: number, lift: Lift) {
  const table = isLower(lift)
    ? score >= 80 ? 0 : score >= 66 ? -4 : score >= 50 ? -7 : -12
    : score >= 80 ? 0 : score >= 66 ? -2 : score >= 50 ? -4 : -8

  return table
}

function targetFor(exercise: PlannedExercise, state: StoredState, score: number): TargetResult {
  if (!exercise.lift || !exercise.pctOfMax) {
    return { exercise, kg: null, adj: 0, basis: 'Accessories are left alone', factors: [] }
  }

  const baseAdj = groupAdjustment(score, exercise.lift)
  const hasSoreness = sorenessMatches(state.checkin, exercise.lift)
  const readinessFactor = baseAdj === 0 ? 0 : Math.trunc(baseAdj * 0.45)
  const sleepFactor = baseAdj < 0 && state.checkin.sleep <= 3 ? -1 : 0
  const sorenessFactor = hasSoreness ? baseAdj - readinessFactor - sleepFactor : 0
  const adj = readinessFactor + sleepFactor + sorenessFactor
  const planned = state.maxes[exercise.lift] * exercise.pctOfMax

  return {
    exercise,
    kg: roundTo2_5(planned * (1 + adj / 100)),
    adj,
    basis: `${Math.round(exercise.pctOfMax * 100)}% of ${state.maxes[exercise.lift]} ${state.profile.units} max`,
    factors: [
      { label: 'Readiness', value: readinessFactor },
      { label: 'Sleep', value: sleepFactor },
      { label: 'Soreness', value: sorenessFactor },
    ],
  }
}

function dateLabel(date: string | Date = new Date()) {
  const value = typeof date === 'string' ? new Date(date) : date
  const weekday = value.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const day = value.toLocaleDateString('en-US', { day: '2-digit' })
  const month = value.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${weekday} ${day} ${month}`
}

function App() {
  const [state, setState] = useState<StoredState>(() => readState())
  const [tab, setTab] = useState<Tab>(() => readInitialTab())
  const [tick, setTick] = useState(() => Number(new Date()))
  const [showWhy, setShowWhy] = useState(false)
  const [overrideKey, setOverrideKey] = useState<string | null>(null)

  const score = scoreCheckin(state.checkin)
  const lowerWorkout = state.workouts[0]
  const upperWorkout = state.workouts[1]
  const activeWorkout = state.workouts.find((workout) => workout.id === state.activeWorkoutId) ?? lowerWorkout
  const targetMap = useMemo(() => {
    return new Map(
      state.workouts
        .flatMap((workout) => workout.exercises)
        .map((exercise) => [exercise.id, targetFor(exercise, state, score)]),
    )
  }, [score, state])
  const squatTarget = targetMap.get('back-squat')
  const activeExercise = activeWorkout.exercises[0]
  const activeTarget = targetMap.get(activeExercise.id)
  const setRows = activeWorkout.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.sets }, (_, index) => ({
      exercise,
      index,
      key: `${exercise.id}:${index}`,
      target: targetMap.get(exercise.id),
    })),
  )
  const loggedKeys = new Set(state.activeSets.map((set) => `${set.exerciseId}:${set.index}`))
  const doneCount = state.activeSets.length
  const nextRow = setRows.find((row) => row.exercise.id === activeExercise.id && !loggedKeys.has(row.key))
  const restRemaining = state.restStartedAt
    ? Math.max(0, restSeconds - Math.floor((tick - Number(new Date(state.restStartedAt))) / 1000))
    : 0
  const verdict = (squatTarget?.adj ?? 0) === 0
    ? {
        badge: 'PLAN HELD',
        sentence: 'Green day. Sleep and soreness are inside range — run the targets as written.',
      }
    : {
        badge: `${squatTarget?.adj ?? 0}% ADJUSTED`,
        sentence: 'Yellow day. Sleep and leg soreness are built into today\'s main lift targets.',
      }

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Number(new Date())), 1000)
    const online = () => setState((current) => ({ ...current, sync: { ...current.sync, online: true } }))
    const offline = () => setState((current) => ({ ...current, sync: { ...current.sync, online: false } }))
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  function selectTab(next: Tab) {
    setTab(next)
    window.history.replaceState(null, '', `#${next}`)
  }

  function patchCheckin(next: Partial<Checkin>) {
    setState((current) => ({
      ...current,
      checkin: { ...current.checkin, ...next, date: new Date().toISOString().slice(0, 10) },
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function startWorkout(workoutId = lowerWorkout.id) {
    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      activeWorkoutId: workoutId,
      activeStartedAt: current.activeStartedAt ?? now,
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
    selectTab('log')
  }

  function logSet(row: { exercise: PlannedExercise; index: number; key: string; target?: TargetResult }) {
    if (loggedKeys.has(row.key)) return
    const kg = row.target?.kg ?? 0
    const now = new Date().toISOString()

    setState((current) => ({
      ...current,
      activeStartedAt: current.activeStartedAt ?? now,
      activeSets: [
        ...current.activeSets,
        {
          exerciseId: row.exercise.id,
          index: row.index,
          kg,
          reps: row.exercise.reps,
          rpe: row.exercise.rpe ?? null,
          at: now,
        },
      ],
      restStartedAt: now,
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function adjustSet(exerciseId: string, index: number, field: 'kg' | 'reps', delta: number) {
    setState((current) => ({
      ...current,
      activeSets: current.activeSets.map((set) =>
        set.exerciseId === exerciseId && set.index === index
          ? {
              ...set,
              [field]: field === 'kg' ? Math.max(0, roundTo2_5(set.kg + delta)) : Math.max(1, set.reps + delta),
            }
          : set,
      ),
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function completeSession() {
    const finishedAt = new Date()
    const startedAt = state.activeStartedAt ? Number(new Date(state.activeStartedAt)) : Number(finishedAt)
    const session: Session = {
      id: crypto.randomUUID(),
      date: finishedAt.toISOString(),
      workoutName: activeWorkout.name,
      readiness: score,
      sets: state.activeSets,
      durationMin: Math.max(1, Math.round((Number(finishedAt) - startedAt) / 60000)),
      prs: state.activeSets.some((set) => set.exerciseId === 'back-squat') ? ['Back Squat top set'] : [],
    }

    setState((current) => ({
      ...current,
      sessions: [session, ...current.sessions],
      activeSets: [],
      activeStartedAt: null,
      restStartedAt: null,
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
    selectTab('history')
  }

  function syncNow() {
    if (!state.sync.online) return
    setState((current) => ({ ...current, sync: { ...current.sync, queued: 0 } }))
  }

  return (
    <main className="app">
      <section className="screen">
        {tab === 'today' && (
            <Today
              lowerWorkout={lowerWorkout}
              patchCheckin={patchCheckin}
            profile={state.profile}
            score={score}
            showWhy={showWhy}
            squatTarget={squatTarget}
            startWorkout={startWorkout}
            state={state}
            syncNow={syncNow}
            targetMap={targetMap}
            upperWorkout={upperWorkout}
            verdict={verdict}
            setShowWhy={setShowWhy}
          />
        )}
        {tab === 'log' && (
          <Log
            activeExercise={activeExercise}
            activeSets={state.activeSets}
            activeTarget={activeTarget}
            activeWorkout={activeWorkout}
            adjustSet={adjustSet}
            completeSession={completeSession}
            doneCount={doneCount}
            logSet={logSet}
            loggedKeys={loggedKeys}
            nextKey={nextRow?.key}
            overrideKey={overrideKey}
            restRemaining={restRemaining}
            setOverrideKey={setOverrideKey}
            setRows={setRows}
          />
        )}
        {tab === 'history' && <History queued={state.sync.queued} sessions={state.sessions} />}
        {tab === 'progress' && (
          <Progress
            selectedLift={state.selectedLift}
            sessions={state.sessions}
            setSelectedLift={(selectedLift) => setState((current) => ({ ...current, selectedLift }))}
            target={squatTarget}
          />
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

function Today({
  lowerWorkout,
  patchCheckin,
  profile,
  score,
  setShowWhy,
  showWhy,
  squatTarget,
  startWorkout,
  state,
  syncNow,
  targetMap,
  upperWorkout,
  verdict,
}: {
  lowerWorkout: Workout
  patchCheckin: (next: Partial<Checkin>) => void
  profile: Profile
  score: number
  setShowWhy: (value: boolean) => void
  showWhy: boolean
  squatTarget?: TargetResult
  startWorkout: (workoutId?: string) => void
  state: StoredState
  syncNow: () => void
  targetMap: Map<string, TargetResult>
  upperWorkout: Workout
  verdict: { badge: string; sentence: string }
}) {
  const mainTargets = state.workouts.flatMap((workout) => workout.exercises.filter((exercise) => exercise.lift))

  return (
    <>
      <div className="eyebrow-row">
        <span>{profile.name} · {profile.level}</span>
        <span>{dateLabel()}</span>
      </div>
      <header className="day-head">
        <h1>Today&apos;s /<br />Training</h1>
        <p>{verdict.sentence}</p>
      </header>

      <section className="target-band">
        <div>
          <p className="micro">Readiness</p>
          <p className="readiness-number">{score}<span>/100</span></p>
        </div>
        <div className="target-side">
          <p className="micro">Squat target</p>
          <p className="load-number">{formatKg(squatTarget?.kg)} <span>{profile.units}</span></p>
          <button className={(squatTarget?.adj ?? 0) === 0 ? 'badge sage' : 'badge amber'} onClick={() => setShowWhy(!showWhy)} type="button">
            {verdict.badge}
          </button>
        </div>
        {showWhy && squatTarget && (
          <div className="why-panel">
            {squatTarget.factors.map((factor) => (
              <span key={factor.label}>{factor.label} {factor.value}%</span>
            ))}
          </div>
        )}
      </section>

      <section className="checkin">
        <CheckinRow label="Overall" value={state.checkin.overall} words={readouts.overall} onChange={(overall) => patchCheckin({ overall })} />
        <CheckinRow label="Sleep" value={state.checkin.sleep} words={readouts.sleep} onChange={(sleep) => patchCheckin({ sleep })} />
        <CheckinRow label="Leg soreness" value={state.checkin.soreness} words={readouts.soreness} onChange={(soreness) => patchCheckin({ soreness })} />
      </section>

      <section className="targets-list">
        <h2 className="section-label">Today&apos;s targets</h2>
        {mainTargets.map((exercise) => {
          const target = targetMap.get(exercise.id)
          return (
            <div className="target-row" key={exercise.id}>
              <div>
                <strong>{exercise.name}</strong>
                <p>{target?.basis}</p>
              </div>
              <p>{formatKg(target?.kg)} <span>{profile.units}</span></p>
              <em className={(target?.adj ?? 0) === 0 ? 'sage-text' : 'amber-text'}>{target?.adj === 0 ? 'held' : `${target?.adj}%`}</em>
            </div>
          )
        })}
        <p className="footnote">Percentages come from your check-in, not from a mood. Accessories are left alone.</p>
      </section>

      <section className="session-list">
        <button className="session-choice today-choice" onClick={() => startWorkout(lowerWorkout.id)} type="button">
          <span>{lowerWorkout.name}</span>
          <p>{lowerWorkout.detail}</p>
          <em>9 SETS</em>
        </button>
        <button className="session-choice" onClick={() => startWorkout(upperWorkout.id)} type="button">
          <span>{upperWorkout.name}</span>
          <p>{upperWorkout.detail}</p>
          <em>TOMORROW</em>
        </button>
      </section>

      <button className="primary-button" onClick={() => startWorkout(lowerWorkout.id)} type="button">
        <span>Start lower strength</span>
        <span>→</span>
      </button>

      <div className="sync-line">
        <span>● {state.sync.online ? 'ONLINE' : 'OFFLINE'} · {state.sync.queued} CHANGE WAITING</span>
        <button onClick={syncNow} type="button">Sync</button>
      </div>
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

function Log({
  activeExercise,
  activeSets,
  activeTarget,
  activeWorkout,
  adjustSet,
  completeSession,
  doneCount,
  logSet,
  loggedKeys,
  nextKey,
  overrideKey,
  restRemaining,
  setOverrideKey,
  setRows,
}: {
  activeExercise: PlannedExercise
  activeSets: LoggedSet[]
  activeTarget?: TargetResult
  activeWorkout: Workout
  adjustSet: (exerciseId: string, index: number, field: 'kg' | 'reps', delta: number) => void
  completeSession: () => void
  doneCount: number
  logSet: (row: { exercise: PlannedExercise; index: number; key: string; target?: TargetResult }) => void
  loggedKeys: Set<string>
  nextKey?: string
  overrideKey: string | null
  restRemaining: number
  setOverrideKey: (key: string | null) => void
  setRows: Array<{ exercise: PlannedExercise; index: number; key: string; target?: TargetResult }>
}) {
  const currentRows = setRows.filter((row) => row.exercise.id === activeExercise.id)
  const remainingExercises = activeWorkout.exercises.slice(1)

  return (
    <>
      <div className="eyebrow-row">
        <span>ACTIVE · {doneCount}/9 SETS</span>
        <span className={restRemaining > 0 ? 'rest-live' : ''}>REST {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}</span>
      </div>
      <header className="day-head compact">
        <h1>{activeExercise.name}</h1>
        <p className="mono-line">{activeWorkout.name} · TARGET {formatKg(activeTarget?.kg)} KG</p>
        <p>{activeTarget?.adj === 0 ? 'Plan held. Load is written as prescribed.' : `${activeTarget?.adj}% from readiness · sleep and leg soreness are in the number.`}</p>
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
          const logged = activeSets.find((set) => set.exerciseId === row.exercise.id && set.index === row.index)
          const isLogged = Boolean(logged)
          const isNext = row.key === nextKey

          return (
            <div className={`set-row ${isLogged ? 'logged' : ''} ${isNext ? 'next' : ''}`} key={row.key}>
              <button onClick={() => logSet(row)} type="button">{row.index + 1}</button>
              <button onClick={() => logSet(row)} type="button">{isLogged ? 'logged' : isNext ? 'up next' : 'pending'}</button>
              <button onClick={() => setOverrideKey(overrideKey === row.key ? null : row.key)} type="button">{formatKg(logged?.kg ?? row.target?.kg)}</button>
              <button onClick={() => setOverrideKey(overrideKey === row.key ? null : row.key)} type="button">{logged?.reps ?? row.exercise.reps}</button>
              <button onClick={() => logSet(row)} type="button">{logged?.rpe ?? '—'}</button>
              {overrideKey === row.key && logged && (
                <div className="stepper">
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'kg', -2.5)} type="button">−2.5</button>
                  <span>{formatKg(logged.kg)} KG · {logged.reps} REPS</span>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'kg', 2.5)} type="button">+2.5</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'reps', -1)} type="button">−1 REP</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'reps', 1)} type="button">+1 REP</button>
                </div>
              )}
            </div>
          )
        })}
      </section>
      <p className="helper">Tap a set to log it. Rest starts on its own.</p>

      <section className="then-list">
        <h2 className="section-label">Then</h2>
        {remainingExercises.map((exercise) => (
          <div className="then-row" key={exercise.id}>
            <div>
              <span>{exercise.name}</span>
              <small>{exercise.category}</small>
            </div>
            <em>{exercise.sets} × {exercise.reps}{exercise.lift ? ` · ${formatKg(activeTarget?.kg)} KG` : ''}</em>
          </div>
        ))}
      </section>
      <div className="actions">
        <button className="secondary-button" disabled={!loggedKeys.size} onClick={completeSession} type="button">Complete</button>
        <button className="secondary-button" type="button">Add set</button>
      </div>
    </>
  )
}

function History({ queued, sessions }: { queued: number; sessions: Session[] }) {
  const volume = sessions.reduce((total, session) => total + session.sets.reduce((setTotal, set) => setTotal + set.kg * set.reps, 0), 0)

  return (
    <>
      <div className="eyebrow-row"><span>LAST 30 DAYS</span><span>{dateLabel()}</span></div>
      <header className="day-head compact"><h1>History</h1></header>
      <section className="history-stats three">
        <div><span>Sessions</span><strong>{sessions.length}</strong></div>
        <div><span>Volume</span><strong>{Math.round(volume).toLocaleString()} KG</strong></div>
        <div><span>Queued</span><strong>{queued}</strong></div>
      </section>
      <section className="history-list">
        {sessions.length ? sessions.map((session) => {
          const top = session.sets[0]
          return (
            <article className="history-row" key={session.id}>
              <strong className={session.readiness >= 70 ? 'sage-text' : 'amber-text'}>{session.readiness}</strong>
              <div>
                <div><h2>{session.workoutName}</h2><time>{dateLabel(session.date)}</time></div>
                <p>{session.durationMin} min · 4 exercises · full load</p>
                <em>{top ? `${top.exerciseId.replace('-', ' ').toUpperCase()} ${formatKg(top.kg)} × ${top.reps} · ${session.prs[0] ?? 'TOP SET'}` : 'NO SETS'}</em>
              </div>
            </article>
          )
        }) : <p className="empty">Finished sessions appear here.</p>}
      </section>
    </>
  )
}

function Progress({
  selectedLift,
  sessions,
  setSelectedLift,
  target,
}: {
  selectedLift: Lift
  sessions: Session[]
  setSelectedLift: (lift: Lift) => void
  target?: TargetResult
}) {
  const rows = sessions
    .flatMap((session) => session.sets.filter((set) => set.exerciseId === 'back-squat').slice(0, 1).map((set) => ({ date: session.date, kg: set.kg, label: 'TOP SET', current: true })))
  const targetRow = { date: new Date().toISOString(), kg: target?.kg ?? 0, label: 'TODAY', current: false }
  const allRows = [targetRow, ...rows]
  const max = Math.max(...allRows.map((row) => row.kg), 1)

  return (
    <>
      <div className="eyebrow-row"><span>TOP SET · BACK SQUAT</span><span /></div>
      <div className="lift-switch">
        {(['squat', 'bench', 'deadlift', 'press'] as Lift[]).map((lift) => (
          <button className={selectedLift === lift ? 'active' : ''} key={lift} onClick={() => setSelectedLift(lift)} type="button">{lift}</button>
        ))}
      </div>
      <header className="day-head compact">
        <h1>Progress</h1>
        <p>Six weeks of logged top sets. No trophies, no streaks — just the number going up.</p>
      </header>
      <section className="progress-list">
        {allRows.map((row, index) => (
          <div className="progress-row" key={`${row.date}-${index}`}>
            <div><span>{dateLabel(row.date)}</span><em>{row.label}</em></div>
            <div className="bar-track"><i className={index > 2 ? 'old' : !row.current ? 'future' : ''} style={{ width: `${(row.kg / max) * 100}%` }} /></div>
            <strong>{formatKg(row.kg)}</strong>
          </div>
        ))}
      </section>
      <section className="also-moving">
        <h2 className="section-label">Recent PRs</h2>
        <div><span>Back Squat</span><strong>115 × 5</strong></div>
        <div><span>Bench Press</span><strong>72.5 × 5</strong></div>
      </section>
    </>
  )
}

export default App
