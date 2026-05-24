# --- Estágio 1: Builder ---
FROM node:20-alpine AS builder

# Instalar bibliotecas nativas necessárias para o Prisma em Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar todas as dependências (incluindo devDependencies para build)
RUN npm ci --audit=false

# Copiar pasta Prisma e gerar o Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copiar código fonte e rodar build (tsc)
COPY . .
RUN npm run build

# --- Estágio 2: Runner de Produção ---
FROM node:20-alpine

# Instalar bibliotecas nativas necessárias para o Prisma em Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

# Copiar dependências do package.json
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --omit=dev --audit=false

# Instalar tsx globalmente de forma leve para executar o seeder TypeScript de produção
RUN npm install -g tsx

# Copiar pastas necessárias do builder e código local
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
COPY seed.ts ./
COPY entrypoint.sh ./

# Garantir permissão de execução no script de entrypoint
RUN chmod +x entrypoint.sh

EXPOSE 3001

# Definir o entrypoint automatizado
ENTRYPOINT ["./entrypoint.sh"]
