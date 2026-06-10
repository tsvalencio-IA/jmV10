# JM Guinchos — V32.1 Senior Hotfix Motorista + Evidências

Versão: `jm-v32-1-senior-hotfix-motorista-evidencias`

## Correções reais desta entrega

1. **Erro Firestore permission-denied no painel motorista**
   - Causa encontrada: `motorista.js` tentava ouvir `settings/integrations`, mas a regra Firestore anterior não permitia motorista ler esse documento.
   - Correção: `firestore.rules` agora permite `isDriver()` ler `settings/integrations`, `settings/public` e `settings/publicIntegrations`.
   - Correção adicional: `motorista.js` agora possui callback de erro no listener de settings; se `settings/integrations` estiver bloqueado, tenta `settings/publicIntegrations` e não derruba o painel.

2. **Consultas por assignedDriverId/driverUid/driverEmail**
   - O erro visto no DevTools foi causado pelo script de diagnóstico tentando consultas que as regras não autorizam para motorista.
   - O app operacional do motorista continua usando `driverId == auth.uid`, que é o padrão mais seguro.

3. **Prancha de avarias do veículo**
   - Removido o desenho 2D pobre/sem acabamento.
   - `damageVehicleSvg()` foi substituído por prancha técnica premium em SVG, com visual profissional para automóvel, moto e caminhão/guincho.
   - Mantida a lógica de clicar nas partes, marcar avaria, descrever e salvar no checklist.

4. **Cache/versionamento**
   - Atualizado para `jm-v32-1-senior-hotfix-motorista-evidencias` para evitar carregar JS/CSS antigo.

## Arquivos alterados

- `js/motorista.js`
- `firestore.rules`
- `index.html`
- `jm.html`
- `motorista.html`
- `cliente-chamado.html`
- `relatorio.html`
- `superadmin.html`
- `service-worker.js`
- documentação/lista de entrega

## Regras Firebase

Atualizar apenas:

- Firestore Database > Rules > `firestore.rules`

Não foi necessário alterar:

- Realtime Database Rules / `database.rules.json`

## Testes técnicos locais

Executado:

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
- parse JSON em `database.rules.json`, `manifest.json`, `package.json`, `firebase.json`

## Teste real obrigatório após publicar

1. Publicar ZIP completo.
2. Publicar `firestore.rules`.
3. Abrir `motorista.html?v=jm-v32-1-senior-hotfix-motorista-evidencias`.
4. Fazer login com `moto@jm.com`.
5. Confirmar que não aparece mais `Missing or insufficient permissions` para `settings/integrations`.
6. Confirmar que chamado com `driverId = Gfz0edLP9XQQDba4mDp1TeiWBRt1` aparece.
7. Abrir checklist de provas e conferir a nova prancha de avarias.
8. Testar envio de foto/áudio/assinatura.
