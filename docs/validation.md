# Validation record

## Current implementation stage

- Python deterministic/custom-validator tests: **30 passing**. GenLayer is explicitly stubbed; model responses are predetermined independent fixtures. This includes the reviewed diagnostic logging revision described below.
- Both contract files passed the pre-existing official GenVM linter/runner check (`genvm-linter` commit `28450e665666300fc648dbe495110dfd0cb6a7b4`, GenVM manager `v0.6.0-rc10`). Both use the exact runner hash in the source header. The linter reports that a newer runner is available.
- JavaScript artifact/receipt/read-scheduling tests: **27 passing**, including partial-archive checks that reject promotion of failed consensus, changed calldata/leader dimensions and an incorrect rollback payload.
- Default plan output pins zero value, full-validator Studionet and both current source hashes.
- Both exact reviewed contracts were deployed on Studionet 61999 with zero value and full validators. Current provider: `0x77281Bd457CC53d6E2Da4a2B6D4223dda86DEC35`; current consumer: `0x45fd9AD9B58cCc6207e9b7120781A457AD4c5d4D`. Source hashes are recorded in `public/deployment.json`.
- The single diagnostic-version run completed the unchanged fixture: alpha/beta `DUPLICATE`, beta/gamma and alpha/gamma `DISTINCT`, the exact two-member certificate, real cross-contract consumption, and all three expected rejection cases.
- `public/evidence/demo.json` is **`verified:true`**. `npm run verify` passes **11 public RPC transcripts: 2 deployments, 6 successful workflow writes and 3 exact expected rollbacks**. This establishes one bounded completed Studionet run. No successful browser interaction, publication, external adoption or universal consensus reliability is claimed.

## Current complete live evidence

All workflow writes used chain 61999, value 0 and `leader_only:false`. Successful calls establish validator `MAJORITY_AGREE` and VM `SUCCESS`; rejection calls establish validator `MAJORITY_AGREE`, VM `ERROR` and the exact rollback payload. These are majority results, not unanimous model agreement.

| Check | Transaction / observed result |
| --- | --- |
| Alpha/beta | `0x07c8a785de342bc0da26633bd6ca088ab96f63a453110f2d8f3803f649eab593`; stored `DUPLICATE` |
| Beta/gamma | `0xe8e69055d008d86f0866cf3e4c4a37a35db6a80fe61b040c3cb1dfee74395915`; stored `DISTINCT` |
| Alpha/gamma | `0x8e4853562c1ae7ad84a527fbd00f141c7348088ec99da09f89300d63419ae8a3`; stored `DISTINCT` |
| Missing third edge | `0xdc933349320c1d30244f5e105e4f5e9290aab01636e38c847815387489c25cfc`; exact rollback `Missing pair evidence; transitive grouping is forbidden` |
| Nonduplicate third member after all edges exist | `0x3b1cacfb72f4112ff5e1988d1f1ce1f40dec5adb77698c9025eca3c6142e41c3`; exact rollback `Every group pair must independently establish DUPLICATE` |
| Separate consumer reads exact two-member certificate | `0xd9282d366095980f21b6ee3432a05102fb6969a9d620a10add3b8343ad0d9f3d`; stored reliance receipt verified |
| Wrong intended scope | `0x396938716698464f14e3b9a88342c38fdb71462287fd92122df150796c0b60f2`; exact rollback `Batch or scope differs from consumer intent` |
| Rejected certificate and wrong-scope receipt | Both read back as `null` |

Certificate digest: `817e1ba03f0a62046b346e71ceb2ac3cc7461b7847749c83eb1c00f21202e373`. Consumer receipt digest: `f4bba9b8da410e72327e2bf7fde96fbcb8ca99f52ec607976d2290946638b735`.

Current evidence files are `public/deployment.json`, `public/evidence/demo.json` and `public/evidence/transcripts.json`. The selected real validator diagnostics are in `public/evidence/diagnostic-run-0x77281bd457cc53d6e2da4a2b6d4223dda86dec35.json`.

## History: original deployment's unresolved semantic disagreement

