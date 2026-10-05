# Comparable evidence and acceptance

Derive required invariants from the scoped contracts. Select performance metrics only when they answer the hypothesis. Reuse the native scorecard format and evaluator; [the JSON template](../assets/scorecard.template.json) is for projects without one. A template is not an executable gate: establish a project-native evaluator or explicit reproducible evaluation procedure before claiming results.

For each criterion record ID, contract or rationale, unit, scenario, measurement source, aggregation, operator, threshold, required/advisory status, and sampling plan. Choose thresholds from project requirements and the baseline. Configure required criteria before running; an empty or unconfigured scorecard cannot pass.

## Measurement protocol

- Record code identity including relevant uncommitted content, OS/runtime/tool versions, workload, concurrency, seed where applicable, warmup, sample count and raw sample location.
- Define repetition and aggregation before comparison. Keep baseline and candidate conditions comparable; distinguish within-run samples from independent repeated runs.
- Report P95 by the nearest-rank method; record any other estimator a runner uses and apply it consistently. Small samples yield weak tail evidence, so a single percentile carries no claimed precision.
- For binary outcomes, report successes and trials. Zero observed failures or 100% observed recovery describe tested cases, not universal guarantees.
- When independent Bernoulli trials are a defensible model, report a two-sided Wilson interval for successes/n and record the confidence level. For correlated trials, change the sampling design or explain why the interval is unsuitable.
- Required absent, malformed, nonfinite or insufficient observations are inconclusive, never zero or pass. Prespecify adequacy, uncertainty handling, and the number of runs before the decision.

Freeze the scorecard version and test protocol for a comparison. When a discovered test gap changes measurement meaning, version the protocol and rerun the baseline with the new method when possible; otherwise mark the comparison inconclusive. Limits stay as frozen.

## Gate and improvement

Use `pass`, `fail`, and `inconclusive` per criterion. A required failure makes the gate fail; otherwise any required inconclusive result makes it inconclusive. Pass requires all required criteria and project checks to pass. Report advisory misses separately. Follow the project's warning policy.

Passing invariants establishes acceptability, not improvement. Judge the stated hypothesis using its predefined gain and tolerated regressions. Report no demonstrated gain when evidence does not discriminate.

Use failure injection only when relevant and isolated: identify owned processes/files, provoke the real failure boundary, and inspect recovery and residue. Add assertions for demonstrated blind spots.

## Statistical reference

NIST/SEMATECH Engineering Statistics Handbook: [percentiles](https://www.itl.nist.gov/div898/handbook/prc/section2/prc262.htm) and [confidence intervals for a proportion](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm).