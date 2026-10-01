# AxionBH


AxionBH is an exploratory browser simulator for the black-hole / axion model documented in `index.html`.

## Research Workbench v8.8.0

Open `sim.html` in a modern browser.

The v8 workbench:

- runs the numerical model directly in JavaScript;
- no longer requires Pyodide, NumPy or SciPy downloads;
- keeps all calculations local in the browser;
- implements the legacy-key `cme` stationary CVE closure, manual Bosenova, superradiant and hybrid modes;
- validates inputs before calculation;
- plots `κ(spin)`;
- exports the current run as JSON;
- has dark/light themes and a responsive UI;
- compares built-in scenarios in one view;
- provides a 3D/contour `spin × B₀` parameter explorer with logarithmic `fₐ` slices;
- runs ±10% sensitivity analysis over the parameters relevant to each mode;
- stores up to 20 user presets locally;
- creates shareable URLs that reproduce the current parameter state;
- exports the active Explorer A/B grid as tidy CSV;
- generates a Markdown reproducibility report with a deterministic state ID;
- reports numerical diagnostics, including the CME self-consistency residual and threshold/inactive states;
- evaluates the CME closure in one natural-unit system and solves its quadratic branches analytically;
- adds one-parameter inverse inference against `e+ budget ratio = 1` and a deficit heatmap measured in decimal orders;
- adds a Missing Physics Lab that places a phenomenological `g_extra` at three distinct stages without changing the baseline simulation;
- separates the axial chiral vortical current from the magnetic chiral magnetic current in an Anomalous Transport diagnostic;
- adds a Chirality Dynamics lab for `n5(t)`, finite chirality-flip relaxation, and a signed `E·B` anomaly source;
- replaces the massless `T^2/6` CVE base source with the exact free massive-Dirac bulk linear-response integral;
- adds an optional density closure that solves the electron vector chemical potential from net electron density `n(e-) - n(e+)` at finite temperature;
- adds an accretion-plasma closure `mdot -> rho -> n_e,net -> mu_V` using an explicit steady thick-disk continuity proxy;
- adds a Model Validity / Layer Map that separates analytic, literature-model, idealized, phenomenological, diagnostic-proxy and external-input layers;
- adds a Sgr A* accretion-calibration analysis comparing the legacy AxionBH rate with the EHT 2023 promising GRMHD cluster and the conditional Faraday-rotation range;
- adds a Flow Geometry calibration using the RIAF scaling `v_r/c = alpha (H/R)^2 / sqrt(r/r_g)` and a transparent exploratory envelope in radius, thickness and composition.

The simulator is an implementation of an exploratory model. Its output is not a validated astrophysical inference.

## Development

Run the engine checks with Node.js:

```bash
node tests/simulator-core.test.cjs
node tests/static-app.test.cjs
```

GitHub Actions runs both checks on pull requests and pushes to `main`.


## Research analysis

The v8.4.1 analysis tools are deterministic transformations of the current AxionBH implementation:

- **κ(spin)**: one-dimensional CME sweep with the model's spin threshold shown.
- **3D Explorer**: CME surfaces/contours over `spin × B₀`, with `fₐ` selected as a logarithmic slice from `10^14` to `10^18 GeV`.
- **Sensitivity**: one-at-a-time ±10% perturbation ranked by the largest relative change in `e+ budget ratio`.
- **Scenario comparison**: baseline, high-B, optimistic and the current parameter set side-by-side.
- **A/B parameter comparison**: current parameters and a selected reference scenario rendered as matched surfaces/contours.
- **Relative-difference map**: signed `Δ% = (A - B) / |B| × 100`; cells with zero reference output are left undefined rather than divided by zero.
- **Diagnostics**: each run records a deterministic state ID, finite-output checks and model-branch diagnostics; CME reports the quadratic discriminant, fixed-point slope and relative residual.
- **CME closure v8.4.1**: `B`, `T`, `Ω_H`, `m_eff` and `L_eff` are converted to `ℏ=c=k_B=1`; `∇·J₅ ≈ J₅/L_eff` is used, and the smaller positive quadratic root is selected as the stable branch.
- **Reproducibility export**: the current run can be exported as enriched JSON or Markdown, while the Explorer grid can be exported row-by-row as CSV.
- **Parameter Inference**: for each configured CME parameter, v8.4.1 scans a deliberately broad diagnostic range and either solves `e+ budget ratio = 1` or reports the best reachable value and the remaining logarithmic deficit.
- **Deficit map**: Explorer can render `log10(L511/L)` directly; positive values are the number of decimal orders still missing from the target.
- **Missing Physics Lab**: compares a gain in the closure source, a gain in the effective axion→chiral coupling, and a downstream positron-conversion gain. Upstream gains are stopped when the quadratic discriminant becomes negative.
- **Anomalous Transport**: explicitly distinguishes the axial CVE current `J5 = sigmaV * omega` from the magnetic CME vector current `j = (e^2 mu5 / 2 pi^2) B`. The two are reported separately and are not added into a positron luminosity.
- **Chirality Dynamics**: evolves axial charge exactly for constant source and flip rate, using the free massless-Dirac relation `n5 = mu5 T^2/3 + mu5^3/(3 pi^2)`. It can add a signed anomaly source proportional to `E·B`, while clearly flagging the regime `T/m_e`.

