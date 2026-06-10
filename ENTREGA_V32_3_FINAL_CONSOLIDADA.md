# JM Guinchos V32.3 Final Consolidada

Base oficial: `jmV10-main(1).zip` (V32.1).

## Correções desta entrega

- Assistente IA separa blocos exatos de Origem, Destino e Tarifas.
- Remove repetição/contaminação da origem dentro do destino.
- Caso real validado: Tanabi/SP → São José do Rio Preto.
- Extrai OS A26052668515/1, técnico, cliente, beneficiário, veículo e placa.
- Preserva o valor oficial de R$ 807,00 como preço manual/importado.
- Extrai 3 tarifas e confirma total de R$ 807,00.
- Mantém `externalStatus = Finalizado` separado do status interno do chamado.
- Chamado oficial nasce aguardando validação de rota e permanece em `calls`.
- Google/Nominatim restringidos e validados para o Brasil.
- Reconhecimento dos 26 estados e Distrito Federal por sigla ou nome.
- Busca progressiva por rua/número/cidade/UF/país.
- Endereços ambíguos apresentam opções para escolha.
- Coordenadas fora do Brasil e 0,0 são rejeitadas.
- Mantidos OSRM, Leaflet/OpenStreetMap, Tracker RAFA, GPS RTDB, financeiro, frota, motorista, Cloudinary, provas, portal e relatório.
- Cache unificado em `jm-v32-3-final-consolidada`.

## Regras

- `firestore.rules`: preservadas da base V32.1.
- `database.rules.json`: preservadas da base V32.1.

## Testes locais executados

- `node --check` nos JavaScripts.
- Parse dos JSONs.
- Teste do parser com o texto real.
- Teste de geocodificação simulada rejeitando Europa e aceitando somente Brasil.
- Teste de Paraná por nome e PR por sigla.
- Teste de cache/versionamento.
- Verificação dos arquivos do Service Worker.

Teste autenticado real com Firebase/Cloudinary/Tracker depende do ambiente publicado e das credenciais/configurações restauradas no Firestore.
