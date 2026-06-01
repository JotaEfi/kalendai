#!/bin/sh

set -e

echo "=== [KalendAI Boot] ==="

# ── 1. Verificar MinIO (gracioso — falha não bloqueia boot) ──────────────
echo "1. Verificando conectividade com MinIO..."
MINIO_EP="${MINIO_ENDPOINT:-http://minio:9000}"
node -e "
const endpoint = process.env.MINIO_ENDPOINT || 'http://minio:9000';
const isHttps = endpoint.startsWith('https');
const http = isHttps ? require('https') : require('http');
console.log('Sondando MinIO em:', endpoint);
const req = http.get(
  endpoint + '/minio/health/live',
  { timeout: 3000 },
  (res) => {
    if (res.statusCode === 200) {
      console.log('✅ MinIO acessível. Status:', res.statusCode);
    } else {
      console.log('⚠️ MinIO respondeu com status inesperado:', res.statusCode, '— continuando mesmo assim.');
    }
    process.exit(0);
  }
);
req.on('error', (err) => {
  console.log('⚠️ Não foi possível verificar MinIO (' + err.message + ') — continuando mesmo assim.');
  process.exit(0);
});
req.on('timeout', () => {
  console.log('⚠️ Timeout ao conectar ao MinIO — continuando mesmo assim.');
  req.destroy();
  process.exit(0);
});
" || true

# ── 2. Aguardar banco e sincronizar schema ───────────────────────────────
echo "2. Aguardando banco de dados e sincronizando esquema Prisma..."
npx prisma db push --skip-generate

# ── 3. Seeder idempotente ────────────────────────────────────────────────
echo "3. Executando o seeder idempotente para garantir o administrador padrão..."
npx tsx seed.ts

# ── 4. Iniciar servidor ──────────────────────────────────────────────────
echo "4. Iniciando o servidor de aplicação KalendAI..."
exec npm start
