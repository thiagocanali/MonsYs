Quero que você atue como um Staff/Principal Software Engineer, Software Architect e Product Engineer.

Quero construir um produto SaaS chamado provisoriamente de "OpsPilot".

O objetivo é criar uma plataforma moderna de IT Operations / Observability / RMM focada em transformar eventos técnicos em ações operacionais.

IMPORTANTE:
Não quero apenas um dashboard bonito.
Quero construir uma aplicação funcional, com arquitetura profissional, segurança, escalabilidade e código realmente executável.

==================================================
1. VISÃO DO PRODUTO
==================================================

O OpsPilot será uma plataforma onde empresas poderão cadastrar dispositivos/servidores e instalar um pequeno agente nesses dispositivos.

O agente coleta telemetria operacional de forma leve e envia os dados para a plataforma.

A plataforma transforma esses dados em:

- eventos
- alertas
- incidentes
- procedimentos
- runbooks
- automações
- escalonamentos
- evidências
- histórico
- métricas operacionais

O conceito principal é:

DEVICE
   ↓
TELEMETRY
   ↓
EVENT
   ↓
RULE ENGINE
   ↓
INCIDENT
   ↓
RUNBOOK
   ↓
ACTION
   ↓
RESOLUTION
   ↓
AUDIT / EVIDENCE

Quero que o projeto demonstre capacidade real de engenharia de software e resolução de problemas de operações de TI.

==================================================
2. PRINCÍPIO FUNDAMENTAL
==================================================

O diferencial do produto não deve ser simplesmente "monitorar computadores".

O diferencial é:

"Transformar um alerta em uma ação executável."

Exemplo:

CPU > 90% durante 10 minutos

↓

Sistema cria evento

↓

Rule Engine identifica a regra

↓

Runbook RB-CPU-001 é associado

↓

Operador vê:

- problema
- dispositivo
- usuário
- severidade
- histórico
- causa provável
- procedimento
- equipe responsável
- próximos passos

↓

Operador pode executar diagnóstico

↓

Sistema executa ação através do Agent

↓

Agent retorna resultado

↓

Incidente é atualizado

↓

Toda a operação fica registrada em uma timeline.

==================================================
3. STACK
==================================================

Use preferencialmente:

Frontend:
- React
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- TanStack Query
- React Router
- Recharts

Backend:
- NestJS
- TypeScript
- REST API
- WebSocket

Banco:
- PostgreSQL

Cache / filas:
- Redis

Agent:
- Go

Infra:
- Docker
- Docker Compose

Documentação:
- OpenAPI / Swagger

Testes:
- Vitest/Jest
- Supertest
- Playwright quando fizer sentido

IMPORTANTE:

Não crie microsserviços desnecessariamente.

Comece com um backend modular bem estruturado.

A arquitetura deve permitir separar componentes posteriormente.

==================================================
4. ARQUITETURA
==================================================

Estruture o projeto aproximadamente assim:

ops-pilot/
│
├── apps/
│   ├── dashboard/
│   └── api/
│
├── agent/
│
├── packages/
│   ├── types/
│   └── config/
│
├── infrastructure/
│   ├── docker/
│   └── postgres/
│
├── docs/
│
├── docker-compose.yml
├── README.md
└── .env.example

Backend:

src/
├── auth/
├── users/
├── organizations/
├── devices/
├── telemetry/
├── events/
├── rules/
├── incidents/
├── runbooks/
├── actions/
├── notifications/
├── audit/
├── websocket/
└── health/

Não crie todos os módulos vazios de uma vez.

Implemente incrementalmente.

==================================================
5. MULTI-TENANCY
==================================================

O sistema deve nascer preparado para múltiplas organizações.

Entidades principais:

Organization
User
Role
Permission
Team
Device
DeviceGroup
Event
Rule
Incident
Runbook
RunbookStep
Action
ActionExecution
Notification
AuditLog

Todos os dados operacionais devem possuir isolamento por organization_id quando aplicável.

Não permitir que uma organização consiga acessar dados de outra.

==================================================
6. AUTENTICAÇÃO
==================================================

Implementar:

- login
- logout
- sessão/JWT
- refresh token quando necessário
- password hashing
- RBAC
- roles

Roles iniciais:

ADMIN
OPERATOR
VIEWER

Permissões devem ser granulares o suficiente para evoluir posteriormente.

==================================================
7. DEVICE AGENT
==================================================

Criar um agente escrito em Go.

O Agent deve ser pequeno e eficiente.

Primeiro alvo:

Windows.

O Agent deverá coletar:

