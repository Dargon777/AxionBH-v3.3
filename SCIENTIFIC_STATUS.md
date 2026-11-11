# AxionBH scientific status

This document separates established ingredients, idealized closures, phenomenological assumptions, and open hypotheses in **AxionBH v8.10.2**.

## Reading the model correctly

AxionBH is a layered exploratory model. A successful numerical run means that the implemented equations were evaluated consistently under the selected assumptions. It does **not** mean that the complete physical scenario is established.

The strongest use of the workbench is falsification and stress testing: locating dimensional inconsistencies, unreachable targets, kinematic closures, energy ceilings, plasma suppression, and transport losses.

## Evidence hierarchy

### 1. Standard / analytic ingredients

These pieces are not unique to AxionBH:

- Kerr black-hole geometry and horizon angular velocity;
- unit conversions between cgs and natural units;
- ideal Fermi-Dirac occupation functions;
- the Breit-Wheeler `γγ → e⁺e⁻` cross section;
- classical curvature-radiation expressions;
- the Schwinger constant-field pair-production expression;
- positronium line-yield bookkeeping.

Their presence in the code does not validate the model-specific links between them.

### 2. Literature-motivated approximations

The workbench uses published approximations or observational context for:

- the EHT Sgr A* GRMHD accretion-rate context;
- RIAF/ADAF flow geometry scaling;
- scalar-211 small-`α` superradiance growth;
- Galactic 511-keV bulge flux and positron-rate context;
- low-energy positron propagation scales.

These are imported as context or reduced formulae, not full numerical reproductions of the source papers.

### 3. Idealized closure layers

These are physically motivated but simplified:

- ideal massive electron gas used to infer `μ_V` from net electron density;
- steady thick-disk continuity bridge `ṁ → ρ → n_e`;
- power-law soft-photon spectrum in the gap model;
- reduced inverse-Compton treatment with approximate Klein-Nishina suppression;
- reduced ISM diffusion/advection or collisional/ballistic transport;
- effective thermal-annihilation coefficients for ISM phases.

### 4. AxionBH phenomenological assumptions

These remain model hypotheses:

- the stationary axion-to-chirality closure;
- the historical `a/M = 0.35` CVE activation gate;
- phenomenological conversion efficiencies in manual burst branches;
- any direct identification of a chiral scale with an observable positron luminosity without a microscopic kinetic derivation;
- the proposed curvature/topology connection to baryon-number violation.

### 5. Open research questions

The current implementation does not establish:

- a microscopic derivation of the complete `axion → chirality → e⁺` chain;
- a self-consistent GR kinetic plasma solution around Sgr A*;
- a time-dependent GRPIC black-hole gap cascade;
- a global 3D Galactic magnetic-field and multiphase-gas transport solution;
- a statistical fit or posterior for AxionBH parameters;
- a demonstrated explanation of the Galactic 511-keV signal;
- a demonstrated baryogenesis mechanism.

## Important model audits

### 511-keV observable

Earlier development mixed a number of order `10^43` with an energy-luminosity interpretation. The current workbench treats the Galactic quantity as a positron rate and separately tracks:

- source positron production;
- escaped positron rate;
- annihilation rate;
- positronium branching;
- 511-keV line-photon rate;
- predicted flux at Earth.

### CVE versus CME

The stationary closure is based on an axial chiral-vortical current. The magnetic chiral effect is computed separately as a vector/electric current. The two are not automatically summed and the code does not silently convert the CME current into a 511-keV luminosity.

### Finite electron mass

At `T = 10^7 K`, electrons are not in the ultrarelativistic massless regime. The workbench therefore includes a direct finite-mass Fermi-Dirac integral and exposes massless formulas as approximations rather than silently using them as the baseline.

### Sgr A* accretion baseline

The historical AxionBH default corresponds to roughly `10^-3 M☉/yr`. The EHT 2023 promising model cluster quoted `5.2–9.5 × 10^-9 M☉/yr`. In v8.10.2:

- **Sgr A* · EHT-context baseline** uses the geometric midpoint of that cluster and the accretion-density plasma closure;
- **Legacy AxionBH baseline** preserves the historical parameter set for reproducibility.

The EHT paper itself stresses that all tested model families failed at least one observational constraint. The range is therefore model context, not a model-independent measurement.

