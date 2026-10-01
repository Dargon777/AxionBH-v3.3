# AxionBH


AxionBH is an exploratory browser simulator for the black-hole / axion model documented in `index.html`.

## Research Workbench v7.9

Open `sim.html` in a modern browser.

The v7 simulator:

- runs the numerical model directly in JavaScript;
- no longer requires Pyodide, NumPy or SciPy downloads;
- keeps all calculations local in the browser;
- implements CME, manual Bosenova, superradiant and hybrid modes;
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
- adds one-parameter inverse inference against `L/L511 = 1` and a deficit heatmap measured in decimal orders;
- adds a Missing Physics Lab that places a phenomenological `g_extra` at three distinct stages without changing the baseline simulation;
- separates the axial chiral vortical current from the magnetic chiral magnetic current in an Anomalous Transport diagnostic;
- adds a Chirality Dynamics lab for `n5(t)`, finite chirality-flip relaxation, and a signed `E·B` anomaly source;
- adds a finite-mass axial-CVE kernel using the massive-QED Fermi–Dirac integrals of Lin & Yang (Phys. Rev. D 98, 114022), plus carrier-density diagnostics.

The simulator is an implementation of an exploratory model. Its output is not a validated astrophysical inference.

## Development

Run the engine checks with Node.js:

```bash
node tests/simulator-core.test.cjs
node tests/static-app.test.cjs
```

GitHub Actions runs both checks on pull requests and pushes to `main`.


## Research analysis

The v7.9 analysis tools are deterministic transformations of the current AxionBH implementation:

- **κ(spin)**: one-dimensional CME sweep with the model's spin threshold shown.
- **3D Explorer**: CME surfaces/contours over `spin × B₀`, with `fₐ` selected as a logarithmic slice from `10^14` to `10^18 GeV`.
- **Sensitivity**: one-at-a-time ±10% perturbation ranked by the largest relative change in `L/L511`.
- **Scenario comparison**: baseline, high-B, optimistic and the current parameter set side-by-side.
- **A/B parameter comparison**: current parameters and a selected reference scenario rendered as matched surfaces/contours.
- **Relative-difference map**: signed `Δ% = (A - B) / |B| × 100`; cells with zero reference output are left undefined rather than divided by zero.
- **Diagnostics**: each run records a deterministic state ID, finite-output checks and model-branch diagnostics; CME reports the quadratic discriminant, fixed-point slope and relative residual.
- **CME closure v7.9**: `B`, `T`, `Ω_H`, `m_eff` and `L_eff` are converted to `ℏ=c=k_B=1`; `∇·J₅ ≈ J₅/L_eff` is used, and the smaller positive quadratic root is selected as the stable branch.
- **Reproducibility export**: the current run can be exported as enriched JSON or Markdown, while the Explorer grid can be exported row-by-row as CSV.
- **Parameter Inference**: for each configured CME parameter, v7.9 scans a deliberately broad diagnostic range and either solves `L/L511 = 1` or reports the best reachable value and the remaining logarithmic deficit.
- **Deficit map**: Explorer can render `log10(L511/L)` directly; positive values are the number of decimal orders still missing from the target.
- **Missing Physics Lab**: compares a gain in the closure source, a gain in the effective axion→chiral coupling, and a downstream positron-conversion gain. Upstream gains are stopped when the quadratic discriminant becomes negative.
- **Anomalous Transport**: explicitly distinguishes the axial CVE current `J5 = sigmaV * omega` from the magnetic CME vector current `j = (e^2 mu5 / 2 pi^2) B`. The two are reported separately and are not added into a positron luminosity.
- **Chirality Dynamics**: evolves axial charge exactly for constant source and flip rate, using the free massless-Dirac relation `n5 = mu5 T^2/3 + mu5^3/(3 pi^2)`. It can add a signed anomaly source proportional to `E·B`, while clearly flagging the regime `T/m_e`.
- **Finite-Mass Plasma**: evaluates the massive axial-CVE coefficient at finite vector chemical potential, compares it with the massless reference, and reports the ideal-gas electron/positron densities implied by the selected `mu_vec/m_e`.

The explorer uses a single `fₐ` slice for both A and B so the comparison isolates the remaining scenario assumptions. Grid resolution is user-selectable and calculations are cached locally for responsive switching between surface, contour and difference views.

These tools are for exploring the implementation. They are not statistical confidence intervals and do not establish observational validity.


## CME v7.9 unit audit

The previous implementation mixed cgs quantities with natural-unit transport coefficients and multiplied the self-consistency source by `L_eff`. The v7.9 closure instead converts all CME quantities to a single natural-unit system and uses the gradient estimate `div J5 ~ J5/L_eff`.