The explorer uses a single `fₐ` slice for both A and B so the comparison isolates the remaining scenario assumptions. Grid resolution is user-selectable and calculations are cached locally for responsive switching between surface, contour and difference views.

These tools are for exploring the implementation. They are not statistical confidence intervals and do not establish observational validity.


## CME v8.4.1 unit audit

The previous implementation mixed cgs quantities with natural-unit transport coefficients and multiplied the self-consistency source by `L_eff`. The v8.4.1 closure instead converts all CME quantities to a single natural-unit system and uses the gradient estimate `div J5 ~ J5/L_eff`.

The axial vortical coefficient is implemented as `sigma5 = mu5^2/(2*pi^2) + T^2/6` for zero vector chemical potential. The model's dimensionless relation is interpreted as `eta5 = mu5/T`, so the physical `mu5` is an energy. Because `mu5` is linear in `a`, the closure is exactly quadratic: `a = c0 + c2*a^2`. v8.4.1 computes both mathematical branches analytically and uses the smaller branch, for which the fixed-point slope is the stable one when below unity.

The explicit `a/M = 0.35` switch remains a phenomenological model assumption. It is not produced by the quadratic closure itself.


## v8.4.1 inverse inference

The inference panel is not a fit, posterior, confidence interval, or physical prior. It is a deterministic one-parameter-at-a-time diagnostic of the current closure. All other parameters are held fixed while one parameter is scanned over an intentionally broad range.

A TARGET row means a numerical crossing of e+ budget ratio = 1 exists inside that scan. UNREACHED means no crossing was found; the table reports the best point discovered and how many decimal orders of luminosity remain missing. This distinction is important because some CME parameters hit the quadratic-closure boundary before reaching the observational target.


## v8.4.1 closure ceiling

For the present quadratic CVE closure, `a = c0 + c2 a^2` with `mu5 = q_mu a`, the requirement of a real stable branch gives `D = 1 - 4 c0 c2 >= 0`.

With the finite-mass base vortical coefficient `sigma_base`, the internal ceiling is `mu5_max = sqrt(2 pi^2 sigma_base)`. It reduces to `pi T/sqrt(3)` only in the massless, zero-vector-chemical-potential limit where `sigma_base = T^2/6`.

This is an internal mathematical ceiling of the chosen quadratic closure, not an observational or experimental bound. Its numerical value now depends on the finite-mass plasma closure and therefore on the resolved electron vector chemical potential.

The `g_extra` controls are diagnostic only. They do not alter the default CME run, presets, or exported baseline parameters.

## v8.4.1 terminology and transport decomposition

The stationary branch historically used the internal mode key `cme`. v8.4.1 keeps that key for saved URLs and API compatibility, but the self-consistency source implemented by the code is an axial chiral vortical effect (CVE): an axial current parallel to vorticity.

The magnetic chiral magnetic effect (CME) is now computed separately as a vector/electric current parallel to the magnetic field, with `sigma_CME = e^2 mu5 / (2 pi^2) = 2 alpha mu5 / pi` for a single unit-charge Dirac species.

Both current magnitudes have natural-unit dimension GeV^3, so their scales can be compared. They are nevertheless different currents and generally different directions; the simulator therefore does not sum them or infer an `L511` contribution from the CME current without an additional kinetic/geometric conversion model.

## v8.4.1 chirality dynamics

