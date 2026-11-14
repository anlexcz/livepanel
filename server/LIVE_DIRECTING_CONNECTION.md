# PR #33 – Live Directing Connection (limited functional scope)

## Authorized transport and state
An authenticated build (`VITE_LIVEPANEL_AUTH=enabled`) now renders a separate `ProductionLive` view for the Live Directing section. It establishes a same-origin `/ws/operator` connection (WSS under HTTPS) using the existing server-side cookie session.

On connection/reconnection it waits for a full authoritative `SNAPSHOT`. Every `UPDATE` must have the next revision; stale/duplicate messages are ignored, gaps or invalid payloads force reconnect and a new SNAPSHOT. A command uses a UUID and `expectedRevision`, no optimistic state updates. The UI sends a command only while connected to a known server snapshot; confirmation failures and timeouts are visibly reported. A lost acknowledgement triggers resync rather than automatically repeating an ambiguous command.

## Supported actions
Only commands supported by backend PR #29 are exposed: `session.start`, `session.stop`, `chat.setMode`, `featured.hide` and `editorial.hide`. CHAT's enabled/paused/disabled mode is an actual persisted server flag; it is **not yet a live YouTube chat collector**. FEATURED/EDITORIAL only allow hiding an existing reference; the UI cannot invent YouTube message IDs. EVENT and TICKER are still read-only.

The authenticated directing view intentionally does **not** reuse the existing interactive mock chat/directing controls. The other demo pages and static scenes remain prototypes. The GitHub Pages build continues rendering exactly the local demo UI because auth is opt-in.

## Security and release boundary
No changes to VPS, panel.metrobus.cz, HTTP login endpoint, or operator WebSocket server authentication. The authenticated build must be served from the same HTTPS origin as the Node backend; GitHub Pages is not an authenticated admin host. This is a narrow engineering integration, not a ready-to-broadcast system. Real YouTube Collector, live messages, OBS overlays, runtime EVENT/TICKER engine, and external security audit remain future work.
