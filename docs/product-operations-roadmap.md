# MonsYs — visão de produto e roadmap de operações

**Status:** proposta de evolução do produto, alinhada ao código e à revisão técnica de 11/11/2026.  
**Objetivo:** transformar a base atual de monitoramento multiempresa em uma plataforma de operações de TI que conecta sinais técnicos, pessoas, procedimentos, comunicação e evidências.

## 1. Posicionamento

O MonsYs deve ajudar equipes de operações a responder quatro perguntas:

1. O que aconteceu?
2. Qual cliente, serviço ou ativo foi afetado?
3. Quem deve agir e qual procedimento deve seguir?
4. O que foi feito, por quem, quando e com qual resultado?

O diferencial não é acumular dashboards. É reduzir o tempo entre detecção, entendimento, encaminhamento e resolução, mantendo contexto operacional verificável.

O produto será multiempresa (multi-tenant), com isolamento por organização e experiência própria. Sistemas utilizados em NOC, service desk, monitoramento e controle de turnos servem como referências de problemas e fluxos — não como modelos para copiar telas, marcas ou conteúdo proprietário.

## 2. Princípios de produto e engenharia

- **Operação real antes de demonstração:** não apresentar dados fictícios como se fossem dados de produção.
- **Uma fonte de verdade:** incidentes, responsáveis, procedimentos e registros devem compartilhar IDs e relações consistentes.
- **Multi-tenancy por padrão:** toda entidade operacional deve pertencer a uma organização, direta ou indiretamente, com autorização validada no servidor e restrições relacionais no banco quando possível.
- **Auditoria como parte do fluxo:** mudanças de estado, atribuições, aprovações, contatos operacionais e encerramentos devem gerar evidências.
- **Ação segura:** nenhuma execução remota ou comando arbitrário sem identidade do agente, autorização, aprovação explícita quando necessária e resultado verificável.
- **Falha explícita:** estados de carregamento, vazio, indisponibilidade e erro não podem ser confundidos.
- **Evolução incremental:** monólito modular e APIs versionadas; não criar microsserviços ou infraestrutura distribuída sem necessidade comprovada.
- **Privacidade e minimização:** coletar somente dados necessários à operação; evitar dados pessoais ou conteúdo de usuário final que não sejam necessários.

## 3. Mapa de módulos

### Fundação operacional existente

A implementação atual já possui conceitos e partes funcionais para autenticação Better Auth, organizações e memberships, agentes e credenciais, heartbeat, amostras de telemetria, eventos, incidentes, timeline, runbooks, ações, resultados e logs de auditoria.

Isso não significa que todos os fluxos estejam completos ou prontos para produção. A execução real de ações por agente, por exemplo, ainda não está implementada. O estado de cada módulo deve ser conferido no código e nos testes antes de ser apresentado como funcional.

### Módulos a desenvolver

| Módulo | Responsabilidade | Integrações principais |
|---|---|---|
| Clientes e ativos | Cadastro de organizações, ambientes, sites, serviços e dispositivos | Organizações, agentes, incidentes |
| Contatos e escalonamento | Contatos técnicos e de negócio, canais, prioridade e cadeia de acionamento | Organizações, incidentes, escalas, notificações |
| Base de conhecimento | Procedimentos versionados, instruções, pré-condições, validade e responsáveis | Runbooks, eventos, incidentes |
| Passagem de turno | Entrega estruturada de pendências e confirmação de recebimento | Incidentes, timeline, equipes, escalas |
| Equipes e escalas | Equipes, operadores, turnos, folgas, sobreaviso e responsável atual | Memberships, escalonamento, notificações |
| Comunicação operacional | Registro de tentativas de contato e integrações de canais | Contatos, incidentes, auditoria |
| Indicadores e relatórios | MTTA, MTTR, volume, recorrência, cumprimento de SLA e carga por equipe | Eventos, incidentes, auditoria |
| Automação segura | Diagnósticos e ações aprovadas, com execução e resultado rastreáveis | Agentes, runbooks, ações, aprovações |

## 4. Fluxo operacional de referência