- hostname
- OS
- CPU
- memória
- disco
- espaço livre
- uptime
- processos principais
- serviços
- conectividade
- versão do agente

Inicialmente não implementar recursos invasivos.

NÃO coletar:

- senhas
- teclas digitadas
- conteúdo de arquivos
- histórico de navegação
- mensagens pessoais
- captura de tela escondida

O projeto deve seguir o princípio:

"Monitorar a saúde operacional do dispositivo, não a vida do usuário."

==================================================
8. AGENT HEARTBEAT
==================================================

Cada Agent deve possuir um device_id único.

Periodicamente ele envia heartbeat.

Exemplo:

POST /api/v1/agent/heartbeat

Payload:

{
  "deviceId": "...",
  "hostname": "...",
  "agentVersion": "...",
  "timestamp": "...",
  "metrics": {
    "cpu": 32.4,
    "memory": 61.2,
    "disk": 72.1
  }
}

O backend deve registrar o último heartbeat.

Dashboard deve mostrar:

ONLINE
OFFLINE
DEGRADED

Não usar apenas um booleano.

Considerar last_seen_at.

==================================================
9. EVENT ENGINE
==================================================

Criar um Rule Engine.

Exemplo de regra:

{
  "name": "High CPU",
  "metric": "cpu_usage",
  "operator": ">",
  "threshold": 90,
  "duration": 600,
  "severity": "WARNING",
  "runbookId": "..."
}

Quando a condição for satisfeita:

criar EVENT.

O Rule Engine deve suportar inicialmente:

>
<
>=
<=
==
duration

Depois poderá evoluir para:

AND
OR
NOT
event correlation
anomaly detection

Não implementar tudo agora.

==================================================
10. SEVERIDADE
==================================================

Utilizar:

INFO
WARNING
CRITICAL

Cada evento deve possuir:

id
organization_id
device_id
rule_id
severity
status
title
message
created_at
updated_at
resolved_at

==================================================
11. INCIDENT
==================================================

Nem todo evento precisa virar incidente.

Criar conceito separado:

Event
Incident

Um ou vários eventos podem estar relacionados ao mesmo incidente futuramente.

Status:

OPEN
ACKNOWLEDGED
IN_PROGRESS
RESOLVED
CLOSED

==================================================
12. RUNBOOK ENGINE
==================================================

Essa é uma das partes mais importantes do produto.

Um Runbook representa um procedimento operacional.

Exemplo:

RB-CPU-001

Título:
CPU elevada em estação Windows

Steps:

1. Verificar CPU
2. Identificar processo
3. Verificar histórico
4. Executar diagnóstico
5. Decidir se deve escalar

Cada step pode possuir:

- ordem
- descrição
- tipo
- comando
- timeout
- condição
- ação
- aprovação necessária

Tipos:

MANUAL
COMMAND
HTTP
CONDITION
NOTIFICATION

Não permitir execução arbitrária sem autenticação/autorização.

==================================================
13. ACTION ENGINE
==================================================

Criar sistema para executar ações através do Agent.

Exemplo:

Dashboard
   ↓
POST /incidents/:id/actions
   ↓
Backend
   ↓
Authorization
   ↓
Command Queue
   ↓
Agent
   ↓
Execution
   ↓
Result
   ↓
Incident Timeline

Exemplo de ação:

GET_TOP_PROCESSES

Depois:

RESTART_SERVICE

Depois:

RUN_COMMAND

ATENÇÃO:

Ações perigosas devem exigir confirmação explícita.

Nunca executar comandos arbitrários automaticamente apenas porque chegaram de uma regra.

==================================================
14. AUDITORIA
==================================================

Toda ação importante deve gerar AuditLog.

Exemplo:

USER:
Thiago

ACTION:
RESTART_SERVICE

DEVICE:
PC-001

SERVICE:
Spooler

TIMESTAMP:
...

RESULT:
SUCCESS

Isso deve ser imutável para o usuário comum.

==================================================
15. INCIDENT TIMELINE
==================================================

Criar uma interface muito importante.

Ao abrir um incidente:

mostrar timeline:

14:02:31
Evento detectado

14:02:32
Rule RB-CPU-001 acionada

14:02:33
Incidente criado

14:03:00
Operador iniciou diagnóstico

14:03:02
Top processes coletados

14:03:10
Processo java.exe identificado

14:04:00
Ação executada

14:04:03
CPU caiu para 41%

14:04:04
Incidente resolvido

Essa timeline deve ser um dos elementos principais da aplicação.

==================================================
16. DASHBOARD
==================================================

Criar dashboard profissional inspirado em sistemas reais de NOC.

Não copiar visualmente nenhuma aplicação existente.