The dynamics panel uses `dn5/dt = S_proxy + C_A E·B - Gamma_flip n5`, with `C_A = e^2/(2 pi^2) = 2 alpha/pi` in the convention used by the magnetic-CME diagnostic. `S_proxy = |J5,CVE|/L_eff` is deliberately labeled a proxy; it is not claimed to be a microscopic derivation of axion-to-chirality conversion.

For a free massless Dirac gas at zero vector chemical potential the panel uses `n5(mu5,T) = mu5 T^2/3 + mu5^3/(3 pi^2)` and `chi5 = T^2/3 + mu5^2/pi^2`. With constant coefficients the axial-density equation is solved analytically rather than by a time-step integrator.

Important regime warning: the baseline temperature `1e7 K` corresponds to `T/m_e ~ 1.7e-3`. Therefore the massless-fermion susceptibility and transport formulas are not a quantitatively reliable electron-plasma model at the baseline point. v8.4.1 exposes this explicitly instead of hiding it.

## v8.4.1 finite-mass electron plasma

The stationary CVE source no longer assumes the massless thermal coefficient at the baseline electron temperature. v8.4.1 evaluates the free massive-Dirac bulk axial vortical conductivity in linear response using a direct Fermi-Dirac integral. The new input `electronMuMeV` is the magnitude of the electron vector chemical potential.

At `m -> 0` the numerical integral reproduces `T^2/6 + mu_V^2/(2 pi^2)`. At the default `T = 1e7 K` and `mu_V = 0`, `m_e/T ~ 593` and the finite-mass coefficient is suppressed by about `3.2e-254` relative to the massless `T^2/6` reference.

This does not imply that a real Sgr A* accretion plasma has `mu_V = 0`. A charge-neutral electron-ion plasma contains net electrons supplied by baryons, so the relevant vector chemical potential must be determined by density/composition/kinetics rather than assumed. The Plasma tab therefore scans `mu_V` explicitly.

The nonlinear `mu5^2/(2 pi^2)` piece in the AxionBH quadratic closure is retained for continuity but is explicitly labeled a legacy massless ansatz: for massive fermions axial charge is not exactly conserved, so a true equilibrium axial chemical potential requires extra care.

## v8.4.1 electron density closure

The plasma layer can now determine the electron vector chemical potential from the net electron density rather than treating `mu_V` as an independent knob. The ideal massive Fermi gas uses

`n_net = 2 ∫ d^3p/(2 pi)^3 [f(E-mu_V) - f(E+mu_V)]`,

with `E = sqrt(p^2 + m_e^2)`. The factor two is spin degeneracy. The inversion `n_net -> mu_V` is monotonic for non-negative net electron density and is solved by a bracketed bisection over the direct Fermi-Dirac integral.

`electronDensityMode = 0` preserves the v7.9 manual-`mu_V` behavior. `electronDensityMode = 1` makes `electronDensityCm3` the closure variable and derives `mu_V` before evaluating the finite-mass CVE coefficient.

The density is the net conserved electron number `n(e-) - n(e+)`, appropriate for charge balance against positive ions. The code also reports the separate ideal-gas electron and positron densities and their ratio.

No Sgr A* density is hard-coded: the default simulator remains in manual mode. The example density field is exploratory and must be supplied or constrained by an accretion-flow model before astrophysical interpretation.

## v8.4.1 accretion plasma architecture

v8.4.1 introduces a third electron-plasma mode: `electronDensityMode = 2`. It estimates net electron density from a steady thick-disk continuity proxy

`mdot = 4 pi r H rho |v_r|`,  `n_e,net = Y_e rho / m_p`,

then performs the existing massive ideal-Fermi-gas inversion `n_e,net -> mu_V` before evaluating the finite-mass CVE coefficient.

The new inputs are `accretionRadiusRg`, `radialVelocityFracC`, `scaleHeightRatio`, and `electronFractionYe`. They are deliberately explicit because this closure is not a GRMHD solution. It is a transparent bridge between the accretion-rate parameter and the plasma layer.

The default remains manual `mu_V` so existing v7.x states reproduce their previous plasma choice unless the user opts into a density or accretion closure.

The Validity tab is a model-dependency map, not a score. It records which layers are algebraic/analytic, literature-based free-field transport, ideal-gas closures, phenomenological AxionBH assumptions, or diagnostic proxies.

