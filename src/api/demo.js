// A pretend backend so the app can be tried on a phone without a server.
import { ApiError } from './errors';
import { getMeta, setMeta } from '../db/repo';

// Login with phone 9000000001 and password demo123.
// It mimics the exact responses of the real FastAPI endpoints.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FIRST_M = ['Venkata Ramana', 'Srinivas', 'Ramesh', 'Suresh', 'Nagaraju', 'Prasad', 'Mahesh', 'Chandra Sekhar', 'Ravi Teja', 'Koteswara Rao', 'Anil Kumar', 'Sai Kiran'];
const FIRST_F = ['Lakshmi', 'Padma', 'Anjali', 'Kavitha', 'Sujatha', 'Swathi', 'Rani', 'Divya', 'Bhavani', 'Madhavi', 'Sravani', 'Hema'];
const FAMILY = ['Kota', 'Vemula', 'Bandi', 'Gundla', 'Mekala', 'Paladugu', 'Tadi', 'Ponnam', 'Karri', 'Allam'];

function buildVoters() {
  const rnd = seeded(142);
  const voters = [];
  let serial = 1;
  for (let house = 1; house <= 40; house++) {
    const family = FAMILY[Math.floor(rnd() * FAMILY.length)];
    const houseNo = `${1 + Math.floor(house / 12)}-${house}`;
    const size = 2 + Math.floor(rnd() * 3);
    const headName = `${family} ${FIRST_M[Math.floor(rnd() * FIRST_M.length)]}`;
    for (let i = 0; i < size; i++) {
      const female = i === 1 || rnd() > 0.55;
      const first = female ? FIRST_F[Math.floor(rnd() * FIRST_F.length)] : FIRST_M[Math.floor(rnd() * FIRST_M.length)];
      voters.push({
        id: String(1000 + serial),
        serial_no: serial,
        epic_no: `KDK${String(3100000 + serial * 37).padStart(7, '0')}`,
        name: i === 0 ? headName : `${family} ${first}`,
        relation_type: i === 0 ? 'Father' : i === 1 ? 'Husband' : 'Father',
        relation_name: i === 0 ? `${family} ${FIRST_M[(house + 3) % FIRST_M.length]}` : headName,
        gender: i === 0 ? 'M' : female ? 'F' : 'M',
        age: i === 0 ? 45 + Math.floor(rnd() * 25) : i === 1 ? 38 + Math.floor(rnd() * 20) : 18 + Math.floor(rnd() * 12),
        house_no: houseNo,
        section: house <= 20 ? 'Ward 3, Main Road' : 'Ward 3, Temple Street',
      });
      serial++;
    }
  }
  return voters;
}

const state = {
  voters: buildVoters(),
  mobile: {}, // voter_id -> { mobile_number, household_id }
  turnout: {}, // voter_id -> { voted_at, party }
  surveyCounts: {},
  households: {},
  processed: new Set(),
  otps: {}, // voter_id -> { code, mobile_number, expiresAt }
};

// This pretend backend otherwise lives only in memory, so every app reload would "forget"
// mobile numbers, family mappings and turnout the operator already saved — and the next
// auto-sync would then overwrite the (still-intact) local database with that amnesia.
// Persisting it into the same local database that survives reloads avoids that.
const STATE_KEY = 'demo_backend_state';
let hydrating = null;

async function ensureHydrated() {
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const raw = await getMeta(STATE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          state.mobile = saved.mobile || {};
          state.turnout = saved.turnout || {};
          state.surveyCounts = saved.surveyCounts || {};
          state.households = saved.households || {};
          state.processed = new Set(saved.processed || []);
        }
      } catch {
        // Corrupt or missing saved state — start fresh rather than fail the request.
      }
    })();
  }
  await hydrating;
}

async function persist() {
  await setMeta(
    STATE_KEY,
    JSON.stringify({
      mobile: state.mobile,
      turnout: state.turnout,
      surveyCounts: state.surveyCounts,
      households: state.households,
      processed: [...state.processed],
    })
  );
}

const BOOTH = { booth_no: 142, name: 'MPP School, Room 2', village: 'Kandukur', mandal: 'Kandukur' };
const OPERATOR = { id: 7, name: 'Demo Operator', phone: '9000000001' };