The original provider was `0xDBb17Dbc2Eb461055dab1776a45f04896A7afad3`, with consumer `0x81D1eb6fF7684D9dA5A33F165Ad136C6EDA43FE1` and provider source SHA `6362aca980dbff00731f33c27d7dea263cc2004544d7be35cf71a2aba232233f`. Its deployment, partial archive and selected initial failure receipt are preserved under `public/evidence/deployments/0xdbb17dbc2eb461055dab1776a45f04896a7afad3/`. Its original full RPC receipt remains in ignored `.local/`.

Transaction `0xbd370396f4569a8e4abe206b3fcab6ae5222713558d477430d5d920f42e47c75` initially returned `UNDETERMINED / MAJORITY_DISAGREE`. A later read returned `FINALIZED / MAJORITY_DISAGREE`; `get_pair(owner, "csv-demo-v1", "beta", "gamma")` still returned `null`. The leader returned successfully with `scope_fit=BOTH`, `trigger=DISJOINT`, `symptom=DIFFERENT`, `context=SAME`, and `consistency=CONSISTENT`, citing lines 1–3 of each report. Three validators disagreed; each validator executed successfully. An idle validator was cancelled after quorum.

The exact rejecting dimension or audit flag cannot be recovered from this historical receipt. That source returns only a boolean, uses short-circuit dimension equality before the audit, catches exceptions as rejection, and logs neither its independent tuple nor its audit booleans. All three disagreeing validators have empty stdout and stderr. LLM token aggregates do not identify a specific rejecting field. A semantic mismatch, substantive audit rejection, or caught parse/model exception remain possible; none is asserted as the proven cause.

The failed call was never resubmitted to that original address. Alpha/gamma and the rejection of a nonduplicate third member were **not attempted on the original deployment**. The reviewed revision adds observability and was deployed at a new address for one authorized run of the unchanged fixture. No semantic acceptance criterion was loosened. The new completed run does not retrospectively identify or prove a fix for the original disagreement.

## History: original deployment's supported partial results

The separately verified partial archive contains 9 selected public RPC transcripts: 2 deployments, 4 successful workflow writes, 2 exact expected rollbacks and the failed semantic comparison. Every write used chain 61999, value 0 and `leader_only:false`. Successful calls have validator `MAJORITY_AGREE` and VM `SUCCESS`; expected rollbacks have validator `MAJORITY_AGREE`, VM `ERROR` and the exact rejection payload. This count includes the disagreement as preserved evidence, never as a successful call.

| Check | Observed evidence |
| --- | --- |
| Separate consumer reads exact alpha/beta certificate | `0x9e7477dadcdb6ca9887ed42c5ac2ccf9d68339e613e665b6016a3cc4596de192`; `FINALIZED / MAJORITY_AGREE / SUCCESS` |
| Wrong intended scope | `0x74dd5fce638ae8694b387298d23a4ede1fa8764c06c22247f04902ae14a2a6a3`; exact rollback `Batch or scope differs from consumer intent` |
| Wrong-scope receipt | Read back as `null` |
| Three-member certificate after missing-edge attempt | Read back as `null` |
| Original valid certificate | Re-read unchanged after both consumer calls |
| Beta/gamma and alpha/gamma pair storage | Both read back as `null` |

Certificate digest: `74b85ed1f9bc4ae0c0f4c7dce79a2c694d44c6a771ea4635dd0613a41d47a677`. Consumer receipt digest: `e598c132249e7e4c6fa89d91b9d91d9938a503def3268eaa2fe3241fdb9f0a4b`.

Historical public files remain `public/evidence/partial.json`, `partial-transcripts.json`, `partial-deployment.json`, `failed-comparison-initial.json` and the address-isolated copies above. Original source snapshots remain under `public/evidence/sources/`. Run `node scripts/verify-partial-evidence.mjs` to recheck their bounded claims locally. This historical archive remains `verified:false` for its full workflow; the current complete archive belongs to the separate reviewed deployment.

## Reviewed diagnostic logging revision and observed minority rejections

Reviewed provider SHA-256: `798396ef6d331453a1f6984e96314baa502f321b8550d19678667848576cf308`. Consumer SHA-256 remains `04670e87f31a16cc46a323e31b72db27b6a2076cb651a28087468c6c60701f6f`. Both deployed sources were re-read and matched these hashes before the workflow. The fixture bytes and canonical fixture digest are unchanged. This revision ran once on the new deployment; the original deployment and its failure evidence remain separate.

