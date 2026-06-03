import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

async function seedCoreData(): Promise<void> {
  // Keep seeding infrastructure idempotent and conservative. Real production
  // seed sets should be explicit to avoid surprising writes to shared databases.
}

export async function seedDatabase(): Promise<void> {
  await seedCoreData();
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';

if (entryPath && resolve(fileURLToPath(import.meta.url)) === entryPath) {
  seedDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}