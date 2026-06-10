# JM Guinchos v28.6 — Assistente IA cria chamado oficial sem sumir

## Correção principal

A versão anterior ainda deixava o botão "Salvar revisado" do Assistente IA salvando apenas em `integrationInbox`.
Isso criava a impressão de que o chamado tinha sido salvo, mas ele não nascia em `calls`.

Nesta versão foi criado o fluxo correto:

1. `Aplicar no formulário`
   - continua preenchendo o formulário para revisão manual.

2. `Salvar na fila`
   - salva o rascunho em `integrationInbox`.
   - mensagem deixa claro que ainda não é chamado oficial.

3. `Criar chamado oficial`
   - cria documento real em `calls`.
   - aparece na lista de chamados.
   - não some após snapshot/renderAll.
   - se origem/destino vierem só como texto, cria o chamado como `Aguardando validação de rota`.

## Campos novos/ajustados

Chamado oficial criado pela IA sem coordenadas recebe:

- `statusKey: "aguardando_validacao_rota"`
- `status: "Aguardando validação de rota"`
- `routeValidationStatus: "pendente"`
- `originLabel`
- `destLabel`
- `origem: { label, coords: null, source: "ai_text_pending_geocode" }`
- `destino: { label, coords: null, source: "ai_text_pending_geocode" }`
- `aiGenerated: true`
- `aiReviewed: true`
- `sourceType: "ai_insurance_parser"`

## Preservado

Não foram alterados os fluxos de:
- login;
- motorista;
- financeiro;
- frota;
- rota inteligente;
- pedágio;
- RAFA;
- GPS celular RTDB;
- portal público;
- relatório;
- provas/checklist;
- Cloudinary;
- regras Firestore;
- regras RTDB.

## Cache

Versão atualizada para:

`jm-v28-6-ai-chamado-oficial`

Abra com cache limpo ou use Ctrl+F5.
