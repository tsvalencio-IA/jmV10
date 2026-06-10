"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
const tests = ["insurance-parser.test.js","geocode-brasil.test.js","version-cache.test.js"];
for (const test of tests) {
  const result = spawnSync(process.execPath,[path.join(__dirname,test)],{stdio:"inherit"});
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("ALL TESTS PASSED");
