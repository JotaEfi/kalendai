# --- Estágio 1: Builder ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências
# Usando npm install em vez de npm ci: em monorepo workspace, o package-lock.json
# fica na raiz e não é copiado para o contexto Docker do subprojeto.
RUN npm install --audit=false

# Copiar código e compilar a aplicação
COPY . .
RUN npm run build

# --- Estágio 2: Nginx de Produção ---
FROM nginx:1.27-alpine

# Copiar assets estáticos compilados para a pasta padrão do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do Nginx contendo o proxy de API
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