The validator now emits `SEMANTICPARTITION_DIAGNOSTIC` JSON lines for its candidate and independent five-field tuples, the exact mismatched field names, actual audit booleans and audit response shape, the final accepted/rejected branch, and exception stage/type. It does not log exception messages, model/provider settings, keys or runtime configuration. Dimension mismatch still short-circuits before the audit. Acceptance still requires exact equality of all five dimensions and all seven audit fields being actual boolean `true`; caught exceptions still reject. Prompts, relation derivation and storage commitments are unchanged.

Five added Python tests cover dimension mismatch, false/invalid/malformed audits, exception diagnostics and successful diagnostics. They also compare the logging revision against the preserved original source over eight controlled scenarios, requiring identical decisions, prompt strings, stored pair bytes and unconsumed model fixtures. The current Python suite has 30 tests and the JavaScript suite has 27. GenVM lint and schema validation pass with the same pinned runner; its only notice is that a newer runner exists. These offline checks establish the logging change's tested boundaries; they do not identify or claim to have fixed the original live disagreement.

The current real validator logs show these minority rejection branches:

- Alpha/beta: two validators matched every semantic dimension but returned `unknown_justified:false` in the audit.
- Beta/gamma: one validator rejected with `UserError` at `independent_semantics`; another matched dimensions but returned `citations:false` in the audit. The exception message was intentionally not logged, so no more specific parse/validation cause is claimed.
- Alpha/gamma: one validator matched dimensions but returned `unknown_justified:false` in the audit.

The remaining recorded accepted decisions have matching tuples and all seven audit booleans `true`. Each pair still reached `MAJORITY_AGREE`. These diagnostics demonstrate actual differing model/audit behavior within this new run; they cannot be used to assign a cause to the old transaction. The observability revision does not establish deterministic model reliability or a solved original semantic error.

The exact source diff is in `docs/diagnostic-source.diff`; the reviewed source and local lint result are in `public/evidence/sources/798396ef6d331453a1f6984e96314baa502f321b8550d19678667848576cf308.py` and `public/evidence/diagnostic-lint.json`.

## Completed live verification procedure

1. Deploy the provider and consumer using exact reviewed hashes, re-read both deployed sources and verify the consumer's configured provider.
2. Freeze the synthetic CSV report batch. Compare alpha/beta to establish a supported duplicate pair and certify exactly those two members.
3. Attempt a three-member certificate before the missing edges exist. Retain the validator-agreed exact rollback, never call it success.
4. Independently compare beta/gamma and alpha/gamma. Both should be `DISTINCT` in this explicit synthetic scenario; if consensus returns otherwise, preserve the result and stop rather than fabricate the fixture expectation.
5. Attempt the three-member certificate after full coverage; reject its nonduplicate edge.
6. A second wallet calls the separate consumer contract with the exact provider certificate. Verify stored receipt and unchanged original certificate.
7. Change only the intended scope hash and verify the call reverts without creating a receipt. Re-read complete RPC receipts for all calls and verify actor, destination, ABI calldata, majority agreement, VM execution and full-validator mode.

All seven steps completed on the reviewed diagnostic deployment, producing 2 deployment receipts, 6 successful workflow receipts and 3 expected rejections. Historical disagreements remain recorded as failed attempts and are not counted as successful evidence.

## Covered offline failure classes

Missing third edges and non-transitive grouping; overlap/distinct/unknown rejection; singleton/duplicate/foreign membership; stale batch/scope/report hashes; creator namespace isolation; immutable evidence and no reroll; independent semantic disagreement; unrelated/missing/fabricated citations; non-boolean audit response; malformed/injected output fields; wrong provider/chain/certificate/member intent; consumer receipt replay; deterministic Python/JavaScript digest checks; lifecycle/consensus/VM success separation; paced read retry behavior; plan mode and reviewed-hash requirements.

Prompt-injection tests verify structural boundaries and rejection paths with controlled fixtures. They are **not** evidence that real models resist every injection. Synthetic reports are not real defect reports or proof of product behavior. All test actors are controlled by the project; no adoption or external users are claimed.
