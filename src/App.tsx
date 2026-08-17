import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'

type Tab = 'today' | 'log' | 'history' | 'progress'
type LiftId = 'squat' | 'bench' | 'deadlift' | 'press'
type SorenessArea = 'legs' | 'chest' | 'back' | 'shoulders' | 'full'
type SorenessLevel = 'none' | 'mild' | 'moderate' | 'high'
type ReadinessStatus = 'green' | 'yellow' | 'red'

type Profile = {
  name: string
  experience: 'Intermediate' | 'Beginner' | 'Advanced'
  goal: 'Strength' | 'Powerlifting' | 'General muscle'
  units: 'kg' | 'lb'
  preference: 'Conservative' | 'Balanced' | 'Aggressive'
}

type Readiness = {
  overall: number
  sleep: number
  sorenessLevel: SorenessLevel
  sorenessArea: SorenessArea
  note: string
  updatedAt: string
}

type Exercise = {
  id: string
  name: string
  category: string
  pattern: 'squat' | 'bench' | 'hinge' | 'press' | 'pull' | 'accessory'
  primaryLift?: LiftId
  tracksPr: boolean
}

type RoutineExercise = {
  exerciseId: string
  sets: number
  reps: number
  percent?: number
  rpe: number
  restSeconds: number
}

type Routine = {
  id: string
  name: string
  focus: string
  exercises: RoutineExercise[]
}

type SetLog = {
  id: string
  weight: number
  reps: number
  rpe: number
  done: boolean
  note: string
}

type ExerciseLog = {
  id: string
  exerciseId: string
  targetWeight?: number
  targetReason?: string
  sets: SetLog[]
  note: string
}

type Session = {
  id: string
  date: string
  name: string
  readinessStatus: ReadinessStatus
  readinessScore: number
  durationMinutes: number
  exercises: ExerciseLog[]
  prs: string[]
}

type StoredState = {
  profile: Profile
  workingMaxes: Record<LiftId, number>
  readiness: Readiness
  sessions: Session[]
  syncQueue: string[]
}

const liftLabels: Record<LiftId, string> = {
  squat: 'Squat',
  bench: 'Bench',
  deadlift: 'Deadlift',
  press: 'Overhead Press',
}

const sorenessLabels: Record<SorenessArea, string> = {
  legs: 'Legs',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  full: 'Full body',
}

const statusTone: Record<ReadinessStatus, string> = {
  green: '#12805c',
  yellow: '#b45309',
  red: '#c2410c',
}

const exercises: Exercise[] = [
  { id: 'back-squat', name: 'Back Squat', category: 'Squat', pattern: 'squat', primaryLift: 'squat', tracksPr: true },
  { id: 'bench-press', name: 'Bench Press', category: 'Bench', pattern: 'bench', primaryLift: 'bench', tracksPr: true },
  { id: 'deadlift', name: 'Deadlift', category: 'Deadlift', pattern: 'hinge', primaryLift: 'deadlift', tracksPr: true },
  { id: 'overhead-press', name: 'Overhead Press', category: 'Press', pattern: 'press', primaryLift: 'press', tracksPr: true },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', category: 'Hinge', pattern: 'hinge', primaryLift: 'deadlift', tracksPr: false },
  { id: 'barbell-row', name: 'Barbell Row', category: 'Pull', pattern: 'pull', tracksPr: false },
  { id: 'split-squat', name: 'Split Squat', category: 'Accessory', pattern: 'accessory', primaryLift: 'squat', tracksPr: false },
]

const routines: Routine[] = [
  {
    id: 'lower-strength',
    name: 'Lower Strength',
    focus: 'Squat focus with hinge volume',
    exercises: [
      { exerciseId: 'back-squat', sets: 3, reps: 5, percent: 0.76, rpe: 7.5, restSeconds: 180 },
      { exerciseId: 'romanian-deadlift', sets: 3, reps: 8, percent: 0.58, rpe: 7, restSeconds: 120 },
      { exerciseId: 'split-squat', sets: 3, reps: 10, rpe: 8, restSeconds: 90 },
    ],
  },
  {
    id: 'upper-strength',
    name: 'Upper Strength',
    focus: 'Bench, press, and upper back',
    exercises: [
      { exerciseId: 'bench-press', sets: 4, reps: 4, percent: 0.78, rpe: 8, restSeconds: 180 },
      { exerciseId: 'overhead-press', sets: 3, reps: 6, percent: 0.7, rpe: 7.5, restSeconds: 150 },
      { exerciseId: 'barbell-row', sets: 4, reps: 8, rpe: 8, restSeconds: 120 },
    ],
  },
]

