const fs = require("node:fs");
const assert = require("node:assert/strict");

const index = fs.readFileSync("index.html", "utf8");
const sim = fs.readFileSync("sim.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("site.webmanifest", "utf8"));
const sitemap = fs.readFileSync("sitemap.xml", "utf8");
const robots = fs.readFileSync("robots.txt", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const scientific = fs.readFileSync("SCIENTIFIC_STATUS.md", "utf8");

function duplicateIds(html) {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

assert.deepEqual(duplicateIds(index), []);
assert.deepEqual(duplicateIds(sim), []);

assert.ok(index.includes('<html lang="en"'));
assert.ok(index.includes("AxionBH v8.9.1"));
assert.ok(index.includes('rel="canonical" href="https://dargon777.github.io/AxionBH-v3.3/"'));
assert.ok(index.includes('rel="manifest" href="site.webmanifest"'));
assert.ok(index.includes('href="favicon.svg"'));
assert.ok(index.includes('href="sim.html"'));

for (const lang of ["en", "ru", "de", "zh"]) {
  assert.ok(index.includes('data-lang="' + lang + '"'), "missing language: " + lang);
}
assert.ok(index.includes('url.searchParams.set("lang", lang)'));
assert.ok(index.includes('aria-pressed'));

assert.ok(sim.includes("AxionBH — Research Workbench v8.9.1"));
assert.ok(sim.includes('id="resetBtn"'));
assert.ok(sim.includes('value="baseline">Sgr A* · EHT-context baseline'));
assert.ok(sim.includes('value="legacy">Legacy AxionBH baseline'));
assert.ok(sim.includes('role="status" aria-live="polite"'));

assert.equal(manifest.name, "AxionBH Research Workbench");
assert.equal(manifest.start_url, "./");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);

assert.ok(sitemap.includes("https://dargon777.github.io/AxionBH-v3.3/"));
assert.ok(sitemap.includes("https://dargon777.github.io/AxionBH-v3.3/sim.html"));
assert.ok(robots.includes("sitemap.xml"));

assert.ok(readme.includes("AxionBH v8.9.1"));
assert.ok(readme.includes("Legacy AxionBH baseline"));
assert.ok(readme.includes("SCIENTIFIC_STATUS.md"));
assert.ok(scientific.includes("not a validated astrophysical inference"));
assert.ok(scientific.includes("Sgr A* · EHT-context baseline"));

console.log("AxionBH site integrity checks passed");
