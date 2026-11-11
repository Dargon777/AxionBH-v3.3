# AxionBH

**AxionBH v8.10.1** is an exploratory browser-based research workbench for testing a layered black-hole / plasma / pair-production / positron-transport model against Galactic 511-keV observables.

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
- PBH self-interaction-driven stimulated axion-capture diagnostics;
- local PBH axion↔photon Boltzmann-equilibrium diagnostics with an explicit unit-consistency audit;
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

## v8.10 PBH axion-cloud literature bridge

v8.10 adds two **standalone literature-derived audits** without silently feeding them into the Sgr A* / 511-keV causal chain:

- **Stimulated capture around Schwarzschild PBHs** following Branco & Rosa (2026), arXiv:2610.21951. The core exposes the focusing parameter `xi = 2 pi alpha / v_a`, the ground-state stimulated growth rate `Gamma1`, the self-interaction critical cloud density, the approximate bosenova-limited cloud mass and an optional `Gamma1/H` full-growth check.
- **Stimulated axion decay / inverse decay around PBHs** following Choi, Joh & Kadota (2026), arXiv:2611.09132. The core exposes the vacuum `a -> gamma gamma` rate, de Broglie-core/spike escape and filling times, the local `kappa` enhancement criterion, and the semi-analytic stimulated/spontaneous equilibrium branches.

### Unit-consistency cross-check

The November 2026 paper quotes a benchmark with `M_PBH=1e-6 M_sun`, `m_a=1e-6 eV`, `g_agammagamma=1e-11 GeV^-1`, `n_a0~=4.6e32 cm^-3` and `tau_a~=1.3e45 s`, and describes stimulated emission for that setup.

AxionBH reproduces the quoted vacuum lifetime scale. However, when the quoted number density is explicitly converted from `cm^-3` to natural `GeV^3` before evaluating `nbar=16 pi^2 n/m_a^3`, the local `kappa>0` criterion is not met in the direct benchmark audit. This is retained as a **normalization discrepancy to investigate**, not “fixed” by changing units or fitting a hidden factor. It may reflect a convention, profile-normalization detail, implementation detail, or an issue in the preprint; AxionBH does not decide which without reproducing the authors' numerical pipeline.

These PBH modules are therefore diagnostic research tools. They do not establish PBH axion clouds observationally and do not validate the original AxionBH axion→chirality hypothesis.

## v8.10.1 normalization forensics

A follow-up audit of arXiv:2611.09132 now isolates the benchmark discrepancy more sharply.

For the paper's Figure-3 benchmark (`M_PBH=1e-6 M_sun`, `m_a=1e-6 eV`, `g_agammagamma=1e-11 GeV^-1`, `n_a0=4.6e32 cm^-3`), the printed definitions give

- `nbar = 16 pi^2 n / m_a^3`
- `tau_onset = beta / nbar_a0`
- `kappa = nbar_a0/beta - 1/tbar_esc`.

With the dimensionally correct volume conversion `cm^-3 -> GeV^3`, AxionBH obtains `tau_onset ~= 1.34e-41`, while `tbar_esc ~= 4.43e-53`; therefore the local benchmark is non-enhanced.

The forensics module also evaluates a **deliberately invalid counterfactual** in which the density is divided by only two powers of the `cm -> GeV^-1` conversion and the result is then treated numerically as a `GeV^3` density. That counterfactual gives `tau_onset ~= 2.65e-55`, which lies on the scale of the onset marker in the paper's Figure 3, and yields a lower PBH-mass threshold of `~5.97e-9 M_sun`, within a factor ~2 of the paper's `2.90e-9 M_sun`.

This is **strong evidence for a density/unit-normalization inconsistency**, but it is not proof that the authors' code used exactly this two-power conversion. AxionBH preserves both the correct calculation and the counterfactual side by side so the discrepancy remains auditable.

See `NORMALIZATION_AUDIT_2611_09132.md` for the numerical derivation.

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
