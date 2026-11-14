# PR #35 – YouTube Collector Foundation

## Implemented
- A single **manual-start, injectable** in-process `YouTubeCollector` orchestrator with one active network source. It implements the approved method sequence: `streamList` → reconnect → `list` fallback → controlled return to streamList. Only actual connection errors trigger reconnect; a silent chat is healthy.
- The fallback uses YouTube's `pollingIntervalMillis` (minimum local wait is 1 second; no periodic HTTP busy-loop), with no simultaneous stream and list request.
- Errors are classified into permission, exhausted quota, ended/disabled chat, malformed input and transient outage. Terminal errors do not trigger API fallback or quota wasting.
- A small normalizer converts official YouTube message resources into a stable internal object with source ID, chat ID, author data, timestamps, text, and special event types (Super Chat, stickers, membership, moderation).
- Distinguishes **recovered** initial history batches from later new messages. Recovered chat is never implicitly suitable for automatic live graphic playback.
- Session-scoped, bounded in-memory ID dedup; the separate list and streaming continuation tokens are not assumed interchangeable. A checkpoint only moves after downstream processing succeeds.
- The first real official Google API adapter is **list** via authenticated HTTPS using a *caller-provided* OAuth token provider. Tokens are neither persisted nor logged. `streamList` uses an injectable adapter interface, not an unverified hand-written gRPC implementation.
- Diagnostics expose current source mode, status, reconnect count, duplicate count and last successful/message timestamps. No raw YouTube payloads appear in diagnostics.

## Deliberate exclusions / next PR
- The collector is a **library foundation** only. It is **not started by Fastify**, not attached to Production State, not feeding real CHAT/FEATURED/EVENT, not connected to an OAuth flow, and has **no live gRPC streamList adapter yet**. Therefore the full end-to-end source pipeline is **not operational**.
- YouTube broadcast/video URL validation and discovery of `liveChatId`, OAuth refresh, persistent checkpoints, durable deduplication, deletion/retention and archive storage must be designed and tested before live ingest. Bounded dedup state disappears on process restart.
- No actual YouTube API credentials or API calls were used in automated tests. No >5h live test, OBS rendering, or production security audit has occurred.
- The existing source ingestion callback must persist or safely commit data **before returning** if the caller wishes to use continuation tokens after a reconnect. No automatic overlay display is performed by the collector.
- Do not expose source raw data or OAuth secrets over public OBS endpoints. Handle moderation and deletion events separately before archiving and display.
- Official reference: https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/streamList and https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/list.

## Approved operating principle
One Node.js modular monolith, one active source, no browser-based collector integrated by default. The proposed alternative third source remains an **open idea only**, not approved as automatic fallback.
