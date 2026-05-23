import { createHash, createHmac, createPrivateKey, createSign, randomBytes, timingSafeEqual } from 'node:crypto';

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

export function createRandomToken(length = 32): string {
  return randomBytes(length).toString('base64url');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number, issuer: string, audience: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: now, exp: now + expiresInSeconds, iss: issuer, aud: audience };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedBody = toBase64Url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  return `${data}.${toBase64Url(signature)}`;
}

export function verifyJwt<TPayload extends object>(token: string, secret: string, issuer: string, audience: string): TPayload | null {
  const [encodedHeader, encodedBody, encodedSignature] = token.split('.');

  if (!encodedHeader || !encodedBody || !encodedSignature) {
    return null;
  }

  const data = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = createHmac('sha256', secret).update(data).digest();
  const actualSignature = fromBase64Url(encodedSignature);

  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(encodedBody).toString('utf8')) as { exp?: number; iss?: string; aud?: string } & TPayload;

  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (payload.iss !== issuer || payload.aud !== audience) {
    return null;
  }

  return payload;
}

export function signGitHubAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 30, exp: now + 9 * 60, iss: appId };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = createPrivateKey({ key: privateKey, format: 'pem' });
  const signature = createSign('RSA-SHA256').update(data).sign(key);
  return `${data}.${toBase64Url(signature)}`;
}

export function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n').trim();
}

export function encodeBasicAuth(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}