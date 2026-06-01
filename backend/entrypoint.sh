#!/bin/sh

# Falhar o script se qualquer comando falhar
set -e

echo "=== [KalendAI Boot] ==="

echo "1. Verificando infraestrutura MinIO no ambiente..."
node -e "
const http = require('http');
const endpoint = process.env.MINIO_ENDPOINT || 'http://minio:9000';
console.log('Sondando conexão com MinIO em:', endpoint);
const req = http.get(endpoint + '/minio/health/live', (res) => {
  if (res.statusCode === 200) {
    console.log('✅ MinIO existente detectado no ambiente. Sincronizando com a instância em funcionamento...');
    process.exit(0);
  } else {
    console.log('⚠️ Resposta do MinIO recebida, mas status inesperado:', res.statusCode);
    process.exit(0);
  }
});
req.on('error', (err) => {
  console.log('ℹ️ Nenhum MinIO ativo respondendo em ' + endpoint + '. Iniciando/criando o MinIO do zero.');
  process.exit(0);
});
req.setTimeout(2500, () => {
  console.log('ℹ️ Timeout ao conectar ao MinIO. Iniciando/criando o MinIO do zero.');
  req.destroy();
  process.exit(0);
});
" || true

echo "2. Aguardando banco de dados e sincronizando esquema Prisma..."
npx prisma db push --skip-generate

echo "3. Executando o seeder idempotente para garantir o administrador padrão..."
npx tsx seed.ts

echo "4. Iniciando o servidor de aplicação KalendAI..."
exec npm start
