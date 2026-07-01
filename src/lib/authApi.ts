export type AuthRole = 'viewer' | 'editor' | 'admin';

export interface AuthUser {
  uid: string;
  username: string;
  role: AuthRole;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && typeof (payload as { message?: unknown }).message === 'string') {
    return (payload as { message: string }).message;
  }

  return fallback;
}

export function parseAuthResponse(payload: unknown): AuthUser {
  const value = payload as {
    success?: unknown;
    data?: Partial<AuthUser>;
    message?: unknown;
  };

  if (!value.success) {
    throw new Error(typeof value.message === 'string' ? value.message : '登录失败。');
  }

  if (
    !value.data
    || typeof value.data.uid !== 'string'
    || typeof value.data.username !== 'string'
    || !['viewer', 'editor', 'admin'].includes(String(value.data.role))
  ) {
    throw new Error('登录响应格式不正确。');
  }

  return value.data as AuthUser;
}

export async function signInToDuoCloud(username: string, password: string): Promise<AuthUser> {
  const response = await fetch('/api/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  return parseAuthResponse(await response.json());
}

export async function getDuoCloudSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  const payload = await response.json();

  if (!payload.success || !payload.data) {
    return null;
  }

  return parseAuthResponse(payload);
}

export async function signOutOfDuoCloud(): Promise<void> {
  const response = await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });

  const payload = await response.json();

  if (!payload?.success) {
    throw new Error(getErrorMessage(payload, '退出登录失败。'));
  }
}