Two-temperature GRMHD work published in 2024 also shows that electron thermodynamics and cooling can materially change Sgr A* light-curve predictions. AxionBH therefore treats its reduced plasma layer as an approximation rather than a substitute for GRMHD.

### Scalar superradiance

The old fixed spin switch was removed. The scalar-211 branch now checks the kinematic superradiance condition before estimating growth and saturation. Even an active boson cloud does not by itself provide a microscopic MeV positron-production mechanism.

### Gap and pair cascade

The gap branch checks charge starvation, potential drop, radiation reaction, photon production and `γγ` pair opacity. A numerical `closure-not-found` result is retained as a valid outcome.

The branch remains a reduced stationary model and does not replace GRPIC.

### Positron transport

v8.8–v8.9 explicitly separate source production from the observed annihilation morphology. The current reduced ISM model exposes large regime dependence rather than hiding it in one smearing parameter.

## PBH stimulated-capture and axion-photon modules (v8.10)

Two new modules are intentionally kept separate from the Sgr A* 511-keV pipeline.

### Stimulated self-interaction capture

The Branco–Rosa 2026 module implements the published local ground-state growth rate, gravitational-focusing parameter, critical self-interaction density and approximate maximum cloud mass. These are classified as **literature-model calculations**. AxionBH does not yet evolve the early-Universe density/velocity history, the transition time `t_*`, stripping, reabsorption and repeated bosenova cycles self-consistently.

### Local axion ↔ photon kinetics

The Choi–Joh–Kadota 2026 module implements the published local escape/filling prescriptions and semi-analytic equilibrium equations for spontaneous/stimulated decay and inverse decay. Number densities supplied in `cm^-3` are explicitly converted to natural units before the dimensionless `nbar` normalization is formed.

The published benchmark is also exposed as a regression/audit case. The quoted vacuum lifetime is reproduced, but the direct unit-converted evaluation currently gives a different sign for the local `kappa` enhancement test than the behavior described in the preprint. This is recorded as an **open normalization discrepancy**, not evidence that either calculation is correct by fiat. The correct next step is independent reproduction of the paper's density profile and numerical normalization.

## arXiv:2611.09132 normalization forensics (v8.10.2)

The published benchmark quotes `n_a0 ~= 4.6e32 cm^-3` and defines `nbar = 16 pi^2 n/m_a^3`. A number density is a volume density, so converting it to natural units requires **three** powers of the length conversion. Under that conversion the Figure-3 benchmark gives `kappa<0` and an onset time many orders of magnitude later than photon escape.

A deliberately dimensionally invalid two-power conversion is retained only as a forensic counterfactual. Numerically, it moves the onset marker to the scale plotted in Figure 3 and moves the inferred lower PBH-mass threshold close to the published Eq. (3.27) coefficient. The result is classified as a **strong normalization inconsistency**, not as a demonstrated coding mistake by the paper's authors.

The correct natural-unit branch remains canonical. No downstream AxionBH observable is allowed to use the counterfactual branch.

## Conditional radio-constraint impact (v8.10.2)

AxionBH now propagates the normalization discrepancy into the paper's analytic enhancement boundaries **only under the explicit assumption** that the same multiplicative density normalization affects both the core-side lower boundary and spike-side upper boundary.

Under that assumption, none of the Figure-7 parameter-grid cells retains an interval with `M^- < M^+`. This means the local prerequisite for the paper's stimulated radio source is absent before any cosmological intensity integral is evaluated.

This is not yet a corrected observational exclusion. The full radial source `Q_gamma(r)`, enhancement radius, filling budget, redshift integral and ARCADE-2 comparison must be recomputed from a dimensionally consistent profile before a replacement bound on `f_PBH` can be claimed.

## Reproducibility policy

- Model version: `8.10.2`
- Shared-state schema: kept backward compatible with v8.9.0
- Historical baseline preserved as a separate preset
- Diagnostic exports contain a deterministic state ID
- User presets are browser-local
- A failed or unreachable target is reported rather than automatically tuned away

## Core references

- Event Horizon Telescope Collaboration (2023), arXiv:2311.09478.
- Salas et al. (2024), arXiv:2411.09556.
- Siegert et al. (2016), A&A 586, A84.
- Jean et al. (2009), arXiv:0909.4022.
- Narayan & McClintock (2008), arXiv:0803.0322.
- Baryakhtar et al. (2021), Phys. Rev. D 103, 095019.
