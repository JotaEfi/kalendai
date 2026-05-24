#!/bin/sh

# Falhar o script se qualquer comando falhar
set -e

echo "=== [KalendAI Boot] ==="
echo "1. Aguardando banco de dados e aplicando migrações Prisma..."
npx prisma migrate deploy

echo "2. Executando o seeder idempotente para garantir o administrador padrão..."
npx tsx seed.ts

echo "3. Iniciando o servidor de aplicação KalendAI..."
exec npm start