const defaultState: StoredState = {
  profile: {
    name: 'Reagan',
    experience: 'Intermediate',
    goal: 'Strength',
    units: 'kg',
    preference: 'Balanced',
  },
  workingMaxes: {
    squat: 150,
    bench: 100,
    deadlift: 185,
    press: 65,
  },
  readiness: {
    overall: 3,
    sleep: 3,
    sorenessLevel: 'moderate',
    sorenessArea: 'legs',
    note: 'Slept light. Quads still tight.',
    updatedAt: new Date().toISOString(),
  },
  sessions: [
    {
      id: 'session-1',
      date: '2026-08-10T10:00:00.000Z',
      name: 'Lower Strength',
      readinessStatus: 'green',
      readinessScore: 82,
      durationMinutes: 58,
      prs: ['Back Squat top set'],
      exercises: [
        {
          id: 'log-1',
          exerciseId: 'back-squat',
          targetWeight: 115,
          sets: [
            { id: 'set-1', weight: 115, reps: 5, rpe: 7.5, done: true, note: '' },
            { id: 'set-2', weight: 115, reps: 5, rpe: 8, done: true, note: '' },
            { id: 'set-3', weight: 117.5, reps: 5, rpe: 8.5, done: true, note: 'Fast first three.' },
          ],
          note: '',
        },
      ],
    },
    {
      id: 'session-2',
      date: '2026-08-13T10:00:00.000Z',
      name: 'Upper Strength',
      readinessStatus: 'yellow',
      readinessScore: 67,
      durationMinutes: 52,
      prs: [],
      exercises: [
        {
          id: 'log-2',
          exerciseId: 'bench-press',
          targetWeight: 77.5,
          sets: [
            { id: 'set-4', weight: 77.5, reps: 4, rpe: 7.5, done: true, note: '' },
            { id: 'set-5', weight: 80, reps: 4, rpe: 8, done: true, note: '' },
            { id: 'set-6', weight: 80, reps: 4, rpe: 8.5, done: true, note: '' },
          ],
          note: '',
        },
      ],
    },
  ],
  syncQueue: ['readiness-2026-08-17'],
}

const storageKey = 'strength-log:mvp'

function readStoredState(): StoredState {
  const saved = window.localStorage.getItem(storageKey)

  if (!saved) {
    return defaultState
  }

  try {
    return { ...defaultState, ...JSON.parse(saved) }
  } catch {
    return defaultState
  }
}

function roundLoad(value: number) {
  return Math.round(value / 2.5) * 2.5
}

