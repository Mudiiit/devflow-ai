type Service = { name: string; url: string };

const services: Service[] = [
  { name: 'api', url: process.env.API_URL ?? 'http://localhost:4000' },
  { name: 'web', url: process.env.WEB_URL ?? 'http://localhost:3000' },
  { name: 'worker', url: process.env.WORKER_URL ?? 'http://localhost:3000' },
];

async function check(service: Service) {
  const readyUrl = `${service.url.replace(/\/$/, '')}/health/ready`;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(readyUrl, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) {
      console.error(`${service.name} not ready: HTTP ${res.status}`);
      const text = await res.text().catch(() => '');
      console.error(text);
      return false;
    }
    const body = await res.json().catch(() => ({}));
    if (body.status !== 'ok') {
      console.error(`${service.name} readiness reported status=${body.status}`);
      return false;
    }
    console.log(`${service.name} is ready`);
    return true;
  } catch (err: any) {
    console.error(`${service.name} check failed:`, err?.message ?? err);
    return false;
  }
}

(async () => {
  console.log('Starting deployment verification...');
  const results = await Promise.all(services.map((s) => check(s)));
  const ok = results.every(Boolean);
  if (!ok) {
    console.error('One or more services failed verification.');
    process.exit(2);
  }
  console.log('All services verified ok.');
  process.exit(0);
})();
