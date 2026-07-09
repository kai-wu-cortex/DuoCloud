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

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

  const payload = await readJsonPayload(response);
  if (!payload) {
    throw new Error('登录服务未返回有效 JSON，请确认本地 API 或 Vercel dev 服务已启动。');
  }

  return parseAuthResponse(payload);
}

export async function getDuoCloudSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  const payload = await readJsonPayload(response);

  if (!payload) {
    return null;
  }

  const value = payload as { success?: unknown; data?: unknown };

  if (!value.success || !value.data) {
    return null;
  }

  return parseAuthResponse(payload);
}

export async function signOutOfDuoCloud(): Promise<void> {
  let response: Response;

  try {
    response = await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('退出登录失败，请检查网络连接后重试。');
  }

  const payload = await readJsonPayload(response);

  if (response.ok === false) {
    throw new Error(getErrorMessage(payload, '退出登录失败，请稍后重试。'));
  }

  if (!payload || typeof payload !== 'object' || !(payload as { success?: unknown }).success) {
    throw new Error(getErrorMessage(payload, '退出登录失败，请稍后重试。'));
  }
}
