# Changelog

## v8.10.2

Conditional radio-constraint impact audit.

- propagated the v8.10.1 normalization discrepancy into the published `M^-` / `M^+` threshold scalings under an explicit shared-normalization assumption;
- evaluated the full Figure-7 `(g_agammagamma,m_a)` grid;
- found no surviving enhancement interval in any grid cell under that assumption;
- derived the coupling required to reopen `M^- < M^+`, approximately `1e-6–1e-5 GeV^-1` across `m_a=1e-7–1e-3 eV`;
- kept the result classified as conditional: the diffuse-radio intensity and PBH-fraction exclusion curves are not replaced until the radial and cosmological calculation is recomputed from scratch;
- added regression tests and updated model metadata.

## v8.10.1

Photon-kinetics normalization-forensics patch.

- added a dedicated audit for the arXiv:2611.09132 Figure-3 benchmark;
- exposed the correct cubic `cm^-3 -> GeV^3` conversion and resulting `tau_onset`, `kappa`, and inferred core lower-mass threshold;
- added a deliberately invalid two-power conversion counterfactual for diagnosis only;
- found that the counterfactual reproduces the plotted onset scale and the published lower-mass coefficient to order unity, while the correct conversion does not;
- added nonrelativistic-validity overlap checks;
- explicitly forbid the counterfactual from feeding any canonical AxionBH observable;
- added regression tests and detailed documentation.

## v8.10.0

PBH axion-cloud literature-integration release.

- added Branco–Rosa (2026) stimulated self-interaction capture audit: `xi`, `Gamma1`, critical cloud density, approximate maximum cloud mass and optional `Gamma1/H` growth criterion;
- added Choi–Joh–Kadota (2026) local axion↔photon kinetics: vacuum decay, de Broglie-core/spike timescales, `kappa`, and semi-analytic equilibrium photon/axion densities;
- added explicit `cm^-3 <-> natural units` normalization in the photon-kinetics path;
- added a published-benchmark cross-check that reproduces the quoted vacuum lifetime but surfaces a currently unresolved enhancement-normalization discrepancy;
- kept both PBH modules standalone so they do not silently alter the existing Sgr A* / 511-keV pipeline;
- added regression tests and updated reproducibility metadata.

## v8.9.1

Product, reproducibility and scientific-integrity release.

- made the EHT-context Sgr A* preset the modern baseline;
- preserved the historical parameter set as **Legacy AxionBH baseline**;
- kept the shared-state schema backward compatible;
- standardized the numerical workbench UI in English;
- added Reset and `Ctrl/⌘ + Enter` run shortcut;
- improved keyboard focus, reduced-motion support and ARIA live regions;
- added canonical, Open Graph and web-app metadata;
- added favicon, manifest, sitemap and robots metadata;
- improved the multilingual overview with shareable `?lang=` state;
- rewrote the README around the current layered architecture;
- added `SCIENTIFIC_STATUS.md`;
- expanded static-site and CI integrity checks.

## v8.9.0

Reduced multiphase ISM positron transport:

- WNM/WIM/HIM/CNM/molecular phase presets;
- reduced collisional slowing;
- in-flight annihilation;
- diffusion + advection and collisional/ballistic regimes;
- energy-dependent transport sweeps.

## v8.8

Separated near-source positron production from the observable 511-keV signal:

- source escape;
- spatial retention;
- thermalisation survival;
- annihilation;
- positronium branching;
- Earth line flux.

## v8.7

Self-consistent spectral gap closure:

- power-law soft-photon spectrum;
- spectral `γγ` opacity;
- inverse-Compton cooling;
- Klein-Nishina suppression proxy;
- self-consistent gap-height search.

## v8.6

Charge-starved gap and pair-cascade diagnostics:

- Goldreich-Julian charge deficit;
- gap potential;
- curvature photons;
- Breit-Wheeler pair production;
- electrical-power ceiling.

## v8.5.2

Scalar-211 superradiance physics audit:

- physical `ω_R < mΩ_H` condition;
- small-`α` growth fit;
- spin-down saturation estimate;
- explicit seed occupation;
- removal of the historical spin-only switch.

## v8.5.1

511-keV observable calibration:

- canonical bulge positron-rate reference;
- consistent pair rest-energy conversion;
- accretion calibration context.

## v8.4.1

Major dimensional and plasma audit:

- natural-unit CVE closure;
- analytic quadratic branches;
- finite-mass electron plasma;
- density and accretion closures;
- CVE/CME separation;
- chirality dynamics diagnostics;
- inverse scans and closure ceilings;
- explicit microphysics audit.
