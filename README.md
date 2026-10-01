# AxionBH


AxionBH is an exploratory browser simulator for the black-hole / axion model documented in `index.html`.

## Research Workbench v7.1

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
- generates a `spin × B₀` heatmap for `L/L₅₁₁`;
- runs ±10% sensitivity analysis over the parameters relevant to each mode;
- stores up to 20 user presets locally;
- creates shareable URLs that reproduce the current parameter state.

The simulator is an implementation of an exploratory model. Its output is not a validated astrophysical inference.

## Development

Run the engine checks with Node.js:

```bash
node tests/simulator-core.test.cjs
node tests/static-app.test.cjs
```

GitHub Actions runs both checks on pull requests and pushes to `main`.


## Research analysis

The v7.1 analysis tools are deterministic transformations of the current AxionBH implementation:

- **κ(spin)**: one-dimensional CME sweep with the model's spin threshold shown.
- **spin × B₀**: two-dimensional CME map colored by `log10(L/L511)`.
- **Sensitivity**: one-at-a-time ±10% perturbation ranked by the largest relative change in `L/L511`.
- **Scenario comparison**: baseline, high-B, optimistic and the current parameter set side-by-side.

These tools are for exploring the implementation. They are not statistical confidence intervals and do not establish observational validity.
