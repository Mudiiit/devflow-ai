(async () => {
  const services = [
    { name: 'api', url: process.env.API_URL || 'http://localhost:4000' },
    { name: 'web', url: process.env.WEB_URL || 'http://localhost:3000' },
    { name: 'worker', url: process.env.WORKER_URL || 'http://localhost:3000' },
  ];

  const argv = process.argv.slice(2);
  const waitArgIndex = argv.indexOf('--wait');
  const waitSeconds = waitArgIndex >= 0 && argv[waitArgIndex + 1] ? Number(argv[waitArgIndex + 1]) : undefined;
  const envWait = process.env.WAIT_SECONDS ? Number(process.env.WAIT_SECONDS) : undefined;
  const timeoutSeconds = Number.isFinite(waitSeconds) ? waitSeconds : Number.isFinite(envWait) ? envWait : 0;

  const intervalMs = 2000;
  const deadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : 0;

  async function check(service) {
    const readyUrl = `${service.url.replace(/\/$/, '')}/health/ready`;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(readyUrl, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, message: `HTTP ${res.status} ${text}` };
      }
      const body = await res.json().catch(() => ({}));
      if (body.status !== 'ok') {
        return { ok: false, message: `status=${body.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err && err.message ? err.message : String(err) };
    }
  }

  console.log('Starting deployment verification...');

  // If no wait requested, run a single parallel check
  if (timeoutSeconds === 0) {
    const results = await Promise.all(services.map((s) => check(s)));
    const ok = results.every((r) => r.ok);
    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      const r = results[i];
      if (r.ok) console.log(`${s.name} is ready`); else console.error(`${s.name} not ready: ${r.message}`);
    }
    if (!ok) {
      console.error('One or more services failed verification.');
      process.exitCode = 2;
      return;
    }
    console.log('All services verified ok.');
    return;
  }

  // Wait/retry loop until deadline
  const statusMap = new Map();
  while (deadline === 0 || Date.now() <= deadline) {
    const results = await Promise.all(services.map((s) => check(s)));
    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      const r = results[i];
      if (r.ok) statusMap.set(s.name, { ok: true }); else statusMap.set(s.name, { ok: false, message: r.message });
    }

    const allOk = [...statusMap.values()].every((v) => v.ok);
    if (allOk) {
      for (const s of services) console.log(`${s.name} is ready`);
      console.log('All services verified ok.');
      return;
    }

    const remaining = services.filter((s) => !(statusMap.get(s.name)?.ok));
    console.log(`Waiting for ${remaining.length} service(s) to become ready...`);
    for (const r of remaining) console.log(` - ${r.name}: ${statusMap.get(r.name).message}`);

    if (Date.now() + intervalMs > deadline) break;
    await new Promise((res) => setTimeout(res, intervalMs));
  }

  console.error('Timeout waiting for services to become ready.');
  for (const s of services) {
    const st = statusMap.get(s.name);
    if (st?.ok) console.log(`${s.name} ok`); else console.error(`${s.name} not ready: ${st?.message ?? 'unknown'}`);
  }
  process.exitCode = 2;
})();
