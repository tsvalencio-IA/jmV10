(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JM = root.JM || {};
  root.JM.insuranceParser = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "jm-v32-3-final-consolidada";
  const STATE_NAMES = {
    acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
    "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
    "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
    paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
    "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
    "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO"
  };
  const VALID_UFS = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ]);

  function key(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function lines(text) {
    return String(text || "")
      .replace(/\t+/g, " ")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n/)
      .map(function (line) { return line.replace(/\s+/g, " ").trim(); })
      .filter(Boolean);
  }

  function cleanSegment(value) {
    return String(value || "")
      .replace(/\.{3,}/g, " ")
      .replace(/,+/g, ",")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ", ")
      .replace(/\s+/g, " ")
      .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
      .trim();
  }

  function exactIndex(inputLines, label, startAt) {
    const expected = key(label);
    for (let i = Number(startAt || 0); i < inputLines.length; i += 1) {
      if (key(inputLines[i]) === expected) return i;
    }
    return -1;
  }

  function section(inputLines, startLabel, stopLabels) {
    const start = exactIndex(inputLines, startLabel, 0);
    if (start < 0) return [];
    let end = inputLines.length;
    (stopLabels || []).forEach(function (stop) {
      const index = exactIndex(inputLines, stop, start + 1);
      if (index >= 0 && index < end) end = index;
    });
    return inputLines.slice(start + 1, end);
  }

  function nearestValue(inputLines, label, options) {
    const index = exactIndex(inputLines, label, 0);
    if (index < 0) return "";
    const opts = options || {};
    const validator = typeof opts.validator === "function" ? opts.validator : function () { return true; };
    const order = opts.preferBefore ? [-1, 1, -2, 2, -3, 3] : [1, -1, 2, -2, 3, -3];
    for (const offset of order) {
      const candidate = inputLines[index + offset];
      if (!candidate) continue;
      if (/^(origem|destino|tarifas|question[aá]rio|endere[cç]o)$/i.test(candidate)) continue;
      if (validator(candidate)) return candidate;
    }
    return "";
  }

  function extractState(text) {
    const raw = String(text || "");
    const ufMatches = raw.toUpperCase().match(/(?:^|[\s,\-/])([A-Z]{2})(?=$|[\s,\-/])/g) || [];
    for (const token of ufMatches) {
      const uf = token.replace(/[^A-Z]/g, "");
      if (VALID_UFS.has(uf)) return uf;
    }
    const normalized = key(raw);
    for (const name of Object.keys(STATE_NAMES).sort(function (a, b) { return b.length - a.length; })) {
      const pattern = new RegExp("(?:^|\\s)" + name.replace(/\s+/g, "\\s+") + "(?:$|\\s)");
      if (pattern.test(normalized)) return STATE_NAMES[name];
    }
    return "";
  }

  function extractPostalCode(text) {
    const match = String(text || "").match(/\b\d{5}-?\d{3}\b/);
    return match ? match[0] : "";
  }

  function findStreetStart(text) {
    const raw = String(text || "");
    const match = raw.match(/\b(?:Rua|R\.?|Avenida|Av\.?|Alameda|Travessa|Rodovia|Rod\.?|Estrada|Estr\.?|SP-\d{2,3}|BR-\d{2,3}|PR-\d{2,3}|SC-\d{2,3}|MG-\d{2,3}|RJ-\d{2,3})\b/i);
    return match ? match.index : -1;
  }

  function cleanAddressLine(value) {
    let text = cleanSegment(value);
    const streetStart = findStreetStart(text);
    if (/^(pr[oó]ximo|perto|ao lado)/i.test(text) && streetStart > 0) text = text.slice(streetStart);
    return cleanSegment(text);
  }

  function cityFromAddress(text, state) {
    const raw = cleanAddressLine(text);
    const dash = raw.match(/(?:^|,|\s)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,}?)\s*[-/]\s*([A-Z]{2})\b/i);
    if (dash && VALID_UFS.has(String(dash[2]).toUpperCase())) return cleanSegment(dash[1]);

    const parts = raw.split(",").map(cleanSegment).filter(Boolean);
    const postal = extractPostalCode(raw);
    const stateKey = String(state || "").toUpperCase();
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const part = parts[i];
      if (!part || part === postal) continue;
      if (/^\d{5}-?\d{3}$/.test(part)) continue;
      if (VALID_UFS.has(part.toUpperCase())) continue;
      if (STATE_NAMES[key(part)]) continue;
      if (/^(brasil|brazil)$/i.test(part)) continue;
      if (/^(distrito|bairro|centro|zona|jardim|jd\.?|vila|parque|loteamento|industrial)$/i.test(part)) continue;
      if (/\b(?:rua|avenida|av\.?|rodovia|estrada|travessa|alameda|km)\b/i.test(part)) continue;
      if (/^\d+$/.test(part)) continue;
      if (stateKey && key(part) === key(stateKey)) continue;
      return part;
    }
    return "";
  }

  function sameMeaning(a, b) {
    const left = key(a);
    const right = key(b);
    return !!left && !!right && (left === right || left.includes(right) || right.includes(left));
  }

  function wordSet(value) {
    return new Set(key(value).split(" ").filter(function (word) { return word.length > 2; }));
  }

  function overlapRatio(a, b) {
    const left = wordSet(a);
    const right = wordSet(b);
    if (!left.size || !right.size) return 0;
    let common = 0;
    left.forEach(function (word) { if (right.has(word)) common += 1; });
    return common / Math.min(left.size, right.size);
  }

  function uniqueText(values) {
    const out = [];
    (values || []).forEach(function (value) {
      const cleaned = cleanSegment(value);
      if (!cleaned) return;
      if (out.some(function (existing) { return sameMeaning(existing, cleaned); })) return;
      out.push(cleaned);
    });
    return out;
  }

  function lineScore(line, index) {
    const text = cleanAddressLine(line);
    let score = Math.max(0, 3 - Number(index || 0) * 0.25);
    if (/\b(?:rua|r\.?|avenida|av\.?|alameda|travessa|rodovia|rod\.?|estrada|estr\.?|sp-\d+|br-\d+|pr-\d+|sc-\d+)\b/i.test(text)) score += 8;
    if (/\b\d{1,6}\b/.test(text)) score += 3;
    if (extractPostalCode(text)) score += 4;
    if (extractState(text)) score += 3;
    if (/\bkm\s*\d+/i.test(text)) score += 2;
    if (/^(ponto de refer[eê]ncia|observa[cç][aã]o|pr[oó]ximo)/i.test(text)) score -= 3;
    if (text.length > 24) score += 1;
    return score;
  }

  function isOtherSectionContamination(candidate, otherDetails, currentAnchor) {
    if (!otherDetails) return false;
    const cleaned = cleanAddressLine(candidate);
    if (!cleaned) return false;

    if (sameMeaning(cleaned, otherDetails.address) || sameMeaning(cleaned, otherDetails.searchAddress)) return true;
    if ((otherDetails.rawLines || []).some(function (line) { return sameMeaning(cleaned, cleanAddressLine(line)); })) return true;
    if (overlapRatio(cleaned, otherDetails.address) >= 0.72) return true;

    const otherCity = key(otherDetails.city || "");
    const anchorCity = key(currentAnchor && currentAnchor.city || "");
    const candidateCity = key(cityFromAddress(cleaned, extractState(cleaned)) || "");
    const candidateKey = key(cleaned);
    if (otherCity && candidateKey.includes(otherCity) && (!anchorCity || anchorCity !== otherCity)) return true;
    if (otherCity && candidateCity === otherCity && anchorCity && anchorCity !== otherCity) return true;

    const otherPostal = otherDetails.postalCode || "";
    const candidatePostal = extractPostalCode(cleaned);
    if (otherPostal && candidatePostal && otherPostal === candidatePostal && overlapRatio(cleaned, otherDetails.address) > 0.45) return true;
    return false;
  }

  function parseAddressSection(sectionLines, otherDetails) {
    const references = [];
    const observations = [];
    const rawCandidates = [];
    const discarded = [];

    (sectionLines || []).forEach(function (rawLine) {
      const line = cleanSegment(rawLine);
      if (!line) return;
      if (/^ponto de refer[eê]ncia\s*:/i.test(line)) {
        references.push(cleanSegment(line.replace(/^ponto de refer[eê]ncia\s*:/i, "")));
        return;
      }
      if (/^observa[cç][aã]o\s*:/i.test(line)) {
        observations.push(cleanSegment(line.replace(/^observa[cç][aã]o\s*:/i, "")));
        return;
      }
      if (/^(tarifa|de quem cobrar|valor unit[aá]rio|quantidade|valor total)$/i.test(line)) return;
      rawCandidates.push({ raw: line, cleaned: cleanAddressLine(line), index: rawCandidates.length });
    });

    const anchorRaw = rawCandidates[0] && rawCandidates[0].cleaned || "";
    const anchorState = extractState(anchorRaw);
    const currentAnchor = {
      city: cityFromAddress(anchorRaw, anchorState),
      state: anchorState
    };

    const candidates = rawCandidates.filter(function (candidate) {
      const contaminated = isOtherSectionContamination(candidate.cleaned, otherDetails, currentAnchor);
      if (contaminated) discarded.push(candidate.raw);
      return !contaminated;
    });

    const ranked = candidates.slice().sort(function (a, b) {
      return lineScore(b.cleaned, b.index) - lineScore(a.cleaned, a.index);
    });
    const selected = ranked[0] || candidates[0] || null;
    const primary = selected ? selected.cleaned : "";
    let state = extractState(primary);
    let city = cityFromAddress(primary, state);

    candidates.forEach(function (candidate) {
      if (!candidate.cleaned || sameMeaning(candidate.cleaned, primary)) return;
      const candidateState = extractState(candidate.cleaned);
      const candidateCity = cityFromAddress(candidate.cleaned, candidateState);
      if (!state && candidateState) state = candidateState;
      if (!city && candidateCity) city = candidateCity;
      if (/\b(?:sp-\d+|br-\d+|pr-\d+|sc-\d+|mg-\d+|rj-\d+|km\s*\d+)\b/i.test(candidate.cleaned)) {
        references.push(candidate.cleaned);
      }
    });

    const postalCode = extractPostalCode(primary) || candidates.map(function (candidate) {
      return extractPostalCode(candidate.cleaned);
    }).find(Boolean) || "";

    const parts = [primary];
    const primaryKey = key(primary);
    if (city && !primaryKey.includes(key(city))) parts.push(city);
    if (state && !new RegExp("(?:^|\\W)" + state + "(?:$|\\W)", "i").test(primary)) parts.push(state);
    if (postalCode && !primary.includes(postalCode)) parts.push(postalCode);
    if (primary && !/\bbrasil\b/i.test(primary)) parts.push("Brasil");

    const searchAddress = uniqueText(parts).join(", ");
    return {
      address: searchAddress,
      searchAddress,
      reference: uniqueText(references).join(" | "),
      observation: uniqueText(observations).join(" | "),
      city: city || "",
      state: state || "",
      postalCode: postalCode || "",
      country: "BR",
      rawLines: sectionLines || [],
      discardedLines: discarded
    };
  }

  function parseAddressSections(rawText) {
    const inputLines = lines(rawText);
    const originLines = section(inputLines, "Origem", ["Destino", "Tarifas"]);
    const destinationLines = section(inputLines, "Destino", ["Tarifas"]);
    const origin = parseAddressSection(originLines, null);
    const destination = parseAddressSection(destinationLines, origin);
    return { origin, destination };
  }

  function parseMoney(value) {
    const raw = String(value || "").replace(/R\$/gi, "").replace(/\s/g, "").trim();
    if (!raw) return 0;
    if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
    return Number(raw) || 0;
  }

  function moneyMatches(value) {
    return Array.from(String(value || "").matchAll(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\$\s*\d+(?:,\d{2})/gi)).map(function (match) {
      return match[0];
    });
  }

  function parseNumber(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (/^\d{1,3}(?:\.\d{3})*,\d+$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
    return Number(raw.replace(",", ".")) || 0;
  }

  function parseTariffs(inputLines) {
    const tariffLines = section(inputLines, "Tarifas", []);
    const rows = [];
    let declaredTotal = 0;

    tariffLines.forEach(function (line) {
      const normalized = cleanSegment(line);
      if (!normalized) return;
      if (/^(tarifa|de quem cobrar|valor unit[aá]rio|quantidade|valor total)$/i.test(normalized)) return;
      const amounts = moneyMatches(normalized);
      if (/^total\b/i.test(normalized)) {
        const last = amounts[amounts.length - 1];
        if (last) declaredTotal = Math.max(declaredTotal, parseMoney(last));
        return;
      }
      if (amounts.length < 2) return;

      const firstMoney = amounts[0];
      const lastMoney = amounts[amounts.length - 1];
      const firstIndex = normalized.indexOf(firstMoney);
      const lastIndex = normalized.lastIndexOf(lastMoney);
      const prefix = cleanSegment(normalized.slice(0, firstIndex));
      const between = normalized.slice(firstIndex + firstMoney.length, lastIndex);
      const quantityMatch = between.match(/\b(\d+(?:[.,]\d+)?)\b/);
      const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : 1;
      const unitAmount = parseMoney(firstMoney);
      const amount = parseMoney(lastMoney);

      const tokens = prefix.split(/\s{2,}|\t|\s+-\s+/).map(cleanSegment).filter(Boolean);
      let description = prefix;
      let payer = "";
      const knownPayerMatch = prefix.match(/\b(Maxpar|Alfa Seguros|Porto|Allianz|Suhai|HDI|Tokio Marine|Assist[eê]ncia[^,]*)$/i);
      if (knownPayerMatch) {
        payer = knownPayerMatch[1];
        description = cleanSegment(prefix.slice(0, knownPayerMatch.index));
      } else if (tokens.length > 1) {
        payer = tokens[tokens.length - 1];
        description = tokens.slice(0, -1).join(" ");
      } else {
        const words = prefix.split(" ").filter(Boolean);
        if (words.length >= 2 && /maxpar/i.test(words[words.length - 1])) {
          payer = words.pop();
          description = words.join(" ");
        }
      }

      rows.push({
        description: description || "Tarifa",
        payer,
        quantity: quantity || 1,
        unitAmount,
        amount,
        raw: normalized
      });
    });

    const calculatedTotal = rows.reduce(function (sum, row) { return sum + Number(row.amount || 0); }, 0);
    return {
      rows,
      calculatedTotal: Math.round(calculatedTotal * 100) / 100,
      declaredTotal: Math.round(declaredTotal * 100) / 100,
      total: Math.round((declaredTotal || calculatedTotal) * 100) / 100
    };
  }

  function valueNearLabel(inputLines, label, kind) {
    const validator = kind === "money"
      ? function (value) { return /R\$|\d+[.,]\d{2}/.test(value); }
      : kind === "km"
        ? function (value) { return /\d+(?:[.,]\d+)?\s*km/i.test(value); }
        : function (value) { return !!cleanSegment(value); };
    return nearestValue(inputLines, label, { preferBefore: true, validator });
  }

  function kmFromText(value) {
    const match = String(value || "").match(/(\d+(?:[.,]\d+)?)\s*km/i);
    return match ? Number(String(match[1]).replace(",", ".")) || 0 : 0;
  }

  function parse(rawText) {
    const inputLines = lines(rawText);
    const addresses = parseAddressSections(rawText);
    const tariffs = parseTariffs(inputLines);
    const externalStatus = nearestValue(inputLines, "Situação", {
      preferBefore: true,
      validator: function (value) { return /^(finalizado|em andamento|pendente|cancelado|aberto|acionado)$/i.test(value.trim()); }
    });

    const totalValueText = valueNearLabel(inputLines, "Valor Total", "money");
    const totalRouteText = valueNearLabel(inputLines, "Percurso Total", "km");
    const baseDistanceText = valueNearLabel(inputLines, "Distância da Base", "km") || valueNearLabel(inputLines, "Distancia da Base", "km");

    return {
      parserVersion: VERSION,
      externalStatus: externalStatus || "",
      technician: nearestValue(inputLines, "Técnico", { preferBefore: true }) || nearestValue(inputLines, "Tecnico", { preferBefore: true }),
      protocol: nearestValue(inputLines, "Ordem de Serviço", { preferBefore: false }) || nearestValue(inputLines, "Ordem de Servico", { preferBefore: false }),
      explicitClient: nearestValue(inputLines, "Cliente", { preferBefore: false }),
      requester: nearestValue(inputLines, "Solicitante", { preferBefore: false }),
      beneficiary: nearestValue(inputLines, "Beneficiário", { preferBefore: false }) || nearestValue(inputLines, "Beneficiario", { preferBefore: false }),
      beneficiaryPhone: nearestValue(inputLines, "Telefone do Beneficiário", { preferBefore: false }) || nearestValue(inputLines, "Telefone do Beneficiario", { preferBefore: false }),
      vehicle: nearestValue(inputLines, "Veículo", { preferBefore: false }) || nearestValue(inputLines, "Veiculo", { preferBefore: false }),
      plate: nearestValue(inputLines, "Placa", { preferBefore: false }),
      year: nearestValue(inputLines, "Ano", { preferBefore: false }),
      color: nearestValue(inputLines, "Cor do Veículo", { preferBefore: false }) || nearestValue(inputLines, "Cor do Veiculo", { preferBefore: false }),
      cause: nearestValue(inputLines, "Causa", { preferBefore: false }),
      totalValue: parseMoney(totalValueText) || tariffs.total,
      totalRouteKm: kmFromText(totalRouteText),
      baseDistanceKm: kmFromText(baseDistanceText),
      tariffs: tariffs.rows,
      tariffTotal: tariffs.total,
      tariffCalculatedTotal: tariffs.calculatedTotal,
      tariffDeclaredTotal: tariffs.declaredTotal,
      origin: addresses.origin,
      destination: addresses.destination
    };
  }

  return {
    version: VERSION,
    parse,
    parseAddressSections,
    parseAddressSection,
    parseTariffs,
    normalizeKey: key,
    extractState,
    cityFromAddress,
    parseMoney
  };
}));
