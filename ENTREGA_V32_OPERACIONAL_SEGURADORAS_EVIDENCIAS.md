# JM-ATT V32 — Operacional, Seguradoras e Evidências

Entrega consolidada em cima da base V28.6, preservando login, motorista, financeiro, frota, RAFA, GPS celular RTDB, portal público, relatório, rota inteligente/pedágio e Cloudinary.

## Principais pontos entregues

### 1. Núcleo operacional preservado
- Chamados oficiais criados pelo Assistente IA continuam como `calls` reais quando o usuário escolhe criar chamado oficial.
- Rascunhos continuam podendo ir para `integrationInbox` quando o usuário escolher fila/triagem.
- Chamados sem coordenada podem permanecer como pendentes de validação de rota, sem “sumir”.

### 2. Cache/versionamento unificado
Versão única aplicada:

`jm-v32-1-senior-hotfix-motorista-evidencias`

Arquivos HTML, scripts e `service-worker.js` foram versionados para evitar mistura de JS antigo no celular/PWA.

### 3. Evidências 10/10 com múltiplos áudios
- Adicionado campo de múltiplos áudios no painel do motorista.
- Áudios são enviados ao Cloudinary como recurso `auto`, sem compressão de imagem.
- Cada áudio é salvo no chamado em `proofAudios[]`.
- Áudios não sobrescrevem anteriores.
- `callProofs` também registra os áudios enviados na auditoria de provas.
- Gestor vê áudios no dossiê/provas do chamado.
- Portal público e relatório mostram áudios somente quando provas públicas estiverem liberadas.

### 4. Regras Firestore ajustadas
- `firestore.rules` agora permite que motorista atualize `proofAudios` dentro do conjunto controlado de campos permitidos em `driverCallUpdate()`.

### 5. Portal público e relatório
- `cliente-chamado.html` renderiza áudio com player quando a prova pública for áudio.
- `relatorio.html` lista áudios anexados como evidências digitais.
- Rodapé/assinatura discreta do sistema preservada.

## O que foi preservado
- Login JM/motorista/superadmin.
- Financeiro e fluxo de despesas.
- Frota e manutenção.
- Rota inteligente, OSRM, RAFA, trackerProviders e GPS celular RTDB.
- Portal público do cliente.
- Relatório/PDF.
- Cloudinary.
- Firestore e RTDB separados.

## Regras Firebase

### Firestore
Arquivo alterado:

`firestore.rules`

Publique em:

Firebase Console → Firestore Database → Rules

### Realtime Database
Arquivo não alterado nesta entrega:

`database.rules.json`

Se for republicar, publique somente em:

Firebase Console → Realtime Database → Rules

## Testes de sintaxe executados

- `node --check js/app.js`
- `node --check js/motorista.js`
- `node --check js/mapa.js`
- `node --check js/utils.js`
- `node --check js/google-maps.js`
- `node --check js/firebase.js`
- `node --check js/tracker.js`
- `node --check js/superadmin.js`
- `node --check js/toll-plazas.js`
- `node --check service-worker.js`
- `python3 -m json.tool database.rules.json`
- `python3 -m json.tool manifest.json`

Todos passaram sem erro de sintaxe.

## Teste funcional recomendado após subir

1. Limpar cache/PWA ou abrir com query `?v=jm-v32-1-senior-hotfix-motorista-evidencias`.
2. Criar chamado oficial pelo Assistente IA.
3. Conferir que o chamado aparece em Chamados e Central.
4. Vincular motorista ao chamado.
5. No painel motorista, selecionar chamado.
6. Enviar uma foto e dois áudios.
7. Conferir que o gestor vê fotos e áudios no dossiê.
8. Liberar provas ao cliente.
9. Abrir `cliente-chamado.html?t=TOKEN` e conferir players de áudio.
10. Abrir `relatorio.html?t=TOKEN` e conferir áudio listado como evidência digital.
11. Testar rota/preço/pedágio existente.
12. Confirmar financeiro/despesa sem duplicidade.

## Observação honesta
Esta entrega foi validada localmente por estrutura e sintaxe. Testes autenticados reais ainda dependem do seu Firebase, Cloudinary, regras publicadas e cache do navegador.