function formatLoad(value?: number) {
  if (!value) {
    return '-'
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function estimateOneRepMax(weight: number, reps: number) {
  if (!weight || !reps) {
    return 0
  }

  return Math.round(weight * (1 + reps / 30))
}

function getReadinessScore(readiness: Readiness) {
  const sorenessPenalty = {
    none: 0,
    mild: 5,
    moderate: 12,
    high: 22,
  }[readiness.sorenessLevel]
  const raw = readiness.overall * 9 + readiness.sleep * 8 + 25 - sorenessPenalty

  return Math.max(0, Math.min(100, raw))
}

function getStatus(score: number): ReadinessStatus {
  if (score >= 75) {
    return 'green'
  }

  if (score >= 50) {
    return 'yellow'
  }

  return 'red'
}

function sorenessAffectsLift(area: SorenessArea, lift: LiftId) {
  if (area === 'full') {
    return true
  }

  if (area === 'legs') {
    return lift === 'squat' || lift === 'deadlift'
  }

  if (area === 'chest') {
    return lift === 'bench'
  }

  if (area === 'back') {
    return lift === 'deadlift' || lift === 'squat'
  }

  return lift === 'press' || lift === 'bench'
}

function getAdjustment(lift: LiftId, readiness: Readiness, preference: Profile['preference']) {
  const score = getReadinessScore(readiness)
  const status = getStatus(score)
  const baseByStatus = {
    green: preference === 'Aggressive' ? 2 : 0,
    yellow: preference === 'Conservative' ? -5 : -3,
    red: preference === 'Aggressive' ? -7 : -10,
  }[status]
  const sleepDrop = readiness.sleep <= 2 ? -3 : readiness.sleep === 3 && status !== 'green' ? -1 : 0
  const sorenessDrop =
    sorenessAffectsLift(readiness.sorenessArea, lift) && readiness.sorenessLevel !== 'none'
      ? { mild: -1, moderate: -3, high: -6, none: 0 }[readiness.sorenessLevel]
      : 0
  const preferenceCap = preference === 'Aggressive' ? -10 : preference === 'Conservative' ? -16 : -13
  const percent = Math.max(preferenceCap, Math.min(3, baseByStatus + sleepDrop + sorenessDrop))
  const reasons = [
    `${status[0].toUpperCase()}${status.slice(1)} readiness: ${baseByStatus > 0 ? '+' : ''}${baseByStatus}%`,
  ]

  if (sleepDrop) {
    reasons.push(`Sleep quality ${readiness.sleep}/5: ${sleepDrop}%`)
  }

  if (sorenessDrop) {
    reasons.push(`${sorenessLabels[readiness.sorenessArea]} soreness: ${sorenessDrop}%`)
  }

  if (!sorenessDrop && status !== 'green') {
    reasons.push(`No direct soreness conflict for ${liftLabels[lift]}`)
  }

  return { percent, reasons, score, status }
}

function createSet(weight: number, reps: number, rpe: number): SetLog {
  return {
    id: crypto.randomUUID(),
    weight,
    reps,
    rpe,
    done: false,
    note: '',
  }
}

function findExercise(id: string) {
  return exercises.find((exercise) => exercise.id === id) ?? exercises[0]
}

function getBestSets(sessions: Session[], exerciseId: string) {
  return sessions
    .flatMap((session) =>
      session.exercises
        .filter((exercise) => exercise.exerciseId === exerciseId)
        .flatMap((exercise) =>
          exercise.sets
            .filter((set) => set.done)
            .map((set) => ({
              date: session.date,
              e1rm: estimateOneRepMax(set.weight, set.reps),
              weight: set.weight,
              reps: set.reps,
            })),
        ),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function buildRoutineLogs(routine: Routine, state: StoredState): ExerciseLog[] {
  return routine.exercises.map((entry) => {
    const exercise = findExercise(entry.exerciseId)
    const lift = exercise.primaryLift
    const adjustment = lift ? getAdjustment(lift, state.readiness, state.profile.preference) : undefined
    const baseTarget = lift && entry.percent ? state.workingMaxes[lift] * entry.percent : 0
    const targetWeight = baseTarget ? roundLoad(baseTarget * (1 + (adjustment?.percent ?? 0) / 100)) : undefined

    return {
      id: crypto.randomUUID(),
      exerciseId: entry.exerciseId,
      targetWeight,
      targetReason: adjustment
        ? `${adjustment.percent > 0 ? '+' : ''}${adjustment.percent}% from readiness`
        : undefined,
      note: '',
      sets: Array.from({ length: entry.sets }, () =>
        createSet(targetWeight ?? 0, entry.reps, entry.rpe),
      ),
    }
  })
}

function App() {
  const [storedState, setStoredState] = useState<StoredState>(() => readStoredState())
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [activeWorkoutName, setActiveWorkoutName] = useState('Lower Strength')
  const [activeLogs, setActiveLogs] = useState<ExerciseLog[]>(() => buildRoutineLogs(routines[0], readStoredState()))
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [weekAnchor] = useState(() => Date.now())
  const [restSeconds, setRestSeconds] = useState(0)
  const [selectedLift, setSelectedLift] = useState<LiftId>('squat')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  const readinessScore = getReadinessScore(storedState.readiness)
  const readinessStatus = getStatus(readinessScore)
  const selectedAdjustment = getAdjustment(selectedLift, storedState.readiness, storedState.profile.preference)
  const filteredExercises = exercises.filter((exercise) =>
    `${exercise.name} ${exercise.category}`.toLowerCase().includes(exerciseSearch.toLowerCase()),
  )
  const selectedExercise = exercises.find((exercise) => exercise.primaryLift === selectedLift) ?? exercises[0]
  const progressSets = getBestSets(storedState.sessions, selectedExercise.id)
  const maxChartValue = Math.max(...progressSets.map((item) => item.e1rm), storedState.workingMaxes[selectedLift])
  const currentTarget = roundLoad(
    storedState.workingMaxes[selectedLift] * 0.76 * (1 + selectedAdjustment.percent / 100),
  )

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(storedState))
  }, [storedState])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRestSeconds((value) => Math.max(0, value - 1))
    }, 1000)
    const syncOnline = () => setIsOnline(navigator.onLine)
    const syncOffline = () => setIsOnline(false)

    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOffline)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOffline)
    }
  }, [])

  const weeklySummary = useMemo(() => {
    const sevenDaysAgo = weekAnchor - 7 * 24 * 60 * 60 * 1000
    const sessions = storedState.sessions.filter((session) => new Date(session.date).getTime() >= sevenDaysAgo)
    const volume = sessions.reduce(
      (total, session) =>
        total +
        session.exercises.reduce(
          (exerciseTotal, exercise) =>
            exerciseTotal +
            exercise.sets.reduce((setTotal, set) => setTotal + (set.done ? set.weight * set.reps : 0), 0),
          0,
        ),
      0,
    )

    return { sessions: sessions.length, volume }
  }, [storedState.sessions, weekAnchor])

  function updateReadiness(next: Partial<Readiness>) {
    setStoredState((state) => ({
      ...state,
      readiness: { ...state.readiness, ...next, updatedAt: new Date().toISOString() },
      syncQueue: [...new Set([...state.syncQueue, `readiness-${Date.now()}`])],
    }))
  }

  function updateMax(lift: LiftId, value: number) {
    setStoredState((state) => ({
      ...state,
      workingMaxes: { ...state.workingMaxes, [lift]: value },
    }))
  }

  function startRoutine(routine: Routine) {
    setActiveWorkoutName(routine.name)
    setActiveLogs(buildRoutineLogs(routine, storedState))
    setStartedAt(() => Date.now())
    setActiveTab('log')
  }

  function updateSet(exerciseLogId: string, setId: string, next: Partial<SetLog>) {
    setActiveLogs((logs) =>
      logs.map((exercise) =>
        exercise.id === exerciseLogId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...next } : set)),
            }
          : exercise,
      ),
    )
  }

  function addSet(exerciseLogId: string) {
    setActiveLogs((logs) =>
      logs.map((exercise) => {
        if (exercise.id !== exerciseLogId) {
          return exercise
        }

        const previous = exercise.sets.at(-1)

        return {
          ...exercise,
          sets: [...exercise.sets, createSet(previous?.weight ?? exercise.targetWeight ?? 0, previous?.reps ?? 5, previous?.rpe ?? 8)],
        }
      }),
    )
  }

  function addExercise(exerciseId: string) {
    const exercise = findExercise(exerciseId)
    const lift = exercise.primaryLift
    const adjustment = lift ? getAdjustment(lift, storedState.readiness, storedState.profile.preference) : undefined
    const targetWeight = lift ? roundLoad(storedState.workingMaxes[lift] * 0.7 * (1 + (adjustment?.percent ?? 0) / 100)) : undefined

    setActiveLogs((logs) => [
      ...logs,
      {
        id: crypto.randomUUID(),
        exerciseId,
        targetWeight,
        targetReason: adjustment ? `${adjustment.percent > 0 ? '+' : ''}${adjustment.percent}% from readiness` : undefined,
        note: '',
        sets: [createSet(targetWeight ?? 0, 8, 8)],
      },
    ])
  }

  function finishSession() {
    const completedLogs = activeLogs.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => set.done),
    })).filter((exercise) => exercise.sets.length > 0)

    if (!completedLogs.length) {
      return
    }

    const previousBests = new Map<string, number>()

    storedState.sessions.forEach((session) => {
      session.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          previousBests.set(
            exercise.exerciseId,
            Math.max(previousBests.get(exercise.exerciseId) ?? 0, estimateOneRepMax(set.weight, set.reps)),
          )
        })
      })
    })

    const prs = completedLogs.flatMap((exercise) => {
      const record = Math.max(...exercise.sets.map((set) => estimateOneRepMax(set.weight, set.reps)))
      const previous = previousBests.get(exercise.exerciseId) ?? 0
      const exerciseName = findExercise(exercise.exerciseId).name

      return record > previous ? [`${exerciseName} e1RM ${record}`] : []
    })
    const session: Session = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      name: activeWorkoutName,
      readinessStatus,
      readinessScore,
      durationMinutes: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
      exercises: completedLogs,
      prs,
    }

    setStoredState((state) => ({
      ...state,
      sessions: [session, ...state.sessions],
      syncQueue: [...state.syncQueue, `session-${session.id}`],
    }))
    setActiveLogs(buildRoutineLogs(routines[0], storedState))
    setStartedAt(Date.now())
    setActiveTab('history')
  }

  function completeSet(exerciseId: string, set: SetLog, restSeconds: number) {
    updateSet(exerciseId, set.id, { done: !set.done })

    if (!set.done) {
      setRestSeconds(restSeconds)
    }
  }

  function clearQueue() {
    if (!isOnline) {
      return
    }

    setStoredState((state) => ({ ...state, syncQueue: [] }))
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-block">
          <span className="brand-mark">SB</span>
          <div>
            <p>StrengthBoard</p>
            <strong>{storedState.profile.goal} logger</strong>
          </div>
        </div>

        <nav className="tabs" aria-label="App sections">
          {(['today', 'log', 'history', 'progress'] as Tab[]).map((tab) => (
            <button
              className={activeTab === tab ? 'is-active' : ''}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              <span aria-hidden="true">{tab === 'today' ? 'T' : tab === 'log' ? 'L' : tab === 'history' ? 'H' : 'P'}</span>
              {tab}
            </button>
          ))}
        </nav>

        <div className="sync-panel">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <div>
            <strong>{isOnline ? 'Online' : 'Offline mode'}</strong>
            <p>{storedState.syncQueue.length} changes waiting</p>
          </div>
          <button onClick={clearQueue} type="button">
            Sync
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">StrengthBoard</p>
            <h1>Today&apos;s Training</h1>
          </div>
          <div className="profile-pill">
            <span>{storedState.profile.name}</span>
            <strong>{storedState.profile.experience}</strong>
          </div>
        </header>

        {activeTab === 'today' && (
          <div className="view-stack">
            <section className="readiness-band" style={{ '--tone': statusTone[readinessStatus] } as CSSProperties}>
              <div>
                <p className="eyebrow">Today</p>
                <h2>{readinessStatus} readiness</h2>
                <p className="muted">
                  Score {readinessScore}. {sorenessLabels[storedState.readiness.sorenessArea]} soreness and sleep are applied to today&apos;s main lifts.
                </p>
              </div>
              <div className="score-box">
                <strong>{readinessScore}</strong>
                <span>/100</span>
              </div>
            </section>

            <section className="split-layout">
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Check-in</p>
                    <h2>30 second readiness</h2>
                  </div>
                </div>
                <div className="metric-controls">
                  <MetricControl
                    label="Overall"
                    value={storedState.readiness.overall}
                    onChange={(value) => updateReadiness({ overall: value })}
                  />
                  <MetricControl
                    label="Sleep"
                    value={storedState.readiness.sleep}
                    onChange={(value) => updateReadiness({ sleep: value })}
                  />
                </div>
                <div className="segmented">
                  {(['none', 'mild', 'moderate', 'high'] as SorenessLevel[]).map((level) => (
                    <button
                      className={storedState.readiness.sorenessLevel === level ? 'is-active' : ''}
                      key={level}
                      onClick={() => updateReadiness({ sorenessLevel: level })}
                      type="button"
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div className="segmented compact">
                  {(['legs', 'chest', 'back', 'shoulders', 'full'] as SorenessArea[]).map((area) => (
                    <button
                      className={storedState.readiness.sorenessArea === area ? 'is-active' : ''}
                      key={area}
                      onClick={() => updateReadiness({ sorenessArea: area })}
                      type="button"
                    >
                      {sorenessLabels[area]}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="Readiness note"
                  onChange={(event) => updateReadiness({ note: event.target.value })}
                  placeholder="Optional note"
                  value={storedState.readiness.note}
                />
              </div>

              <div className="panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Target engine</p>
                    <h2>{liftLabels[selectedLift]}</h2>
                  </div>
                  <select onChange={(event) => setSelectedLift(event.target.value as LiftId)} value={selectedLift}>
                    {Object.entries(liftLabels).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="target-readout">
                  <span>Today&apos;s 76% target</span>
                  <strong>{formatLoad(currentTarget)} {storedState.profile.units}</strong>
                  <p>{selectedAdjustment.percent > 0 ? '+' : ''}{selectedAdjustment.percent}% adjustment</p>
                </div>
                <ul className="reason-list">
                  {selectedAdjustment.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <div className="max-grid">
                  {(Object.keys(liftLabels) as LiftId[]).map((lift) => (
                    <label key={lift}>
                      <span>{liftLabels[lift]}</span>
                      <input
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => updateMax(lift, Number(event.target.value))}
                        type="number"
                        value={storedState.workingMaxes[lift]}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="routine-grid" aria-label="Start workout">
              {routines.map((routine) => (
                <button className="routine-tile" key={routine.id} onClick={() => startRoutine(routine)} type="button">
                  <span>Start</span>
                  <strong>{routine.name}</strong>
                  <p>{routine.focus}</p>
                </button>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'log' && (
          <div className="view-stack">
            <section className="panel workout-header">
              <div>
                <p className="eyebrow">Active workout</p>
                <input
                  aria-label="Workout name"
                  onChange={(event) => setActiveWorkoutName(event.target.value)}
                  value={activeWorkoutName}
                />
              </div>
              <div className="timer-box">
                <span>Rest</span>
                <strong>{Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}</strong>
              </div>
              <button className="primary-action" onClick={finishSession} type="button">
                Complete
              </button>
            </section>

            <section className="exercise-list">
              {activeLogs.map((exerciseLog) => {
                const exercise = findExercise(exerciseLog.exerciseId)
                const routineEntry = routines.flatMap((routine) => routine.exercises).find((entry) => entry.exerciseId === exercise.id)

                return (
                  <div className="exercise-block" key={exerciseLog.id}>
                    <div className="exercise-heading">
                      <div>
                        <p className="eyebrow">{exercise.category}</p>
                        <h2>{exercise.name}</h2>
                      </div>
                      <div className="target-chip">
                        <span>Target</span>
                        <strong>{formatLoad(exerciseLog.targetWeight)} {storedState.profile.units}</strong>
                      </div>
                    </div>
                    {exerciseLog.targetReason && <p className="muted">{exerciseLog.targetReason}</p>}
                    <div className="sets-table">
                      <div className="sets-row sets-head">
                        <span>Done</span>
                        <span>Weight</span>
                        <span>Reps</span>
                        <span>RPE</span>
                        <span>Note</span>
                      </div>
                      {exerciseLog.sets.map((set) => (
                        <div className={`sets-row ${set.done ? 'is-done' : ''}`} key={set.id}>
                          <button
                            aria-label={set.done ? 'Mark set incomplete' : 'Mark set done'}
                            className="check-button"
                            onClick={() => completeSet(exerciseLog.id, set, routineEntry?.restSeconds ?? 120)}
                            type="button"
                          >
                            {set.done ? '✓' : ''}
                          </button>
                          <input
                            aria-label="Weight"
                            inputMode="decimal"
                            onChange={(event) => updateSet(exerciseLog.id, set.id, { weight: Number(event.target.value) })}
                            type="number"
                            value={set.weight || ''}
                          />
                          <input
                            aria-label="Reps"
                            inputMode="numeric"
                            onChange={(event) => updateSet(exerciseLog.id, set.id, { reps: Number(event.target.value) })}
                            type="number"
                            value={set.reps || ''}
                          />
                          <input
                            aria-label="RPE"
                            inputMode="decimal"
                            max="10"
                            min="1"
                            onChange={(event) => updateSet(exerciseLog.id, set.id, { rpe: Number(event.target.value) })}
                            step="0.5"
                            type="number"
                            value={set.rpe || ''}
                          />
                          <input
                            aria-label="Set note"
                            onChange={(event) => updateSet(exerciseLog.id, set.id, { note: event.target.value })}
                            placeholder="Optional"
                            value={set.note}
                          />
                        </div>
                      ))}
                    </div>
                    <button className="secondary-action" onClick={() => addSet(exerciseLog.id)} type="button">
                      Add set
                    </button>
                  </div>
                )
              })}
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Exercise library</p>
                  <h2>Add movement</h2>
                </div>
                <input
                  aria-label="Search exercises"
                  onChange={(event) => setExerciseSearch(event.target.value)}
                  placeholder="Search"
                  value={exerciseSearch}
                />
              </div>
              <div className="library-grid">
                {filteredExercises.map((exercise) => (
                  <button key={exercise.id} onClick={() => addExercise(exercise.id)} type="button">
                    <strong>{exercise.name}</strong>
                    <span>{exercise.category}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="view-stack">
            <section className="summary-strip">
              <div>
                <span>Week sessions</span>
                <strong>{weeklySummary.sessions}</strong>
              </div>
              <div>
                <span>Week volume</span>
                <strong>{Math.round(weeklySummary.volume).toLocaleString()} {storedState.profile.units}</strong>
              </div>
              <div>
                <span>Queued sync</span>
                <strong>{storedState.syncQueue.length}</strong>
              </div>
            </section>
            <section className="history-list">
              {storedState.sessions.map((session) => (
                <article className="session-row" key={session.id}>
                  <div className="session-status" style={{ '--tone': statusTone[session.readinessStatus] } as CSSProperties}>
                    {session.readinessScore}
                  </div>
                  <div>
                    <p className="eyebrow">{new Date(session.date).toLocaleDateString()}</p>
                    <h2>{session.name}</h2>
                    <p className="muted">
                      {session.durationMinutes} min. {session.exercises.length} exercises. {session.prs.length ? session.prs.join(', ') : 'No PRs'}
                    </p>
                  </div>
                  <div className="session-sets">
                    {session.exercises.flatMap((exercise) =>
                      exercise.sets.slice(0, 2).map((set) => (
                        <span key={`${exercise.id}-${set.id}`}>
                          {findExercise(exercise.exerciseId).name}: {formatLoad(set.weight)} x {set.reps}
                        </span>
                      )),
                    )}
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="view-stack">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Progress</p>
                  <h2>{liftLabels[selectedLift]}</h2>
                </div>
                <select onChange={(event) => setSelectedLift(event.target.value as LiftId)} value={selectedLift}>
                  {Object.entries(liftLabels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chart">
                {progressSets.length ? (
                  progressSets.map((item) => (
                    <div className="chart-row" key={`${item.date}-${item.weight}-${item.reps}`}>
                      <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <div>
                        <i style={{ width: `${Math.max(8, (item.e1rm / maxChartValue) * 100)}%` }} />
                      </div>
                      <strong>{item.e1rm}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">Complete a tracked set to start the chart.</p>
                )}
              </div>
            </section>

            <section className="split-layout">
              <div className="panel">
                <p className="eyebrow">Personal records</p>
                <h2>Recent PRs</h2>
                <ul className="pr-list">
                  {storedState.sessions.flatMap((session) => session.prs).slice(0, 6).map((pr) => (
                    <li key={pr}>{pr}</li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <p className="eyebrow">Future-ready data</p>
                <h2>Coach prep</h2>
                <dl className="data-model">
                  <div><dt>User</dt><dd>Profile, units, maxes</dd></div>
                  <div><dt>Readiness</dt><dd>Score, soreness, note</dd></div>
                  <div><dt>Workout</dt><dd>Exercises, sets, overrides</dd></div>
                  <div><dt>Link</dt><dd>Coach-client relation later</dd></div>
                </dl>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}

function MetricControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="metric-control">
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            aria-label={`${label} ${option}`}
            className={value === option ? 'is-active' : ''}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