The axial vortical coefficient is implemented as `sigma5 = mu5^2/(2*pi^2) + T^2/6` for zero vector chemical potential. The model's dimensionless relation is interpreted as `eta5 = mu5/T`, so the physical `mu5` is an energy. Because `mu5` is linear in `a`, the closure is exactly quadratic: `a = c0 + c2*a^2`. v7.9 computes both mathematical branches analytically and uses the smaller branch, for which the fixed-point slope is the stable one when below unity.

The explicit `a/M = 0.35` switch remains a phenomenological model assumption. It is not produced by the quadratic closure itself.


## v7.9 inverse inference

The inference panel is not a fit, posterior, confidence interval, or physical prior. It is a deterministic one-parameter-at-a-time diagnostic of the current closure. All other parameters are held fixed while one parameter is scanned over an intentionally broad range.

A TARGET row means a numerical crossing of L/L511 = 1 exists inside that scan. UNREACHED means no crossing was found; the table reports the best point discovered and how many decimal orders of luminosity remain missing. This distinction is important because some CME parameters hit the quadratic-closure boundary before reaching the observational target.


## v7.9 closure ceiling

For the present quadratic CME closure, `a = c0 + c2 a^2` with `mu5 = q_mu a`, the requirement of a real stable branch gives `D = 1 - 4 c0 c2 >= 0`.

If an arbitrary multiplicative enhancement is placed anywhere upstream between the closure source and the effective `a -> mu5` coupling, the maximum attainable chemical potential is `mu5_max = pi T / sqrt(3)`.

This is an internal mathematical ceiling of the current closure, not an external experimental bound. Moving the same phenomenological gain between the source and chiral-coupling stages cannot evade it. For the baseline preset the ceiling is about `8.82e-6 L511`, leaving roughly `5.05 dex` for a genuinely downstream or structurally different mechanism.

The `g_extra` controls are diagnostic only. They do not alter the default CME run, presets, or exported baseline parameters.

## v7.9 terminology and transport decomposition

The stationary branch historically used the internal mode key `cme`. v7.9 keeps that key for saved URLs and API compatibility, but the self-consistency source implemented by the code is an axial chiral vortical effect (CVE): an axial current parallel to vorticity.

The magnetic chiral magnetic effect (CME) is now computed separately as a vector/electric current parallel to the magnetic field, with `sigma_CME = e^2 mu5 / (2 pi^2) = 2 alpha mu5 / pi` for a single unit-charge Dirac species.

Both current magnitudes have natural-unit dimension GeV^3, so their scales can be compared. They are nevertheless different currents and generally different directions; the simulator therefore does not sum them or infer an `L511` contribution from the CME current without an additional kinetic/geometric conversion model.

## v7.9 chirality dynamics

The dynamics panel uses `dn5/dt = S_proxy + C_A E·B - Gamma_flip n5`, with `C_A = e^2/(2 pi^2) = 2 alpha/pi` in the convention used by the magnetic-CME diagnostic. `S_proxy = |J5,CVE|/L_eff` is deliberately labeled a proxy; it is not claimed to be a microscopic derivation of axion-to-chirality conversion.

For a free massless Dirac gas at zero vector chemical potential the panel uses `n5(mu5,T) = mu5 T^2/3 + mu5^3/(3 pi^2)` and `chi5 = T^2/3 + mu5^2/pi^2`. With constant coefficients the axial-density equation is solved analytically rather than by a time-step integrator.

Important regime warning: the baseline temperature `1e7 K` corresponds to `T/m_e ~ 1.7e-3`. Therefore the massless-fermion susceptibility and transport formulas are not a quantitatively reliable electron-plasma model at the baseline point. v7.9 exposes this explicitly instead of hiding it.

## v7.9 finite-mass axial CVE

For a massive Dirac fermion at constant temperature and vector chemical potential, v7.9 evaluates the axial chiral-vortical coefficient from Lin & Yang, Phys. Rev. D 98, 114022 (2018), arXiv:1810.02979. In their notation `sigma_V = [2 F3 + m^2 F2]/(2 pi^2)` with `F2` and `F3` written as Fermi-Dirac momentum integrals.

The implementation rewrites the integrals in the dimensionless variables `x=q/T`, `z=m/T`, and `nu=mu_vec/T`, evaluates them by composite Simpson quadrature, and recovers `mu_vec^2/(2 pi^2) + T^2/6` in the massless limit.

At the baseline `T=1e7 K` and `mu_vec=0`, taking the carrier mass to be `m_e` gives an enormous thermal suppression of the axial-CVE coefficient. This is not a statement that the accretion flow contains no electrons: a real ionized plasma has a vector chemical potential fixed by charge neutrality and density. The `mu_vec/m_e` control therefore exposes how strongly the result depends on the missing plasma-density closure.

v7.9 intentionally does not replace the magnetic-CME formula or the axial-charge dynamics with a pretend 'massive mu5 chemical potential'. For nonzero fermion mass, axial charge is explicitly non-conserved and the massive kinetic problem requires more structure than substituting one susceptibility for another.