## v8.4.1 Sgr A* accretion calibration

v8.4.1 does not silently replace the historical AxionBH accretion rate. Instead it evaluates the same v8.0 accretion-plasma geometry at several literature-context rates so that the effect of `mdot` can be isolated from the other phenomenological flow parameters.

Two ranges are included:

- **EHT 2023 Sgr A* Paper V** (`arXiv:2311.09478`): a promising low-inclination MAD GRMHD cluster with `mdot = 5.2e-9` to `9.5e-9 M_sun/yr`. The EHT paper explicitly notes that all tested model families fail at least one observational constraint, so this is stored as a model-cluster range rather than a hard observational interval.
- **Marrone et al. 2007 Faraday rotation** (`arXiv:astro-ph/0611791`): a conditional range `2e-9` to `2e-7 M_sun/yr`, dependent on assumptions about magnetic-field strength, ordering and geometry.

The historical AxionBH default `6.3e22 g/s` is approximately `1.0e-3 M_sun/yr`, more than five orders of magnitude above the EHT promising-cluster range. The Calibration tab forces the accretion-plasma closure for every comparison row while holding `r/r_g`, `H/r`, `|v_r|/c`, `Y_e`, temperature and the remaining AxionBH parameters fixed.

These ranges are literature context, not a statistical combination or a new posterior.

## v8.4.1 flow geometry calibration

v8.4.1 asks how much freedom remains in the v8.0 continuity bridge once `mdot` is fixed to the geometric midpoint of the EHT 2023 promising-model cluster.

The literature anchor is the ADAF/RIAF review by Narayan & McClintock (`arXiv:0803.0322`): radiatively inefficient flows are geometrically thick (`H` of order `R`) and have radial speed approximately `v_r ~ alpha v_K (H/R)^2`, with the review quoting `alpha ~ 0.1-0.3`. In `r/r_g` units the workbench uses the transparent Newtonian proxy `v_r/c = alpha (H/R)^2 / sqrt(r/r_g)`.

The scan envelope is deliberately broader than the directly quoted statements: `r/r_g = 3-30`, `H/R = 0.3-1`, `alpha = 0.1-0.3`, and `Y_e = 0.5-1`. The radius interval and `H/R=0.3` lower edge are exploratory horizon-scale choices, while the `Y_e` interval spans fully ionized He-to-H electron-per-baryon composition. These are not Sgr A* posterior intervals.

The Flow tab evaluates all 16 envelope corners and a 2D `r/r_g x H/R` map at geometric-mean alpha and `Y_e=0.85`. It reports the maximum luminosity leverage in dex and the best remaining `e+ budget ratio` deficit. This is a structural stress test of the continuity closure, not a parameter fit.

## v8.4.1 microphysics audit

v8.4.1 identifies and isolates a dimensional error in the historical 511-keV comparison. The observational quantity of order 1e43 is a Galactic positron annihilation/injection **rate** in e+/s, not an energy luminosity in erg/s. The legacy `L_OBS_511=1.07e43` numerical field is retained only as a deprecated reproducibility alias; new audit code uses `POSITRON_RATE_OBS_511`.

The workbench now reports a rate-corrected phenomenological proxy

`Ndot_e+ = L_model / E_cost`

with the existing `E_cost=1.6e-6 erg` kept explicit. This conversion is **not** a microscopic pair-production calculation. Likewise, the stationary local `axion -> mu5` relation remains explicitly phenomenological: derivative axion-current interactions motivate charge-bias mechanisms in suitable non-equilibrium systems, but do not derive the specific AxionBH closure ansatz.

The Microphysics tab shows the historical dimensional mismatch and the corrected positron-rate proxy side by side. Legacy result fields are not silently rewritten in v8.4.1 so old shared states remain numerically reproducible.

## v8.4.1 explicit pair production
Adds an idealized constant-field Schwinger e+e- diagnostic. The QED rate is explicit; the local E field, screening, backreaction and active filling factor are not derived. The Pairs tab inverts the rate for a fiducial one-r_g shell and separately checks the necessary mdot c^2 energy ceiling.

## v8.4.1 canonical 511-keV observable

v8.3/v8.4 exposed the dimensional mismatch but retained the historical `ratio511` for compatibility. v8.4.1 completes the migration: `ratio511` is now the energy-budget-equivalent positron-rate ratio used everywhere in the workbench.

