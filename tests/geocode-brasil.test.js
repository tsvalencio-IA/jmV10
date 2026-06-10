"use strict";
const assert = require("assert");
global.window = global;
window.JM = { utils: {
  coords(a,b) { a=Number(String(a).replace(",",".")); b=Number(String(b).replace(",",".")); return Number.isFinite(a)&&Number.isFinite(b)&&a>=-90&&a<=90&&b>=-180&&b<=180 ? {lat:a,lng:b}:null; },
  pointFrom(v) { return v&&v.lat!=null&&v.lng!=null ? {lat:Number(v.lat),lng:Number(v.lng)} : null; },
  haversineKm(a,b) { const R=6371,toRad=x=>x*Math.PI/180; const dlat=toRad(b.lat-a.lat),dlng=toRad(b.lng-a.lng); const h=Math.sin(dlat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dlng/2)**2; return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)); },
  roundPoint(p) { return p; },
  normalizeUrl(x) { return x; }
}};
global.fetch = async function () {
  return { ok: true, async json() { return [
    { display_name:"Thessaloniki, Greece", lat:"40.6401", lon:"22.9444", importance:0.99, address:{country_code:"gr", city:"Thessaloniki", state:"Central Macedonia"}},
    { display_name:"Rua Thessalônico Barbosa, 400, Distrito Industrial, São José do Rio Preto, São Paulo, Brasil", lat:"-20.811", lon:"-49.376", importance:0.7, address:{country_code:"br", city:"São José do Rio Preto", state:"São Paulo", state_code:"SP"}},
    { display_name:"Rua Thessalônico Barbosa, 410, Distrito Industrial, São José do Rio Preto, São Paulo, Brasil", lat:"-20.812", lon:"-49.377", importance:0.6, address:{country_code:"br", city:"São José do Rio Preto", state:"São Paulo", state_code:"BR-SP"}}
  ]; }};
};
require("../js/google-maps.js");
(async function () {
  const ctx = JM.googleMaps.expectedGeoContext("Rua X, 10, Curitiba, Paraná, Brasil");
  assert.strictEqual(ctx.state, "PR");
  assert.strictEqual(ctx.city, "Curitiba");
  assert.strictEqual(JM.googleMaps.isBrazilPoint({lat:48.8,lng:2.3}), false);
  const candidates = await JM.googleMaps.geocodeCandidates("Rua Thessalônico Barbosa, 400, Distrito Industrial, São José do Rio Preto, Brasil", {});
  assert.ok(candidates.length >= 1);
  assert.ok(candidates.every((item) => item.countryCode === "br"));
  assert.strictEqual(candidates[0].city, "São José do Rio Preto");
  assert.strictEqual(candidates[0].state, "SP");
  console.log("PASS geocode-brasil.test.js");
}()).catch((error) => { console.error(error); process.exit(1); });
