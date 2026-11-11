# Normalization audit: arXiv:2611.09132

## Scope

This note independently checks the local benchmark used in Choi, Joh & Kadota (2026), *Stimulated Axion Decay around Primordial Black Holes and the Diffuse Radio Background*, arXiv:2611.09132v1.

It is an internal consistency audit. It does **not** claim that a specific implementation error occurred unless the authors' numerical source is independently reproduced.

## Printed benchmark and equations

The paper's Figure 3 uses approximately

- `M_PBH = 1e-6 M_sun`
- `m_a = 1e-6 eV = 1e-15 GeV`
- `g_agammagamma = 1e-11 GeV^-1`
- `n_a0 = 4.6e32 cm^-3`
- `tau_a ~= 1.3e45 s`
- `r = 100 r_Sch`.

The paper defines

```text
nbar_i = 16 pi^2 n_i / m_a^3
tbar_esc = t_esc / tau_a
kappa = nbar_a0 / beta - 1 / tbar_esc
tau_onset = beta / nbar_a0
```

Inside the soliton-like core,

```text
beta = G M_PBH m_a
t_esc = 2 r_dB / (3 c)
r_dB = 1 / (G M_PBH m_a^2)
```

For the benchmark, AxionBH obtains

```text
beta                  = 7.48314e-3
r_dB / r_Sch          = 8.92899e3
t_esc                 = 5.86396e-8 s
tau_a                 = 1.32341e45 s
tbar_esc              = 4.43093e-53
```

The radius ratio agrees with the paper's quoted `r_dB ~= 9e3 r_Sch`, and the vacuum lifetime agrees with the quoted `~1.3e45 s`.

## Correct volume-density conversion

Using

```text
1 cm = 5.067730716e13 GeV^-1
```

a physical volume density transforms as

```text
n[GeV^3] = n[cm^-3] / (5.067730716e13)^3.
```

Therefore

```text
n_a0 = 4.6e32 cm^-3
     = 3.53441e-9 GeV^3
     = 3.53441e18 eV^3.
```

The normalized density is then

```text
nbar_a0 = 5.58132e38
tau_onset = beta / nbar_a0
          = 1.34075e-41.
```

Comparison with photon escape:

```text
tau_onset / tbar_esc = 3.02585e11.
```

Thus photons escape roughly eleven orders of magnitude in dimensionless time before the printed stimulated-onset estimate is reached, and the direct local criterion gives `kappa < 0`.

## Comparison with Figure 3

The onset marker in Figure 3 is visually on the `~1e-55` dimensionless-time scale, whereas the correct conversion gives `~1.34e-41`.

This discrepancy is independent of the vacuum-lifetime calculation and the core escape-time calculation, both of which reproduce the scales stated in the paper.

## Two-power counterfactual

For diagnosis only, AxionBH evaluates the dimensionally invalid operation

```text
n_pseudo = n[cm^-3] / (CM_TO_GEV_INV)^2
```

and then treats the resulting numerical value as if it were a `GeV^3` density.

This is **not a valid unit conversion**.

Numerically it gives

```text
n_pseudo             = 1.79115e5  (treated as GeV^3)
n_pseudo             = 1.79115e32 (treated as eV^3)
nbar_pseudo          = 2.82846e52
tau_onset,pseudo     = 2.64566e-55
tau_onset/tbar_esc   = 5.97082e-3.
```

The resulting onset time falls on the scale of the Figure-3 onset marker.

The numerical boost relative to the correct volume conversion is

```text
5.06773e13,
```

exactly one missing power of the `cm -> GeV^-1` conversion factor.

## Lower PBH-mass threshold cross-check

The paper reports

```text
M_PBH^- ~= 2.90e-9 M_sun
```

for the benchmark axion mass, coupling and fraction.

In the flat-core benchmark scalings,

```text
nbar_a0 / beta  propto M_PBH^2
1/tbar_esc      propto M_PBH,
```

so the local benchmark can infer the crossing mass from the ratio of the escape and stimulated terms.

Using the correct volume conversion gives

```text
M_PBH^- ~= 3.0e5 M_sun,
```

which is incompatible with the paper's coefficient and lies far outside the nonrelativistic PBH-dominated axion-core regime for `m_a=1e-6 eV`.

Using the two-power counterfactual gives

```text
M_PBH^- ~= 5.97e-9 M_sun,
```

within a factor `~2.06` of the paper's `2.90e-9 M_sun`.

Equivalently, matching the paper's lower-mass coefficient from the correctly converted benchmark would require increasing the normalized density by about

```text
1.04e14,
```

which is only a factor `~2.06` above one missing `cm -> GeV^-1` conversion factor.

## Figure 4 consistency check

Figure 4 labels equilibrium number densities in `eV^3` and shows core values around `10^30 eV^3` for the same benchmark.

The quoted initial density `4.6e32 cm^-3` corresponds to only `3.53e18 eV^3` under the correct volume conversion.

This provides a second, independent indication that the plotted natural-unit densities and the quoted cgs density are not using the same normalization.

## Current conclusion

The checks jointly support the following statement:

> The v1 preprint contains a strong density/unit-normalization inconsistency between the quoted cgs benchmark density, the printed natural-unit Boltzmann normalization, and the numerical scales shown in Figures 3–4 / Eq. (3.27).

What is **not** established:

- that the authors literally used a two-power conversion in their code;
- whether an unpublished convention or intermediate rescaling explains the discrepancy;
- how a corrected normalization changes every final radio-background exclusion curve.

The two-power branch in AxionBH is therefore a forensic counterfactual only. The canonical calculation always uses the cubic conversion appropriate to a volume density.

## References

- Choi, Joh & Kadota (2026), arXiv:2611.09132v1.
- AxionBH v8.10.1 normalization-forensics module.


## Conditional impact on Eq. (3.27) and Figure 7

The published enhancement interval is bounded by

```text
M^- = 2.90e-9 M_sun (g/1e-11)^-2 (m_a/1e-6)^-1/2
M^+ = 69.6    M_sun (g/1e-11)^4  (m_a/1e-6)^-2.
```

The lower boundary scales inversely with an overall density normalization, while the spike-side upper boundary scales with its square. If the same normalization discrepancy inferred above affects both boundaries, applying the factor needed to reconcile `M^-` gives

```text
reference corrected M^-  ~= 3.03e5 M_sun
conditional corrected M+ ~= 6.39e-27 M_sun.
```

Across the Figure-7 grid

```text
g = 1e-10, 1e-11, 1e-12, 1e-13 GeV^-1
m_a = 1e-7, 1e-6, 1e-5, 1e-4, 1e-3 eV
```

all 20 cells have `M^- > M^+` under this hypothesis.

Solving `M^-=M^+` gives the coupling required merely to create any enhancement interval:

```text
1e-7 eV -> 1.07e-6 GeV^-1
1e-6 eV -> 1.90e-6 GeV^-1
1e-5 eV -> 3.38e-6 GeV^-1
1e-4 eV -> 6.01e-6 GeV^-1
1e-3 eV -> 1.07e-5 GeV^-1
```

For context, the 2024 extended CAST result reports `g_agamma < 5.8e-11 GeV^-1` at 95% C.L. for `m_a <= ~0.02 eV`, covering this entire mass grid.

Therefore, **if** the shared-normalization hypothesis is correct, the stimulated-enhancement prerequisite disappears throughout the parameter space used for the paper's radio-background plots at couplings already many orders above existing limits.

This remains conditional because the upper-bound rescaling has not yet been independently reconstructed from the full spike normalization. The next required step is a from-scratch radial-profile and cosmological-intensity reproduction.