The phenomenological bridge remains `P_proxy = (mu5/m_p) mdot c^2`, followed by `Ndot_e+,eq = P_proxy / E_cost` with the historical `E_cost = 1.6e-6 erg`. The canonical ratio is `Ndot_e+,eq / 1.07e43 s^-1`. The previous dimensionally invalid `P_proxy[erg/s] / 1.07e43[s^-1]` value is preserved as `legacyRatio511` only.

This semantic correction raises positive canonical ratios by `1/E_cost ≈ 6.25e5`, or about `5.80 dex`; it does not introduce new microphysics.

The explicit Schwinger channel added in v8.4 is kept separate. Its energy ceiling now uses the exact pair rest energy `2 m_e c^2`, rather than reusing the phenomenological 1 MeV-per-positron proxy.

The Microphysics audit additionally evaluates the derivative axion-fermion benchmark `b0_peak = C_e m_a a0/(2 f_a)` at `C_e=1`. This is an axial-background scale associated with the standard derivative coupling and is not automatically an equilibrium chiral chemical potential.


## v8.5.1 511-keV reference calibration

The canonical Galactic-bulge positron-rate reference is calibrated to 2e43 e+/s, following the model-dependent bulge production-rate estimate of Siegert et al. (2016, A&A 586 A84). A total visible Galactic rate of order 5e43 e+/s is stored as context, not used as the bulge target.

All power-to-pair-rate conversions now use the same exact minimum pair rest energy, 2 m_e c^2 = 1.637421155e-6 erg. This includes the canonical CVE observable, manual Bosenova, superradiant conversion, Missing Physics and the closure ceiling. The v8.5 Gap/Schwinger layer is preserved unchanged except that it shares the same target reference.


## v8.5.2 scalar 211 superradiance physics fix

The superradiant branch no longer uses the historical `spin >= 0.4` switch or the ad-hoc `a_*^4 alpha^16` growth law.

For the scalar `211` level it now:

- evaluates the hydrogenic bound-state frequency `omega_R / mu ~= 1 - alpha^2/8`;
- requires the physical Kerr superradiance condition `omega_R < m Omega_H` with `m=1`;
- uses the small-`alpha` literature fit `Gamma_211 / mu ~= 4e-2 alpha^8 [a_* - 2 alpha (1 + sqrt(1-a_*^2))]` from Baryakhtar et al. (2021, Phys. Rev. D 103, 095019, Table IV);
- reports the corresponding critical spin instead of a universal spin threshold;
- estimates the cloud saturation energy by conserving black-hole energy and angular momentum while spinning down to the superradiant boundary;
- replaces the hidden `1e-10 M_BH` seed with an explicit boson seed occupation `N_seed` (default 1);
- computes the number of e-folds from `ln(N_sat/N_seed)`;
- reports both the instantaneous `Gamma E_cloud` growth-power scale and the time-averaged extraction power `E_cloud/t_sat`;
- keeps `epsilon_pair` as an explicitly phenomenological energy-to-positron conversion proxy. No microscopic direct conversion of an ultralight axion quantum into an electron-positron pair is assumed.

The growth formula is a small-`alpha` approximation, not a numerical Teukolsky solution. The saturation estimate omits accretion during growth, gravitational-wave losses and axion self-interactions.

The previous default point `M=4.28e6 M_sun`, `a_*=0.89`, `m_a=1e-17 eV` is now correctly classified as kinematically closed for scalar-211 superradiance rather than forced active by a spin-only gate.


## v8.6 charge-starved gap and pair cascade

The Gap analysis is promoted from a Schwinger field ceiling to an explicit diagnostic chain:

`charge supply → Goldreich-Julian deficit → analytic gap potential → particle acceleration → curvature photons → gamma-gamma pairs`.

The implementation adds:

