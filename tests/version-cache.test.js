"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const root = path.resolve(__dirname, "..");
const version = "jm-v32-3-final-consolidada";
const activeFiles = ["index.html","jm.html","motorista.html","superadmin.html","cliente-chamado.html","relatorio.html","service-worker.js","js/app.js","js/motorista.js"];
for (const file of activeFiles) {
  const text = fs.readFileSync(path.join(root,file),"utf8");
  assert.ok(text.includes(version), file + " não contém a versão unificada");
  assert.ok(!/jm-v(?:20|28|32-1|32-2)-/.test(text), file + " contém versão ativa antiga");
}
const sw = fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
assert.ok(sw.includes("./js/insurance-parser.js"));
console.log("PASS version-cache.test.js");
