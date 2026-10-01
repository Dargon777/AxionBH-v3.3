# AxionBH


AxionBH is an exploratory browser simulator for the black-hole / axion model documented in `index.html`.

## Research Workbench v7.3

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
- reports numerical diagnostics, including the CME self-consistency residual and threshold/inactive states.

The simulator is an implementation of an exploratory model. Its output is not a validated astrophysical inference.

## Development

Run the engine checks with Node.js:

```bash
node tests/simulator-core.test.cjs
node tests/static-app.test.cjs
```

GitHub Actions runs both checks on pull requests and pushes to `main`.


## Research analysis

The v7.3 analysis tools are deterministic transformations of the current AxionBH implementation:

- **κ(spin)**: one-dimensional CME sweep with the model's spin threshold shown.
- **3D Explorer**: CME surfaces/contours over `spin × B₀`, with `fₐ` selected as a logarithmic slice from `10^14` to `10^18 GeV`.
- **Sensitivity**: one-at-a-time ±10% perturbation ranked by the largest relative change in `L/L511`.
- **Scenario comparison**: baseline, high-B, optimistic and the current parameter set side-by-side.
- **A/B parameter comparison**: current parameters and a selected reference scenario rendered as matched surfaces/contours.
- **Relative-difference map**: signed `Δ% = (A - B) / |B| × 100`; cells with zero reference output are left undefined rather than divided by zero.
- **Diagnostics**: each run records a deterministic state ID, finite-output checks and model-branch diagnostics; CME additionally reports the relative residual of the self-consistent root.
- **Reproducibility export**: the current run can be exported as enriched JSON or Markdown, while the Explorer grid can be exported row-by-row as CSV.

The explorer uses a single `fₐ` slice for both A and B so the comparison isolates the remaining scenario assumptions. Grid resolution is user-selectable and calculations are cached locally for responsive switching between surface, contour and difference views.

These tools are for exploring the implementation. They are not statistical confidence intervals and do not establish observational validity.
