const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("sim.html", "utf8");
const app = fs.readFileSync("simulator-app.js", "utf8");
const core = fs.readFileSync("simulator-core.js", "utf8");

assert.ok(html.includes('src="simulator-core.js"'));
assert.ok(html.includes('src="simulator-app.js"'));
assert.ok(html.includes('href="simulator.css"'));
assert.ok(!html.includes("pyodide"));
assert.ok(!html.includes("runPythonAsync"));
assert.ok(!html.includes("FORMSPREE"));
assert.ok(!html.includes("CUSTOM_SERVER_URL"));
assert.ok(!html.includes("GOOGLE_FORM_URL"));
assert.ok(!html.includes("passwordModal"));
assert.ok(!app.includes("fetch("));
assert.ok(core.includes("spinSweep"));
assert.ok(core.includes("manualBosenova"));

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual(duplicates, []);

console.log("AxionBH static integrity checks passed");
