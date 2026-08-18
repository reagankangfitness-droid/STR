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
type SetOverride = { kg: number; reps: number; rpe: number | null }
type ExerciseDraft = {
  name: string
  category: PlannedExercise['category']
  lift: Lift | 'none'
  pctOfMax: number
  sets: number
  reps: number
  rpe: number
}

type StoredState = {
  profile: Profile
  maxes: Maxes
  workouts: Workout[]
  checkin: Checkin
  sessions: Session[]
  sync: SyncState
  activeWorkoutId: string
  activeSets: LoggedSet[]
  activeExtraSets: Record<string, number>
  activeStartedAt: string | null
  restStartedAt: string | null
  selectedLift: Lift
  setOverrides: Record<string, SetOverride>
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

const seedSessions: Session[] = [
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
]

function createDefaultState(): StoredState {
  return {
    profile,
    maxes,
    workouts,
    checkin: { ...defaultCheckin, date: new Date().toISOString().slice(0, 10) },
    sessions: seedSessions,
    sync: { online: true, queued: 1 },
    activeWorkoutId: 'lower-strength',
    activeSets: [],
    activeExtraSets: {},
    activeStartedAt: null,
    restStartedAt: null,
    selectedLift: 'squat',
    setOverrides: {},
  }
}

const readouts = {
  overall: ['Flat', 'Low', 'Fine', 'Good', 'Sharp'],
  sleep: ['Broken', 'Light', 'Fair', 'Solid', 'Deep'],
  soreness: ['None', 'Mild', 'Moderate', 'High', 'Severe'],
}

function readState(): StoredState {
  const saved = window.localStorage.getItem(storageKey)
  const defaultState = createDefaultState()

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
      activeExtraSets: parsed.activeExtraSets ?? {},
      setOverrides: parsed.setOverrides ?? {},
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

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2
}

function roundPercent(value: number) {
  return Math.round(value / 2.5) * 2.5
}

function formatKg(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatRpe(value: number | null | undefined) {
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

function workoutSetCount(workout: Workout) {
  return workout.exercises.reduce((total, exercise) => total + exercise.sets, 0)
}

function makeId(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base || 'exercise'}-${Date.now().toString(36)}`
}

function App() {
  const [state, setState] = useState<StoredState>(() => readState())
  const [tab, setTab] = useState<Tab>(() => readInitialTab())
  const [tick, setTick] = useState(() => Number(new Date()))
  const [showWhy, setShowWhy] = useState(false)
  const [overrideKey, setOverrideKey] = useState<string | null>(null)

  const score = scoreCheckin(state.checkin)
  const lowerWorkout = state.workouts[0]
  const activeWorkout = state.workouts.find((workout) => workout.id === state.activeWorkoutId) ?? lowerWorkout
  const targetMap = useMemo(() => {
    return new Map(
      state.workouts
        .flatMap((workout) => workout.exercises)
        .map((exercise) => [exercise.id, targetFor(exercise, state, score)]),
    )
  }, [score, state])
  const squatTarget = targetMap.get('back-squat')
  const activeMainExercise = activeWorkout.exercises.find((exercise) => exercise.lift)
  const focusTarget = activeMainExercise ? targetMap.get(activeMainExercise.id) : squatTarget
  const setRows = activeWorkout.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.sets + (state.activeExtraSets[exercise.id] ?? 0) }, (_, index) => ({
      exercise,
      index,
      key: `${exercise.id}:${index}`,
      target: targetMap.get(exercise.id),
    })),
  )
  const loggedKeys = new Set(state.activeSets.map((set) => `${set.exerciseId}:${set.index}`))
  const activeExercise = activeWorkout.exercises.find((exercise) =>
    setRows.some((row) => row.exercise.id === exercise.id && !loggedKeys.has(row.key)),
  ) ?? activeWorkout.exercises[0]
  const activeTarget = targetMap.get(activeExercise.id)
  const doneCount = state.activeSets.length
  const totalSetCount = setRows.length
  const nextRow = setRows.find((row) => !loggedKeys.has(row.key))
  const selectedTarget = state.workouts
    .flatMap((workout) => workout.exercises)
    .find((exercise) => exercise.lift === state.selectedLift)
  const restRemaining = state.restStartedAt
    ? Math.min(restSeconds, Math.max(0, restSeconds - Math.floor((tick - Number(new Date(state.restStartedAt))) / 1000)))
    : 0
  const verdict = (focusTarget?.adj ?? 0) === 0
    ? {
        badge: 'PLAN HELD',
        sentence: 'Green day. Sleep and soreness are inside range — run the targets as written.',
      }
    : {
        badge: `${focusTarget?.adj ?? 0}% ADJUSTED`,
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

  function updateMax(lift: Lift, delta: number) {
    setState((current) => ({
      ...current,
      maxes: {
        ...current.maxes,
        [lift]: Math.max(0, roundTo2_5(current.maxes[lift] + delta)),
      },
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function setTodayWorkout(workoutId: string) {
    setState((current) => ({
      ...current,
      activeWorkoutId: workoutId,
      activeSets: current.activeWorkoutId === workoutId ? current.activeSets : [],
      activeExtraSets: current.activeWorkoutId === workoutId ? current.activeExtraSets : {},
      activeStartedAt: current.activeWorkoutId === workoutId ? current.activeStartedAt : null,
      restStartedAt: current.activeWorkoutId === workoutId ? current.restStartedAt : null,
      setOverrides: current.activeWorkoutId === workoutId ? current.setOverrides : {},
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function updateExercise(workoutId: string, exerciseId: string, patch: Partial<PlannedExercise>) {
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((workout) =>
        workout.id === workoutId
          ? {
              ...workout,
              exercises: workout.exercises.map((exercise) =>
                exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
              ),
            }
          : workout,
      ),
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function adjustExercise(
    workoutId: string,
    exerciseId: string,
    field: 'sets' | 'reps' | 'pctOfMax' | 'rpe',
    delta: number,
  ) {
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((workout) =>
        workout.id === workoutId
          ? {
              ...workout,
              exercises: workout.exercises.map((exercise) => {
                if (exercise.id !== exerciseId) return exercise
                if (field === 'sets' || field === 'reps') return { ...exercise, [field]: Math.max(1, exercise[field] + delta) }
                if (field === 'rpe') return { ...exercise, rpe: Math.max(1, Math.min(10, roundToHalf((exercise.rpe ?? 7) + delta))) }
                return { ...exercise, pctOfMax: Math.max(0.3, Math.min(1.2, roundPercent((exercise.pctOfMax ?? 0.7) * 100 + delta) / 100)) }
              }),
            }
          : workout,
      ),
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function setExerciseLift(workoutId: string, exerciseId: string, lift: Lift | 'none') {
    const categoryByLift: Record<Lift, PlannedExercise['category']> = {
      squat: 'Squat',
      bench: 'Bench',
      deadlift: 'Deadlift',
      press: 'Press',
    }
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((workout) =>
        workout.id === workoutId
          ? {
              ...workout,
              exercises: workout.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? lift === 'none'
                    ? { ...exercise, lift: undefined, pctOfMax: undefined }
                    : { ...exercise, lift, category: categoryByLift[lift], pctOfMax: exercise.pctOfMax ?? 0.7 }
                  : exercise,
              ),
            }
          : workout,
      ),
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function removeExercise(workoutId: string, exerciseId: string) {
    setState((current) => ({
      ...current,
      workouts: current.workouts.map((workout) =>
        workout.id === workoutId && workout.exercises.length > 1
          ? { ...workout, exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId) }
          : workout,
      ),
      activeSets: current.activeSets.filter((set) => set.exerciseId !== exerciseId),
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function addCustomExercise(workoutId: string, draft: ExerciseDraft) {
    const exercise: PlannedExercise = {
      id: makeId(draft.name),
      name: draft.name.trim() || 'Custom Exercise',
      category: draft.category,
      sets: draft.sets,
      reps: draft.reps,
      rpe: draft.rpe,
      ...(draft.lift === 'none' ? {} : { lift: draft.lift, pctOfMax: draft.pctOfMax }),
    }

    setState((current) => ({
      ...current,
      workouts: current.workouts.map((workout) =>
        workout.id === workoutId ? { ...workout, exercises: [...workout.exercises, exercise] } : workout,
      ),
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function resetLocalData() {
    window.localStorage.removeItem(storageKey)
    setOverrideKey(null)
    setShowWhy(false)
    setState(createDefaultState())
    selectTab('today')
  }

  function startWorkout(workoutId = lowerWorkout.id) {
    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      activeWorkoutId: workoutId,
      activeSets: [],
      activeExtraSets: {},
      activeStartedAt: now,
      restStartedAt: null,
      setOverrides: {},
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
    selectTab('log')
  }

  function logSet(row: { exercise: PlannedExercise; index: number; key: string; target?: TargetResult }) {
    if (loggedKeys.has(row.key)) return
    const override = state.setOverrides[row.key]
    const kg = override?.kg ?? row.target?.kg ?? 0
    const reps = override?.reps ?? row.exercise.reps
    const rpe = override?.rpe ?? row.exercise.rpe ?? null
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
          reps,
          rpe,
          at: now,
        },
      ],
      restStartedAt: now,
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function toggleOverride(row: { exercise: PlannedExercise; index: number; key: string; target?: TargetResult }) {
    setOverrideKey(overrideKey === row.key ? null : row.key)
    setState((current) => {
      if (current.setOverrides[row.key]) return current
      const logged = current.activeSets.find((set) => set.exerciseId === row.exercise.id && set.index === row.index)

      return {
        ...current,
        setOverrides: {
          ...current.setOverrides,
          [row.key]: {
            kg: logged?.kg ?? row.target?.kg ?? 0,
            reps: logged?.reps ?? row.exercise.reps,
            rpe: logged?.rpe ?? row.exercise.rpe ?? null,
          },
        },
      }
    })
  }

  function adjustSet(exerciseId: string, index: number, field: 'kg' | 'reps' | 'rpe', delta: number) {
    const key = `${exerciseId}:${index}`
    setState((current) => ({
      ...current,
      activeSets: current.activeSets.map((set) =>
        set.exerciseId === exerciseId && set.index === index
          ? {
              ...set,
              [field]: field === 'kg'
                ? Math.max(0, roundTo2_5(set.kg + delta))
                : field === 'reps'
                  ? Math.max(1, set.reps + delta)
                  : Math.max(1, Math.min(10, roundToHalf((set.rpe ?? 7) + delta))),
            }
          : set,
      ),
      setOverrides: {
        ...current.setOverrides,
        [key]: {
          kg: field === 'kg'
            ? Math.max(0, roundTo2_5((current.setOverrides[key]?.kg ?? current.activeSets.find((set) => set.exerciseId === exerciseId && set.index === index)?.kg ?? 0) + delta))
            : (current.setOverrides[key]?.kg ?? current.activeSets.find((set) => set.exerciseId === exerciseId && set.index === index)?.kg ?? 0),
          reps: field === 'reps'
            ? Math.max(1, (current.setOverrides[key]?.reps ?? current.activeSets.find((set) => set.exerciseId === exerciseId && set.index === index)?.reps ?? 1) + delta)
            : (current.setOverrides[key]?.reps ?? current.activeSets.find((set) => set.exerciseId === exerciseId && set.index === index)?.reps ?? 1),
          rpe: field === 'rpe'
            ? Math.max(1, Math.min(10, roundToHalf((current.setOverrides[key]?.rpe ?? current.activeSets.find((set) => set.exerciseId === exerciseId && set.index === index)?.rpe ?? 7) + delta)))
            : (current.setOverrides[key]?.rpe ?? current.activeSets.find((set) => set.exerciseId === exerciseId && set.index === index)?.rpe ?? null),
        },
      },
      sync: { ...current.sync, queued: current.sync.queued + 1 },
    }))
  }

  function deleteSet(exerciseId: string, index: number) {
    const key = `${exerciseId}:${index}`
    setState((current) => {
      const nextOverrides = { ...current.setOverrides }
      delete nextOverrides[key]

      return {
        ...current,
        activeSets: current.activeSets.filter((set) => !(set.exerciseId === exerciseId && set.index === index)),
        setOverrides: nextOverrides,
        sync: { ...current.sync, queued: current.sync.queued + 1 },
      }
    })
    setOverrideKey(null)
  }

  function addSet() {
    setState((current) => ({
      ...current,
      activeExtraSets: {
        ...current.activeExtraSets,
        [activeExercise.id]: (current.activeExtraSets[activeExercise.id] ?? 0) + 1,
      },
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
      activeExtraSets: {},
      activeStartedAt: null,
      restStartedAt: null,
      setOverrides: {},
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
              activeWorkout={activeWorkout}
              focusTarget={focusTarget}
              patchCheckin={patchCheckin}
            profile={state.profile}
            score={score}
            showWhy={showWhy}
            startWorkout={startWorkout}
            state={state}
            syncNow={syncNow}
            targetMap={targetMap}
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
            addSet={addSet}
            completeSession={completeSession}
            deleteSet={deleteSet}
            doneCount={doneCount}
            logSet={logSet}
            loggedKeys={loggedKeys}
            nextKey={nextRow?.key}
            overrideKey={overrideKey}
            restRemaining={restRemaining}
            setOverrides={state.setOverrides}
            setRows={setRows}
            targetMap={targetMap}
            toggleOverride={toggleOverride}
            totalSetCount={totalSetCount}
          />
        )}
        {tab === 'history' && <History queued={state.sync.queued} sessions={state.sessions} />}
        {tab === 'progress' && (
          <Progress
            activeWorkout={activeWorkout}
            addCustomExercise={addCustomExercise}
            adjustExercise={adjustExercise}
            profile={state.profile}
            removeExercise={removeExercise}
            resetLocalData={resetLocalData}
            selectedLift={state.selectedLift}
            setExerciseLift={setExerciseLift}
            sessions={state.sessions}
            setSelectedLift={(selectedLift) => setState((current) => ({ ...current, selectedLift }))}
            setTodayWorkout={setTodayWorkout}
            state={state}
            target={selectedTarget ? targetMap.get(selectedTarget.id) : undefined}
            updateMax={updateMax}
            updateExercise={updateExercise}
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
  activeWorkout,
  focusTarget,
  patchCheckin,
  profile,
  score,
  setShowWhy,
  showWhy,
  startWorkout,
  state,
  syncNow,
  targetMap,
  verdict,
}: {
  activeWorkout: Workout
  focusTarget?: TargetResult
  patchCheckin: (next: Partial<Checkin>) => void
  profile: Profile
  score: number
  setShowWhy: (value: boolean) => void
  showWhy: boolean
  startWorkout: (workoutId?: string) => void
  state: StoredState
  syncNow: () => void
  targetMap: Map<string, TargetResult>
  verdict: { badge: string; sentence: string }
}) {
  const targetLabel = focusTarget?.exercise.name ? `${focusTarget.exercise.name} target` : 'Target'
  const previewExercises = activeWorkout.exercises.slice(0, 2)
  const hiddenExerciseCount = Math.max(0, activeWorkout.exercises.length - previewExercises.length)

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
          <p className="micro">{targetLabel}</p>
          <p className="load-number">{formatKg(focusTarget?.kg)} <span>{profile.units}</span></p>
          <button className={(focusTarget?.adj ?? 0) === 0 ? 'badge sage' : 'badge amber'} onClick={() => setShowWhy(!showWhy)} type="button">
            {verdict.badge}
          </button>
        </div>
        {showWhy && focusTarget && (
          <div className="why-panel">
            {focusTarget.factors.map((factor) => (
              <span key={factor.label}>{factor.label} {factor.value}%</span>
            ))}
          </div>
        )}
      </section>

      <section className="targets-list">
        <h2 className="section-label">Today&apos;s workout</h2>
        <div className="workout-summary">
          <span>{activeWorkout.name}</span>
          <strong>{workoutSetCount(activeWorkout)} SETS</strong>
          <p>{activeWorkout.detail}</p>
        </div>

        <button className="primary-button decision-button" onClick={() => startWorkout(activeWorkout.id)} type="button">
          <span>Start {activeWorkout.name}</span>
          <span>Begin</span>
        </button>

        <div className="session-preview">
          {previewExercises.map((exercise, index) => {
          const target = targetMap.get(exercise.id)
          return (
            <div className="target-row" key={exercise.id}>
              <div>
                <strong>{String(index + 1).padStart(2, '0')} · {exercise.name}</strong>
                <p>{exercise.lift ? target?.basis : `${exercise.sets} × ${exercise.reps} · left alone`}</p>
              </div>
              <p>{exercise.lift ? formatKg(target?.kg) : `${exercise.sets}×${exercise.reps}`} <span>{exercise.lift ? profile.units : ''}</span></p>
              <em className={(target?.adj ?? 0) === 0 ? 'sage-text' : 'amber-text'}>{exercise.lift ? target?.adj === 0 ? 'held' : `${target?.adj}%` : 'base'}</em>
            </div>
          )
        })}
          {hiddenExerciseCount > 0 && <p className="preview-more">{hiddenExerciseCount} more in Log.</p>}
        </div>
      </section>

      <section className="checkin">
        <h2 className="section-label">Readiness check</h2>
        <CheckinRow label="Overall" value={state.checkin.overall} words={readouts.overall} onChange={(overall) => patchCheckin({ overall })} />
        <CheckinRow label="Sleep" value={state.checkin.sleep} words={readouts.sleep} onChange={(sleep) => patchCheckin({ sleep })} />
        <CheckinRow label="Leg soreness" value={state.checkin.soreness} words={readouts.soreness} onChange={(soreness) => patchCheckin({ soreness })} />
      </section>

      <div className="sync-line">
        <span>● {state.sync.online ? 'ONLINE' : 'OFFLINE'} · {state.sync.queued} CHANGE WAITING</span>
        <button onClick={syncNow} type="button">Sync</button>
      </div>
    </>
  )
}

function MaxRow({
  lift,
  units,
  updateMax,
  value,
}: {
  lift: Lift
  units: string
  updateMax: (lift: Lift, delta: number) => void
  value: number
}) {
  const liftLabels: Record<Lift, string> = {
    squat: 'Squat',
    bench: 'Bench',
    deadlift: 'Deadlift',
    press: 'Press',
  }

  return (
    <div className="max-row">
      <span>{liftLabels[lift]}</span>
      <button onClick={() => updateMax(lift, -2.5)} type="button">−2.5</button>
      <strong>{formatKg(value)} <em>{units}</em></strong>
      <button onClick={() => updateMax(lift, 2.5)} type="button">+2.5</button>
    </div>
  )
}

function ExerciseEditor({
  adjustExercise,
  exercise,
  removeExercise,
  setExerciseLift,
  updateExercise,
  workoutId,
}: {
  adjustExercise: (workoutId: string, exerciseId: string, field: 'sets' | 'reps' | 'pctOfMax' | 'rpe', delta: number) => void
  exercise: PlannedExercise
  removeExercise: (workoutId: string, exerciseId: string) => void
  setExerciseLift: (workoutId: string, exerciseId: string, lift: Lift | 'none') => void
  updateExercise: (workoutId: string, exerciseId: string, patch: Partial<PlannedExercise>) => void
  workoutId: string
}) {
  const liftValue = exercise.lift ?? 'none'

  return (
    <article className="exercise-editor">
      <div className="editor-head">
        <input
          aria-label={`${exercise.name} name`}
          onChange={(event) => updateExercise(workoutId, exercise.id, { name: event.target.value })}
          value={exercise.name}
        />
        <button onClick={() => removeExercise(workoutId, exercise.id)} type="button">Remove</button>
      </div>
      <div className="editor-meta">
        <span>{exercise.category}</span>
        <span>{exercise.lift ? `${exercise.lift} · ${Math.round((exercise.pctOfMax ?? 0) * 100)}%` : 'left alone'}</span>
      </div>
      <div className="lift-picks">
        {(['none', 'squat', 'bench', 'deadlift', 'press'] as Array<Lift | 'none'>).map((lift) => (
          <button className={liftValue === lift ? 'active' : ''} key={lift} onClick={() => setExerciseLift(workoutId, exercise.id, lift)} type="button">
            {lift}
          </button>
        ))}
      </div>
      <div className="edit-grid">
        <StepperControl label="Sets" value={String(exercise.sets)} onDec={() => adjustExercise(workoutId, exercise.id, 'sets', -1)} onInc={() => adjustExercise(workoutId, exercise.id, 'sets', 1)} />
        <StepperControl label="Reps" value={String(exercise.reps)} onDec={() => adjustExercise(workoutId, exercise.id, 'reps', -1)} onInc={() => adjustExercise(workoutId, exercise.id, 'reps', 1)} />
        <StepperControl label="RPE" value={formatRpe(exercise.rpe)} onDec={() => adjustExercise(workoutId, exercise.id, 'rpe', -0.5)} onInc={() => adjustExercise(workoutId, exercise.id, 'rpe', 0.5)} />
        {exercise.lift && (
          <StepperControl
            label="Percent"
            value={`${Math.round((exercise.pctOfMax ?? 0.7) * 100)}%`}
            onDec={() => adjustExercise(workoutId, exercise.id, 'pctOfMax', -2.5)}
            onInc={() => adjustExercise(workoutId, exercise.id, 'pctOfMax', 2.5)}
          />
        )}
      </div>
    </article>
  )
}

function StepperControl({
  label,
  onDec,
  onInc,
  value,
}: {
  label: string
  onDec: () => void
  onInc: () => void
  value: string
}) {
  return (
    <div className="mini-stepper">
      <span>{label}</span>
      <button onClick={onDec} type="button">−</button>
      <strong>{value}</strong>
      <button onClick={onInc} type="button">+</button>
    </div>
  )
}

function AddExerciseForm({
  addCustomExercise,
  workoutId,
}: {
  addCustomExercise: (workoutId: string, draft: ExerciseDraft) => void
  workoutId: string
}) {
  const [draft, setDraft] = useState<ExerciseDraft>({
    name: '',
    category: 'Accessory',
    lift: 'none',
    pctOfMax: 0.7,
    sets: 3,
    reps: 8,
    rpe: 8,
  })
  const categories: PlannedExercise['category'][] = ['Squat', 'Bench', 'Deadlift', 'Press', 'Hinge', 'Pull', 'Accessory']

  function addExercise() {
    addCustomExercise(workoutId, draft)
    setDraft((current) => ({ ...current, name: '' }))
  }

  return (
    <section className="add-exercise">
      <h3>Add exercise</h3>
      <input
        aria-label="Custom exercise name"
        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        placeholder="Exercise name"
        value={draft.name}
      />
      <div className="category-picks">
        {categories.map((category) => (
          <button
            className={draft.category === category ? 'active' : ''}
            key={category}
            onClick={() => setDraft((current) => ({ ...current, category }))}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>
      <div className="lift-picks">
        {(['none', 'squat', 'bench', 'deadlift', 'press'] as Array<Lift | 'none'>).map((lift) => (
          <button
            className={draft.lift === lift ? 'active' : ''}
            key={lift}
            onClick={() => setDraft((current) => ({ ...current, lift }))}
            type="button"
          >
            {lift}
          </button>
        ))}
      </div>
      <div className="edit-grid">
        <StepperControl label="Sets" value={String(draft.sets)} onDec={() => setDraft((current) => ({ ...current, sets: Math.max(1, current.sets - 1) }))} onInc={() => setDraft((current) => ({ ...current, sets: current.sets + 1 }))} />
        <StepperControl label="Reps" value={String(draft.reps)} onDec={() => setDraft((current) => ({ ...current, reps: Math.max(1, current.reps - 1) }))} onInc={() => setDraft((current) => ({ ...current, reps: current.reps + 1 }))} />
        <StepperControl label="RPE" value={formatRpe(draft.rpe)} onDec={() => setDraft((current) => ({ ...current, rpe: Math.max(1, roundToHalf(current.rpe - 0.5)) }))} onInc={() => setDraft((current) => ({ ...current, rpe: Math.min(10, roundToHalf(current.rpe + 0.5)) }))} />
        {draft.lift !== 'none' && (
          <StepperControl label="Percent" value={`${Math.round(draft.pctOfMax * 100)}%`} onDec={() => setDraft((current) => ({ ...current, pctOfMax: Math.max(0.3, current.pctOfMax - 0.025) }))} onInc={() => setDraft((current) => ({ ...current, pctOfMax: Math.min(1.2, current.pctOfMax + 0.025) }))} />
        )}
      </div>
      <button className="secondary-button add-button" onClick={addExercise} type="button">Add custom exercise</button>
    </section>
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
  addSet,
  completeSession,
  deleteSet,
  doneCount,
  logSet,
  loggedKeys,
  nextKey,
  overrideKey,
  restRemaining,
  setOverrides,
  setRows,
  targetMap,
  toggleOverride,
  totalSetCount,
}: {
  activeExercise: PlannedExercise
  activeSets: LoggedSet[]
  activeTarget?: TargetResult
  activeWorkout: Workout
  adjustSet: (exerciseId: string, index: number, field: 'kg' | 'reps' | 'rpe', delta: number) => void
  addSet: () => void
  completeSession: () => void
  deleteSet: (exerciseId: string, index: number) => void
  doneCount: number
  logSet: (row: { exercise: PlannedExercise; index: number; key: string; target?: TargetResult }) => void
  loggedKeys: Set<string>
  nextKey?: string
  overrideKey: string | null
  restRemaining: number
  setOverrides: Record<string, SetOverride>
  setRows: Array<{ exercise: PlannedExercise; index: number; key: string; target?: TargetResult }>
  targetMap: Map<string, TargetResult>
  toggleOverride: (row: { exercise: PlannedExercise; index: number; key: string; target?: TargetResult }) => void
  totalSetCount: number
}) {
  const currentRows = setRows.filter((row) => row.exercise.id === activeExercise.id)
  const activeIndex = activeWorkout.exercises.findIndex((exercise) => exercise.id === activeExercise.id)
  const remainingExercises = activeWorkout.exercises.slice(activeIndex + 1)

  return (
    <>
      <div className="eyebrow-row">
        <span>ACTIVE · {doneCount}/{totalSetCount} SETS</span>
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
          const override = setOverrides[row.key]
          const isLogged = Boolean(logged)
          const isNext = row.key === nextKey
          const displayKg = override?.kg ?? logged?.kg ?? row.target?.kg
          const displayReps = override?.reps ?? logged?.reps ?? row.exercise.reps
          const displayRpe = override?.rpe ?? logged?.rpe ?? row.exercise.rpe ?? null

          return (
            <div className={`set-row ${isLogged ? 'logged' : ''} ${isNext ? 'next' : ''}`} key={row.key}>
              <button onClick={() => logSet(row)} type="button">{row.index + 1}</button>
              <button onClick={() => logSet(row)} type="button">{isLogged ? 'logged' : isNext ? 'up next' : 'pending'}</button>
              <button onClick={() => toggleOverride(row)} type="button">{formatKg(displayKg)}</button>
              <button onClick={() => toggleOverride(row)} type="button">{displayReps}</button>
              <button onClick={() => toggleOverride(row)} type="button">{formatRpe(displayRpe)}</button>
              {overrideKey === row.key && (
                <div className="stepper">
                  <span>{formatKg(displayKg)} KG · {displayReps} REPS · RPE {formatRpe(displayRpe)}</span>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'kg', -2.5)} type="button">−2.5</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'kg', 2.5)} type="button">+2.5</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'reps', -1)} type="button">−1 REP</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'reps', 1)} type="button">+1 REP</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'rpe', -0.5)} type="button">−0.5 RPE</button>
                  <button onClick={() => adjustSet(row.exercise.id, row.index, 'rpe', 0.5)} type="button">+0.5 RPE</button>
                  {isLogged && <button className="delete-set" onClick={() => deleteSet(row.exercise.id, row.index)} type="button">Delete set</button>}
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
            <em>{exercise.sets} × {exercise.reps}{exercise.lift ? ` · ${formatKg(targetMap.get(exercise.id)?.kg)} KG` : ''}</em>
          </div>
        ))}
      </section>
      <div className="actions">
        <button className="secondary-button" disabled={!loggedKeys.size} onClick={completeSession} type="button">Complete</button>
        <button className="secondary-button" onClick={addSet} type="button">Add set</button>
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
  activeWorkout,
  addCustomExercise,
  adjustExercise,
  profile,
  removeExercise,
  resetLocalData,
  selectedLift,
  setExerciseLift,
  sessions,
  setSelectedLift,
  setTodayWorkout,
  state,
  target,
  updateMax,
  updateExercise,
}: {
  activeWorkout: Workout
  addCustomExercise: (workoutId: string, draft: ExerciseDraft) => void
  adjustExercise: (workoutId: string, exerciseId: string, field: 'sets' | 'reps' | 'pctOfMax' | 'rpe', delta: number) => void
  profile: Profile
  removeExercise: (workoutId: string, exerciseId: string) => void
  resetLocalData: () => void
  selectedLift: Lift
  setExerciseLift: (workoutId: string, exerciseId: string, lift: Lift | 'none') => void
  sessions: Session[]
  setSelectedLift: (lift: Lift) => void
  setTodayWorkout: (workoutId: string) => void
  state: StoredState
  target?: TargetResult
  updateMax: (lift: Lift, delta: number) => void
  updateExercise: (workoutId: string, exerciseId: string, patch: Partial<PlannedExercise>) => void
}) {
  const liftNames: Record<Lift, string> = {
    squat: 'Back Squat',
    bench: 'Bench Press',
    deadlift: 'Deadlift',
    press: 'Overhead Press',
  }
  const liftExerciseIds: Record<Lift, string> = {
    squat: 'back-squat',
    bench: 'bench-press',
    deadlift: 'deadlift',
    press: 'overhead-press',
  }
  const exerciseId = target?.exercise.id ?? liftExerciseIds[selectedLift]
  const rows = sessions
    .flatMap((session) => session.sets.filter((set) => set.exerciseId === exerciseId).slice(0, 1).map((set) => ({ date: session.date, kg: set.kg, label: 'TOP SET', current: true })))
  const targetRow = { date: new Date().toISOString(), kg: target?.kg ?? 0, label: 'TODAY', current: false }
  const allRows = [targetRow, ...rows]
  const max = Math.max(...allRows.map((row) => row.kg), 1)

  return (
    <>
      <div className="eyebrow-row"><span>TOP SET · {liftNames[selectedLift].toUpperCase()}</span><span /></div>
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

      <section className="setup-panel">
        <h2 className="section-label">Setup</h2>

        <section className="session-list">
          <h3 className="subsection-label">Today&apos;s workout</h3>
          {state.workouts.map((workout) => (
            <button
              className={workout.id === activeWorkout.id ? 'session-choice today-choice' : 'session-choice'}
              key={workout.id}
              onClick={() => setTodayWorkout(workout.id)}
              type="button"
            >
              <span>{workout.name}</span>
              <p>{workout.detail}</p>
              <em>{workout.id === activeWorkout.id ? 'TODAY' : `${workoutSetCount(workout)} SETS`}</em>
            </button>
          ))}
        </section>

        <section className="maxes-list">
          <h3 className="subsection-label">Working maxes</h3>
          {(['squat', 'bench', 'deadlift', 'press'] as Lift[]).map((lift) => (
            <MaxRow key={lift} lift={lift} units={profile.units} value={state.maxes[lift]} updateMax={updateMax} />
          ))}
        </section>

        <section className="builder-list">
          <h3 className="subsection-label">Workout editor</h3>
          {activeWorkout.exercises.map((exercise) => (
            <ExerciseEditor
              adjustExercise={adjustExercise}
              exercise={exercise}
              key={exercise.id}
              removeExercise={removeExercise}
              setExerciseLift={setExerciseLift}
              updateExercise={updateExercise}
              workoutId={activeWorkout.id}
            />
          ))}
          <AddExerciseForm addCustomExercise={addCustomExercise} workoutId={activeWorkout.id} />
        </section>

        <button className="reset-button" onClick={resetLocalData} type="button">Reset local data</button>
      </section>
    </>
  )
}

export default App
