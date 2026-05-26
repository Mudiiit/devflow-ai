import { createHmac, timingSafeEqual } from 'node:crypto';

export const verifyHmacSha256Signature = (
  payload: Buffer,
  providedSignature: string,
  secret: string,
): boolean => {
  const normalized = providedSignature.startsWith('sha256=')
    ? providedSignature.slice('sha256='.length)
    : providedSignature;

  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  if (
    !/^[0-9a-f]+$/i.test(normalized) ||
    normalized.length !== expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(normalized, 'hex'),
  );
};
