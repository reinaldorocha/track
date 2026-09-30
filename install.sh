#!/usr/bin/env bash

# ==============================================================================
# UTM-TRACK — SCRIPT DE INSTALAÇÃO AUTOMATIZADA NA VPS (DOCKER + POSTGRESQL)
# ==============================================================================

set -e

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # Sem cor

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}          UTM-TRACK — INSTALAÇÃO AUTOMATIZADA EM VPS (DOCKER)                ${NC}"
echo -e "${CYAN}==============================================================================${NC}\n"

# 1. Verificar comandos obrigatórios
echo -e "${YELLOW}>> 1. Verificando pré-requisitos do sistema...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERRO] Docker não está instalado nesta VPS.${NC}"
    echo -e "Instale executando: ${CYAN}curl -fsSL https://get.docker.com | sh${NC}"
    exit 1
fi

DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERRO] Docker Compose não encontrado.${NC}"
    echo -e "Instale o plugin docker-compose antes de prosseguir."
    exit 1
fi

echo -e "${GREEN}[OK] Docker e Docker Compose detectados: $DOCKER_COMPOSE_CMD${NC}\n"

# 2. Configurar o arquivo .env.production
echo -e "${YELLOW}>> 2. Verificando variáveis de ambiente (.env.production)...${NC}"

if [ -f ".env.production" ]; then
    echo -e "${GREEN}[OK] Arquivo .env.production já existe. Utilizando configuração existente.${NC}"
else
    echo -e "${CYAN}Configurando novo arquivo .env.production:${NC}"
    
    # Pergunta sobre a URL da aplicação
    read -p "Informe o domínio da aplicação (ex: https://track.seudominio.com.br): " APP_URL
    APP_URL=${APP_URL:-"https://track.seudominio.com.br"}
    # Remover barra final se houver
    APP_URL="${APP_URL%/}"

    # Pergunta sobre dados do PostgreSQL na VPS
    echo -e "\n${CYAN}Configuração da conexão com o PostgreSQL da VPS:${NC}"
    read -p "Host do PostgreSQL [host.docker.internal]: " DB_HOST
    DB_HOST=${DB_HOST:-"host.docker.internal"}

    read -p "Porta do PostgreSQL [5432]: " DB_PORT
    DB_PORT=${DB_PORT:-"5432"}

    read -p "Nome do banco de dados [utmtrack]: " DB_NAME
    DB_NAME=${DB_NAME:-"utmtrack"}

    read -p "Usuário do banco de dados [utmuser]: " DB_USER
    DB_USER=${DB_USER:-"utmuser"}

    read -s -p "Senha do banco de dados: " DB_PASS
    echo ""

    # Geração automática de chaves criptográficas seguras
    echo -e "\nGerando chaves criptográficas automáticas..."
    
    if command -v openssl &> /dev/null; then
        GEN_NEXTAUTH_SECRET=$(openssl rand -base64 32)
        GEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
    else
        # Fallback usando /dev/urandom
        GEN_NEXTAUTH_SECRET=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 44 | head -n 1)
        GEN_ENCRYPTION_KEY=$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 64 | head -n 1)
    fi

    DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

    cat <<EOF > .env.production
# ==============================================================================
# UTM-TRACK — VARIÁVEIS DE AMBIENTE DE PRODUÇÃO (VPS)
# ==============================================================================

# URLs da Aplicação
NEXT_PUBLIC_APP_URL="${APP_URL}"
NEXTAUTH_URL="${APP_URL}"

# Chaves de Autenticação JWT e Sessão
NEXTAUTH_SECRET="${GEN_NEXTAUTH_SECRET}"
AUTH_SECRET="${GEN_NEXTAUTH_SECRET}"
AUTH_TRUST_HOST=true

# Chave Mestre de Criptografia AES-256-GCM (Tokens Meta e Webhooks)
ENCRYPTION_KEY="${GEN_ENCRYPTION_KEY}"

# Conexão PostgreSQL
DATABASE_URL="${DATABASE_URL}"

# Ambiente
NODE_ENV="production"
PORT=3000
EOF

    echo -e "${GREEN}[OK] .env.production criado com sucesso com chaves criptográficas exclusivas.${NC}\n"
fi

# 3. Compilar a imagem Docker
echo -e "${YELLOW}>> 3. Construindo a imagem Docker da aplicação (Next.js + Prisma)...${NC}"
$DOCKER_COMPOSE_CMD build

echo -e "\n${YELLOW}>> 4. Sincronizando tabelas no PostgreSQL (Prisma db push)...${NC}"
# Executa prisma db push dentro do container temporário
if ! $DOCKER_COMPOSE_CMD run --rm utm-track npx prisma db push; then
    echo -e "${RED}[AVISO] Falha ao conectar no PostgreSQL.${NC}"
    echo -e "Certifique-se de que:"
    echo -e "1. O banco de dados e usuário existem: ${CYAN}CREATE DATABASE utmtrack;${NC}"
    echo -e "2. O PostgreSQL aceita conexões da rede Docker no ${CYAN}/etc/postgresql/*/main/pg_hba.conf${NC}"
    echo -e "Deseja continuar e tentar subir o container mesmo assim? (s/N): "
    read -r CONT
    if [[ ! "$CONT" =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# 5. Iniciar container
echo -e "\n${YELLOW}>> 5. Inicializando o container em segundo plano...${NC}"
$DOCKER_COMPOSE_CMD up -d --remove-orphans

sleep 3

# 6. Verificar status
echo -e "\n${YELLOW}>> 6. Status do container:${NC}"
docker ps -f name=utm-track-app

echo -e "\n${GREEN}==============================================================================${NC}"
echo -e "${GREEN}       UTM-TRACK INSTALADO E EM EXECUÇÃO COM SUCESSO NO DOCKER!               ${NC}"
echo -e "${GREEN}==============================================================================${NC}"

# Extrair domínio do .env.production para exibir a configuração Nginx
DOMAIN=$(grep -E '^NEXT_PUBLIC_APP_URL=' .env.production | cut -d '=' -f2 | sed -e 's|https://||' -e 's|http://||' -e 's|"||g' -e 's|/.*||')
DOMAIN=${DOMAIN:-"track.seudominio.com.br"}

echo -e "\n${CYAN}>> Próximo passo: Configuração do Nginx e SSL na VPS:${NC}"
echo -e "1. Crie o arquivo de site no Nginx: ${YELLOW}sudo nano /etc/nginx/sites-available/utm-track${NC}"
echo -e "2. Cole a configuração abaixo:"
echo -e "------------------------------------------------------------------------------"
cat <<EOF
server {
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    location /tracker.js {
        proxy_pass http://127.0.0.1:3000/tracker.js;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400";
    }
}
EOF
echo -e "------------------------------------------------------------------------------"
echo -e "3. Ative o site e emita o certificado SSL gratuito:"
echo -e "   ${YELLOW}sudo ln -sf /etc/nginx/sites-available/utm-track /etc/nginx/sites-enabled/${NC}"
echo -e "   ${YELLOW}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo -e "   ${YELLOW}sudo certbot --nginx -d ${DOMAIN}${NC}\n"
