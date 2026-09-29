# AxionBH v6.6 — physics-audit revision

AxionBH is a browser-based phenomenological toy model exploring axion-like fields around rotating black holes, positron production, superradiance, and bosenova-like bursts.

## Files

- `index.html` — theory and model assumptions.
- `sim.html` — interactive browser simulator using Pyodide + NumPy/SciPy.

## What v6.6 fixes

- Restores the calculator and spin plot accidentally replaced by literal `...` placeholders in v6.5.
- Uses the Kerr horizon angular velocity for dimensionless spin:
  `Omega_H = a_* c / (2 r_+)`.
- Removes the hard-coded `a_* = 0.35` cloud cutoff. Any threshold must emerge from the equations or an explicit physical criterion.
- Makes `beta_turb` actually affect the turbulence factor.
- Makes `n_profile` affect both the representative magnetic field and the ergosphere average.
- Prevents an extra `k_B` conversion in the chiral-conductivity calculation.
- Fixes the JavaScript solar-mass conversion (`Msun` previously existed only inside Python).
- Treats `~10^43` for Galactic 511-keV emission as a positron/annihilation **rate** in s^-1, not an energy luminosity in erg/s.
- Fixes bosenova luminosity units: an energy already expressed in erg is no longer multiplied by `c^2` a second time.
- Fixes hybrid bosenova time accounting by separating cycle time from total elapsed time.
- Stores SHA-256 digests for sent-result deduplication instead of plaintext serialized parameter sets.
- Replaces the old ad-hoc superradiance `alpha^16` scaling with a clearly labeled Detweiler-inspired small-`alpha` estimate for the dominant scalar `l=m=1` mode and an explicit `omega < m Omega_H` condition.

## 511-keV reference convention

The simulator currently uses:

- `Ndot_obs = 1.07e43 s^-1`
- `E_ann = 2 * 511 keV`
- therefore `L_ref ≈ 1.75e37 erg/s`

The primary comparison shown by the UI is `Ndot / Ndot_obs`.

## Important limitation

The CME/chiral sector is still **phenomenological**. v6.6 fixes clear programming and dimensional bookkeeping errors, but it does **not** establish a first-principles cgs normalization for the chain

`a_bar -> mu5 -> sigma5 -> source -> a_bar`.

If no positive stationary root is found for a parameter set, the simulator returns a zero stationary contribution instead of inventing a root. A future revision should derive this sector consistently in one unit system (preferably natural units internally, with cgs conversion only at the UI boundary).

The superradiance branch is likewise an order-of-magnitude approximation, not a precision Teukolsky solver.

## Running locally

Serve the repository over HTTP, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/sim.html`.

## References used in the v6.6 audit

- Kerr horizon frequency / superradiance notation: https://arxiv.org/abs/2210.15935
- Detweiler small-alpha superradiant scaling discussion: https://academic.oup.com/ptep/article/2014/4/043E02/1619369
- Galactic bulge positron annihilation rate (~1e43 s^-1): https://academic.oup.com/mnras/article/411/3/1727/972473
- Historical comparison of annihilation rate and energy luminosity: https://ntrs.nasa.gov/citations/19810061766
