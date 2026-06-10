"use strict";
const assert = require("assert");
const parser = require("../js/insurance-parser.js");

const SAMPLE = `Item de Cobertura

Finalizado
Situação

R$ 807,00
Valor Total

80.06 km
Percurso Total

32.55 km
Distância da Base

Miller Vinicius da Silva
Técnico

Ordem de Serviço
A26052668515/1
Cliente
ALFA SEGUROS
Solicitante
Thiago
Beneficiário
GELO PEROLA RIO PRETO LTDA
Telefone do Beneficiário
(17) 99101-2151
Veículo
1016 /31 ACCELO 4X2 2P. DIES.
Placa
FJW9092
Ano
/
Cor do Veículo
-
Causa
-
Observação
-
Questionário
O serviço deverá ser agendado ou acionado imediatamente?
Emergencial
Qual a condição do veículo?
Estava em movimento e apresentou problemas
Veículo carregado?
Não
O que aconteceu?
Começou a fazer barulho, desligou e não liga mais
Endereço
Origem
SP-320, ..., Tanabi
próximo quitanda sucos e salgados três irmãos Parada Certa, 685,, Estr. Mun. Euclídes da Cunha, 451, Tanabi - SP, 15170-000
Ponto de referência: Euclides da cunha sp 320 km 468 Parada Certa, 685,, Estr. Mun. Euclídes da Cunha, 451, Tanabi - SP, 15170-000
Observação: próximo quitanda sucos e salgados três irmãos
Destino
Rua Thessalônico Barbosa, 400, Distrito Industrial, São José do Rio Preto
próximo quitanda sucos e salgados três irmãos Parada Certa, 685,, Estr. Mun. Euclídes da Cunha, 451, Tanabi - SP, 15170-000
Ponto de referência: próximo ao recinto disposição
Tarifas
Tarifa\tDe quem cobrar\tValor Unitário\tQuantidade\tValor Total
KM COBERTURA\tMaxpar\tR$ 5,50\t34\tR$ 187,00
SAIDA\tMaxpar\tR$ 500,00\t1\tR$ 500,00
HORA TRABALHADA\tMaxpar\tR$ 120,00\t1\tR$ 120,00
Total: Maxpar\tR$ 807,00
Total\tR$ 807,00`;

const data = parser.parse(SAMPLE);
assert.strictEqual(data.externalStatus, "Finalizado");
assert.strictEqual(data.technician, "Miller Vinicius da Silva");
assert.strictEqual(data.protocol, "A26052668515/1");
assert.strictEqual(data.explicitClient, "ALFA SEGUROS");
assert.strictEqual(data.beneficiary, "GELO PEROLA RIO PRETO LTDA");
assert.strictEqual(data.plate, "FJW9092");
assert.strictEqual(data.totalValue, 807);
assert.strictEqual(data.totalRouteKm, 80.06);
assert.strictEqual(data.baseDistanceKm, 32.55);
assert.strictEqual(data.tariffs.length, 3);
assert.strictEqual(data.tariffTotal, 807);
assert.match(data.origin.searchAddress, /Tanabi/i);
assert.match(data.destination.searchAddress, /São José do Rio Preto/i);
assert.doesNotMatch(data.destination.searchAddress, /Tanabi/i);
assert.ok(data.destination.discardedLines.some((line) => /Tanabi/i.test(line)));

const parana = parser.parseAddressSection([
  "Rua XV de Novembro, 100, Centro, Curitiba, Paraná, 80000-000"
], null);
assert.strictEqual(parana.state, "PR");
assert.strictEqual(parana.city, "Curitiba");
console.log("PASS insurance-parser.test.js");