const SURVEYS = [
  {
    id: 1,
    title: 'Household welfare survey',
    description: 'Ask the head of the family. Takes about 2 minutes.',
    questions: [
      { id: 'pension', text: 'Does anyone in the family receive a pension?', type: 'single', options: ['Yes', 'No'], required: true },
      { id: 'schemes', text: 'Which benefits does the family receive?', type: 'multi', options: ['Ration card', 'Health card', 'Housing scheme', 'Farmer support', 'None'], required: true },
      { id: 'issue', text: 'What is the biggest problem in your street?', type: 'single', options: ['Drinking water', 'Roads', 'Drainage', 'Street lights', 'Other'], required: true },
      { id: 'working_outside', text: 'How many family members work outside the village?', type: 'number', required: false },
      { id: 'remarks', text: 'Anything else the family wants the MLA office to know?', type: 'text', required: false },
    ],
  },
];

const NOTIFICATIONS = [
  { id: 'n1', title: 'Welcome to Neta360', body: 'Start by mapping families in your booth. Your work is saved on the phone even without signal.', created_at: '2026-09-01T09:00:00Z' },
  { id: 'n2', title: 'Welfare survey is live', body: 'Please complete the household welfare survey for every family by the end of the month.', created_at: '2026-09-05T10:30:00Z' },
];

function pull() {
  return {
    booth: BOOTH,
    voters: state.voters.map((v) => ({
      ...v,
      mobile_number: state.mobile[v.id]?.mobile_number ?? null,
      household_id: state.mobile[v.id]?.household_id ?? null,
      is_voted: Boolean(state.turnout[v.id]),
      voted_at: state.turnout[v.id]?.voted_at ?? null,
      voted_party: state.turnout[v.id]?.party ?? null,
      survey_count: state.surveyCounts[v.id] || 0,
    })),
    households: Object.values(state.households),
    surveys: SURVEYS,
    notifications: NOTIFICATIONS,
    server_time: new Date().toISOString(),
  };
}

function push(ops) {
  const applied = [];
  for (const op of ops) {
    if (!state.processed.has(op.id)) {
      const p = op.payload;
      if (op.entity === 'voter_mobile') state.mobile[p.voter_id] = { mobile_number: p.mobile_number, household_id: p.household_id };
      if (op.entity === 'household' && op.op === 'upsert') state.households[p.id] = { ...p, updated_at: new Date().toISOString() };
      if (op.entity === 'household' && op.op === 'delete') delete state.households[p.id];
      if (op.entity === 'turnout') {
        if (op.op === 'mark') state.turnout[p.voter_id] = { voted_at: p.voted_at, party: p.party || null };
        else delete state.turnout[p.voter_id];
      }
      if (op.entity === 'survey_response' && p.voter_id) state.surveyCounts[p.voter_id] = (state.surveyCounts[p.voter_id] || 0) + 1;
      state.processed.add(op.id);
    }
    applied.push(op.id);
  }
  return { applied, failed: [] };
}

export async function demoRequest(path, method, body) {
  await wait(400);
  if (path === '/api/mobile/auth/login') {
    if (body.phone === OPERATOR.phone && body.password === 'demo123') {
      return { access_token: 'demo-token', token_type: 'bearer', operator: OPERATOR, booth: BOOTH };
    }
    throw new ApiError('Wrong phone number or password.', 401);
  }
  await ensureHydrated();
  if (path.startsWith('/api/mobile/sync/pull')) return pull();
  if (path === '/api/mobile/sync/push') {
    const res = push(body.ops);
    await persist();
    return res;
  }
  if (path === '/api/mobile/voters/otp/send') {
    if (!/^\d{10}$/.test(body.mobile_number || '')) throw new ApiError('Enter a valid 10-digit mobile number.', 400);
    const code = String(100000 + Math.floor(Math.random() * 900000));
    state.otps[body.voter_id] = { code, mobile_number: body.mobile_number, expiresAt: Date.now() + 5 * 60 * 1000 };
    // demo_otp only appears in demo mode, standing in for the SMS a real gateway would send.
    // Also logged because Alert.alert is a no-op on web (react-native-web), so that's the
    // only place a web tester could otherwise see it.
    console.log(`[Neta360 demo] OTP for voter ${body.voter_id} (${body.mobile_number}): ${code}`);
    return { sent: true, expires_in: 300, demo_otp: code };
  }
  if (path === '/api/mobile/voters/otp/verify') {
    const rec = state.otps[body.voter_id];
    if (!rec || rec.mobile_number !== body.mobile_number) throw new ApiError('Request a new OTP first.', 400);
    if (Date.now() > rec.expiresAt) throw new ApiError('OTP expired. Request a new one.', 400);
    if (rec.code !== String(body.otp || '')) throw new ApiError('Incorrect OTP.', 400);
    delete state.otps[body.voter_id];
    return { verified: true };
  }
  throw new Error(`Demo backend has no route for ${method} ${path}`);
}
