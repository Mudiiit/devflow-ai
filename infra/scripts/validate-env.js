const required = [
  { key: 'DATABASE_URL' },
  { key: 'JWT_SECRET', min: 32 },
];

// Provide safe local defaults when not running in production to ease local verification.
if (process.env.NODE_ENV !== 'production') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://devflow:devflow_password@localhost:5432/devflow';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-please-change-0000000000000000';
  console.warn('Using local fallback defaults for DATABASE_URL and JWT_SECRET (non-production).');
}

const optional = [
  { key: 'SECRET_ENCRYPTION_KEY', min: 32 },
  { key: 'NEXTAUTH_SECRET', min: 32 },
];

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--strict');

let ok = true;
for (const r of required) {
  const val = process.env[r.key];
  if (!val) {
    console.error(`Missing required env: ${r.key}`);
    ok = false;
    continue;
  }
  if (r.min && val.length < r.min) {
    console.error(`Env ${r.key} must be at least ${r.min} characters`);
    ok = false;
  }
}

for (const r of optional) {
  const val = process.env[r.key];
  if (!val) {
    if (isProd) {
      console.error(`Missing required-for-production env: ${r.key}`);
      ok = false;
    } else {
      console.warn(`Optional env not set (local ok): ${r.key}`);
    }
    continue;
  }
  if (r.min && val.length < r.min) {
    console.error(`Env ${r.key} must be at least ${r.min} characters`);
    ok = false;
  }
}

if (!ok) {
  process.exitCode = 2;
} else {
  console.log('Environment validation passed.');
}
