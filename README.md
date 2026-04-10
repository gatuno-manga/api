<div align="center">

![Angular][Angular.io]
![Nestjs][Nestjs.io]
![Mysql][Mysql.io]
![Sass][Sass.io]
![Docker][Docker.io]
![JavaScript][JavaScript.io]
![TypeScript][TypeScript.io]
![Redis][Redis.io]
![Selenium][Selenium.io]
![BullMQ][BullMQ.io]
![TypeORM][TypeORM.io]

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Unlicense License][license-shield]][license-url]

<a href="https://github.com/bgluis/gatuno/">
    <img src="docs/logo.svg" alt="Logo" width="140" height="140">
</a>

  <h3>Gatuno</h3>
  Uma biblioteca local
</div>

# 📖 Sobre

O Gatuno é um sistema desenvolvido para organizar e compartilhar uma coleção pessoal de e-books em uma rede local. A aplicação utiliza técnicas de web scraping para buscar metadados online — como capas, sinopses e autores.

O projeto serve como um estudo sobre raspagem de dados, automação e criação de servidores web locais.

# 📋 Motivo

Vivemos em uma era onde o acesso à informação digital é fundamental, porém volátil. Plataformas online podem desaparecer, o conteúdo pode ser removido e o que está disponível hoje pode não estar amanhã. Essa dependência de fontes externas representa uma fragilidade constante, um risco de perdermos o acesso a obras que julgamos importantes.

# 💻 Como iniciar

### Requisitos

- Habilitar a virtualização no BIOS do seu computador
- Ter o Docker instalado
- Ter o Docker Compose instalado

### Instalação do Docker

1. Acesse o site oficial: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Baixe e instale o Docker conforme seu sistema operacional (Linux, Windows ou Mac).

3. Após instalar, verifique se está tudo certo:

```bash
docker --version
docker-compose --version
```

### Configuração inicial

1. Crie um arquivo `.env` na raiz do projeto baseado no arquivo `.env.example`:

```bash
cp .env.example .env
```

2. Crie um arquivo `.env` no diretório `back/` baseado no arquivo `back/.env.example`:

```bash
cp back/.env.example back/.env
```

3. Configure as variáveis de ambiente necessárias nos arquivos `.env` criados. Exemplo de configuração mínima:

**Arquivo `.env` (raiz):**

```env
NODE_ENV=development
API_PORT=3000
APP_PORT=4200

# Database configuration
DB_NAME=gatuno
DB_PASS=sua_senha_aqui
DB_USER=gatuno_user
DB_MASTER_EXTERNAL_PORT=3306
DB_SLAVE_1_EXTERNAL_PORT=3307
DB_SLAVE_2_EXTERNAL_PORT=3308

PHPMYADMIN_PORT=8080

# Selenium Hub Ports
SELENIUM_HUB_PORT_1=4442
SELENIUM_HUB_PORT_2=4443
SELENIUM_HUB_PORT_3=4444

# Redis configuration
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_redis
REDISCOMMANDER_PORT=8081
```

**Arquivo `back/.env`:**

```env
JWT_ACCESS_SECRET=seu_secret_jwt_access
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=seu_secret_jwt_refresh
JWT_REFRESH_EXPIRATION=7d
SALT_LENGTH=16
PASSWORD_KEY_LENGTH=32

USERADMIN_EMAIL=admin@example.com
USERADMIN_PASSWORD=senha_admin

CHAPTER_SCRAPING_CONCURRENCY=6
COVER_IMAGE_CONCURRENCY=3
FIX_CHAPTER_CONCURRENCY=2
```

### Executando o ambiente de desenvolvimento

1. No diretório raiz do projeto, inicie os containers:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Ou usando o arquivo combinado (equivalente ao comando acima):

```bash
docker compose -f docker-compose.common.yml -f docker-compose.dev.yml up -d --build
```

2. Aguarde todos os serviços iniciarem. Você pode verificar o status com:

```bash
docker compose -f docker-compose.dev.yml ps
```

3. A replicação MySQL (Master-Slave) é configurada automaticamente pelos scripts de inicialização:

- `database/master/init.sh`
- `database/slave/init.sh`

Não é necessário executar script manual `init-slave.sh`.

4. Acesse os serviços:

- **Aplicação Frontend**: http://localhost:4200
- **API Backend**: http://localhost:3000

Ferramentas opcionais (executadas separadamente):

```bash
docker compose -f docker-compose.tools.yml up -d --build
```

- **PhpMyAdmin**: http://localhost:8080
- **Redis Commander**: http://localhost:8081
- **Playwright Debug (browser remoto)**: http://localhost:3001

### Executando o ambiente de produção

Para produção, ajuste as variáveis no `.env` da raiz e no `back/.env`.

1. Configure as variáveis de ambiente para produção no arquivo `.env`:

```env
NODE_ENV=production
API_HOST=api.seudominio.com
APP_HOST=seudominio.com
API_PORT=3000
APP_PORT=4000
```

2. Inicie os containers de produção:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Ou usando os arquivos combinados:

```bash
docker compose -f docker-compose.common.yml -f docker-compose.prod.yml up -d --build
```

3. Verifique saúde da replicação:

