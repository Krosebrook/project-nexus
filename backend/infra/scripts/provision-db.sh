#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting Encore-only database provisioning..."

echo "⏳ Waiting for Postgres to be ready..."
node -e "require('./backend/infra/db/wait_for_pg').waitForPostgres().then(() => console.log('✓ Postgres is ready')).catch(e => { console.error(e); process.exit(1); })"

echo "📦 Running migrations..."
node -e "require('./backend/infra/db/run_migrations').runMigrations().then(r => console.log(\`✓ Applied \${r.applied.length} migrations, skipped \${r.skipped.length}\`)).catch(e => { console.error(e); process.exit(1); })"

if [ "${SEED_DB:-false}" = "true" ]; then
  echo "🌱 Seeding database..."
  node -e "require('./backend/infra/db/seed').seedDatabase().then(() => console.log('✓ Database seeded')).catch(e => { console.error(e); process.exit(1); })"
fi

echo "✅ Database provisioning complete!"