Criar design original.

Dashboard deve possuir:

Cards:

- Total Devices
- Online
- Offline
- Open Incidents
- Critical Incidents
- Events Today

Gráficos:

- eventos por severidade
- eventos por hora
- incidentes por categoria
- devices online/offline

Tabela:

Recent Incidents

Colunas:

Severity
Status
Device
Title
Rule
Created
Assigned Team

==================================================
17. DEVICE PAGE
==================================================

Cada dispositivo deve possuir uma página detalhada.

Mostrar:

Device name
Hostname
OS
Agent version
Last seen
Status

CPU
RAM
Disk

Histórico de métricas.

Processos.

Serviços.

Eventos recentes.

Incidentes.

Ações disponíveis.

==================================================
18. EVENT PAGE
==================================================

Ao abrir um evento:

mostrar:

Cliente/Organization
Device
Application
Object
Procedure
Software
Severity
Message

Depois:

Runbook relacionado

Timeline

Eventos similares

Ações

Isso deve ser inspirado conceitualmente em sistemas de NOC reais, mas com UI própria.

==================================================
19. EVENTS SIMILARES
==================================================

Para cada incidente/evento:

mostrar eventos similares.

Exemplo:

CPU HIGH
PC-001
17 ocorrências

CPU HIGH
PC-002
8 ocorrências

CPU HIGH
PC-014
3 ocorrências

Futuramente isso poderá utilizar busca semântica/IA.

Inicialmente usar regras simples:

same rule
same device
same category
same message pattern

==================================================
20. NOTIFICAÇÕES
==================================================

Criar abstração:

NotificationProvider

Implementar inicialmente:

- in-app
- email

Arquitetura preparada para:

- Slack
- Microsoft Teams
- WhatsApp
- Webhook

Não implementar todas agora.

==================================================
21. API
==================================================

Criar API REST versionada:

/api/v1

Exemplos:

POST /auth/login

GET /organizations

GET /devices

GET /devices/:id

GET /events

GET /events/:id

GET /incidents

GET /incidents/:id

POST /incidents/:id/acknowledge

POST /incidents/:id/actions

GET /runbooks

POST /runbooks

GET /rules

POST /rules

POST /agent/register

POST /agent/heartbeat

POST /agent/events

==================================================
22. WEBSOCKET
==================================================

Dashboard deve receber eventos em tempo real.

Exemplo:

Agent
 ↓
Backend
 ↓
Event Engine
 ↓
WebSocket
 ↓
Dashboard

Quando um evento novo chegar:

não exigir refresh da página.

Mostrar notificação visual.

==================================================
23. BANCO
==================================================

Criar schema PostgreSQL profissional.

Utilizar UUID.

Timestamps:

created_at
updated_at

Soft delete apenas onde fizer sentido.

Criar índices para:

organization_id
device_id
severity
status
created_at
last_seen_at

Não criar índices indiscriminadamente.

==================================================
24. SEGURANÇA
==================================================

Segurança é prioridade.

Implementar:

- password hashing
- JWT seguro
- RBAC
- validation
- rate limiting
- CORS configurável
- Helmet
- secrets via environment variables
- audit logging
- input sanitization
- SQL injection protection via ORM/query builder
- tenant isolation

Não colocar secrets no código.

Criar:

.env.example

==================================================
25. OBSERVABILIDADE DO PRÓPRIO SISTEMA
==================================================

O OpsPilot também deve ser observável.

Backend deve possuir:

/health
/ready

Logs estruturados.

Request ID.

Error handling centralizado.

Métricas básicas.

O objetivo é demonstrar que a plataforma consegue monitorar a si mesma.

==================================================
26. DEMO MODE
==================================================

Criar um mecanismo para gerar dados fictícios.

Comando:

seed

Deve criar:

1 organization
5 users
50 devices
1000 events
100 incidents
20 rules
10 runbooks

Alguns dispositivos devem estar:

ONLINE
OFFLINE
DEGRADED

Gerar incidentes:

CPU_HIGH
MEMORY_HIGH
DISK_LOW
SERVICE_STOPPED
AGENT_OFFLINE
NETWORK_LATENCY

Isso permitirá demonstrar o sistema sem precisar instalar 50 máquinas.

==================================================
27. UX
==================================================

A interface deve parecer um produto SaaS profissional.

Não quero:

- telas vazias
- excesso de cards
- gradientes exagerados
- visual de template genérico
- dashboard cheio de informações inúteis

Quero:

- hierarquia visual
- boa tipografia
- tabelas densas
- filtros
- busca
- paginação
- badges de severidade
- timeline
- estados de loading
- empty states
- error states
- responsive design

