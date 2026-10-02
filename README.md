# AxionBH

**AxionBH v8.9.1** is an exploratory browser-based research workbench for testing a layered black-hole / plasma / pair-production / positron-transport model against Galactic 511-keV observables.

> The project is a model-testing environment, not a validated astrophysical inference tool.

## Open it

- **Overview:** https://dargon777.github.io/AxionBH-v3.3/
- **Research Workbench:** https://dargon777.github.io/AxionBH-v3.3/sim.html

The overview is available in **English, Russian, German and Simplified Chinese**. English is the canonical/default language. The numerical workbench uses English scientific terminology.

## What the model does

AxionBH separates the problem into explicit layers instead of treating a single efficiency factor as an explanation:

```text
black-hole state
      ↓
accretion / plasma
      ↓
candidate source mechanism
      ↓
e⁺e⁻ pair production
      ↓
positron escape + slowing + transport
      ↓
annihilation + positronium
      ↓
511-keV line flux at Earth
```

The current workbench includes:

- stationary axial **CVE** closure diagnostics;
- a separate magnetic **CME** current diagnostic;
- finite-mass electron-plasma transport coefficients;
- electron-density and accretion-density closures;
- scalar-211 superradiance kinematic/growth checks;
- manual Bosenova and hybrid exploratory branches;
- charge-starved black-hole gap diagnostics;
- curvature and inverse-Compton radiation losses;
- spectral Breit–Wheeler `γγ → e⁺e⁻` pair production;
- self-consistent gap-height closure searches;
- Schwinger-pair diagnostics and energy ceilings;
- source-to-bulge positron transport;
- reduced multiphase ISM transport;
- positronium branching and predicted 511-keV line flux;
- parameter maps, sensitivity scans, inverse diagnostics and scenario comparison;
- explicit model-validity / assumption layers;
- reproducible JSON, CSV, Markdown reports and shareable state URLs.

## Baselines and reproducibility

The default **Sgr A* · EHT-context baseline** now uses the geometric midpoint of the EHT 2023 promising GRMHD accretion-rate cluster, `5.2–9.5 × 10⁻⁹ M☉/yr`, and enables the accretion-density plasma closure.

The previous historical AxionBH parameter set is preserved as **Legacy AxionBH baseline** so old assumptions can still be reproduced and compared.

Saved URLs include a model version and state-schema version. User presets remain local to the browser.

## Scientific status

The code intentionally distinguishes:

| Layer | Status |
| --- | --- |
| Kerr geometry and algebraic conversions | analytic / standard |
| free-field transport pieces | literature-based / idealized |
| finite-mass ideal Fermi-gas closure | idealized model |
| accretion continuity bridge | phenomenological proxy |
| Axion → chirality stationary closure | phenomenological hypothesis |
| gap cascade | reduced diagnostic model |
| positron ISM transport | reduced transport model |
| full AxionBH explanation of the 511-keV signal | **not established** |

A detailed assumption map is in [SCIENTIFIC_STATUS.md](SCIENTIFIC_STATUS.md).

## Important corrections retained in v8

Several earlier shortcuts are now explicitly audited rather than hidden:

1. The Galactic quantity of order `10^43` is a **positron rate** in `e⁺/s`, not an energy luminosity in `erg/s`.
2. CVE and CME are different currents and are not automatically summed.
3. The old spin-only superradiance switch was replaced with the scalar-211 kinematic condition.
4. The historical AxionBH accretion rate was far above the EHT-context range and is now a legacy preset.
5. Pair production is separated from transport and from the final annihilation observable.
6. A failed closure, energy ceiling or transport deficit is treated as a result rather than tuned away.

## Local development

No build step is required. Open `index.html` or `sim.html` in a browser.

Run the checks with Node.js 22+:

```bash
node --check simulator-core.js
node --check simulator-app.js
node tests/simulator-core.test.cjs
node tests/static-app.test.cjs
node tests/site-integrity.test.cjs
```

GitHub Actions runs the same checks on pushes and pull requests.

## Key observational context

- Event Horizon Telescope Collaboration, *First Sagittarius A* Event Horizon Telescope Results. V. Testing Astrophysical Models of the Galactic Center Black Hole*, arXiv:2311.09478.
- Siegert et al. (2016), Galactic 511-keV morphology and spectroscopy, *A&A* 586, A84.
- Jean et al. (2009), low-energy Galactic positron transport, arXiv:0909.4022.
- Narayan & McClintock (2008), RIAF/ADAF review, arXiv:0803.0322.
- Baryakhtar et al. (2021), scalar superradiance growth approximations, *Phys. Rev. D* 103, 095019.

These references provide context or ingredients for individual layers. They do **not** constitute confirmation of the AxionBH hypothesis.

## Version history

See [CHANGELOG.md](CHANGELOG.md).

---

**Dargon777 · AxionBH Research Workbench**
