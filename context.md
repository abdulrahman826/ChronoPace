# context.md — ChronoPace

> **CHRONOPACE — Decision Intelligence for the Energy Battle**
> *Deciding when energy is worth spending.*

The question this product answers is **not** "where should energy be
deployed?" — it's **"is this the moment our finite energy is worth
spending?"** That reframe is the whole product. Every section below exists
to support one of: legality, rival-state uncertainty, opportunity cost, or
confidence/abstention. If a proposed feature doesn't touch one of those
four things, it's probably not core — see §18 for this as an explicit
filter.

Read this before touching any code in this repo. It exists so a teammate
(or an agent) picking up this project mid-build doesn't have to
reverse-engineer intent from diffs or from what's on screen. This is the
**whole project**, not just the dashboard — read it end to end before
assuming you know what's built and what's still just designed, because
those two things currently do not match, and that mismatch matters.

**Current reality in one line**: the *decision engine* (the actual
"intelligence" in this hackathon's theme) — Stages 1-4 as designed in
this document — has **zero lines of Python in this repository**. A real
backend exists and is reachable, but it lives in a **separate repository**
(`https://github.com/siddiquezain/chronobrain`, local checkout typically
at `../engine` next to this repo) — never vendored, copied, or merged
into this one. As of 2026-09-12 that backend is far along and materially
richer than the original Stages 1-4 spec below: a hardened
`DecisionSnapshot` contract (confidence/opportunity/Monte Carlo fields
added 2026-09-06 through 2026-09-11), tick-level strategic-rival tracking,
multi-race/season discovery, a compound-stratified + ML-hybrid rival
observation model, and a `POST /api/v1/decision` endpoint that is fully
live-tested end to end (§12). Nothing here confirms the external backend
literally implements Stages 1-4's file-by-file design below — only its
HTTP contract is known and verified — but its *behavior* (legality-first,
deterministic, uncertainty-aware, no client-side strategy logic) is
consistent with this document's intent throughout. The *dashboard* you
can click through locally consumes that live backend when one is
configured and reachable, and falls back to hand-typed mock data
otherwise — both paths render through the same components. If code and
this file ever disagree, trust the code and flag the mismatch rather than
trusting whichever is more convenient. **§12 is a full rewrite as of
2026-09-12** — read it before assuming anything about the current
dashboard from an older skim of this file.

## 1. What this project is

**ChronoPace** is a real-time, deterministic decision-support engine for
2026 Formula 1 energy/overtake strategy, built for the **TrackShift 2026
Innovation Challenge** hackathon (official theme: AI Motorsport
Intelligence, problem one of three — name it correctly in any judge-facing
material).

`TrackShift` = the hackathon name. `ChronoPace` = the product name.

> **Core positioning**: ChronoPace is a deterministic race-strategy engine
> that decides when finite electrical energy is worth spending by
> combining regulatory legality, probabilistic rival-state estimation,
> Monte Carlo planning, and future opportunity cost.
>
> **Core differentiator**: We don't just optimize the attack. We decide
> whether the attack is worth spending the energy on.

**Competitive positioning**: a different TrackShift team ("Deploy AI") is
reportedly building toward *where/when* energy should be deployed, with
driver/car/track-specific learned modeling. Don't attack that project or
make unsupported comparative claims in any pitch material — the accurate,
defensible distinction is one of scope, not quality: Deploy AI answers
*where/when*; ChronoPace answers *whether the spend is worth it at all*,
via legality-first optimization, rival uncertainty, opportunity cost, and
deliberate abstention. Win on that distinction, not by claiming to be
"more AI."

A companion document, **`ChronoPace-Solution-Design.pdf`** (repo root),
covers the same architecture in narrative form — problem statement, the
solution, and the reasoning behind each major decision — written to hand
to teammates who want the pitch-level version instead of this
reference-level one. This file is the one to trust for exact field names,
formulas, and conventions when actually writing code.

## 2. The one architectural law

**Python computes every number, deterministically and testably. An LLM
(Claude) is only ever allowed to turn an already-correct, already-verified
JSON payload into a plain-language sentence. It never computes, never
decides, and never has authority to change a number it was given.**

This is the safety argument the whole project rests on: an LLM generates
tokens probabilistically and can state a wrong number with full
confidence, which is unacceptable when the number is an energy deployment
figure or a compliance decision. Any change that lets a language model
influence a numeric or compliance outcome is a violation of the core
design, not a refactor — flag it explicitly rather than making it quietly.
No LLM call exists anywhere in Stages 1-3. The LLM appears exactly once,
in Stage 4, only after Stages 1-3 have produced final, verified numbers.
The *decision* (Stages 1-3) is fast; the *narration* (Stage 4, an API
call) is not — keep those two claims separate, never call the narrated
output "real-time." (The dashboard doesn't violate this law either way it
currently runs — on mock data it isn't computing anything at all, it's a
static placeholder standing in for where Stage 1-3's real output will go;
on live backend data (§12) it's relaying a real response, not itself
computing one. Nothing under Stages 1-3 happens client-side in either
case.)

## 3. Architecture — the four-stage pipeline

Memorable version, one question per stage — useful shorthand in a pitch,
not a substitute for the exact contracts below:

```text
OBSERVE                                  (Telemetry Simulator, §17 step 2)
   ↓
CAN WE?               → Regulatory Gate           (Stage 1)
   ↓
SHOULD WE?             → Monte Carlo Planner        (Stage 2)
   ↓
NOW OR LATER?           → Opportunity Horizon         (§9, layered on top)
   ↓
DO WE KNOW ENOUGH?       → Confidence Gate              (Stage 3)
   ↓
ACTION
   ↓
EXPLAIN                   → LLM Narrator                  (Stage 4, §10)
```

| Stage | File | Role | Status |
|---|---|---|---|
| 1 — Regulatory Gate | `rule_gate.py` | Legality only, not viability | Specified, **not built** |
| 2 — Monte Carlo Planner | `planner.py` | Ranks legal modes by simulated outcome | Specified, **not built** |
| 3 — Confidence Gate | `confidence_gate.py` | Two-part significance + DCLI + rival-uncertainty check | Specified, **not built** |
| 4 — LLM Narrator | `narrator.py` | Turns the verified decision into a sentence | Not started — blocked on Stage 3 |

A fifth component, the **Rival Energy State Estimator** (`rival_estimator.py`,
§6), sits alongside this pipeline: it feeds Stage 2 and Stage 3 as a
probabilistic input, but is not itself one of the four numbered stages and
never touches Stage 1. A sixth, the **Opportunity Horizon**
(`opportunity_engine.py`, §9), sits *on top of* Stages 2-3 rather than
inside the numbered sequence — it chains the single-lap pipeline across
several future laps to compare whole strategies, not just this lap's
modes. **None of these six Python files exist on disk yet** — see §12
for what does.

**Data flow has two valid shapes, depending on how far the build has
gotten — both are real, not one superseding the other mid-build:**

- **Pre-Horizon (built first, §17 steps 1-7)**: `TelemetryInput` →
  `RegulatoryGate.evaluate()` → `GateResult` (`legal_modes`, `base_cap_mj`,
  `violations`) → (`legal_modes` + `PlanningContext`, optionally carrying a
  `RivalSocEstimate`) → `MonteCarloPlanner.plan()` → `PlannerResult`
  (ranked `ModeProjection`s, `recommended_mode`) → (`PlannerResult` +
  `DriverLoadInput`, optionally the same rival estimate) →
  `ConfidenceGate.evaluate()` → `ConfidenceGateResult` (final
  recommendation, possibly overridden to `BALANCED_MODE`). This is the
  complete single-lap pipeline and a legitimate demo on its own.
- **Post-Horizon (§17 step 8 onward)**: `opportunity_engine.py` chains
  `MonteCarloPlanner.plan()` across a bounded future horizon per candidate
  strategy (§9), and `ConfidenceGate.evaluate()`'s inputs become the
  **top-ranked strategy vs. runner-up strategy** instead of top mode vs.
  runner-up mode — same gate, extended inputs, not a second gate.

Either way, the final `ConfidenceGateResult` → Stage 4 (§10, not yet
built) → `StrategyCall` (§10's narrator-input contract).

Run tests from the repo root once the backend exists: `python -m pytest -q`.

## 4. Deployment modes — five, not four

| Mode | What it represents | Stage 1 legality condition |
|---|---|---|
| `CONSERVE_MODE` | Minimal deployment, banks energy for later | Base cap only |
| `BALANCED_MODE` | Default baseline deployment; the fallback target when Stage 3 overrides | Base cap only |
| `ARM_OVERTAKE_MODE` | Attack this lap while within proximity of the car ahead; also what qualifies the bonus for next lap | Base cap, **and** must be within `overtake_detection_gap_threshold_s` at the detection point |
| `USE_OVERTAKE_BONUS_MODE` | Spend a banked bonus from *last* lap's qualification | Base cap + bonus, **and** `overtake_qualified_last_lap` must be true — illegal (not merely capped lower) otherwise |
| `PUSH_MODE` | Sustained max-legal deployment (e.g. defending, a qualifying-style lap) | Base cap only |

**Why arming and spending are separate modes, not one mode with a hidden
flag**: the 2026 Overtake Mode bonus (+0.5 MJ) is banked on the lap you
qualify (within the gap threshold at the detection point) and can only be
*spent* on the following lap — a genuine sequential decision, not a
same-lap bonus. Splitting it into two modes keeps `ModeDynamics` (§7) a
clean per-mode lookup table instead of forcing conditional logic into it,
lets Stage 2 rank "should I arm" and "should I spend" as the independent
strategic choices they actually are, and keeps each mode's Stage 1
legality a single condition instead of one mode with two different rules
depending on hidden state. A single `HOLD_BALANCED` or abstention mode was
considered and rejected: abstention is a Stage-3 statement about
*confidence*, not an on-track action a car executes — it already resolves
to recommending `BALANCED_MODE` with `overridden=True` on the existing
`ConfidenceGateResult`, not a sixth deployment mode.

**Qualification is a telemetry fact, not a mode-choice fact.**
`GateResult.qualifies_for_overtake_bonus_next_lap` is computed purely from
`gap_to_car_ahead_s` — a car qualifies for next lap's bonus by being close
enough at the detection point, *regardless of which mode ChronoPace
actually recommended that lap*. Do not wire "qualification" to whether
`ARM_OVERTAKE_MODE` was the chosen strategy; that would be wrong and is an
easy mistake to make when implementing this.

**Presentation-layer relabeling — resolved.** UI labels only — the five
backend enum values above are what code uses, and do not change.
Implemented as a small lookup (`MODE_LABELS` in `mockTelemetry.js`, used
by `DecisionBanner` and `MonteCarloPlanner`):

```js
CONSERVE_MODE: 'CONSERVE'
BALANCED_MODE: 'BALANCED'
ARM_OVERTAKE_MODE: 'ARM OVERTAKE'
USE_OVERTAKE_BONUS_MODE: 'USE OVERTAKE BONUS'
PUSH_MODE: 'PUSH'
```

This superseded an earlier proposal (ATTACK/ARM/WAIT/HOLD/CONSERVE) that
didn't cleanly cover all five modes — WAIT read as an Opportunity Horizon
*strategy* name (`WAIT_N`, §9) rather than a mode, and `PUSH_MODE` didn't
fit at all. The mapping above is a direct, unambiguous one-to-one for all
five and needed no invented word.

## 5. Stage 1 — Regulatory Gate (`rule_gate.py`)

**FIA 2026 Power Unit Technical Regulations — corrected constants**
(earlier drafts of this project inverted the deployment and recovery
figures; these are the corrected values, cite the article number
alongside the constant in code so a reviewer can check it without reading
logic):

| Constant | Value | Source |
|---|---|---|
| `max_ers_k_power_kw` | 350 kW | Art. 5.4.7 — max instantaneous MGU-K power |
| `max_deployment_per_lap_mj` | 9.0 MJ | Art. 5.4.10 — max energy, MGU-K HV DC bus, per lap (**deployment** side) |
| `max_delta_soc_mj` | 4.0 MJ | Art. 5.4.9 — max SoC swing per lap |
| `recoverable_energy_baseline_mj` | 8.5 MJ | Baseline **recovery/harvest** figure, event-variable (as low as 5 MJ at energy-starved circuits, up to 9 MJ at energy-rich ones, 7 MJ in qualifying) — informational/config-only, does not gate deployment legality. No confirmed article number for this specific figure; comment as "citation pending" rather than inventing one. |
| `overtake_detection_gap_threshold_s` | 1.0 s | F1 Sporting Regulations — proximity eligibility at the detection point |
| `overtake_bonus_mj` | 0.5 MJ | Banked on the qualifying lap, spendable only the following lap |
| `taper_normal_start_kmh` / `taper_normal_end_kmh` | 290 → 355 km/h | Normal deployment taper band |
| `taper_overtake_full_power_end_kmh` | 337 km/h | Full 350 kW sustained to this speed under the Overtake Mode bonus, then tapers |

**The 8.5 MJ figure is not a deployment cap.** A car can gross-deploy up
to 9 MJ in a lap while only net-changing SoC by 4 MJ, because it is also
harvesting during the same lap — these are governed by different articles
(5.4.10 vs 5.4.9) and must not be conflated. The +0.5 MJ bonus applies to
`max_deployment_per_lap_mj` only, **never** to `max_delta_soc_mj`.

**`TelemetryInput`**: `lap_number`, `current_soc_mj`, `lap_start_soc_mj`
(optional — drives the SoC-swing check), `lap_energy_deployed_mj`,
`gap_to_car_ahead_s` (optional), `overtake_qualified_last_lap` (bool,
default `False` — true only if this car was within the gap threshold on
the *immediately preceding* lap; use-it-or-lose-it, the calling
orchestrator must not carry `True` forward more than one lap).

**`GateResult`**: `legal_modes`, `violations` (dict, always all 5
mode-keys present, `[]` for legal modes), `base_cap_mj` (**dict, not a
scalar** — the bonus makes the cap mode-dependent),
`qualifies_for_overtake_bonus_next_lap` (bool, threaded by the caller into
next lap's `TelemetryInput`).

**Binding design decisions (do not relitigate without new information):**
- **The gate enforces legality, not viability.** A mode with 0.1 MJ of
  remaining legal budget is still legal — whether it's worth using is
  Stage 2's job. Don't add a "not worth it" pruning rule here.
- **The SoC-swing check fails open** (skips silently, logs a note) when
  `lap_start_soc_mj` is `None`, rather than failing closed. A deliberate
  demo-usability choice — flagged as a candidate for fail-closed in a
  production/safety-certified build. Don't change the default without
  flagging it as a safety-posture change.
- **`USE_OVERTAKE_BONUS_MODE` does not re-check the gap** — only the
  banked flag. Spending a banked bonus after the gap has since closed is
  legal; whether it's still tactically wise is Stage 2's job (same
  legality-not-viability principle, applied to the new mechanic).

**Naming**: the interactive demo concept once called the "Judge Sabotage
Slider" is now the **Compliance Probe** — push telemetry to the legal
boundary and watch which modes get rejected, with the specific violated
rule cited via `violations[mode]`. The dashboard's `ComplianceProbe`
component (§12) already uses this name — keep it consistent everywhere,
including backend code comments/docstrings.

## 6. Rival Energy State Estimator (`rival_estimator.py`)

No F1 team publishes ERS state of charge for any car — not even your own
team gets a rival's. This module infers a **posterior distribution** over
a rival's SoC from kinematic proxies (a particle filter), not a point
value.

**Reconciling with this project's own binding rule**: an earlier,
rejected version of this idea (acoustic FFT on broadcast audio) came with
a binding rule — its output "must be a labeled, confidence-scored
estimate feeding a context/narration layer only — never a value the
regulatory gate or planner treats as ground truth." This module feeds
Stage 2's Monte Carlo and Stage 3's confidence gate directly, which
appears to conflict with that rule on its face. The reconciliation,
deliberate and stated here so it's a recorded decision, not an implicit
one:
- The estimate propagates as a **distribution** (`mean_soc_mj` +
  `std_soc_mj`), sampled per-iteration inside the Monte Carlo — never
  collapsed to a single point value asserted as fact anywhere downstream.
  This is the same treatment the planner already gives its own
  `ModeDynamics` priors.
- It **never reaches Stage 1.** `TelemetryInput` and `RegulatoryGate` take
  no rival-estimate input at all — legality stays based only on the car's
  own verified telemetry. Enforced at the module level: `rival_estimator.py`
  may import shared constants *from* `rule_gate.py`; `rule_gate.py` must
  **never** import from or reference `rival_estimator.py`. That one-way
  asymmetry is the concrete, checkable form of "never reaches Stage 1."
- Stage 3 is made structurally **more cautious**, not more trusting, when
  the estimate's uncertainty is high (§8) — the system hedges rather than
  trusts an uncertain estimate. That's what keeps this consistent with
  "never ground truth" in spirit, not just in the letter of "it's
  technically a distribution."

**Observables — expanded from the original 2-signal scope.** The first
draft trimmed this to `terminal_speed_kmh` and `clipping_point_fraction`
to stay lightweight. The team deliberately re-scoped this to a fuller,
still-tractable set, because the demo story ("we infer this from
observable behavior") is stronger with real breadth behind it:

| Field | What it captures | Why it's legitimate |
|---|---|---|
| `terminal_speed_kmh` | Peak straight-line speed | Direct proxy for power available at that moment |
| `clipping_point_fraction` | Where on the straight the speed trace flattens (0-1) | Proxy for how early the power-limited taper kicks in |
| `corner_exit_accel_g` | Longitudinal acceleration on corner exit | Higher deployment enables harder exit acceleration, up to a traction ceiling — this is the "corner-exit acceleration gradient" signal from the project's original rival-estimator pitch, reinstated here |
| `sector_delta_s` | Rival's sector time vs. their own rolling baseline for that sector | A standard, real, FIA-timing-derived quantity every team already receives; a genuine pace/deployment proxy independent of the straight-line signals above |

All four are things every team already gets from FIA timing/GPS for every
car on track — nothing here requires access any team lacks. "ERS
deployment pattern" and "previous lap behavior" (both named in early
brainstorming) are **not** separate fields: the *pattern* is what these
four signals look like *together*, and "previous lap behavior" is already
captured by the filter's own recursive structure (`n_observations`,
persistent particle weights across calls) — the posterior after lap 14 is
already informed by laps 1-13, that's what a particle filter *is*. Adding
a fifth field to represent "history" would be redundant with the
mechanism itself.

**`RivalEstimatorConfig`** (frozen dataclass): `n_particles=1000`,
`soc_min_mj=0.0`, `soc_max_mj=9.0` (mirrors `GateConfig.max_deployment_per_lap_mj`
— import it, don't retype it, so the two never drift apart),
`process_noise_std_mj=0.3`, `observation_noise_std_speed_kmh=5.0`,
`observation_noise_std_clip_fraction=0.08`,
`observation_noise_std_accel_g=0.15` (new), `observation_noise_std_sector_delta_s=0.12`
(new), `expected_soc_drift_per_lap_mj=-0.5`,
`ess_resample_threshold_fraction=0.5`, `default_seed=42`. The predict-step
drift is still a single configurable constant — this deliberately does
not jointly infer the rival's own mode choice, which would be a much
larger undertaking than this module's scope calls for even after the
expansion.

**`RivalStateEstimator`**: `predict()` advances particles by the drift
constant plus process noise, clipped to `[soc_min, soc_max]`. `update(observation)`
reweights particles by a Gaussian likelihood combining **all four**
observables, each comparing a particle's *expected* kinematics at that
SoC against the *actual* observation:
- `expected_speed`/`expected_clip` — unchanged, reuse Stage 1's taper
  curve as an evidence proxy (a repurposing of those constants for a
  different purpose than their regulatory meaning, not a regulatory
  claim itself — document as such).
- `expected_accel_g = baseline_accel_g + (soc / soc_max) * accel_gain_g`
  (new illustrative constants, e.g. `baseline_accel_g ≈ 1.0`,
  `accel_gain_g ≈ 0.3`) — more SoC, more deployable exit acceleration.
- `expected_sector_delta_s = -(soc / soc_max) * sector_gain_s` (new
  illustrative constant, e.g. `sector_gain_s ≈ 0.4`) — more SoC, a more
  negative (faster) sector delta.

The four per-observable log-likelihoods are summed (independence
assumption, standard for a first-pass particle filter), max-subtracted
before `exp` for numerical stability, then normalized and resampled via
systematic resampling when effective sample size drops too low.
`estimate()` returns the weighted mean/std as a `RivalSocEstimate`
(`mean_soc_mj`, `std_soc_mj`, `n_observations`). Fully vectorized NumPy,
seeded RNG, same conventions as the rest of the project (§13). All four
new constants (`baseline_accel_g`, `accel_gain_g`, `sector_gain_s`, the
two new observation-noise stds) are engineered/illustrative, same caveat
as `ModeDynamics` — not measured from real car data.

**Validation**: besides standard unit tests, this module has a synthetic
recovery test — generate observations from a *known*, hidden SoC using
the estimator's own observation model plus injected noise, run the
filter, and confirm the recovered mean converges within tolerance and
`std_soc_mj` shrinks as evidence accumulates. This is the standard
validation approach for a latent-variable filter, and it's the answer to
a judge asking "how do you know this estimator works" — a unit-test suite
alone doesn't answer that question, this test does.

## 7. Stage 2 — Monte Carlo Planner (`planner.py`)

**There is no separate "Energy State Model" module** — this is worth
saying explicitly because the concept (track current SoC, deployable
energy, reserve, recent trend, and the energy cost of each candidate
action; carry that state forward as actions are simulated) is real and
load-bearing, it's just not its own file. `TelemetryInput` (§5) is the
snapshot; the *forward-simulated* state it implies lives here, inside each
Monte Carlo iteration, and — for multi-lap comparisons — inside
`opportunity_engine.py`'s lap-to-lap carry described in §9. If a teammate
goes looking for `energy_state.py`, it doesn't exist and shouldn't; the
state-tracking is distributed across these two places by design, not
missing.

`ModeDynamics` (frozen dataclass, one row per mode — now 5 rows) holds
racecraft priors: `mean_laptime_delta_s` (negative = faster/better,
`BALANCED_MODE` = 0.0 baseline), `std_laptime_delta_s`,
`overtake_success_prob`. **This last field means different things by
mode** — for `ARM_OVERTAKE_MODE` it's the probability of *qualifying*
(closing to the gap threshold); for `USE_OVERTAKE_BONUS_MODE` and
`PUSH_MODE` it's the probability of *completing* an overtake. Same field
name, different semantics — document this explicitly, it's an easy thing
to miss.

**These priors are engineered, not measured.** The simulation math is
correct regardless of these constants; their realism is not validated.
This is the single most important calibration gap in the project — never
present the planner's numeric output as validated without repeating this
caveat, in docstrings and in any user-facing summary.

`PlannerConfig`: `n_iterations = 10_000` (fixed and reported in output,
never varied — see §8 for why a variable rollout count would let the
confidence gate manufacture significance), `default_seed`, shared taper
constants (290/355/337 km/h — these describe power-unit hardware
behavior common to all modes, not a per-mode strategy choice, so they
live in config rather than being duplicated across 5 `ModeDynamics` rows),
`overtake_gap_max_bonus`, `failed_overtake_penalty_s`,
`defense_penalty_weight = 0.3` (deliberately modest, not higher, so a
single noisy rival estimate can't swing outcomes nearly as much as if it
were asserted as fact).

`PlanningContext`: `gap_to_car_ahead_s` (optional), `rival_soc_estimate:
Optional[RivalSocEstimate] = None`. Deliberately does *not* carry
`overtake_qualified_last_lap` — that fact belongs exclusively to Stage
1's `legal_modes` output; duplicating it here would create two sources of
truth that could drift apart.

**Seeded determinism**: `numpy.random.SeedSequence(seed).spawn(5)` gives
one independent child RNG stream per mode, in a fixed canonical order —
**not** `legal_modes`'s order. Without this, a mode's samples would
silently depend on which *other* modes happened to be legal that call,
breaking the seeded-determinism guarantee this project's eventual replay
("Time Machine") feature depends on. This must be `.spawn(5)`, not
`.spawn(4)` — a leftover 4 would silently corrupt the newest mode's
stream.

**Rival-estimate modulation** (applies only to `ARM_OVERTAKE_MODE` and
`USE_OVERTAKE_BONUS_MODE`, only when a rival estimate is supplied, using
that mode's own seeded stream): sample a rival SoC per Monte Carlo
iteration from `Normal(mean_soc_mj, std_soc_mj)`, clip to
`[0, max_deployment_per_lap_mj]`, convert to a 0-1 "defense factor," and
scale the effective overtake-success probability down by
`defense_penalty_weight * defense_factor`. When no rival estimate is
supplied, behavior is byte-identical to the no-rival-estimator case. This
mapping is engineered/illustrative, same caveat as `ModeDynamics` — not a
claim about real rival-car defensive physics.

`get_raw_samples(result, mode)` is keyed by `PlannerResult.run_id` (a
monotonic counter), not just by mode — caching only "the most recent
`plan()` call's" samples would silently corrupt an earlier `PlannerResult`
handed to Stage 3 after a second `plan()` call. Raises `ValueError` on a
stale/unknown `run_id`. Sharpe ratio (`-mean/std`) is capped at ±999 when
variance is near zero, never returned as `inf`/`NaN` — a numerical-
stability fix so downstream statistics always receive finite inputs.

## 8. Stage 3 — Confidence Gate (`confidence_gate.py`)

**Why a plain significance test doesn't work here**: standard error scales
as `s/√n`. With `n_iterations` fixed at 10,000, `s/√n` is tiny, so almost
any nonzero true difference between two modes clears a naive `t ≥ 2.0`
threshold — the gate would measure "is n big enough" (always yes, since n
is fixed and large), not "does the difference actually matter." Under
that design, abstention — this project's signature behavior — becomes
nearly impossible to trigger.

**The fix — a two-part gate.** Both statistical reliability AND practical
significance must pass, together with DCLI and the rival-confidence
check, before a non-`BALANCED_MODE` recommendation reaches Stage 4:

1. **Statistical reliability**: compute a one-sided 95% confidence lower
   bound on the difference between the top two ranked modes' means
   (`diff = mean(runner_up) − mean(top)`, positive = top mode confidently
   better — same sign convention throughout, see the warning below), using
   the existing Welch-Satterthwaite degrees of freedom:
   `ci_lower_bound_s = diff − t_crit(confidence_level, df) × se`. Passes
   when `ci_lower_bound_s > min_actionable_laptime_delta_s` — **not**
   merely `> 0`. A one-sided test is the methodologically correct choice
   here (this is a superiority test — does the top mode beat the runner-up
   by a margin — not a two-sided "is there any difference" test).
2. **Practical significance**: `min_actionable_laptime_delta_s = 0.05`
   (seconds, laptime-equivalent) is the default floor for every
   comparison. When either top-two mode is `ARM_OVERTAKE_MODE` or
   `USE_OVERTAKE_BONUS_MODE`, an additional check runs on the
   overtake-probability axis with `min_actionable_overtake_prob_pp = 0.03`
   (3 percentage points) — both required when applicable, since a
   laptime-only view can understate what matters for overtake-flavored
   comparisons.
3. **DCLI (Driver Cognitive Load Index)**: a second, fully independent
   gate — not a substitute for the significance test. Combines three
   normalized [0,1] signals (time since last mode change, recent laptime
   variability, proximity pressure) into a 0-100 score; passes below 60.
   Fully invented — no source document exists for this formula — flagged
   illustrative, same pattern as `ModeDynamics`.
4. **Rival confidence**: `rival_confidence_passed = (rival_estimate is
   None) or (rival_estimate.std_soc_mj <= 1.5)`. This is what makes "the
   gate falls back to `BALANCED_MODE` when rival uncertainty is high" a
   direct, testable rule — not just an emergent side effect of the wider
   Monte Carlo variance a noisy rival estimate also produces in Stage 2
   (§7). Both effects are real and intentionally coexist: one is genuine
   outcome-uncertainty propagation, the other a direct sanity check on
   the estimator's own confidence.

`n_iterations` is fixed and echoed into `ConfidenceGateResult` precisely
because a *variable* rollout count would let the gate manufacture
statistical significance by running longer — fixing and reporting it is
what makes the test honest.

**Sign-convention warning — the single highest-risk correctness point in
this entire project**: under "negative delta = faster/better," the
difference must be computed as `mean(runner_up) − mean(top)`, runner-up
first. Subtracting in the other order silently inverts the whole gate's
pass/fail logic with no error — a confidently-better top mode would
produce a negative statistic and wrongly fail. Test this explicitly and
prominently; do not let an implementation "simplify" the subtraction
order.

`ConfidenceGateResult`: `recommended_mode`, `stage2_recommended_mode`
(the original top pick, preserved even when overridden — Stage 4 needs
this to narrate *what changed*), `runner_up_mode`, `t_statistic`,
`degrees_of_freedom`, `ci_lower_bound_s` (the actual bound, not just a
boolean — this is exactly the kind of already-verified number Stage 4's
narrator should use, e.g. "confident of at least a 0.08s gain"),
`statistical_reliability_passed`, `practical_significance_passed`,
`dcli_score`, `dcli_passed`, `rival_confidence_passed`, `n_iterations`,
`overridden`, `override_reason` (when multiple gates fail, name all of
them, not just the first).

## 9. Opportunity Horizon (`opportunity_engine.py`) — multi-lap strategy comparison

**The reframe this exists for**: ChronoPace's original question was "is
this mode legal and worth it *this lap*?" The sharper question — and the
one the product is now built around — is "is *this* the best moment to
spend limited energy, or will a better opportunity appear later?" That
question cannot be answered by a single-lap comparison; it requires
comparing a small number of complete **future strategies**, not just five
options for the next lap.

**This is a new module, not a rewrite of Stage 2.** `planner.py` keeps
doing exactly what §7 describes — one legal-mode comparison, one lap.
`opportunity_engine.py` sits on top of it and **chains repeated calls** to
that same single-lap machinery across a bounded future horizon, once per
candidate strategy, then hands the aggregated results to an extended
Stage 3 comparison. Nothing about the single-lap physics changes; what's
new is comparing *sequences* of laps instead of one lap.

**Candidate strategies — a fixed, named set, not an open search.** Bounded
on purpose: an unconstrained multi-lap optimization is a much harder
problem than a hackathon needs, and a strategist reading the output needs
named options, not a search result. A configurable `delay_laps` list
(illustrative default `[0, 2, 5]`) plus a permanent `HOLD` baseline:
- **`ATTACK_NOW`** (`delay_laps = 0`) — attempt the overtake sequence
  starting this lap (`ARM_OVERTAKE_MODE` → `USE_OVERTAKE_BONUS_MODE` the
  following lap), `BALANCED_MODE` for the remainder of the horizon.
- **`WAIT_N`** (one per entry in `delay_laps` greater than 0) —
  `BALANCED_MODE`/`CONSERVE_MODE` for `N` laps, then the same attempt
  sequence, then `BALANCED_MODE` for the remainder.
- **`HOLD`** — `BALANCED_MODE` for the entire horizon. The safe baseline
  every other strategy is measured against, same role `BALANCED_MODE`
  already plays in the single-lap gate.

**Simulation mechanism.** For each strategy, for each of `n_iterations`
Monte Carlo draws: walk the horizon lap by lap, drawing that lap's
`ModeDynamics` sample exactly as `planner.py` already does (including
rival-estimate modulation where applicable), carrying the simulated
energy state forward lap-to-lap using the corrected FIA constants (§5),
and accumulating the laptime-delta contribution. The result is one sample
array per strategy, the same shape `get_raw_samples()` already returns
per mode — the extension is that each "sample" is now a summed
multi-lap outcome instead of a single lap's.

**Uncertainty must widen with distance, honestly.** A rival estimate
computed from *this* lap's kinematics is not equally trustworthy 5 laps
out — nothing re-observes the rival in between. Effective standard
deviation at horizon offset `d` laps is scaled by a new, explicitly
illustrative `PlannerConfig` constant: `effective_std = base_std * (1 +
horizon_uncertainty_growth * d)` (default `horizon_uncertainty_growth ≈
0.15`, i.e. roughly 15% wider per lap of lookahead), applied to both the
mode's own `std_laptime_delta_s` and the rival estimate's `std_soc_mj`
when either is used inside a horizon-offset lap. This is what keeps a
"wait 5 laps" recommendation from claiming false confidence — it is
mechanically required to look less certain than "wait 2 laps," which
should in turn look less certain than "attack now."

**Stage 3 extension, not a new gate design.** The exact same two-part
significance construction from §8 (statistical reliability CI, practical
significance, DCLI, rival confidence) applies to the **top-ranked
strategy vs. the runner-up strategy's aggregated horizon outcome**,
instead of top mode vs. runner-up mode. Two new fields express the
"opportunity cost" framing directly, rather than leaving the viewer to
compare two numbers themselves: `foregone_strategy` (the runner-up
strategy's name) and `foregone_value_gap` (how much aggregated value the
chosen strategy beats it by) — this is what lets the eventual narration
say "attacking now beats waiting 2 laps by 0.3 expected positions,"
rather than just naming a winner.

**Build order note**: this depends on Stage 2's single-lap machinery
existing and tested, and its Stage 3 extension depends on Stage 3 being
built first. It is an addition to the build sequence in §17, not a
reordering of it — build the single-lap pipeline (Stages 1-3 + rival
estimator) completely first, exactly as already planned, then add this
layer on top.

## 10. Stage 4 — LLM Narrator (`narrator.py`) — input contract

Not built, and per §2/§17 build order, not to be started before Stage 3
(and ideally Opportunity Horizon) are green. Specified here now anyway,
because Stage 3's output fields (§8) should be designed with this consumer
in mind, not bolted on later.

**Proposed input JSON** — the boundary between deterministic intelligence
and narration, illustrative values only:

```json
{
  "decision": "USE_OVERTAKE_BONUS_MODE",
  "confidence": 0.82,
  "expected_position_gain": 1.2,
  "energy_cost": 2.1,
  "rival_energy_estimate": { "mean": 2.1, "uncertainty": 0.6 },
  "reason_codes": [
    "STRONG_OVERTAKE_OPPORTUNITY",
    "LOW_ESTIMATED_RIVAL_RESERVE",
    "SUFFICIENT_OWN_ENERGY",
    "CURRENT_OPPORTUNITY_OUTVALUES_PROJECTED_WAIT"
  ]
}
```

**This is a summary view, not a new computation.** Every field here must
be assembled by Python from fields already specified elsewhere in this
document — `ConfidenceGateResult` (§8), extended by Opportunity Horizon
(§9) once that exists. Two fields need a defined, deterministic derivation
before Stage 4 is built (open — flagged, not yet decided):
- **`confidence`** (a single [0,1] scalar) must reduce from
  `ci_lower_bound_s`'s margin above the practical-significance floor
  and/or `dcli_score` — candidates to evaluate at build time, not a
  second, independently-eyeballed number that could disagree with
  `statistical_reliability_passed`/`practical_significance_passed`.
- **`reason_codes`** is a **fixed vocabulary** Python selects from based on
  which gates passed/failed and which thresholds were crossed (e.g. a
  `RIVAL_UNCERTAINTY_HIGH` code when `rival_confidence_passed` is
  `False`, a `CURRENT_OPPORTUNITY_OUTVALUES_PROJECTED_WAIT` code when
  Opportunity Horizon's top strategy is `ATTACK_NOW`) — never
  LLM-generated. The LLM narrates the codes it's given; it does not invent
  new ones or omit ones that don't fit a nice sentence.

**Target narration style** (LLM output, given the JSON above):

```text
Decision: USE_OVERTAKE_BONUS_MODE
Confidence: 82%
Reasons:
- Strong overtake opportunity
- Low estimated rival reserve
- Sufficient own energy
- Current opportunity exceeds projected future value
```

**Restating §2 specifically for this stage** — the LLM must NOT: change
`0.82` to any other value, change the decision/action, alter any energy
number, override a legality result, invent a reason code not present in
the input, or introduce any race-state fact not given to it. If the LLM
is removed entirely, the JSON above is still a complete, useful,
machine-readable decision — that's the test for whether Stage 4 stayed in
its lane.

## 11. Core Demo Scenarios

Build the product around a small number of fixed, reproducible scenarios
rather than an open-ended live demo — the point to land with judges is
concrete and specific: **the same overtake opportunity can produce a
different optimal decision depending on our energy state and how far out
the horizon looks.**

- **Scenario A — attack.** High own SoC, low rival estimate, high current
  opportunity → high confidence → `USE_OVERTAKE_BONUS_MODE` (ATTACK).
- **Scenario B — hold.** Same opportunity and same low rival estimate as
  A, but **low own SoC** → `BALANCED_MODE` (HOLD/WAIT). Note for whoever
  implements this: it isn't yet decided *which mechanism* produces this
  outcome — Stage 2 may simply rank `BALANCED_MODE` first once low SoC
  changes the energy-cost tradeoff, or Stage 2 could still rank an
  aggressive mode first with Stage 3 then abstaining on confidence
  grounds. Both are legitimate demonstrations of the system; which one
  actually happens depends on the real `ModeDynamics`/gate numbers once
  built. Don't hard-code the dashboard to assume a specific one of these
  before it's known.
- **Scenario C — horizon comparison.** Requires Opportunity Horizon (§9)
  built. Same opportunity, compare `ATTACK_NOW` vs. `WAIT_2` vs. `WAIT_5`
  vs. `HOLD` side by side, uncertainty visibly widening with distance.

The existing `DecisionBanner` "Demo: toggle scenario" control (§12)
currently flips between a generic pass-case and a generic override-case —
it should eventually be rebuilt around these three named scenarios
specifically, once real fixtures exist to drive them. Tracked as UI work
in §17 step 11, not done yet. Once the backend exists, these must be real
computed outputs from specific seeded `TelemetryInput` fixtures — three
more hand-typed JS objects would repeat the exact problem this document's
opening section warns about (a mock that looks like intelligence but
isn't).

## 12. Dashboard UI (`frontend/`) — built, live-verified against the current hardened backend (rewritten 2026-09-12)

**This entire section was rewritten from scratch on 2026-09-12** after a
live audit against the running backend (chronobrain repo, commit
`01817ec`) — every claim below was checked against actual source code and
a real, running `POST /api/v1/decision` response, not carried over from
an older pass. Anything from an earlier version of this section that
isn't repeated here should be treated as superseded.

Unlike Stages 1-4 as designed in this document, this part genuinely
exists on disk and runs. It started as a **visual prototype of what
ChronoPace looks like once a backend is real**, and is now a fully wired
integration: it fetches from a real, live backend when one is configured
and reachable, and falls back to the original hand-typed mock data
otherwise. Both modes render through the exact same components; nothing
on screen looks structurally different depending on which one is active,
except the handful of fields the live backend has no equivalent for
(§12.7, below).

### 12.1 CURRENT LIVE ARCHITECTURE

```
ChronoPace Engine (separate repo: github.com/siddiquezain/chronobrain,
                    local checkout ../engine — NEVER copied into this repo)
        ↓  uvicorn app.main:app --reload --port 8000
POST /api/v1/decision                              (also GET /api/v1/replay/... for historical)
        ↓  raw JSON — DecisionSnapshot
frontend/src/services/api.js                       (fetchDecision, fetchReplay*, thin fetch wrapper)
        ↓
frontend/src/services/adaptDecision.js              (pure reshape — no computation, no strategy logic)
        ↓
frontend/src/services/DashboardDataContext.jsx      (fetch-once, live/fallback provider, useDashboardData())
        ↓
UI components (DecisionBanner, RivalEstimator, MonteCarloPlanner,
                OpportunityTimeline, ComplianceProbe, EnergyStatus,
                FooterStrip, HistoricalReplayControl, StrategicRivalTimeline)
```

The two repositories communicate **only** over this HTTP boundary. The
frontend contains no backend Python code, no duplicated strategy math,
and no parallel decision logic — verified by repeated `grep` sweeps
(`Math.random`, mode-assignment conditionals, confidence-threshold
overrides, rival/Monte Carlo recomputation — all absent from `src/`).

### 12.2 CURRENT API

**Canonical endpoint**: `POST /api/v1/decision`. This is the *only*
strategy-data source the dashboard uses — legacy paths the backend still
exposes (`/api/race/*`, `/api/energy/*`, `/api/overtake/*`,
`/api/strategy/*`, `/api/simulation/*`) are **not called anywhere** in
`src/` (verified by grep). Request body, matching the live
`/openapi.json`'s `DecisionRequest` schema exactly:

```json
{
  "source": "synthetic",
  "scenario": "B",
  "seed": 42,
  "total_laps": 50,
  "lap": 25,
  "with_narrative": true
}
```

`source` is `'synthetic'` or `'fastf1'`; `scenario` is `A`-`E` (§11);
`overrides` (`InputOverrides`) and `fastf1` (`FastF1Spec`) exist on the
schema but are not sent by the dashboard's default synthetic path — only
`HistoricalReplayControl`'s replay calls use the FastF1-facing routes
(§12.8). All fields are optional server-side; the values above are what
`DashboardDataContext.jsx`'s `SYNTHETIC_PARAMS` actually sends.

**Discovery/replay endpoints** (all under `/api/v1/replay/`, §12.8):
`GET /seasons`, `GET /races?season=`, `GET /sessions?season=&race=`,
`GET /historical/{race}/{lap}?full_snapshot=true[&driver&rival&seed&season&event&session]`,
`GET /historical/{race}/{lap}/timeline`.

### 12.3 CURRENT FRONTEND COMPONENTS

**Stack**: React 19 + Vite. `@react-three/fiber` + `@react-three/drei` +
`three` for the 3D car viewport. Plain CSS Modules (no Tailwind/UI kit).
No routing, no state management library; local `useState`/`useRef` plus
one context (`DashboardDataContext`).

**Layout** (`App.jsx`): `Header` (wordmark + session/lap/car/LIVE-or-REPLAY
cluster + `HistoricalReplayControl` toggle) → a 3-column main row → a
2-item support row → `FooterStrip`.
- **Left column**: `DecisionBanner` → `RivalEstimator`.
- **Center column**: `RacingScene` (the car hero, presentation-only, no
  data) → `MonteCarloPlanner`.
- **Right column**: `CircuitMapPlaceholder` (honest, unimplemented — no
  fake track data) → `OpportunityTimeline`.
- **Support row**: `EnergyStatus` — `ComplianceProbe` (`compact`).

| Component | Backend source | Current state, verified live 2026-09-12 |
|---|---|---|
| `DecisionBanner` | `decision` + `confidence` blocks | Mode via `MODE_LABELS` (unchanged 5-mode map, §4), a `PLANNER` row when the gate overrides the planner's Stage-2 pick, an `ACTION` row (`decision.action`, e.g. `ATTACK_NOW`), a decision-confidence %, the "WHY" reasons text, and 5 gate pills — **RELIABILITY, SIGNIFICANCE, DRIVER LOAD, RIVAL CONF., DATA QUALITY** (a 5th pill, `dataQuality`/`confidence.data_quality_passed`, added with the hardening contract — not 4 anymore). All from real `ConfidenceBlock`/`DecisionBlock` fields; CI-bound/DCLI/t-stat/rival-σ stats grid is fully live. |
| `RivalEstimator` | `rival` block | **Redesigned 2026-09-11** as "RIVAL ENERGY STATE" (was "RIVAL ENERGY ESTIMATOR") — see §12.9 for the honesty rules this redesign enforces. Shows `ESTIMATED ENERGY` (mean) and `±uncertainty` (std) as two visually distinct values (never summed), an `OBSERVATIONS` count, a `STATE BELIEF` L/M/H% distribution (falls back to a bucket label only when `distribution` is absent), an honest mean±std *range bar* (not a fabricated Gaussian curve — deliberately, see the component's own header comment), a `CONFIDENCE GATE` PASSED/FAILED pill reading `confidence.rival_confidence_passed` directly (never a client threshold), `EVIDENCE QUALITY` and `P(DEFEND)`, and — only in historical replay when the tick-level selector actually ran — a "N changes this lap" readout with a `StrategicRivalTimeline` toggle. `clipping_point`/`terminal_speed_kmh` have no field anywhere on the current contract and are **not rendered** anywhere in this component (confirmed by grep — no such field is read). |
| `MonteCarloPlanner` | `monte_carlo` block | 5-mode ranked table, columns **MODE / VS BALANCED / Δ LAP / ENERGY** (an `ENERGY` cost column was added with the hardening pass). "Planner Preference" (renamed from "Best Strategy" to clarify it's the planner's pick, which the confidence gate may still override) / Expected Gain / Risk summary row. A counterfactual row — **RUNNER-UP / VALUE GAP / ATTACK COMPLETION** — reads `monte_carlo.runner_up_mode`, `.mode_value_gap_s`, and the top mode's `attack_completion_probability`; shown only when all three are non-null. `overtakeProbability` (labelled "VS BALANCED" throughout, correctly — it is P(mode beats the BALANCED baseline), not P(overtake completion)) drives the bar directly, no client regex/rescale. |
| `OpportunityTimeline` | `opportunity` block | No longer a placeholder or a fabricated 3-node bonus view — a real "HORIZON STRATEGY RANKING" table from `opportunity.ranked_strategies` (`ATTACK_NOW`/`WAIT_N`/`HOLD`, §9's naming), each row showing horizon delta ± std and, when non-null, a downside-probability subscript (`N%↓`) and an attack-completion probability. Footer shows `FOREGONE VS {runner-up strategy}`, the recommended strategy's attack-completion probability ± std, and the current window's overtake probability — all guarded against null, nothing fabricated when the backend omits a field (e.g. `HOLD`'s downside probability is correctly absent, not zero-filled). |
| `ComplianceProbe` | `compliance` block | Real `compliance.checks[]` (rule/provenance/status/detail) rendered as PASS/BREACH/INFO rows — a new `info` status (MGU-K power ceiling: "no modelled peak") renders as a distinct badge, not forced into pass/fail. |
| `EnergyStatus` | `energy` block | Deployable SoC, lap-deploy MJ, MGU-K peak, and an `energy_is_modeled`-driven title (`CHRONOPACE ENERGY STATE` vs `CHRONOPACE MODELED ENERGY STATE`) so the UI never implies a modeled number was measured. |
| `HistoricalReplayControl` | `/api/v1/replay/*` | Season → Grand Prix → Session discovery (§12.8) plus the original curated-race replay flow; both paths feed the same dashboard. |
| `StrategicRivalTimeline` | `/replay/historical/{race}/{lap}/timeline` | Tick-cadence (~4 Hz real FastF1 sample rate) strategic-rival change visualization, fetched and cached only on request (never bulk-fetched), §12.8. |
| `FooterStrip` | `meta.data_mode` | `DATA MODE: LIVE BACKEND · SYNTHETIC`, `... · HISTORICAL REPLAY · REAL TELEMETRY`, or the mock string — never a fixed `128 Hz` data-rate claim (removed, §12.9). |
| `RacingScene`, `CircuitMapPlaceholder`, `GlassPanel`/`Icons` | — | Unchanged — presentation-only, no backend equivalent, not touched by any integration pass. |

### 12.4 CURRENT DATA FLOW

Exactly the diagram in §12.1. One `useDashboardData()` hook; every
component reads through it, never `mockTelemetry.js` directly (the one
exception, `MODE_LABELS`/`ROLE_LABELS`, is a display-text lookup, not
data). `DashboardDataContext.jsx` fetches once per page load (synthetic
path) and additionally owns the `historical` state slice
(season/race/session discovery, lap replay, tick-timeline cache) used by
`HistoricalReplayControl` and `RivalEstimator`'s timeline toggle.

### 12.5 FIVE DEPLOYMENT MODES — unchanged, still five

`CONSERVE_MODE`, `BALANCED_MODE`, `ARM_OVERTAKE_MODE`,
`USE_OVERTAKE_BONUS_MODE`, `PUSH_MODE` — see §4 for the full backend
semantics; `MODE_LABELS` (`mockTelemetry.js`) is still the only
presentation-layer relabeling, unchanged, and `ARM_OVERTAKE_MODE` is
never collapsed into `USE_OVERTAKE_BONUS_MODE` anywhere in the UI —
verified live 2026-09-12: a single `/api/v1/decision` call's
`monte_carlo.ranked_modes` renders all 5 as distinct rows.

### 12.6 BACKEND → FRONTEND FIELD MAPPING — current, verified live 2026-09-12

The authoritative, line-by-line version of this table lives as inline
comments in `adaptDecision.js` — read that file before touching the
mapping. Summary, confirmed against a real running response (not assumed
from a spec):

| Dashboard field(s) | Backend field(s) | Status |
|---|---|---|
| Mode, action, decision confidence, stage2 mode, override reason | `decision.*` | **Live** |
| CI lower bound, t-statistic, DCLI score, all 5 gate booleans (incl. `dataQuality`) | `confidence.*` | **Live** — was 4 static gates before 2026-09-06, now all 5 real |
| Rival mean/std, n_observations, bucket, distribution (L/M/H), confidence, p_defend, evidence_quality, posterior_health, baseline_ready | `rival.*` | **Live** |
| Strategic rival identity (driver/role/position/gap/ahead/relevance) | `rival.driver`/`.role`/`.strategic_*`/`.relevance_score` | **Live** — always `null` on synthetic responses (no full field to pick an opponent from), populated on historical/FastF1 replay |
| Monte Carlo 5-mode table, runner-up mode, value gap, attack-completion probability, energy cost per mode | `monte_carlo.*` | **Live** — `runner_up_mode`/`mode_value_gap_s`/`attack_completion_probability`/`energy_cost_mj` added by the 2026-09-11 hardening pass |
| Opportunity ranked strategies, foregone strategy/value gap, window overtake probability, attack-completion probability ± std, utility std, downside probability | `opportunity.*` | **Live** — the last four per-strategy fields added by the same hardening pass; `null`-guarded, never fabricated when absent |
| Compliance checks (rule/provenance/status/detail, incl. `info` status) | `compliance.checks[]` | **Live** |
| Energy: SoC, lap-deployed/recovered MJ, MGU-K peak, `energy_is_modeled` | `energy.*` | **Live** |
| `carNumber` | — | **Static (mock)** — no driver/car field on `SnapshotMeta` |
| `terminalSpeedKmh`, `clippingPointFraction` | — | **No live field exists; not rendered anywhere** (not just static-fallback — the current `RivalEstimator` doesn't read these fields at all) |
| Compliance rows' discrete value/limit/unit numbers, breach example | — | **Static (mock)** shape kept as ComplianceProbe's fallback; the real, live checks (`liveComplianceChecks`) are what's actually shown when connected |
| Track/weather/tyre footer strip, `dataRateHz` | — | **Static (mock)** / **suppressed** — the backend reports no per-decision telemetry cadence; a fixed `128 Hz` claim was fabrication and was removed |
| Confidence-gate override demo scenario (2nd state of "Demo: toggle") | — | **Static (mock)**, always — no live "override" scenario exists from a single decision call |

### 12.7 MOCK FALLBACK

`mockTelemetry.js` is unchanged in spirit: still the fallback shape and
still what renders when no backend is configured or reachable. Verified
live: an unset `VITE_API_URL`, a network failure, a non-2xx response, or
a timeout on the **synthetic** path all land in `DashboardDataContext`'s
catch block, which logs and renders the mock bundle with zero crash — the
dashboard never silently shows fabricated *historical* data instead
(§12.8's "no hindsight" rule is separate and stricter: a failed
historical/replay fetch sets `historical.error` and leaves the *main*
dashboard state untouched, it does not fall back to mock). `FooterStrip`'s
`DATA MODE` string is what tells you which of the three states
(mock / live synthetic / historical replay) is currently on screen —
always check it before trusting a screenshot.

### 12.8 Historical Race Replay & multi-race discovery (unchanged since 2026-09-09, still accurate)

`HistoricalReplayControl.jsx` — a judge-facing control in `Header`'s side
slot. Two ways to pick a race:
- **Featured/curated** — `GET /api/v1/replay/races` (no `season`), a
  small registry with sensible driver/rival defaults.
- **Browse other races (2019–2025)** — `GET /seasons` → `GET
  /races?season=` → `GET /sessions?season=&race=`, the live FastF1
  schedule, dynamically discovered, never a hardcoded list. Verified live
  2026-09-12: selecting season 2024 populates all 24 real 2024 rounds
  from the backend.

Either path calls `GET /api/v1/replay/historical/{race}/{lap}?full_snapshot=true[...]`
per lap (fired only on RUN REPLAY or one auto-play tick) and reads
`adaptDecision(raw.snapshot)` — `raw.snapshot` is byte-shape-identical to
`/api/v1/decision`'s own response, so the same adapter/components render
it, no historical-specific rendering path exists.

- **No hindsight**: only `race`/`lap`/`driver`/`rival`/`seed`/`season`/
  `event`/`session` are ever sent — never telemetry, never a future lap's
  data. Causal censoring is entirely the backend's responsibility.
- **Provenance labels**: "REAL TELEMETRY FastF1 · {race}" next to
  "MODELED Rival Energy · Opportunity · Monte Carlo · ChronoPace
  Decision" — never implies the historical car ran under 2026
  regulations. `Header`'s LIVE/REPLAY badge switches to amber "REPLAY"
  during historical mode (verified live 2026-09-12), green "LIVE"
  otherwise.
- **Failure is honest**: a failed historical fetch sets `historical.error`
  and shows "HISTORICAL REPLAY UNAVAILABLE" + the real error text — the
  main dashboard state is left untouched, never silently mocked.
- **Tick-level strategic-rival timeline** (`GET
  /replay/historical/{race}/{lap}/timeline`, `StrategicRivalTimeline.jsx`):
  only fetched on demand ("Show timeline"), cached by
  race+lap+driver+rival+season+event+session so it's never re-fetched for
  an already-seen key, and only offered when `rival.tick_level` (surfaced
  via `raw.summary.strategic_rival`, not the compact `rival` block) is
  true for that lap.

### 12.9 Honesty rules this UI enforces (binding, checked live 2026-09-12)

- Never sum a mean and its uncertainty and present it as "available
  energy" (`4.5 + 2.6 = 7.1`) — `RivalEstimator` shows `ESTIMATED ENERGY`
  and `±uncertainty` as two separate, clearly labeled numbers, and the
  range bar visualizes them as a *band*, not an addition. Verified: no
  component anywhere computes `mean + std` and displays it as a total.
- Never draw a probability density curve from mean/std alone (a
  Gaussian shape implies more knowledge than two numbers support) — the
  old `PosteriorPlot` Gaussian-curve component was replaced by an honest
  range bar (§12.3).
- Never claim a fixed telemetry sample rate the backend doesn't report —
  the old fixed `128 Hz` footer claim is gone; `dataRateHz` is `null` and
  the row is suppressed rather than shown as a guess.
- Never show a rival-confidence PASS/FAIL by a client-side threshold on
  `rival.confidence` — always the backend's own
  `confidence.rival_confidence_passed` boolean.
- Never fabricate a field the backend doesn't currently expose
  (`clipping_point`, `terminal_speed_kmh`) — don't display it, and don't
  invent a placeholder value for it.

### 12.10 CURRENT LIMITATIONS

- **No frontend control to switch synthetic scenario A-E.** `DashboardDataContext`'s
  synthetic path hardcodes `scenario: 'B'` (§12.2); scenarios A/C/D/E are
  reachable today only via a direct API call (§12.13), not from the UI.
  The "Demo: toggle" button on `DecisionBanner` flips between a canned
  pass-case and a canned override-case — it does not call the backend
  with a different scenario. Adding a scenario picker is a real,
  reasonable next step, not yet built.
- **No Circuit Map** — `CircuitMapPlaceholder` is an honest empty
  placeholder, unchanged since the 2026-09-02 layout redesign.
  `opportunity.ranked_strategies`/`rival.strategic_*` fields already
  exist server-side and are unused by this component.
  Opportunity Horizon visualization now exists (§12.3's `OpportunityTimeline`
  row) but Circuit Map itself is still purely a placeholder.
- **No frontend build reproduction of Stages 1-4** — this repo still has
  zero backend Python; the pipeline behind the API is entirely external
  (§0/top of file).
- **`PosteriorPlot`-era n=0 edge case** — a pre-existing, unrelated,
  not-yet-fixed console error (`<path> attribute d: Expected number,
  "M0.0,NaN..."`) can appear on a lap where mean/std SoC are both `0.0
  MJ` (e.g. historical replay lap 1 with `n_observations=0`). Cosmetic
  only — the rest of the dashboard renders correctly around it. Flagged,
  not fixed, out of scope for an integration pass.
- **Cloudflare quick-tunnel URLs are ephemeral** — `frontend/.env.local`'s
  `VITE_API_URL` may point at a `trycloudflare.com` host that rotates or
  dies when the tunnel process restarts; treat `VITE_API_URL` as the
  stable configuration point, not any specific tunnel hostname.

### 12.11 HOW TO RUN BACKEND

Separate repo — from that repo's own root (e.g. `../engine` relative to
this one, **never** inside `frontend/`):

```bash
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify it's up: `curl http://localhost:8000/api/v1/health` → `200`.
Inside this Claude Code project, `.claude/launch.json`'s
`chronopace-backend` entry runs the equivalent command against the
checked-out engine repo path.

### 12.12 HOW TO RUN FRONTEND

```bash
cd frontend && npm install && npm run dev
```

(or the `chronopace-frontend` entry in `.claude/launch.json` — port 5173,
auto-falls-back if taken). Set `VITE_API_URL` in `frontend/.env.local`
and/or `frontend/.env.development.local` (the latter wins for `npm run
dev` per Vite's env-file precedence, restart required after changing
either — Vite only reads env files at server start). `frontend/.env.example`
documents the variable with no real value; never commit a real tunnel URL
or `.env.local`/`.env.development.local` themselves (both gitignored via
`*.local`).

### 12.13 HOW TO TEST LIVE API

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/openapi.json | less        # authoritative live contract — never assume an old one
curl -X POST http://localhost:8000/api/v1/decision \
  -H "Content-Type: application/json" \
  -d '{"source":"synthetic","scenario":"B","seed":42,"total_laps":50,"lap":25,"with_narrative":true}'
```

Determinism check: send the identical body 2-3 times and diff `decision`/
`rival`/`monte_carlo`/`confidence`/`compliance`/`reason_codes` — verified
byte-identical live 2026-09-12. Scenario check: swap `"scenario"` across
`A`-`E` and compare `decision.mode` (verified live: A→BALANCED, B→USE_
OVERTAKE_BONUS, C→CONSERVE, D→PUSH, E→BALANCED, at lap 25/seed 42) — the
backend's `/api/v1/demo/presets` + `/api/v1/demo/preset/{key}` endpoints
also expose named scenario pairs built specifically to demonstrate §11's
core differentiation (same opportunity, different own-energy override →
different mode).

### 12.14 DEMO SCENARIOS — what's real right now

**IMPLEMENTED, verified live 2026-09-12**: the core "same opportunity,
different energy state → different decision" demonstration (§11) is real
and reproducible today via the backend's own built-in presets — no
frontend scenario picker needed to prove it, just two direct API calls:
- `POST /api/v1/demo/preset/HIGH_ENERGY_STRONG_OPPORTUNITY` → `USE_
  OVERTAKE_BONUS_MODE` (SoC 6.4 MJ).
- `POST /api/v1/demo/preset/LIMITED_ENERGY_SAME_OPPORTUNITY` → `CONSERVE_
  MODE` (same scenario/lap/seed, SoC overridden to 0.8 MJ).

Also implemented and demonstrated live: all 5 modes rendering distinctly
in one Monte Carlo table (§12.5); the confidence gate genuinely
overriding to `BALANCED_MODE`/`HOLD` on degraded data quality (seen live
on a historical-replay lap 1 with `n_observations=0`); the Opportunity
Horizon's `ATTACK_NOW` vs `WAIT_2`/`WAIT_5`/`HOLD` ranking with
genuinely widening uncertainty at greater delay (§9); the tick-level
strategic-rival timeline on a real FastF1 lap.

**PLANNED, not yet built**: a frontend UI control to pick scenario A-E or
a named preset directly (currently API-only, §12.10); a real Circuit Map.

**PLACEHOLDER, explicitly not real data**: `CircuitMapPlaceholder`'s
"Track Overview" box; the confidence-gate override demo's second toggle
state (canned, not a live call, §12.6's last row); `mockTelemetry.js`'s
entire bundle when no backend is reachable (clearly marked via
`FooterStrip`'s `DATA MODE`, never presented as live).

**Stack**: React 19 + Vite. `@react-three/fiber` + `@react-three/drei` +
`three` for the 3D car viewport. Plain CSS Modules (no Tailwind/UI kit) —
one `.module.css` file per component. No routing, no state management
library; local `useState` only.

**Layout** (`App.jsx`, redesigned 2026-09-02, then restructured again into
the current 3-zone form — see the specs in `docs/superpowers/specs/` for
the earlier pass): `Header` → a 3-column main row → a 2-item support row
→ `FooterStrip`. The car is the visual anchor in the center column, not
tucked in a side column.
- **Header**: centered wordmark + "AI MOTORSPORT INTELLIGENCE" subtitle;
  top-right session/lap/car/race-time/LIVE cluster.
- **Main row**: **left** column (`DecisionBanner` → `RivalEstimator`,
  stacked — `RivalEstimator` takes whatever vertical room is left, since
  it's the key differentiator) — **center** column (`RacingScene`, the
  car hero, → `MonteCarloPlanner` beneath it) — **right** column
  (`CircuitMapPlaceholder` → `OpportunityTimeline`).
- **Support row**: `EnergyStatus` — `ComplianceProbe` (rendered
  `compact`). Deliberately just these two, kept visually secondary to
  the main row.
- **Footer**: `FooterStrip` — track/weather/tyre flavor plus a `DATA
  MODE: SIMULATION / REPLAY` indicator, so the UI never implies it's
  receiving live FIA/team telemetry.

A **Decision Pipeline** panel (a static 5-stage "how ChronoPace reasons"
strip) existed briefly between `DecisionBanner` and `RivalEstimator` in
an intermediate pass and was removed — Stages 1-3 aren't built yet, so a
pipeline visualization had nothing real to show, and the left column
reads better with `RivalEstimator` getting that space instead.
`TelemetryHeader.jsx` (the old right-column header, from before that) is
similarly retired — its fields split between `Header` (session/lap/car)
and `EnergyStatus` (speed, SoC, relabeled "Deployable").

**Components, one-to-one with the backend concepts above**:
| Component | Mirrors | What it shows |
|---|---|---|
| `DecisionBanner` | `ConfidenceGateResult` (§8) | The "EXECUTE: {mode}" / "OVERRIDE → {mode}" call (mode names through `MODE_LABELS`, §4), a one-line "WHY" readout built from the same gate numbers, the 4 gate-pass pills, the CI-bound/t-stat/DCLI/rival-σ stats grid. Has a working "Demo: toggle scenario" button that flips between a canned pass-case and a canned override-case — the only interactive element on the page right now. |
| `ComplianceProbe` | `GateResult` (§5) | The FIA constant checks (MGU-K power, lap deployment, delta-SoC swing, overtake-bonus banking) as PASS/BREACH rows citing article numbers, plus a worked breach example (hidden when rendered `compact`, e.g. in the support row). |
| `MonteCarloPlanner` | `PlannerResult` / `ModeProjection` (§7) | The 5-mode ranked table as horizontal bars (mode name, bar, probability, laptime delta), plus a best-strategy/expected-gain/risk summary row — `risk` is a 3-bucket label derived from the real Sharpe field, not a new invented one. |
| `RivalEstimator` + `PosteriorPlot` | `RivalSocEstimate` (§6) | A large headline mean±std readout, the posterior density plot, terminal speed, clipping point, attack tendency, a clipping-point/defending-capacity callout, and the "modeled, not measured" disclaimer. Sized to be a major module, not a compact card — see the layout note above. |
| `EnergyStatus` | `TelemetryInput` (§5) | Deployable energy (= current SoC, relabeled), speed, current mode. Deliberately excludes "harvest rate" and "next window" — neither maps to real/spec'd data. |
| `CircuitMapPlaceholder` | — (not built) | Honest empty placeholder sized for where the real Circuit Map goes later — no fake track/position data. Still a placeholder; nothing changed here since the redesign beyond re-theming. |
| `OpportunityTimeline` | — (Opportunity Horizon not built) | No longer an empty placeholder — visualizes the one genuinely sequential mechanic already computed (the overtake bonus's bank-this-lap/spend-next-lap rule) as a 3-node timeline, using only real fields from the dashboard's data layer (lap number, gap, mode projections) — live when a backend's connected, mock otherwise (see "Backend integration", below). Still not a real Opportunity Horizon visualization — that needs §9 built first. |
| `FooterStrip` | — | Track/weather/tyre flavor (static demo values) plus the `DATA MODE` disclaimer. |
| `RacingScene` (`components/RacingScene/`) | — (no backend equivalent) | The car (`frontend/public/models/vf26.glb`) as a stationary subject, slowly rotating in place, under studio lighting with a red rim light — no road, no travel animation, no track. Scale-normalized via a single `CAR_LENGTH` constant (`sceneConfig.js`) rather than a hardcoded model-specific number, so it's correct for any GLB swap. Presentation only — carries no data. |
| `GlassPanel` / `Icons` | — | Shared card shell (dark glass, blurred backdrop, glowing red border) and the hand-drawn SVG icon set every panel uses. No emoji anywhere in the UI, by design. |

**Visual identity**: Titillium Web (display type — headings, decisions)
+ Inter (body/label text) + JetBrains Mono (numeric/technical readouts)
via Google Fonts; a near-black background with a radial vignette over a
subtle repeating "carbon fiber" weave; motorsport red as the primary
accent (borders, glows, the car's rim light), green/amber/red for
pass/warn/fail status — red intentionally doing double duty as both the
brand accent and the fail state, reinforcing rather than conflicting,
same as the reference livery it's drawn from. Dark glassmorphic cards
throughout. This went through several redesign passes, including a full
palette change from an earlier cyan-accented version — this is the
version the team settled on, not a first draft.

**The one thing to actually understand about the data**: every component
reads through `useDashboardData()` (`frontend/src/services/
DashboardDataContext.jsx`), not `mockTelemetry.js` directly — the one
exception is `MODE_LABELS`, a display-text lookup rather than data,
which every component still imports directly since it doesn't vary by
data source. `mockTelemetry.js`'s exports are named and shaped to match
the real Pydantic models above field-for-field on purpose
(`complianceChecks`, `modeProjections`, `rivalEstimate`,
`confidenceGatePass`/`confidenceGateOverride`, etc.), and that naming
discipline is exactly what made connecting a real backend (below) a
**data-source swap, not a component rewrite** when it actually happened,
2026-09-03 — the prediction this paragraph originally made turned out to
be correct. `mockTelemetry.js` itself hasn't gone anywhere: it's still
exactly the shape every component expects, and it's what actually
renders whenever no backend is configured or reachable. Do not let a UI
change quietly invent a field neither source has, or rename one either
does — that would turn this from "ready to wire up" into "needs
reconciling," same as before.

**Backend integration** (`frontend/src/services/`, added 2026-09-03):
this UI now talks to a real backend over HTTP, with the mock file as an
automatic fallback rather than the only mode. Three files:

- `api.js` — a thin `fetch` wrapper. Reads the backend's base URL from
  `VITE_API_URL` (set in `frontend/.env.local`, gitignored — never commit
  a real value there) and POSTs to `/api/v1/decision`.
- `adaptDecision.js` — reshapes the backend's raw response into the exact
  object shape `mockTelemetry.js` already exports, so no component needed
  to change to consume it (field-by-field table below).
- `DashboardDataContext.jsx` — fetches once per page load, provides
  whichever bundle is active (live or fallback) via the
  `useDashboardData()` hook every component reads through.

**What's actually known about the backend, and what isn't**: it's real
and reachable — confirmed via its own `/openapi.json` (title
"ChronoPace", FastAPI) and live `/api/v1/decision` calls that returned
complete, internally-consistent payloads, re-verified across multiple
calls with the lap counter genuinely advancing each time (not a cached
response). Its source is **not in this repository** — it's built and
hosted elsewhere, reached only over the network via `VITE_API_URL`. That
means nothing here confirms it's an implementation of Stages 1-4 as
specified in this document; only its external contract is known, and
that contract doesn't line up with this document's stage boundaries
one-to-one — its API surface is organised as `/api/race/*`,
`/api/energy/*`, `/api/overtake/*`, `/api/strategy/*`,
`/api/simulation/*`, and a consolidated `/api/v1/decision`, not as
separate Stage 1/2/3 endpoints. Treat the two as related but
independently-verified facts, not the same fact twice.

The observed `/api/v1/decision` contract, for reference — request body
`{session_id, lap, driver, rival, scenario}`, all optional with server
defaults; the server appears to hold its own advancing replay-lap state
independent of the request's `lap` value — response:

```
meta:        session_id, lap, total_laps, driver, rival, timestamp, data_mode
decision:    mode, action, confidence, reason, reason_codes
energy:      deployable_mj, harvest_rate_mj_per_lap, energy_state{soc_mj, soc_pct, ...}
rival:       energy_distribution{low,medium,high}, estimated_reserve_mj, reserve_std_mj,
               confidence, clipping{detected, location_percent, terminal_speed_kmh}
opportunity: current{location, success_probability}, recommended_window{lap, location, ...}
monte_carlo: number_of_simulations, strategies[{mode, expected_value, success_probability}],
               best_strategy
compliance:  legal, checks[{rule, status}]
```

**Field-by-field: live vs. still-static-fallback**, even when connected
(the full, authoritative version of this lives as inline comments in
`adaptDecision.js` — this is a summary, not a substitute for reading it
before touching the mapping):

| Dashboard field(s) | Source when live | Notes |
|---|---|---|
| Recommended mode, lap, total laps, car number, deployed SoC | **Live** | Direct or near-direct from the response |
| Rival mean/std SoC, terminal speed, clipping point, attack tendency | **Live** | `attackTendency` is the argmax of the real `energy_distribution` |
| Monte Carlo bars (mode, success %), simulation count, best strategy | **Live** | The bar's laptime-delta label reuses the response's `expected_value` — a dimensionless utility score, not literally seconds, despite the label; `sharpe` is a display-only rescale of `success_probability`, the same "derived, not fabricated" treatment the mock's own Sharpe field already got |
| Decision Banner's "WHY" text | **Live** | Uses `decision.reason` verbatim when present |
| Decision Banner's 4 gate pills | **Live-by-proxy** | The backend exposes one overall `compliance.legal` boolean, not four separate statistical tests — 3 of the 4 pills key off that one boolean; `rivalConfidence` keys off the real `rival.confidence` |
| Decision Banner's CI-lower-bound / t-statistic / degrees-of-freedom / DCLI score | **Static (mock)** | No equivalent in this backend's response — it reports a single confidence score + reason codes, not a Welch t-test/DCLI breakdown. Not invented to fill the gap. |
| Compliance Probe's rows (MGU-K power, lap deployment, SoC swing values/limits/units), breach example | **Static (mock)** | The live shape is `{rule: "Art.5.4.10 Lap Deployment", status: "pass"}` — a sentence plus a status, not discrete value/limit/unit fields, and it doesn't include an MGU-K Power check at all |
| Overtake bonus gap/threshold seconds | **Static (mock)** | The backend embeds this in a sentence, not a discrete field; `qualified` and `bankedFromLap` ARE live (derived from `reason_codes` and the live lap number) |
| Track/weather/tyre footer strip | **Static (mock)** | Not part of this response; `dataMode` specifically IS live (shows the backend's own `meta.data_mode`) |
| Confidence-gate override scenario (the demo toggle's second state) | **Static (mock)**, always | No live "override" scenario exists from a single decision call — toggling to it still works, it just shows the canned example |

**Fallback behavior, verified, not assumed**: an unset `VITE_API_URL`, a
network failure, a non-2xx response, or a timeout all land in the same
place — `DashboardDataContext` catches it, logs it, and renders the
original static mock bundle with zero crash. Verified directly by
pointing `VITE_API_URL` at a deliberately-unreachable host, confirming
the clean revert, then restoring the real value. There's a brief
loading-flash window on first paint (mock values render for the fraction
of a second before the live fetch resolves) — not a bug, just means a
screenshot taken in that exact window can show stale-looking numbers;
give it a second before trusting what's on screen.

**The Cloudflare tunnel URL used to verify all of this**
(captured 2026-09-03) is a `trycloudflare.com` **quick tunnel** —
ephemeral by design, tied to whatever process opened it, and likely to
rotate or go dead whenever that process restarts. Don't treat any
specific `trycloudflare.com` hostname as a stable integration point;
treat `VITE_API_URL` as the stable thing, and expect to be handed a new
URL to put there periodically until this has a permanent host.

**Running it locally**: `cd frontend && npm install && npm run dev`
(or, inside this Claude Code project, the `chronopace-frontend` config in
`.claude/launch.json` — port 5173 by default, falls back automatically if
that's taken). To run against the live backend rather than mock data,
set `VITE_API_URL` in `frontend/.env.local` (tunnel/production) and/or
`frontend/.env.development.local` (added 2026-09-07, gitignored — wins
over `.env.local` specifically for `npm run dev` per Vite's env-file
precedence, so a local backend and a tunnel URL can both be configured
without either overwriting the other). Vite only reads env files at
server start — restart the dev server after changing either file, HMR
won't pick it up. Omit both files, or leave the variable unset, to run
mock-only exactly as before.

**Flag — the contract described just above (request shape, field table,
`meta`/`decision`/`rival` layouts) is the one observed 2026-09-03 and is
now stale.** `adaptDecision.js`'s own header comment records a later
rewrite (2026-09-06) against a materially richer `DecisionSnapshot`:
`decision` gained `stage2_mode`/`confidence_overridden`/`override_reason`;
a real `confidence` block now carries `ci_lower_bound_s`/`t_statistic`/
`dcli_score`/four named gate booleans (all listed as "Static (mock)" in
the table above — no longer true); `monte_carlo.ranked_modes` carries a
real `std_laptime_delta_s` and `sharpe_ratio`; `rival` gained `bucket`/
`n_observations`; `meta.driver`/`meta.rival` and `rival.clipping` were
**removed** with no replacement (both now static-fallback, the opposite
of this table's claim). Per this document's own rule (top of file): trust
`adaptDecision.js`'s inline comments over the table above until someone
rewrites this section properly — that's a reconciliation task in its own
right, not done as part of adding the historical-replay feature below.

**Historical Race Replay** (`HistoricalReplayControl.jsx`, added
2026-09-07) — a judge-facing control, mounted in `Header`'s previously-
empty side slot, that drives the existing dashboard from the backend's
real FastF1 replay pipeline instead of synthetic/mock data. Three new
backend-facing functions in `api.js`, one new `historical` state slice in
`DashboardDataContext.jsx` — no second API layer, no second dashboard.

- `GET /api/v1/replay/races` — the registry of supported historical
  races (currently one: 2024 Italian Grand Prix, LEC vs PIA, 53 scheduled
  laps). Loaded lazily, once, the first time the panel opens. The UI does
  **not** hardcode this list — race/driver/rival names shown come from
  this response, never a client-side lookup table.
- `GET /api/v1/replay/historical/{race}/{lap}?driver=&rival=&seed=&full_snapshot=true`
  — one real request per lap, fired only on RUN REPLAY (or one auto-play
  tick). `full_snapshot=true` is load-bearing, not optional: without it
  this endpoint returns a compact `{race, lap, summary}` preview shape,
  not a `DecisionSnapshot` — `adaptDecision()` (built for the full shape)
  would silently resolve every field to its mock fallback, rendering
  static mock numbers under a "REAL TELEMETRY" label. This exact bug shipped
  briefly (props to a live audit for catching it before a demo) and was
  fixed by adding the query param and reading `adaptDecision(raw.snapshot)`
  instead of `adaptDecision(raw)`. With it, `raw.snapshot` is
  byte-shape-identical to `/api/v1/decision`'s own response, so the same
  adapter, same components, same everything handle it — no historical-
  specific rendering path exists anywhere in the dashboard.
- **No hindsight**: the frontend sends only `race`, `lap`, and optionally
  `driver`/`rival`/`seed` — never telemetry, never an outcome, never
  anything from a lap after the one selected. Causal censoring (a lap's
  decision may only see telemetry through that lap) is entirely the
  backend's responsibility; confirmed server-side, not just assumed —
  see the backend's own `test_future_telemetry_cannot_change_a_lap_n_decision`
  and `test_real_monza_lap_n_only_sees_laps_up_to_n`.
  **No lookup table anywhere**: every decision shown is this response's
  own `decision.mode`/`decision.action`, never a client-side
  `if (lap === N)` — the panel has no per-lap branching at all.
- **Provenance & mode indicator**: the panel always shows a "REAL
  TELEMETRY / FastF1 · {race name}" line next to a "MODELED / Rival
  Energy · Opportunity · Monte Carlo · ChronoPace Decision" line, so it
  never implies the 2024 car ran under 2026 regulations. `FooterStrip`'s
  `DATA MODE` reads `HISTORICAL REPLAY · REAL TELEMETRY` while active,
  reverting to the normal `LIVE BACKEND · SYNTHETIC` (or mock) reading via
  a "← Back to synthetic mode" action that does a real re-fetch, not a
  flag flip.
- **Failure is honest, not silently mocked**: unlike the synthetic path
  (which falls back to mock on any fetch failure, §12 above), a failed
  historical fetch only sets `historical.error` — the dashboard's main
  `state` is left untouched, so a real user-initiated historical request
  never silently resolves to fabricated numbers. Verified live: with
  `fastf1` not yet installed on the backend's Python environment, every
  historical call 503'd with `"the fastf1 package is not installed..."`
  and the panel correctly showed `HISTORICAL REPLAY UNAVAILABLE` plus the
  real error text and a Retry button, while the rest of the dashboard
  kept showing its last-good synthetic data.
- **Verified against real telemetry** (2026-09-07, after installing
  `fastf1==3.4.4` server-side — a backend-environment fix, not a code
  change, done in the separate `engine` repo): 2024 Italian GP, LEC vs
  PIA, laps 2/12/40 return `ARM_OVERTAKE_MODE`/`BALANCED_MODE`/
  `BALANCED_MODE` respectively — the expected causal-replay pattern,
  genuinely computed each time (confirmed identical on repeat calls with
  the same seed, and matching whether fetched standalone or as part of a
  full 53-lap replay), never hardcoded.
- Optional auto-play (PLAY/PAUSE) advances lap-by-lap via a self-
  scheduling `setTimeout` that reads state through a `useRef` (not
  `setInterval` against a stale closure) — still one real backend call
  per lap, never a bulk pre-fetch of the whole race.

## 13. Conventions — follow exactly (backend/Python)

- **Pydantic v2** for all cross-stage I/O models (`BaseModel`, `Field`
  with constraints like `ge=0`). Plain `@dataclass(frozen=True)` for
  internal config objects not serialized across a boundary (`GateConfig`,
  `PlannerConfig`, `ModeDynamics`, `RivalEstimatorConfig`).
- **pytest**, one test file per module (`test_<module>.py`), organized by
  rule/behavior with a `# --- section --- #` banner. `test_integration.py`
  is one deliberate, documented exception — it exists specifically to
  catch cross-stage bugs (sign convention, `run_id` plumbing, RNG-stream
  independence, the rival-estimator's Stage 2/3 dual effects) that
  per-module unit tests can't see.
- Every public class and non-trivial function has a docstring explaining
  **why**, not just what — record the design decision, not just the
  signature.
- Constants mapping to a real-world regulation are named and commented
  with the article they encode, so a reviewer can check them against real
  FIA text without reading logic. Constants that are numerical-stability
  fixes (the ±999 Sharpe cap) or pure engineering choices (DCLI weights,
  `defense_penalty_weight`) are commented as such — never conflate the
  two categories.
- NumPy vectorized Monte Carlo and particle-filter operations — batched
  array ops, never a per-iteration Python loop.
- Seeded RNG (`np.random.default_rng` / `SeedSequence`) everywhere
  randomness is used, with a default seed and an optional override.
  Never unseeded — this is what makes "deterministic pipeline" true
  despite Monte Carlo simulation and particle filtering both being
  involved, and what an eventual replay/"Time Machine" feature depends on.

**Validation is layered, not just "green tests"**: deterministic unit
tests → synthetic Core Demo Scenarios (§11) → Monte Carlo sanity checks →
(later) historical-telemetry backtesting → calibration. Below the
per-module test banners already specified in each stage's own section,
every module's suite should collectively prove these eight things — cross-
reference, don't re-derive a new test scheme:
1. Regulatory Gate rejects illegal actions correctly (§5 tests).
2. Energy accounting stays consistent across a simulated sequence of
   actions (§7's energy-state note, §9's lap-to-lap carry).
3. Rival uncertainty changes downstream outcomes (§7's rival-modulation
   tests, §8's rival-confidence tests).
4. The recommendation changes when our own energy state changes (§7).
5. Opportunity Horizon accounts for opportunity cost, not just raw
   per-lap value (§9).
6. Confidence decreases appropriately as uncertainty increases (§8, §9's
   `effective_std` growth).
7. The system abstains when evidence is insufficient — this is the one
   with no natural home in a per-module suite; make sure
   `test_integration.py` has a case that actually triggers
   `overridden=True` (§8).
8. The LLM narrator preserves every deterministic output unchanged (§10)
   — a literal test asserting the narrated numbers match the input JSON.

## 14. Explicit "do not" list (binding)

- No graph database, vector database, or "Obsidian/Graphify" memory
  system anywhere in the runtime.
- No multi-agent debate loops. No giving the LLM authority to pick a
  strategy.
- No LLM call anywhere in Stages 1-3.
- `rule_gate.py` must never import from or reference `rival_estimator.py`
  — the concrete, checkable form of "rival data never reaches Stage 1."
- No acoustic FFT telemetry processing — separating one power unit's
  signature from nineteen others through broadcast audio compression is
  an unsolved source-separation problem, not a narrowing one. If SoC
  inference is needed, use the particle filter (§6), which works from
  real, public kinematic data instead.
- No game-theory thermal spoofing — this would mean deliberately
  manipulating a rival's strategy system, which directly contradicts this
  project's own central claim ("check what's legal before optimizing
  anything").
- No full active-aero actuation gate — if it comes up at all, it's a
  one-line drag modifier, not a named feature.
- No FastF1 / real-telemetry integration in the hackathon build —
  **resolved, not pending anymore**: build a deterministic
  `telemetry_simulator.py` first (generates the seeded, reproducible
  `TelemetryInput`/`RivalObservation` sequences the Core Demo Scenarios
  (§11) and test fixtures need), and keep every consumer
  telemetry-source-agnostic so a real feed can replace it later without a
  redesign. `RivalObservation`, `TelemetryInput`, and `PlanningContext` are
  plain Pydantic models that don't care whether their values came from the
  simulator or real data — that's what makes the swap possible. FastF1 (or
  any real feed) is a **later calibration layer**, not a hackathon-build
  dependency; don't block Tier 1 progress on it.
- Never claim, in any pitch material or in the UI: a specific dataset
  size, a measured model accuracy, real-time F1 data access, an
  endorsement, a Haas deployment, or access to proprietary Haas telemetry.
  None of that exists. The honest, defensible framing (§16) is:
  "the prototype architecture is deterministic and testable; calibration
  against real race data is the next validation layer" — say that, not
  something stronger.
- No moving the legality check later in the pipeline. It has come up as
  "check compliance last, right before executing" in narrative framing —
  that's fine for how a *demo* walks through the reasoning out loud, but
  the actual computation must keep checking legality **first** (Stage 1,
  before Monte Carlo runs at all), on the existing principle that an
  illegal mode doesn't exist as an option rather than getting vetoed at
  the end. Narrative order and computation order are allowed to differ;
  don't let the former quietly become the latter.
- No renaming or reshaping a field in `mockTelemetry.js` without checking
  it against the matching Pydantic model above **and** against
  `adaptDecision.js`'s live mapping (§12) — both read this exact shape
  now, not just one hypothetical future consumer. This already paid off
  once: connecting a real backend needed zero changes to
  `mockTelemetry.js` or any component, exactly as designed.
- No presenting an Opportunity Horizon strategy (§9) N laps out with the
  same confidence framing as a next-lap recommendation. The uncertainty
  growth in §9 is a hard requirement, not a nice-to-have — an
  unqualified "wait 5 laps" claim is exactly the overconfident-sounding
  behavior the whole project's abstention design exists to avoid.

## 15. Repo layout

```
context.md                        This file
ChronoPace-Solution-Design.pdf     Companion narrative doc (problem/solution/why) for sharing with teammates

--- backend — specified below, NOT YET ON DISK ---
telemetry_simulator.py            Deterministic, seeded scenario generator — produces the TelemetryInput /
                                     RivalObservation sequences behind the Core Demo Scenarios (§11) and test
                                     fixtures; the only planned telemetry source for the hackathon build (§14)
test_telemetry_simulator.py         Telemetry simulator tests
rule_gate.py                      Stage 1 — RegulatoryGate, DeploymentMode enum, Pydantic I/O models
test_rule_gate.py                   Stage 1 tests
rival_estimator.py                 Rival Energy State Estimator — particle filter, one-way import from rule_gate.py only
test_rival_estimator.py             Rival estimator tests, including synthetic recovery
planner.py                          Stage 2 — MonteCarloPlanner, ModeDynamics priors
test_planner.py                      Stage 2 tests
confidence_gate.py                  Stage 3 — ConfidenceGate, two-part significance + DCLI + rival check
test_confidence_gate.py              Stage 3 tests
opportunity_engine.py               Opportunity Horizon (§9) — chains planner.py across a multi-lap
                                       horizon per candidate strategy, built on top of Stages 1-3, not a
                                       reordering of them
test_opportunity_engine.py           Opportunity Horizon tests
narrator.py                          Stage 4 (§10) — not built until Stage 3 is green
test_integration.py                 End-to-end pipeline tests (the one deliberate exception to one-file-per-module)
conftest.py                          Shared pytest fixtures
requirements.txt                     numpy, pydantic, pytest, scipy (all pinned)

--- frontend — actually built ---
frontend/
  .env.local                        VITE_API_URL — gitignored, machine-local, points at the live backend (§12)
  .env.development.local            VITE_API_URL — gitignored, wins over .env.local for `npm run dev` only (§12.12)
  .env.example                      VITE_API_URL= with no value — the only env file actually committed (§12.12)
  src/
    App.jsx, App.module.css          Top-level layout — 3-zone main row + support row (§12)
    components/
      Header.jsx/.module.css          incl. the LIVE/REPLAY badge (§12.8)
      FooterStrip.jsx/.module.css
      DecisionBanner.jsx/.module.css  incl. the 5th DATA QUALITY gate pill (§12.3)
      ComplianceProbe.jsx/.module.css
      MonteCarloPlanner.jsx/.module.css   incl. runner-up/value-gap/attack-completion row (§12.3)
      RivalEstimator.jsx/.module.css   redesigned 2026-09-11, "RIVAL ENERGY STATE" (§12.3/12.9) —
                                          PosteriorPlot.jsx retired, replaced by an inline RangeBar
      CircuitMapPlaceholder.jsx/.module.css
      OpportunityTimeline.jsx/.module.css   real ranked_strategies horizon table (§12.3)
      StrategicRivalTimeline.jsx/.module.css   tick-cadence rival-change visualization, on-demand + cached (§12.8)
      RacingScene/                    Car.jsx, Overlay.jsx, RacingScene.jsx/.module.css, sceneConfig.js
      GlassPanel.jsx/.module.css, Icons.jsx
      HistoricalReplayControl.jsx/.module.css   judge-facing FastF1 replay panel + season/race/session
                                                   discovery ("Browse other races") (§12.8)
    services/                        Backend integration (§12)
      api.js                           fetch wrapper — POSTs VITE_API_URL + /api/v1/decision, plus
                                          fetchReplaySeasons/Races/Sessions, fetchHistoricalLap,
                                          fetchHistoricalLapTimeline (§12.2/12.8)
      adaptDecision.js                 reshapes the real response into mockTelemetry.js's exact shape —
                                          pure reshape, no computation (§12.6's authoritative comments)
      DashboardDataContext.jsx         fetch-once-per-load + live/fallback provider, useDashboardData();
                                          also owns the `historical` discovery/replay state/actions (§12)
    data/mockTelemetry.js            Shape reference AND the fallback data source — no longer the only one (§12)
    index.css, main.jsx
  public/models/vf26.glb             3D car asset (Haas VF-26)
  vite.config.js, package.json
```

Backend files live at the repository root, no `src/` layout, once they
exist — §17 has the build order. (The *real, external* backend's own
repo layout — `app/decision/`, `app/replay/`, `app/ml/`, etc. — is not
this repo's concern and is not reproduced here; see §12.11 for how to
run it, not how it's laid out.)

## 16. What actually exists right now — summary

**Data/validation framing, for any pitch material**: *"The prototype
architecture is deterministic and testable; calibration against real race
data is the next validation layer."* Say that, not anything implying a
current dataset, measured accuracy, or real-time F1 access — none of
those exist yet (§14).

| Component | Status |
|---|---|
| Architecture, data contracts, regulatory constants | Fully specified in this document (this repo has no Python implementing them — see next row) |
| Telemetry Simulator / Stage 1-4 / Opportunity Horizon, **as files in this repo** | Designed, not implemented in this repository — zero backend Python here (§0). The *external* backend (separate repo) implements a materially richer, differently-organized system that achieves the same product intent — see §12.1's architecture diagram and the "current reality" note at the top of this file |
| Dashboard UI | **Built, running, and live-verified end-to-end against the current hardened backend contract** (§12, rewritten 2026-09-12) — all 9 dashboard sections (decision, energy, rival, Monte Carlo, compliance, opportunity, confidence, reasons, data-mode) confirmed showing real backend values field-for-field, not mock, in a live browser session |
| Backend ↔ frontend bridge | **Built and current** (§12) — `services/api.js` / `adaptDecision.js` / `DashboardDataContext.jsx`, fetching a real, reachable, separate-repo backend over `POST /api/v1/decision` exclusively (no legacy endpoint usage anywhere in `src/`, verified by grep) |
| Historical Race Replay + multi-race/season discovery | **Built and verified against real FastF1 telemetry** (§12.8) — `HistoricalReplayControl.jsx` + `StrategicRivalTimeline.jsx`, driving the dashboard from `GET /api/v1/replay/{seasons,races,sessions,historical/...}`. Requires `fastf1` on the backend's Python environment (separate repo) — shows an honest "HISTORICAL REPLAY UNAVAILABLE" rather than mock data when it isn't reachable |
| Rival Energy State card | **Redesigned 2026-09-11** (§12.3/12.9) — honest mean±std range bar (not a fabricated density curve), L/M/H distribution, evidence quality, P(defend), backend-driven confidence-gate pass/fail |
| Monte Carlo / Opportunity hardening fields (runner-up mode, value gap, attack-completion probability, utility std, downside probability) | **Threaded through 2026-09-11/12** (§12.3/12.6) — all null-guarded, never fabricated when the backend omits one |
| Client-side strategy logic | **Confirmed absent** — repeated `grep` sweeps across `frontend/src` for mode-assignment conditionals, confidence thresholds, rival/Monte Carlo recomputation, and `Math.random` all return nothing (§12.1) |
| Real telemetry source | **Resolved**: `telemetry_simulator.py` (synthetic, deterministic) for the hackathon build *as specified in this repo*; the external backend additionally runs real FastF1 telemetry for historical replay, not merely planned (§14/§12.8) |

## 17. Immediate next task

**Judgment call, logged rather than silently applied**: a teammate
proposal framed the build as TIER 1 (gate → estimator → planner → a raw
recommendation, *without* the confidence gate) shipping before TIER 2
(confidence gate + Opportunity Horizon, framed as "differentiation").
This document deliberately keeps the build order below instead, with
Stage 3 immediately after Stage 2 and before Opportunity Horizon. Reason:
the statistical-honesty fix in §8 (replacing a gameable `t≥2.0` with a
real significance-plus-margin test) is not a nice-to-have layered on top
of a working recommender — it's the fix for the exact overconfidence bug
this project exists to correct. A build that has a "working" pipeline
capable of confidently recommending a mode before the honesty gate exists
risks exactly that ungated behavior making it into a demo or a screenshot
by accident. Keep Stage 3 where it already was in the sequence.

Build in this order, keeping `python -m pytest -q` fully green after every
step, not just at the end:

1. `requirements.txt`, `conftest.py` skeleton.
2. `telemetry_simulator.py` + tests — deterministic, seeded generator for
   `TelemetryInput`/`RivalObservation` sequences. Built first because
   everything below needs example telemetry, and because it's what the
   Core Demo Scenarios (§11) and every test fixture actually run against
   — not something to improvise ad hoc per test file.
3. Stage 1 (`rule_gate.py` + tests) — the 5-mode enum and corrected
   constants everything else depends on.
4. `rival_estimator.py` + tests — no dependency on Stage 2/3, only a
   one-way constants import from Stage 1, so it can be built and fully
   validated in isolation right after Stage 1 exists.
5. Stage 2 (`planner.py` + tests) — needs the rival estimator's output
   type, not its Stage 3 integration.
6. Stage 3 (`confidence_gate.py` + tests).
7. `test_integration.py` — needs all of the above wired together. This is
   the single-lap pipeline, complete, and it is a legitimate demo on its
   own — don't treat step 8 as a blocker for showing progress. This is
   also the point at which Core Demo Scenarios A and B (§11) become real,
   computed outputs for the first time.
8. `opportunity_engine.py` + tests (§9) — the multi-lap strategy layer.
   Depends on everything above being built and green; extends Stage 3's
   comparison rather than replacing it. This is what makes Core Demo
   Scenario C (§11) possible.
9. Stage 4 (`narrator.py` + §10's input contract) — not started, do not
   begin until Stage 3 (and ideally the Opportunity Horizon layer, since
   it changes what there is to narrate) are built and green. Resolve the
   `confidence`/`reason_codes` derivation (§10) as part of this step, not
   before — it needs the real gate output shape in hand.
10. **Partially done, out of sequence with the rest of this build order**:
    the frontend-side half of this step — `fetch` calls replacing direct
    `mockTelemetry.js` consumption, with the mock file surviving as a
    fallback/demo mode rather than the only mode — is built and verified
    (§12, 2026-09-03), against a real backend that already exists and is
    reachable. What's *not* confirmed is whether that backend is this
    document's own Stages 1-4 pipeline (built via steps 1-9 above) or a
    separately-built implementation of the same product concept — its
    source isn't in this repo. If/when Stages 1-4 above get built in
    *this* repo, step 10's remaining real work is reconciling that
    backend's actual endpoint shapes against what `adaptDecision.js`
    currently expects, not writing the bridge itself again. (Real
    telemetry source is resolved regardless, §14/§16.)
11. UI work still needed, independent of backend progress and safe to do
    against richer mock data in the meantime: the 4-observable Rival
    Estimator display, a "Why NOW?" consolidated reasoning panel, an
    interactive Attack-vs-Wait comparison, an Opportunity Horizon
    visualization (real Circuit Map and Opportunity Timeline content —
    honest placeholders exist as of the 2026-09-02 layout redesign, §12),
    and rebuilding the demo-scenario toggle around the three named Core
    Demo Scenarios (§11). The presentation-layer relabeling of the 5
    modes (§4) and the overall layout restructure are **done** — not
    pending anymore. **Explicitly lower priority than the
    above**: further 3D viewport/visual polish. The car and telemetry
    visuals are supporting context for the decision, not the product —
    put new UI effort into making the reasoning legible before making the
    car prettier.

## 18. Engineering principles — the fast filter

When a new feature idea comes up, in any teammate's pitch or your own,
check it against this list before speccing it in. In priority order:

1. Correctness over visual complexity.
2. Deterministic calculation over LLM reasoning.
3. Explicit uncertainty (`mean ± std`) over fake precision (a bare point
   value with no error bar).
4. Legal action filtering before optimization, always — never the reverse.
5. Reproducibility (seeded RNG, everywhere).
6. Testability (if you can't write a test for it, it isn't specified yet).
7. Explainability (Stage 4 should be able to narrate *why*, not just
   *what*).
8. Honest prototype-status labeling — "designed" and "built" are different
   words in this document on purpose; don't blur them in a pitch either.
9. Modular architecture (one file, one job — §15's layout is not
   incidental).
10. Demo reliability over feature count — three scenarios that always
    work (§11) beat ten that might not.

The one-line version, worth repeating whenever scope creep shows up:
**does the proposed feature improve energy modeling, legality, rival
uncertainty, opportunity cost, confidence/abstention, or explainability?
If not, it's probably not core.**
