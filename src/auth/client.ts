/** Same-origin session API. Never read/store session cookies or credentials in client storage. */
export type OperatorIdentity = {
  id: number;
  username: string;
  shared: boolean;
  sessionId?: string;
};
export type DeviceSession = { id: string; createdAtMs: number; expiresAtMs: number };

export class AuthRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new AuthRequestError(response.status, `HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const authClient = {
  me: (signal?: AbortSignal) =>
    request<{user: OperatorIdentity}>('/api/auth/me', { signal }),
  login: (username: string, password: string) =>
    request<{user: OperatorIdentity}>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ok: boolean}>('/api/auth/logout', { method: 'POST' }),
  sessions: () => request<{sessions: DeviceSession[]}>('/api/auth/sessions'),
  revoke: (sessionId: string) => request<{ok: boolean}>(
    '/api/auth/sessions/' + encodeURIComponent(sessionId) + '/revoke',
    { method: 'POST' },
  ),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ok:boolean;reauthenticate:boolean}>('/api/auth/password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
