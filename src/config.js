// ─────────────────────────────────────────────────────────────
// Neta360 app settings. This is the only file you normally edit.
// ─────────────────────────────────────────────────────────────

// true  = the app runs with built-in sample data (no backend needed).
//         Use this to try the app on your phone today.
// false = the app talks to your real FastAPI backend below.
export const DEMO_MODE = true;

// Your deployed backend (Render / VPS). No trailing slash.
export const API_BASE_URL = 'https://your-backend.onrender.com';

// How often the app syncs automatically while it is open.
export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

// A change is retried this many times before it is shown as "failed".
export const MAX_SYNC_ATTEMPTS = 5;

// Party options offered when the booth incharge marks someone as voted.
// This is the operator's own guess/assessment (ballots are secret) —
// not confirmed data. Colours are for the badge shown in the app.
export const PARTIES = [
  { code: 'TDP', color: '#FFC627' },
  { code: 'BJP', color: '#FF9933' },
  { code: 'YSRCP', color: '#1B75BB' },
  { code: 'JANASENA', color: '#7B2D8E' },
  { code: 'Others', color: '#55656E' },
];