- a classical order-of-magnitude Goldreich-Julian number-density scale `n_GJ ~= |Omega_F B|/(2 pi e c)`;
- a charge-starvation audit comparing `n_GJ` with the existing accretion-continuity density multiplied by an explicit funnel-injection fraction;
- the analytic black-hole gap voltage scalings summarized by Rieger & Katsoulakos (2017): vacuum `DeltaV ~ Phi0 (h/r_g)^2` and near-GJ `DeltaV ~ Phi0 (h/r_g)^3/6`, where `Phi0 ~ Omega_F r_g^2 B/c`;
- potential-limited and curvature-radiation-reaction electron Lorentz factors;
- characteristic curvature-photon energy;
- the head-on Breit-Wheeler `gamma gamma → e+ e-` cross section, threshold, optical depth and conversion probability in an isotropic monoenergetic soft-photon bath;
- a one-generation pair multiplicity and Goldreich-Julian refill diagnostic;
- an electrical-power ceiling on the pair rate;
- a direct comparison with the already implemented vacuum Schwinger channel.

The gap model remains deliberately diagnostic. The full Kerr Goldreich-Julian density, gap Poisson equation, photon spectra, inverse-Compton losses, pair feedback and time-dependent GR PIC evolution are not solved. The funnel-injection fraction and soft-photon bath are exploratory inputs rather than observational posteriors.


## v8.7 self-consistent spectral gap closure

v8.7 promotes the v8.6 one-energy gap diagnostic into a spectral radiative closure model.

The new layer:

- replaces the monoenergetic soft-photon bath with an isotropic power-law photon-number spectrum, `dN/dε ∝ ε^-p`, normalized to an explicit bolometric soft-photon luminosity;
- integrates Breit-Wheeler `γγ -> e+e-` opacity over that discretized spectrum;
- adds inverse-Compton cooling over the same photon field;
- applies the Moderski et al. approximation `F_KN ~= (1+b)^(-3/2)`, with `b = 4 γ ε/(m_e c^2)`, to expose Klein-Nishina suppression explicitly;
- solves the electron Lorentz factor from electric acceleration versus curvature + inverse-Compton losses, capped by the available gap potential;
- propagates both curvature and IC photons into the one-generation pair budget;
- scans and refines `h/r_g` to find where both pair multiplicity and the Goldreich-Julian refill proxy reach unity.

The closure solver deliberately returns `closure-not-found` if either criterion fails throughout the configured `10^-3 <= h/r_g <= 1` interval.

This is still an exploratory stationary closure. The photon spectrum is not a fitted Sgr A* SED, the IC treatment does not use the exact Klein-Nishina redistribution kernel, angular radiative transfer is simplified, and secondary pairs are not evolved recursively. GRPIC calculations show that real black-hole spark gaps can be intermittent even when steady algebraic closure criteria appear possible.


## v8.8 positron transport and 511-keV observable pipeline

v8.8 separates near-source positron production from the observable Galactic-bulge 511-keV signal.

The new pipeline is

`production -> source escape -> spatial retention -> thermalisation survival -> annihilation -> positronium branching -> 511-keV line flux`.

Key additions:

- source selection between the current mode's positron-rate output, the self-consistent v8.7 gap cascade, and Schwinger production evaluated at a solved gap;
- explicit source-escape, thermalisation-survival and annihilation fractions;
- an isotropic 3D Gaussian transport-kernel proxy with an adjustable smearing scale and bulge acceptance radius;
- an observational morphology context of `150 ± 50 pc` from Siegert et al. (2021), stored as a diagnostic rather than a fitted diffusion coefficient;
- an injection-energy diagnostic using the scenario-dependent `<= 1.4 MeV` propagation interpretation from the same morphology analysis;
- explicit positronium branching: direct annihilation gives two 511-keV photons, para-positronium gives two line photons in 1/4 of Ps decays, and ortho-positronium gives a three-photon continuum in 3/4;
- a calibrated bulge line-flux reference of `(0.96 ± 0.07)e-3 ph cm^-2 s^-1` from Siegert et al. (2016);
- conversion of that flux to a line-photon luminosity using the same effective bulge distance of `8.5 kpc`, giving about `8.30e42 photons/s`;
- separate reporting of production rate, annihilation rate, line-photon rate and predicted Earth flux.

The previous `LINE_PHOTON_RATE_OBS_511 = 5e42 s^-1` value is retained only as `LINE_PHOTON_RATE_OBS_511_LEGACY`; the canonical line-photon reference is now derived from the measured bulge flux.

The transport kernel remains phenomenological. v8.8 does not yet solve pitch-angle scattering, diffusion/advection, Coulomb and ionisation losses, ISM phase transitions, or time-dependent injection. The `150 ± 50 pc` and `<=1.4 MeV` values are observationally motivated context for a specific propagation interpretation, not universal transport laws.
