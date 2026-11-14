# Production Engine – Runtime Timing (PR #34)

## FEATURED: server-authoritative expiry
- Absolute `expiresAtMs` is stored in SQLite in the single Production State row.
- A single `ProductionRuntime` timer observes the closest FEATURED deadline and is rescheduled after every committed UPDATE, including session changes and changed FEATURED entries.
- After the deadline, `ProductionStore.reconcile()` persists the removal and increments the revision. Only **after successful commit** does the processor publish a FEATURED UPDATE to all subscribed operator clients. No fake COMMAND, command ID or history replay is created.
- Restart behavior remains established: the store normalizes already expired items during startup; the runtime only starts the timer for still-active deadlines.
- Long future delays are capped to the supported `setTimeout` range; the timer is cancelled when the Fastify application closes.
- On persistence failures, the timer reports failure and retries; it does not falsely publish a successful mutation.

## EVENT: durable FIFO and pause flag
- `event.pause` and `event.resume` are authenticated, validated operator commands with empty payloads. Their state is stored and synchronized via EVENT UPDATEs.
- A trusted internal `enqueueEvent(eventId)` entry point appends normalized event IDs to the queue in FIFO order, skips duplicates and never exposes event ingestion as a public operator command. It has a protective limit of 1000 pending references.
- **No automatic dequeue or playback** is implemented yet. No existing EVENT reference is played on startup or reconnect.
- `event.paused` is the explicit operator pause flag. It must not be mistaken for OBS reachability: no overlay heartbeat or availability indicator exists. A future renderer/engine must add a separately designed operational availability state before automatic playback.
- This PR does not claim EVENT is fully functional: active-item playback, duration, queue completion, observer acknowledgement and archive handling remain to be implemented.

## Boundaries
The authenticated React production view understands EVENT UPDATE revisions and offers manual pause/resume controls; the public GitHub Pages mock layout remains unchanged. No production server or domain migration. Full YouTube reference validation, retention, live Collector, OBS Browser Source, and verified renderer visibility are still missing.
