(function () {
  "use strict";

  const { coords, pointFrom, haversineKm, roundPoint, normalizeUrl } = window.JM.utils;
  const DEFAULT_SPEED_KMH = 48;
  const DEFAULT_OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
  const routeCache = new Map();
  let googleMapsPromise = null;

  function toLatLng(value) {
    const p = pointFrom(value);
    if (!p) return null;
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) return null;
    return { lat, lng };
  }

  function vehiclePoint(vehicle) {
    return toLatLng(vehicle && (
      vehicle.location ||
      vehicle.lastLocation ||
      vehicle.lastKnownLocation ||
      vehicle.trackerLocation ||
      vehicle.trackerLastLocation ||
      vehicle.trackerPosition ||
      vehicle.lastPosition ||
      vehicle.mobileLocation ||
      vehicle.driverPhoneLocation ||
      vehicle.phoneLocation
    ));
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function decodeSafe(value) {
    try { return decodeURIComponent(String(value || "")); } catch (_) { return String(value || ""); }
  }

  function uniquePoints(points) {
    const seen = new Set();
    return (points || []).filter((p) => {
      const point = toLatLng(p);
      if (!point) return false;
      const key = point.lat.toFixed(6) + "," + point.lng.toFixed(6);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(toLatLng);
  }

  function extractCoordinatePairs(text) {
    const raw = decodeSafe(text).replace(/%2C/gi, ",").replace(/\u2212/g, "-");
    const points = [];
    const patterns = [
      /@(-?\d{1,2}(?:[.,]\d+)?),\s*(-?\d{1,3}(?:[.,]\d+)?)/ig,
      /(?:q|query|ll|center|destination|daddr|saddr|origin)=(-?\d{1,2}(?:[.,]\d+)?),\s*(-?\d{1,3}(?:[.,]\d+)?)/ig,
      /(?:lat|latitude)=(-?\d{1,2}(?:[.,]\d+)?).*?(?:lng|lon|longitude)=(-?\d{1,3}(?:[.,]\d+)?)/ig,
      /!3d(-?\d{1,2}(?:[.,]\d+)?)!4d(-?\d{1,3}(?:[.,]\d+)?)/ig,
      /\/dir\/(-?\d{1,2}(?:[.,]\d+)?),\s*(-?\d{1,3}(?:[.,]\d+)?)(?:\/|$|\?)/ig,
      /\/(-?\d{1,2}(?:[.,]\d+)?),\s*(-?\d{1,3}(?:[.,]\d+)?)(?:\/|$|\?)/ig,
      /(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/ig
    ];
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(raw)) !== null) {
        const point = coords(match[1], match[2]);
        if (point) points.push(point);
      }
    });
    return uniquePoints(points);
  }

  function extractCoordinatePair(text) {
    return extractCoordinatePairs(text)[0] || null;
  }

  function providerFromUrl(url) {
    const raw = String(url || "").toLowerCase();
    if (raw.includes("waze.com")) return "waze";
    if (raw.includes("google") || raw.includes("goo.gl") || raw.includes("maps.app.goo.gl")) return "google_maps";
    if (raw.includes("openstreetmap")) return "openstreetmap";
    return raw ? "external" : "manual";
  }

  function parseLocationInput(value, fallbackLabel) {
    const input = cleanText(value);
    if (!input) return null;
    const point = extractCoordinatePair(input);
    const isUrl = /^https?:\/\//i.test(input) || /maps\.app\.goo\.gl|google\.[^/]+\/maps|waze\.com|openstreetmap\.org/i.test(input);
    return {
      label: point ? (fallbackLabel || input) : input,
      coords: point,
      source: point ? (isUrl ? "shared_map_link" : "manual_coordinates") : (isUrl ? "shared_link_without_visible_coords" : "manual_text_without_coords"),
      provider: isUrl ? providerFromUrl(input) : "manual",
      raw: input,
      externalUrl: isUrl ? normalizeUrl(input) : "",
      resolvedAt: new Date().toISOString()
    };
  }

  function parseRouteInput(value) {
    const input = cleanText(value);
    const externalUrl = normalizeUrl(input);
    const points = extractCoordinatePairs(input);
    return {
      raw: input,
      externalUrl,
      provider: providerFromUrl(input),
      points,
      source: points.length >= 2 ? "shared_route_with_visible_coords" : points.length === 1 ? "shared_point_with_visible_coords" : externalUrl ? "shared_route_without_visible_coords" : "manual_text_without_coords",
      resolvedAt: new Date().toISOString()
    };
  }

  function isConfigured() {
    return true;
  }

  function googleApiKey(settings) {
    return String(settings && (settings.apiKey || settings.mapsKey || settings.googleMapsKey) || "").trim();
  }

  function isGoogleConfigured(settings) {
    return !!googleApiKey(settings);
  }

  function searchSuffix(settings) {
    return cleanText(settings && (settings.searchSuffix || settings.defaultSearchSuffix || settings.city || settings.defaultCity));
  }

  const BRAZIL_UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
  const BRAZIL_STATE_NAMES = {
    acre:"AC", alagoas:"AL", amapa:"AP", amazonas:"AM", bahia:"BA", ceara:"CE",
    "distrito federal":"DF", "espirito santo":"ES", goias:"GO", maranhao:"MA",
    "mato grosso":"MT", "mato grosso do sul":"MS", "minas gerais":"MG", para:"PA",
    paraiba:"PB", parana:"PR", pernambuco:"PE", piaui:"PI", "rio de janeiro":"RJ",
    "rio grande do norte":"RN", "rio grande do sul":"RS", rondonia:"RO", roraima:"RR",
    "santa catarina":"SC", "sao paulo":"SP", sergipe:"SE", tocantins:"TO"
  };

  function geoKey(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function expectedState(text) {
    const raw = String(text || "");
    const matches = raw.toUpperCase().match(/(?:^|[\s,\-/])([A-Z]{2})(?=$|[\s,\-/])/g) || [];
    for (const token of matches) {
      const uf = token.replace(/[^A-Z]/g, "");
      if (BRAZIL_UFS.has(uf)) return uf;
    }
    const normalized = geoKey(raw);
    for (const name of Object.keys(BRAZIL_STATE_NAMES).sort(function (a, b) { return b.length - a.length; })) {
      const pattern = new RegExp("(?:^|\\s)" + name.replace(/\s+/g, "\\s+") + "(?:$|\\s)");
      if (pattern.test(normalized)) return BRAZIL_STATE_NAMES[name];
    }
    return "";
  }

  function normalizeUf(value) {
    const raw = String(value || "").toUpperCase().trim();
    const match = raw.match(/(?:^|[-_/])([A-Z]{2})$/);
    const uf = match ? match[1] : raw;
    return BRAZIL_UFS.has(uf) ? uf : expectedState(raw);
  }

  function expectedCity(text, state) {
    const raw = cleanText(text);
    const dash = raw.match(/(?:^|,|\s)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{2,}?)\s*[-/]\s*([A-Z]{2})\b/i);
    if (dash && BRAZIL_UFS.has(String(dash[2]).toUpperCase())) return cleanText(dash[1]);
    const parts = raw.split(",").map(cleanText).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const part = parts[i];
      if (/^(brasil|brazil)$/i.test(part)) continue;
      if (/^\d{5}-?\d{3}$/.test(part)) continue;
      if (BRAZIL_UFS.has(part.toUpperCase())) continue;
      if (BRAZIL_STATE_NAMES[geoKey(part)]) continue;
      if (/\b(?:rua|avenida|av\.?|rodovia|estrada|travessa|alameda|km)\b/i.test(part)) continue;
      if (/^(distrito|bairro|centro|zona|jardim|jd\.?|vila|parque|loteamento|industrial)$/i.test(part)) continue;
      if (/^\d+$/.test(part)) continue;
      if (state && part.toUpperCase() === state) continue;
      return part;
    }
    return "";
  }

  function expectedGeoContext(text) {
    const state = expectedState(text);
    return { state, city: expectedCity(text, state), raw: cleanText(text) };
  }

  function isBrazilPoint(point) {
    const p = toLatLng(point);
    return !!p && p.lat >= -34.5 && p.lat <= 6.0 && p.lng >= -74.5 && p.lng <= -32.0;
  }

  function looksLikeFullAddress(text) {
    const raw = geoKey(text);
    const hasUf = Array.from(BRAZIL_UFS).some((uf) => new RegExp("(?:^|\\s)" + uf.toLowerCase() + "(?:$|\\s)").test(raw));
    const hasStateName = Object.keys(BRAZIL_STATE_NAMES).some((name) => raw.includes(name));
    return hasUf || hasStateName || /\b(brasil|brazil)\b/.test(raw) || /\b\d{5}[- ]?\d{3}\b/.test(raw);
  }

  function uniqueQueries(values) {
    const seen = new Set();
    return values.map(cleanText).filter(Boolean).filter((value) => {
      const normalized = geoKey(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function searchQueries(text, settings) {
    const raw = cleanText(text);
    if (!raw) return [];
    const suffix = searchSuffix(settings);
    const context = expectedGeoContext(raw);
    const withBrazil = /\bbrasil\b/i.test(raw) ? raw : raw + ", Brasil";
    const parts = raw.split(",").map(cleanText).filter(Boolean);
    const street = parts[0] || raw;
    const numberPart = parts.find((part) => /\b\d{1,6}\b/.test(part)) || "";
    const cityState = [context.city, context.state, "Brasil"].filter(Boolean).join(", ");
    const progressive = [
      withBrazil,
      [street, numberPart !== street ? numberPart : "", cityState].filter(Boolean).join(", "),
      [street, cityState].filter(Boolean).join(", "),
      cityState
    ];
    if (suffix && !looksLikeFullAddress(raw)) progressive.unshift(raw + ", " + suffix + ", Brasil");
    return uniqueQueries(progressive);
  }

  function biasBox(settings) {
    const center = toLatLng(settings && settings.center);
    const radius = Number(settings && settings.radiusMeters || 90000);
    if (!center || !Number.isFinite(radius) || radius <= 0) return null;
    const latDelta = radius / 111320;
    const lngDelta = radius / (111320 * Math.max(0.25, Math.cos(center.lat * Math.PI / 180)));
    return {
      west: center.lng - lngDelta,
      south: center.lat - latDelta,
      east: center.lng + lngDelta,
      north: center.lat + latDelta,
      center
    };
  }

  function googlePlaceUrl(value) {
    const point = toLatLng(value);
    if (point) return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(point.lat + "," + point.lng);
    const text = cleanText(value);
    return text ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(text) : "";
  }

  function loadGoogleMaps(settings) {
    const key = googleApiKey(settings);
    if (!key) return Promise.resolve(false);
    if (window.google && window.google.maps) return Promise.resolve(true);
    if (googleMapsPromise) return googleMapsPromise;
    googleMapsPromise = new Promise((resolve, reject) => {
      const callbackName = "__jmGoogleMapsReady";
      window[callbackName] = () => resolve(true);
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error("Não consegui carregar o Google Maps. Verifique a chave salva no superadmin."));
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&libraries=places,geometry,marker&v=weekly&loading=async&callback=" + callbackName;
      document.head.appendChild(script);
    }).catch((err) => {
      googleMapsPromise = null;
      throw err;
    });
    return googleMapsPromise;
  }

  function googleComponent(result, type, shortName) {
    const components = result && result.address_components || [];
    const component = components.find((item) => Array.isArray(item.types) && item.types.includes(type));
    return component ? String(shortName ? component.short_name : component.long_name || "") : "";
  }

  function candidateMatchesExpected(found, expected) {
    if (!found) return false;
    if (String(found.country || "").toUpperCase() !== "BR") return false;
    if (!isBrazilPoint(found.coords)) return false;
    if (expected.state && String(found.state || "").toUpperCase() !== expected.state) return false;
    if (expected.city) {
      const expectedKey = geoKey(expected.city);
      const cityKey = geoKey(found.city || "");
      const labelKey = geoKey(found.label || "");
      if (cityKey !== expectedKey && !cityKey.includes(expectedKey) && !expectedKey.includes(cityKey) && !labelKey.includes(expectedKey)) return false;
    }
    return true;
  }

  function candidateScore(found, expected, settings) {
    let score = Number(found.importance || 0);
    if (found.country === "BR") score += 20;
    if (isBrazilPoint(found.coords)) score += 10;
    if (expected.state && found.state === expected.state) score += 12;
    if (expected.city) {
      const expectedKey = geoKey(expected.city);
      const cityKey = geoKey(found.city || "");
      const labelKey = geoKey(found.label || "");
      if (cityKey === expectedKey) score += 18;
      else if (cityKey.includes(expectedKey) || expectedKey.includes(cityKey)) score += 12;
      else if (labelKey.includes(expectedKey)) score += 8;
    }
    const box = biasBox(settings);
    if (box && found.coords) {
      const km = haversineKm(found.coords, box.center);
      score += Math.max(0, 2 - (km / 800));
    }
    return score;
  }

  function dedupeCandidates(candidates) {
    const seen = new Set();
    return (candidates || []).filter(function (candidate) {
      if (!candidate || !candidate.coords) return false;
      const normalized = geoKey(candidate.label) + "|" + Number(candidate.coords.lat).toFixed(5) + "|" + Number(candidate.coords.lng).toFixed(5);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function googleCandidateList(text, settings) {
    return loadGoogleMaps(settings).then((ok) => new Promise((resolve, reject) => {
      if (!ok || !window.google || !google.maps.Geocoder) return reject(new Error("Google Maps não está configurado."));
      const geocoder = new google.maps.Geocoder();
      const box = biasBox(settings);
      const expected = expectedGeoContext(text);
      const request = {
        address: text,
        region: "br",
        componentRestrictions: { country: "BR" }
      };
      if (box && google.maps.LatLngBounds) {
        request.bounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(box.south, box.west),
          new google.maps.LatLng(box.north, box.east)
        );
      }
      geocoder.geocode(request, (results, status) => {
        if (status !== "OK" || !Array.isArray(results) || !results.length) {
          return reject(new Error("O Google Maps não localizou esse endereço no Brasil. Confira cidade, UF, CEP ou use coordenadas."));
        }
        const candidates = results.map((result) => {
          const loc = result.geometry && result.geometry.location;
          const coordsValue = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
          const country = googleComponent(result, "country", true).toUpperCase();
          const state = googleComponent(result, "administrative_area_level_1", true).toUpperCase();
          const city = googleComponent(result, "locality", false) || googleComponent(result, "administrative_area_level_2", false) || googleComponent(result, "sublocality", false);
          const found = {
            label: result.formatted_address || text,
            coords: coordsValue,
            country,
            countryCode: country.toLowerCase(),
            state,
            city,
            placeId: result.place_id || "",
            source: "google_geocoding_br_validated",
            provider: "google_maps",
            raw: text,
            externalUrl: googlePlaceUrl(result.formatted_address || text),
            resolvedAt: new Date().toISOString()
          };
          found.confidence = Math.max(0, Math.min(1, candidateScore(found, expected, settings) / 65));
          return found;
        }).filter((candidate) => candidateMatchesExpected(candidate, expected));

        const ranked = dedupeCandidates(candidates).sort((a, b) => candidateScore(b, expected, settings) - candidateScore(a, expected, settings));
        if (!ranked.length) {
          return reject(new Error("O endereço retornado não corresponde ao Brasil, cidade ou UF informada. Revise o destino antes de calcular a rota."));
        }
        resolve(ranked.slice(0, 8));
      });
    }));
  }

  async function geocodeWithGoogle(text, settings) {
    const candidates = await googleCandidateList(text, settings);
    const hit = candidates[0];
    return Object.assign({}, hit, {
      alternatives: candidates.slice(1, 5).map(function (candidate) {
        return { label: candidate.label, coords: candidate.coords, city: candidate.city, state: candidate.state, countryCode: candidate.countryCode };
      })
    });
  }

  function nominatimContext(row) {
    const address = row && row.address || {};
    return {
      label: row.display_name || "",
      coords: coords(row.lat, row.lon),
      country: String(address.country_code || "").toUpperCase(),
      state: normalizeUf(address.state_code || address.state || ""),
      city: address.city || address.town || address.village || address.municipality || address.county || "",
      importance: Number(row.importance || 0),
      rawRow: row
    };
  }

  function rankedNominatimCandidates(rows, settings, text) {
    const expected = expectedGeoContext(text);
    const list = (Array.isArray(rows) ? rows : [])
      .map(nominatimContext)
      .filter((candidate) => candidateMatchesExpected(candidate, expected))
      .map(function (candidate) {
        const score = candidateScore(candidate, expected, settings);
        return Object.assign({}, candidate, {
          source: "nominatim_openstreetmap_br_validated",
          provider: "openstreetmap",
          raw: text,
          externalUrl: googlePlaceUrl(candidate.label || text),
          countryCode: String(candidate.country || "").toLowerCase(),
          confidence: Math.max(0, Math.min(1, score / 65)),
          resolvedAt: new Date().toISOString(),
          _score: score
        });
      });
    return dedupeCandidates(list).sort((a, b) => b._score - a._score);
  }

  async function nominatimCandidateList(text, settings) {
    const queries = searchQueries(text, settings);
    const box = biasBox(settings);
    let allRows = [];
    for (const query of queries) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "10");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("q", query);
      url.searchParams.set("countrycodes", "br");
      url.searchParams.set("accept-language", "pt-BR,pt");
      if (box) url.searchParams.set("viewbox", [box.west, box.north, box.east, box.south].join(","));
      const response = await fetch(url.toString(), {
        headers: { "Accept": "application/json", "Accept-Language": "pt-BR,pt" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Busca gratuita de endereço indisponível agora. Cole um link do Maps ou coordenadas.");
      const rows = await response.json();
      allRows = allRows.concat(Array.isArray(rows) ? rows : []);
      const ranked = rankedNominatimCandidates(allRows, settings, text);
      if (ranked.length >= 3) return ranked.slice(0, 8);
    }
    const ranked = rankedNominatimCandidates(allRows, settings, text);
    if (!ranked.length) throw new Error("Não encontrei um endereço compatível no Brasil. Informe cidade/UF, CEP, coordenadas ou cole um link compartilhado do mapa.");
    return ranked.slice(0, 8);
  }

  async function geocodeWithNominatim(text, settings) {
    const candidates = await nominatimCandidateList(text, settings);
    return Object.assign({}, candidates[0], {
      alternatives: candidates.slice(1, 5).map(function (candidate) {
        return { label: candidate.label, coords: candidate.coords, city: candidate.city, state: candidate.state, countryCode: candidate.countryCode };
      })
    });
  }

  async function geocodeCandidates(text, settings) {
    const parsed = parseLocationInput(text);
    if (parsed && parsed.coords) {
      if (!isBrazilPoint(parsed.coords)) throw new Error("As coordenadas informadas estão fora dos limites do Brasil.");
      return [Object.assign({}, parsed, { country: "BR", countryCode: "br", confidence: 1 })];
    }
    if (!parsed || !parsed.raw) throw new Error("Informe endereço, link do mapa ou coordenadas.");
    if (isGoogleConfigured(settings || {})) {
      try {
        return await googleCandidateList(parsed.raw, settings || {});
      } catch (error) {
        console.warn("Google não retornou candidato brasileiro válido; tentando OpenStreetMap:", error);
      }
    }
    return nominatimCandidateList(parsed.raw, settings || {});
  }

  async function initAutocomplete(inputId, onSelect, settings) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    input.setAttribute("autocomplete", "off");
    if (isGoogleConfigured(settings || {})) {
      try {
        await loadGoogleMaps(settings || {});
        if (window.google && google.maps.places) {
          const country = String(settings && (settings.country || settings.region) || "BR").toLowerCase().slice(0, 2);
          const box = biasBox(settings || {});
          const options = {
            componentRestrictions: { country },
            fields: ["formatted_address", "geometry", "name", "place_id", "address_components"],
            strictBounds: false
          };
          if (box && google.maps.LatLngBounds) {
            options.bounds = new google.maps.LatLngBounds(
              new google.maps.LatLng(box.south, box.west),
              new google.maps.LatLng(box.north, box.east)
            );
          }
          const autocomplete = new google.maps.places.Autocomplete(input, options);
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place || !place.geometry || !place.geometry.location || typeof onSelect !== "function") return;
            const coordsValue = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
            const country = googleComponent(place, "country", true).toUpperCase();
            const state = googleComponent(place, "administrative_area_level_1", true).toUpperCase();
            const city = googleComponent(place, "locality", false) || googleComponent(place, "administrative_area_level_2", false) || googleComponent(place, "sublocality", false);
            const expected = expectedGeoContext(input.value);
            const found = {
              label: place.formatted_address || place.name || input.value,
              coords: coordsValue,
              country,
              countryCode: country.toLowerCase(),
              state,
              city
            };
            if (!candidateMatchesExpected(found, expected)) {
              input.setCustomValidity("Selecione um endereço válido no Brasil e compatível com a cidade/UF informada.");
              input.reportValidity();
              return;
            }
            input.setCustomValidity("");
            onSelect(Object.assign({}, found, {
              source: "google_places_autocomplete_br_validated",
              provider: "google_maps",
              raw: input.value,
              externalUrl: googlePlaceUrl(place.formatted_address || input.value),
              placeId: place.place_id || "",
              confidence: 1,
              resolvedAt: new Date().toISOString()
            }));
          });
        }
      } catch (err) {
        console.warn("Autocomplete Google indisponível, mantendo busca manual gratuita:", err);
      }
    }
    input.addEventListener("change", () => {
      const parsed = parseLocationInput(input.value);
      if (parsed && parsed.coords && typeof onSelect === "function") onSelect(parsed);
    });
    return null;
  }

  async function geocode(text, settings) {
    const candidates = await geocodeCandidates(text, settings || {});
    return candidates[0];
  }

  function estimateRoute(a, b, label) {
    const p1 = toLatLng(a);
    const p2 = toLatLng(b);
    if (!p1 || !p2) return null;
    const km = haversineKm(p1, p2);
    const roadFactor = 1.28;
    const roadKm = km * roadFactor;
    const minutes = Math.max(1, Math.round((roadKm / DEFAULT_SPEED_KMH) * 60));
    return {
      source: "fallback_haversine",
      label: label || "estimativa gratuita",
      distanceMeters: Math.round(roadKm * 1000),
      distanceText: roadKm.toFixed(1).replace(".", ",") + " km estimados",
      durationSeconds: minutes * 60,
      durationText: minutes + " min estimados",
      durationTrafficText: minutes + " min estimados",
      start: p1,
      end: p2,
      geometry: { type: "LineString", coordinates: [[p1.lng, p1.lat], [p2.lng, p2.lat]] },
      isPrecise: false
    };
  }

  function osrmBase(settings) {
    return String(settings && (settings.osrmUrl || settings.osrmEndpoint) || DEFAULT_OSRM_URL).replace(/\/$/, "");
  }

  function routeKey(points, settings) {
    const clean = uniquePoints(points).map((p) => roundPoint(p, 5)).filter(Boolean);
    return osrmBase(settings) + "|" + clean.map((p) => p.lng + "," + p.lat).join(";");
  }

  function routeText(meters) {
    const km = Number(meters || 0) / 1000;
    return km >= 10 ? km.toFixed(0).replace(".", ",") + " km" : km.toFixed(1).replace(".", ",") + " km";
  }

  function durationText(seconds) {
    const min = Math.max(1, Math.round(Number(seconds || 0) / 60));
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    const rest = min % 60;
    return rest ? h + "h " + rest + "min" : h + "h";
  }

  async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms || 12000);
    try {
      return await fetch(url, { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
  }

  async function osrmRoute(points, settings) {
    const clean = uniquePoints(points);
    if (clean.length < 2) return null;
    const key = routeKey(clean, settings);
    if (routeCache.has(key)) return routeCache.get(key);
    const coordinates = clean.map((p) => p.lng + "," + p.lat).join(";");
    const url = osrmBase(settings) + "/" + coordinates + "?overview=full&geometries=geojson&steps=false&alternatives=false";
    const promise = fetchWithTimeout(url, Number(settings && settings.routeTimeoutMs) || 12000)
      .then(async (response) => {
        if (!response.ok) throw new Error("OSRM indisponível: HTTP " + response.status);
        const data = await response.json();
        const route = data && data.routes && data.routes[0];
        if (!route || !route.geometry || !Array.isArray(route.geometry.coordinates)) throw new Error("OSRM não retornou geometria de rota.");
        return {
          source: "osrm_openstreetmap",
          label: "rota por ruas/rodovias OSM",
          distanceMeters: Math.round(route.distance || 0),
          distanceText: routeText(route.distance),
          durationSeconds: Math.round(route.duration || 0),
          durationText: durationText(route.duration),
          durationTrafficText: durationText(route.duration),
          geometry: route.geometry,
          start: clean[0],
          end: clean[clean.length - 1],
          isPrecise: true,
          calculatedAt: new Date().toISOString()
        };
      });
    routeCache.set(key, promise);
    return promise;
  }

  async function routeThroughPoints(points, settings) {
    const clean = uniquePoints(points);
    if (clean.length < 2) return null;
    try {
      return await osrmRoute(clean, settings || {});
    } catch (err) {
      console.warn("Falha OSRM, usando fallback reto/estimado:", err);
      let distanceMeters = 0;
      const lineCoords = clean.map((p) => [p.lng, p.lat]);
      for (let i = 1; i < clean.length; i += 1) distanceMeters += (estimateRoute(clean[i - 1], clean[i]) || {}).distanceMeters || 0;
      const seconds = Math.max(60, Math.round((distanceMeters / 1000 / DEFAULT_SPEED_KMH) * 3600));
      return {
        source: "fallback_haversine",
        label: "fallback por linha estimada",
        distanceMeters,
        distanceText: routeText(distanceMeters) + " estimados",
        durationSeconds: seconds,
        durationText: durationText(seconds) + " estimados",
        durationTrafficText: durationText(seconds) + " estimados",
        geometry: { type: "LineString", coordinates: lineCoords },
        start: clean[0],
        end: clean[clean.length - 1],
        isPrecise: false,
        fallbackReason: err && err.message || "OSRM indisponível",
        calculatedAt: new Date().toISOString()
      };
    }
  }

  function routeUrl(points) {
    const clean = (points || []).map(toLatLng).filter(Boolean);
    if (clean.length < 2) return "";
    const params = new URLSearchParams({ api: "1", travelmode: "driving" });
    params.set("origin", clean[0].lat + "," + clean[0].lng);
    params.set("destination", clean[clean.length - 1].lat + "," + clean[clean.length - 1].lng);
    if (clean.length > 2) params.set("waypoints", clean.slice(1, -1).map((p) => p.lat + "," + p.lng).join("|"));
    return "https://www.google.com/maps/dir/?" + params.toString();
  }

  function statusPenalty(vehicle) {
    const status = String(vehicle && vehicle.status || "").toLowerCase();
    if (status.includes("manut") || status.includes("indispon")) return 100000;
    if (status.includes("atendimento") || status.includes("ocup")) return 1000;
    return 0;
  }

  async function rankVehicles(vehicles, origin, destination, settings) {
    const target = toLatLng(origin);
    if (!target) throw new Error("Origem sem coordenadas para calcular a rota.");
    const dest = toLatLng(destination);
    const located = Object.values(vehicles || {}).filter((v) => vehiclePoint(v));
    const serviceRouteShared = dest ? await routeThroughPoints([target, dest], settings || {}) : null;
    const rankings = await Promise.all(located.map(async (vehicle) => {
      const vPoint = vehiclePoint(vehicle);
      const toOrigin = await routeThroughPoints([vPoint, target], settings || {});
      const fullRoute = await routeThroughPoints([vPoint, target, dest].filter(Boolean), settings || {});
      const score = (toOrigin ? toOrigin.durationSeconds : 999999) + statusPenalty(vehicle);
      return {
        vehicle,
        toOrigin,
        serviceRoute: serviceRouteShared,
        fullRoute,
        kmToOrigin: toOrigin ? toOrigin.distanceMeters / 1000 : 0,
        minutesToOrigin: toOrigin ? Math.round(toOrigin.durationSeconds / 60) : 0,
        score,
        routeUrl: routeUrl([vPoint, target, dest].filter(Boolean))
      };
    }));
    return rankings.sort((a, b) => a.score - b.score);
  }

  window.JM = window.JM || {};
  window.JM.freeRouter = {
    parseLocationInput,
    parseRouteInput,
    extractCoordinatePair,
    extractCoordinatePairs,
    isConfigured,
    isGoogleConfigured,
    loadGoogleMaps,
    initAutocomplete,
    geocode,
    geocodeCandidates,
    geocodeWithGoogle,
    geocodeWithNominatim,
    googlePlaceUrl,
    expectedGeoContext,
    isBrazilPoint,
    estimateRoute,
    routeThroughPoints,
    osrmRoute,
    rankVehicles,
    routeUrl,
    normalizeExternalRouteUrl: normalizeUrl
  };
  // Compatibilidade com a versão anterior: o app ainda chama JM.googleMaps,
  // mas esta implementação não carrega API paga. Rota interna: Leaflet + OSM/OSRM.
  window.JM.googleMaps = window.JM.freeRouter;
}());
