# AxionBH

AxionBH is an exploratory browser simulator for the black-hole / axion model documented in `index.html`.

## Simulator v7

Open `sim.html` in a modern browser.

The v7 simulator:

- runs the numerical model directly in JavaScript;
- no longer requires Pyodide, NumPy or SciPy downloads;
- keeps all calculations local in the browser;
- implements CME, manual Bosenova, superradiant and hybrid modes;
- validates inputs before calculation;
- plots `κ(spin)`;
- exports the current run as JSON;
- has dark/light themes and a responsive UI.

The simulator is an implementation of an exploratory model. Its output is not a validated astrophysical inference.

## Development

Run the engine checks with Node.js:

```bash
node tests/simulator-core.test.cjs
node tests/static-app.test.cjs
```

GitHub Actions runs both checks on pull requests and pushes to `main`.
