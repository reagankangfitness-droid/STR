# StrengthBoard

A Vite + React MVP prototype for fast strength logging with recovery-aware target adjustments.

## Features

- Today dashboard with readiness status and load adjustment explanations
- Working max inputs for squat, bench, deadlift, and overhead press
- Routine start flow for lower and upper strength sessions
- Active workout logger with weight, reps, RPE, set notes, done toggles, and rest timer
- Exercise library for adding strength-focused movements
- Session history, PR detection, weekly volume summary, and estimated 1RM chart
- LocalStorage persistence with an offline/sync queue interface
- Lightweight data model surface prepared for future coach-client linking

## Development

```bash
npm install
npm run dev
```

The local app runs at:

```text
http://127.0.0.1:5173/
```

## Checks

```bash
npm run lint
npm run build
```
