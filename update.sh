#!/usr/bin/env bash

# ==============================================================================
# UTM-TRACK — SCRIPT DE ATUALIZAÇÃO AUTOMATIZADA NA VPS
# ==============================================================================

set -e

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # Sem cor

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}             UTM-TRACK — ATUALIZAÇÃO AUTOMATIZADA DO SISTEMA                 ${NC}"
echo -e "${CYAN}==============================================================================${NC}\n"

# 1. Detectar comando do Docker Compose
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}[ERRO] Docker Compose não encontrado.${NC}"
    exit 1
fi

# 2. Verificar se o ambiente está configurado
if [ ! -f ".env.production" ]; then
    echo -e "${RED}[ERRO] Arquivo .env.production não encontrado.${NC}"
    echo -e "Execute primeiro o ${CYAN}./install.sh${NC} para configurar o ambiente."
    exit 1
fi

# 3. Baixar atualizações do repositório Git
echo -e "${YELLOW}>> 1. Baixando novidades do repositório Git...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
echo -e "Branch atual: ${CYAN}${CURRENT_BRANCH}${NC}"
git pull origin "$CURRENT_BRANCH"

# 4. Reconstruir imagem Docker com as alterações
echo -e "\n${YELLOW}>> 2. Reconstruindo a imagem Docker com as novas alterações...${NC}"
$DOCKER_COMPOSE_CMD build

# 5. Aplicar atualizações de schema no PostgreSQL
echo -e "\n${YELLOW}>> 3. Aplicando atualizações de banco de dados (Prisma db push)...${NC}"
$DOCKER_COMPOSE_CMD run --rm utm-track npx prisma db push

# 6. Reiniciar container com a nova versão
echo -e "\n${YELLOW}>> 4. Reiniciando a aplicação (zero-downtime)...${NC}"
$DOCKER_COMPOSE_CMD up -d --remove-orphans

# 7. Limpar imagens antigas não utilizadas para liberar espaço em disco
echo -e "\n${YELLOW}>> 5. Limpando imagens Docker antigas (liberação de disco)...${NC}"
docker image prune -f

# 8. Validar status do container
echo -e "\n${YELLOW}>> 6. Status do container:${NC}"
sleep 3
docker ps -f name=utm-track-app

echo -e "\n${GREEN}==============================================================================${NC}"
echo -e "${GREEN}             UTM-TRACK ATUALIZADO COM SUCESSO!                                ${NC}"
echo -e "${GREEN}==============================================================================${NC}\n"