Pensar como produto utilizado por operadores durante incidentes.

==================================================
28. IA
==================================================

NÃO implementar IA na primeira versão.

Porém a arquitetura deve permitir adicionar posteriormente:

- resumo de incidente
- sugestão de diagnóstico
- sugestão de runbook
- correlação de eventos
- análise de causa provável
- geração de procedimentos

A IA deverá ser uma camada auxiliar.

Nunca permitir que IA execute ações críticas diretamente sem autorização.

==================================================
29. TESTES
==================================================

Criar testes para:

- authentication
- tenant isolation
- device registration
- heartbeat
- rule engine
- event creation
- incident lifecycle
- runbook execution
- authorization
- audit logging

Criar pelo menos alguns testes E2E para o fluxo:

Agent
→ Heartbeat
→ Event
→ Rule
→ Incident
→ Action
→ Resolution

==================================================
30. DOCKER
==================================================

Criar docker-compose para desenvolvimento.

Serviços:

postgres
redis
api
dashboard

O Agent pode ser executado separadamente.

Deve ser possível iniciar o ambiente com:

docker compose up

Documentar tudo.

==================================================
31. README
==================================================

Criar README profissional contendo:

- descrição
- problema
- solução
- arquitetura
- stack
- screenshots placeholders
- instalação
- execução
- environment variables
- database
- agent
- API
- testes
- roadmap

Explicar que é um projeto de demonstração profissional.

==================================================
32. ROADMAP
==================================================

MVP:

Phase 1
- Auth
- Organization
- Devices
- Agent
- Heartbeat
- Metrics
- Events
- Rules
- Incidents
- Runbooks
- Timeline
- Dashboard

Phase 2
- Actions
- Remote commands
- Notifications
- Teams
- RBAC avançado
- Audit

Phase 3
- Event correlation
- SLA
- Reports
- Advanced automation

Phase 4
- AI
- Root cause analysis
- Semantic search
- Intelligent runbooks

==================================================
33. COMO VOCÊ DEVE TRABALHAR
==================================================

Não tente implementar tudo de uma vez.

Trabalhe em etapas pequenas e funcionais.

Primeiro:

1. Analise o projeto existente.
2. Verifique se já existem arquivos.
3. Identifique a stack atual.
4. Não destrua código existente sem necessidade.
5. Proponha a arquitetura.
6. Crie a estrutura inicial.
7. Configure infraestrutura.
8. Crie banco.
9. Crie backend.
10. Crie frontend.
11. Crie Agent.
12. Integre tudo.
13. Teste.

Sempre que implementar uma feature:

- explique brevemente o que será feito
- implemente
- rode os testes
- corrija erros
- valide o resultado

Não invente APIs ou bibliotecas sem verificar se são adequadas ao projeto.

Não use código fictício quando for possível implementar de verdade.

Não deixe TODOs críticos.

Não esconda erros.

==================================================
34. PRIMEIRO OBJETIVO
==================================================

NÃO comece implementando IA.

NÃO comece implementando dezenas de telas.

NÃO comece criando microsserviços.

O primeiro milestone deve ser:

"Um Agent Windows envia heartbeat para o backend, o backend registra o dispositivo, o dashboard mostra o dispositivo online e o sistema consegue gerar um evento de CPU alta através de uma regra."

Fluxo:

Windows Agent
    ↓
POST /agent/heartbeat
    ↓
Backend
    ↓
PostgreSQL
    ↓
Rule Engine
    ↓
Event
    ↓
WebSocket
    ↓
Dashboard

Depois disso:

Event
    ↓
Incident
    ↓
Runbook
    ↓
Action
    ↓
Agent
    ↓
Result
    ↓
Timeline

==================================================
35. CRITÉRIO DE QUALIDADE
==================================================

Quero que este projeto possa ser apresentado em uma entrevista técnica.

Portanto, pense em:

- arquitetura
- segurança
- performance
- manutenção
- observabilidade
- UX
- testes
- documentação
- escalabilidade

O código deve parecer código de um produto real.

Não faça apenas algo que "funciona".

Faça algo que eu consiga explicar tecnicamente em uma entrevista.

==================================================
AGORA
==================================================

Antes de escrever código:

1. Analise o repositório atual.
2. Liste a stack encontrada.
3. Liste o que já existe.
4. Identifique conflitos com a arquitetura proposta.
5. Proponha a estrutura final.
6. Proponha o banco inicial.
7. Proponha o primeiro milestone.
8. Só então comece a implementação.

Não implemente o projeto inteiro de uma vez.

Comece pelo primeiro milestone funcional.
