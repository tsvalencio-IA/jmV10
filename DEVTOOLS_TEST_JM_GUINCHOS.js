(async function () {
  "use strict";
  console.log("🧪 JM V32.3 FINAL — painel gestor / Assistente IA / geocodificação Brasil");
  if (!window.JM || !JM.app || !JM.app.buildAiDraftsFromText) throw new Error("Abra jm.html V32.3 e faça login antes do teste.");

  const sample = `Item de Cobertura
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
KM COBERTURA Maxpar R$ 5,50 34 R$ 187,00
SAIDA Maxpar R$ 500,00 1 R$ 500,00
HORA TRABALHADA Maxpar R$ 120,00 1 R$ 120,00
Total R$ 807,00`;

  const callDraft = JM.app.buildAiDraftsFromText(sample).find((row) => row.kind === "call");
  if (!callDraft) throw new Error("Assistente IA não gerou chamado.");
  const data = callDraft.data || {};
  const checks = {
    protocolo: data.protocol === "A26052668515/1",
    origemTanabi: /Tanabi/i.test(data.origin || ""),
    destinoRioPreto: /São José do Rio Preto/i.test(data.destination || ""),
    destinoSemTanabi: !/Tanabi/i.test(data.destination || ""),
    valor807: Number(data.amount) === 807,
    tarifas807: Number(data.tariffTotal) === 807,
    statusExterno: data.externalStatus === "Finalizado",
    tecnico: data.technician === "Miller Vinicius da Silva"
  };
  console.table(checks);
  console.log("📦 Rascunho:", data);
  if (Object.values(checks).some((ok) => !ok)) throw new Error("Falha no parser. Veja a tabela acima.");

  try {
    const candidates = await JM.googleMaps.geocodeCandidates(data.destination, window.JM_MAP_SETTINGS || {});
    console.table(candidates.map((row) => ({ endereco: row.label, cidade: row.city, uf: row.state, pais: row.countryCode })));
    if (!candidates.length || candidates.some((row) => row.countryCode !== "br")) throw new Error("Geocodificação retornou candidato fora do Brasil.");
    console.log("✅ Parser e busca Brasil aprovados.");
  } catch (error) {
    console.error("❌ Busca de endereço:", error);
  }
})();