```bash
docker exec gatuno-database-slave-1 mysql -uroot -p"${DB_PASS}" -e "SHOW REPLICA STATUS\\G"
docker exec gatuno-database-slave-2 mysql -uroot -p"${DB_PASS}" -e "SHOW REPLICA STATUS\\G"
```

### Observabilidade de logs da API (PLG Stack)

O projeto possui stack de observabilidade com Prometheus + Grafana + Alertmanager e agora inclui Loki + Promtail para logs da API.

Fluxo de logs:

- Promtail coleta logs Docker do container `gatuno-api`
- Loki armazena os logs com retenção inicial de 30 dias
- Grafana consulta métricas (Prometheus) e logs (Loki)

Subir apenas monitoramento:

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

Subir ambiente de desenvolvimento + monitoramento:

```bash
docker compose -f docker-compose.common.yml -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.monitoring.yml up -d
```

Subir ambiente de produção + monitoramento:

```bash
docker compose -f docker-compose.common.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.monitoring.yml up -d
```

Validação rápida:

```bash
# Estado dos serviços de monitoramento
docker compose -f docker-compose.monitoring.yml ps

# Verificar envio de logs pelo Promtail
docker compose -f docker-compose.monitoring.yml logs -f promtail
```

Endpoints úteis:

- Grafana: http://localhost:3002
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100/ready

No Grafana, use o datasource `Loki` no Explore e consulte por labels da API, por exemplo:

```text
{job="gatuno-api"}
{service="api", container="gatuno-api"}
```

### Comandos úteis

**Parar os containers:**

```bash
docker compose -f docker-compose.dev.yml down
```

**Ver logs dos serviços:**

```bash
docker compose -f docker-compose.dev.yml logs -f [nome_do_serviço]
```

**Reiniciar um serviço específico:**

```bash
docker compose -f docker-compose.dev.yml restart [nome_do_serviço]
```

**Remover volumes (atenção: apaga os dados):**

```bash
docker compose -f docker-compose.dev.yml down -v
```

**Verificar status da replicação:**

```bash
docker exec gatuno-database-slave-1 mysql -uroot -p"${DB_PASS}" -e "SHOW REPLICA STATUS\G"
docker exec gatuno-database-slave-2 mysql -uroot -p"${DB_PASS}" -e "SHOW REPLICA STATUS\G"
```

### Estrutura dos serviços

O projeto utiliza os seguintes serviços:

- **api**: Backend NestJS (porta 3000)
- **app (dev)**: Frontend Angular (porta 4200)
- **app (prod)**: Frontend Angular (porta 4000)
- **database-master**: MySQL Master (porta 3306)
- **database-slave-1**: MySQL Slave 1 (porta 3307)
- **database-slave-2**: MySQL Slave 2 (porta 3308)
- **redis**: Cache Redis (porta 6379)

Serviços opcionais de ferramentas (`docker-compose.tools.yml`):

- **redis-commander**: Interface web para Redis (porta 8081)
- **phpmyadmin**: Interface web para MySQL (porta 8080)

Serviço opcional de debug browser (`docker-compose.dev.yml`):

- **playwright-debug**: Browser remoto para scraping/debug (porta 3001)

# 🤝 Contribuidores

 <a href = "https://github.com/bgluis/gatuno/graphs/contributors">
   <img src = "https://contrib.rocks/image?repo=bgluis/gatuno"/>
 </a>
 <!-- Links -->
 <!-- https://github.com/iuricode/readme-template-->

[repossitory-path]: bgluis/gatuno/
[contributors-shield]: https://img.shields.io/github/contributors/bgluis/gatuno.svg?style=for-the-badge
[contributors-url]: https://github.com/bgluis/gatuno/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/bgluis/gatuno.svg?style=for-the-badge
[forks-url]: https://github.com/bgluis/gatuno/network/members
[stars-shield]: https://img.shields.io/github/stars/bgluis/gatuno.svg?style=for-the-badge
[stars-url]: https://github.com/bgluis/gatuno/stargazers
[issues-shield]: https://img.shields.io/github/issues/bgluis/gatuno.svg?style=for-the-badge
[issues-url]: https://github.com/bgluis/gatuno/issues
[license-shield]: https://img.shields.io/github/license/bgluis/gatuno.svg?style=for-the-badge
[license-url]: https://github.com/bgluis/gatuno/blob/master/LICENSE.txt
[Angular.io]: https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white
[Nestjs.io]: https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white
[Mysql.io]: https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&color=00758f&logoColor=white
[Sass.io]: https://img.shields.io/badge/Sass-000?style=for-the-badge&logo=sass&color=cc6699&logoColor=white
[Docker.io]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[JavaScript.io]: https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black
[TypeScript.io]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[Redis.io]: https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white
[Selenium.io]: https://img.shields.io/badge/Selenium-43B02A?style=for-the-badge&logo=selenium&logoColor=white
[BullMQ.io]: https://img.shields.io/badge/BullMQ-339933?style=for-the-badge&logo=node.js&logoColor=white
[TypeORM.io]: https://img.shields.io/badge/TypeORM-FE0803?logo=typeorm&logoColor=fff&style=for-the-badge