1. Uma amostra de telemetria ou heartbeat é recebida e validada.
2. Uma regra persistida e pertencente à organização avalia a condição.
3. O sistema registra evento e, quando aplicável, incidente de forma idempotente e transacional.
4. O incidente recebe severidade, ativo, serviço, responsável e procedimento recomendado.
5. O operador reconhece, atualiza o estado e registra diagnóstico.
6. Se necessário, o sistema consulta a escala e a cadeia de contatos para escalonar.
7. Uma ação técnica só é executada quando houver agente real, autorização e aprovação exigida.
8. O resultado e as evidências são registrados na timeline e na auditoria.
9. Se não resolvido antes da troca de turno, o incidente entra na passagem de turno.
10. O próximo operador confirma o recebimento e continua a tratativa sem perder contexto.
11. O encerramento registra causa, resolução e dados necessários para indicadores e melhoria contínua.

## 5. Ordem de implementação

### Etapa 0 — estabilização e prontidão de dados (P0)

Antes de adicionar telas e fluxos novos:

- Conciliar formalmente qual banco atende à Vercel (Neon) e qual é o projeto Supabase legado.
- Revisar e integrar, após CI e revisão, as PRs abertas de autenticação e baseline de migrações (#37–#41).
- Inspecionar schema e histórico do banco efetivamente usado pelo runtime; não presumir que o estado do Neon ou Supabase é igual ao ambiente descartável.
- Confirmar permissões do papel de conexão, RLS e isolamento multiempresa.
- Validar autenticação, cookies, organizações, healthcheck e consultas no ambiente de staging.
- Não aplicar migrations de fundação sobre banco existente sem comparação e plano de rollback.

**Critério de saída:** o ambiente alvo tem origem de conexão conhecida, migrations reconciliadas, backup/rollback documentados e fluxo autenticado validado sem expor credenciais.

### Etapa 1 — confiabilidade do fluxo de incidentes (P1)

- Persistir estado do Rule Engine no PostgreSQL, compartilhado entre instâncias e resistente a reinícios.
- Processar amostra, estado de regra, evento e incidente na mesma transação.
- Persistir regras por organização com validação, versão e autorização.
- Definir relações tenant-aware entre incidentes, eventos, runbooks, ações, resultados e timeline.
- Automatizar audit logs para mutações relevantes.
- Implementar paginação e filtros server-side; não depender de uma lista fixa dos 200 incidentes mais recentes.
- Definir limites de ingestão, tolerância de timestamp e política de retenção.

**Critério de saída:** o fluxo de telemetria até incidente é idempotente, transacional, testado com PostgreSQL e isolado entre organizações.

### Etapa 2 — conhecimento operacional e passagem de turno (P2)

Ordem sugerida:

1. Base de conhecimento e procedimentos versionados.
2. Passagem de turno ligada a incidentes reais.
3. Contatos técnicos e cadeia de escalonamento.
4. Equipes, escalas e sobreaviso.
5. Registro de comunicação e notificações.

**Critério de saída:** um incidente pode ser tratado, documentado, escalonado e transferido entre operadores sem depender de anotações externas ou dados demonstrativos.

### Etapa 3 — automação e indicadores (P3)

- Implementar agente Windows real com comunicação autenticada, heartbeat e coleta mínima.
- Implementar execução de diagnósticos com allowlist, timeout, autorização e evidência.
- Adicionar aprovação explícita para ações de risco.
- Disponibilizar resultados e histórico real da execução.
- Calcular indicadores a partir de eventos auditáveis e regras de negócio documentadas.

**Critério de saída:** automações executam apenas ações permitidas e aprovadas, com resultados verificáveis; indicadores são reproduzíveis a partir dos registros.

## 6. Primeiro recorte funcional: passagem de turno

A passagem de turno deve ser um fluxo de trabalho, não um campo livre isolado.

### Entidades conceituais

- **Shift:** janela de trabalho com início, fim, equipe e operador responsável.
- **Handover:** registro de entrega entre turno de origem e turno de destino, com autor, destinatário, estado e timestamps.
- **HandoverItem:** item transferido, associado a incidente, pendência ou observação operacional.
- **HandoverAcknowledgement:** confirmação do recebimento pelo próximo responsável.
- **HandoverComment:** complemento cronológico, sempre identificado por autor e horário.

As entidades persistidas deverão ter organization_id, timestamps e chaves estrangeiras coerentes com a estratégia de tenancy. Itens que apontam para incidentes devem impedir referência cruzada entre organizações.

### Campos mínimos do item

- título e descrição objetiva;
- prioridade;
- categoria (incidente, mudança, acompanhamento ou observação);
- incidente relacionado, quando houver;
- responsável atual e próximo responsável, quando definidos;
- próxima ação esperada;
- prazo, se aplicável;
- estado (pendente, em andamento, concluído ou cancelado);
- evidências e comentários.

### Regras

- Não permitir concluir a passagem sem destinatário ou justificativa de ausência de destinatário.
- Não encerrar automaticamente incidentes por terem sido transferidos.
- A confirmação de recebimento não equivale à resolução.
- Alterações e comentários devem compor uma timeline auditável.
- Itens críticos e incidentes ainda abertos devem permanecer visíveis até resolução ou encerramento justificado.
- O acesso deve respeitar organização e papel; VIEWER não pode criar, editar, transferir ou confirmar.
- Datas devem ser armazenadas em UTC e apresentadas no fuso configurado para a organização.

### Critérios de aceite

- ADMIN e OPERATOR autorizados conseguem criar e editar uma passagem.
- Um operador consegue incluir incidente existente da mesma organização.
- O sistema rejeita incidente inexistente ou pertencente a outro tenant.
- O destinatário consegue confirmar recebimento.
- O estado do incidente não é alterado implicitamente pela transferência.
- Toda criação, edição, transferência e confirmação gera evidência auditável.
- Listagem possui filtros por turno, estado, prioridade e responsável, com paginação.
- Testes de integração validam isolamento multi-tenant e permissões com PostgreSQL real.
- UI possui estados de carregamento, vazio, erro, sucesso e responsividade.

## 7. Diretrizes de UX

- Interface original, com identidade visual consistente e foco em leitura rápida.
- Navegação por áreas de trabalho: Visão geral, Incidentes, Ativos, Conhecimento, Passagem de turno, Equipes e Relatórios.
- Tabelas operacionais com busca, filtros persistentes, ordenação e paginação.
- Severidade, estado e prioridade com semântica visual consistente e texto acessível.
- Timeline cronológica compartilhada entre eventos, incidentes, procedimentos, ações e passagem de turno.
- Detalhes contextuais sem duplicar dados de cliente, dispositivo ou responsável.
- Não adicionar cards ou gráficos sem pergunta operacional clara que respondam.
- Não apresentar botões sem ação implementada; recursos futuros devem ser identificados como indisponíveis ou planejados.

## 8. Segurança e limites

- Better Auth permanece responsável pela identidade humana.
- Agentes usam credenciais próprias, separadas das sessões humanas.
- Toda rota humana valida sessão, membership, papel e organização no servidor.
- IDs fornecidos pelo cliente são seletores, nunca prova de autorização.
- Dados de um tenant não podem aparecer em listas, detalhes, buscas, relações aninhadas, logs ou notificações de outro tenant.
- Segredos nunca são enviados ao frontend, logs, commits ou mensagens.
- Comandos arbitrários, reinício de serviços e ações disruptivas exigem allowlist, autorização e aprovação explícita.
- O produto não deve coletar senhas, teclas, conteúdo de arquivos, histórico de navegação ou capturas ocultas de tela.
- Dados de contato devem ser limitados ao contexto operacional e ter política de acesso e retenção.

## 9. Estratégia de qualidade

Cada módulo deve chegar acompanhado de:

- testes unitários de regras de domínio;
- testes de API para autenticação, autorização, validação e erros;
- testes PostgreSQL para migrations, constraints e isolamento entre tenants;
- testes de UI para fluxos críticos;
- documentação de endpoints e variáveis de ambiente;
- critérios de aceite verificáveis;
- evidência de CI antes de integração.

Não considerar um módulo concluído apenas porque a tela renderiza. Ele precisa persistir dados reais, aplicar permissões, tratar falhas e ter testes.

## 10. Próximas entregas recomendadas

1. Encerrar a revisão e CI das PRs #37–#41 sem fazer merge automático de alterações que ainda não passaram por revisão.
2. Confirmar a conexão de banco usada pela aplicação e reconciliar o baseline do Neon.
3. Resolver a confiabilidade transacional do Rule Engine.
4. Projetar e testar as relações tenant-aware necessárias aos novos módulos.
5. Implementar a primeira fatia vertical de Passagem de Turno (migration + domínio + API + UI + auditoria + testes) somente depois de a Etapa 0 estar concluída.

---

**Regra de produto:** MonsYs só deve anunciar como disponível aquilo que está implementado, persistido, autorizado e testado. O roadmap descreve a direção; não é uma declaração de funcionalidades já entregues.
