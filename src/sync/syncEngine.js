import { api } from '../api/client';
import * as repo from '../db/repo';

const BATCH_SIZE = 100;

// 1. Send queued phone changes to the server (oldest first).
// 2. Download the latest booth data and merge it into the phone.
export async function syncNow() {
  const tried = [];
  let sent = 0;
  for (let round = 0; round < 50; round++) {
    const batch = await repo.takeOutboxBatch(BATCH_SIZE, tried);
    if (!batch.length) break;
    batch.forEach((o) => tried.push(o.id));

    const res = await api.push(
      batch.map((o) => ({
        id: o.id,
        entity: o.entity,
        op: o.op,
        entity_id: o.entity_id,
        payload: JSON.parse(o.payload),
        created_at: o.created_at,
      }))
    );
    await repo.completeOutbox(res.applied || []);
    await repo.failOutbox(res.failed || []);
    sent += (res.applied || []).length;
  }

  const since = await repo.getMeta('notifications_since');
  const data = await api.pull(since);
  await repo.applyPull(data);
  if (data.booth) await repo.setMeta('booth_json', JSON.stringify(data.booth));
  return { sent };
}
