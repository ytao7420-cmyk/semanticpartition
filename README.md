# SemanticPartition

A reusable GenLayer primitive that issues **scope-bound duplicate-report group certificates only when every internal pair has independent supporting evidence**. Its separate `PartitionConsumer` example reads the deployed provider synchronously and records reliance on the exact certificate, batch, scope and members.

This is a comparison of caller-submitted descriptions. It does **not** authenticate observations, diagnose a root cause, find an optimal partition, or prove that members of separate groups are different. All demo reports and wallet actors are project-controlled. No funds or mainnet operations are involved.

## Why the complete-edge model matters

Two reports can each partially resemble a third report without describing the same observable issue. A transitive union operation can silently turn those local similarities into one unsupported cluster. SemanticPartition keeps every required comparison and refuses to certify a group with a missing, overlapping, distinct or unresolved edge. Choosing which candidate group to certify remains explicit; the contract does not claim to solve global clustering.

## Workflow

1. A creator freezes an owner-namespaced batch of 2–6 reports and a comparison scope. Canonical text, line boundaries and SHA-256 commitments are immutable. The batch also binds its actual provider address and chain ID.
2. The creator requests one pair comparison at a time. Every validator independently interprets scope fit, triggering conditions, observed symptom, relevant context and consistency. Deterministic code derives `DUPLICATE`, `OVERLAP`, `DISTINCT` or `UNKNOWN`.
3. Independent validators also substantively audit the leader's actual citations against both full reports; matching labels or a valid line range alone are insufficient. Exact quotations are reconstructed in code. A stored pair cannot be rerolled.
4. The creator selects at least two members. Every one of the `n(n−1)/2` internal pair records must be present, bound to the same scope/report hashes and `DUPLICATE`. A certificate binds all members and all edge digests.
5. Another wallet calls the separate consumer contract. The consumer synchronously reads the provider, verifies its deployment/chain identity and intended certificate/batch/scope/member commitments, then writes an immutable reliance receipt. It does not copy a browser's success label.

## Run locally

```sh
npm ci --ignore-scripts
npm test
npm run test:contract
npm run plan
```

The default harness and `--plan` do not create wallets or broadcast. Tests use explicit GenLayer doubles for deterministic rules and custom-validator branches. They do not prove real LLM behavior, injection resistance, chain rollback or a deployed cross-contract call.

## Studionet verification

Review both exact contract sources first, then run the printed plan. Deployment requires both reviewed source hashes:

```sh
node scripts/live-test.mjs --deploy --source-sha=<provider-sha256> --consumer-source-sha=<consumer-sha256>
node scripts/live-test.mjs --run
npm run verify
```

The harness pins `genlayer-js` 1.1.8, Studionet 61999, `https://studio.genlayer.com/api`, zero value and `leaderOnly:false`. It generates fresh project-only test actors with restrictive file permissions. No user wallet or funded key is used. Broadcast intention is saved before submission and the hash before waiting. An uncertain broadcast blocks automatic retries until an identified transaction's sender, destination, ABI calldata and full-validator setting match. Never erase an incomplete journal to retry a transaction.

The live scenario compares two duplicate synthetic export reports and a different export problem, proves a missing third edge cannot create a group, proves a nonduplicate third member cannot join, and has a second contract consume only the exact two-member group. There are 2 deployments, 6 successful workflow writes and 3 expected-rejection writes. The complete archive is marked `verified:true` only after the entire workflow and public receipt archive verify.

The current reviewed diagnostic deployment completed the unchanged three-report fixture in one live run: **3 verified pairs, 6 successful workflow writes, 3 exact expected rollbacks and 2 deployments**. `public/evidence/demo.json` is `verified:true`; `npm run verify` checks all **11 public RPC transcripts**. Current provider: `0x77281Bd457CC53d6E2Da4a2B6D4223dda86DEC35`; separate consumer: `0x45fd9AD9B58cCc6207e9b7120781A457AD4c5d4D`.

The original deployment's beta/gamma call received `MAJORITY_DISAGREE` and stored no pair. Its source, failure receipt and partial consumer evidence remain independently archived. The reviewed revision added validator logging, preserved the fixture and strict acceptance policy, and ran at a new address; the old failed call was never resubmitted to its original address. The new run reached majority agreement while retaining minority audit/parser rejections in its diagnostic log. This single completed run does not prove the original disagreement was fixed. See [validation](docs/validation.md) for current evidence, actual diagnostics and the clearly separated history.

```sh
node scripts/verify-evidence.mjs          # current complete archive: 11 transcripts
node scripts/verify-partial-evidence.mjs  # preserved original partial archive: 9 transcripts
```

## Interface

Provider writes: `freeze_batch(batch_id, scope, reports_json)`, `compare_pair(batch_id, left_id, right_id)`, `certify_group(batch_id, certificate_id, members_json)`.

Provider views: `get_batch(owner, batch_id)`, `get_pair(owner, batch_id, left_id, right_id)`, `get_certificate(owner, batch_id, certificate_id)`; all return JSON strings, with missing evidence represented by `null`.

Consumer constructor pins the provider address. `consume(...)` accepts the exact intended certificate, batch, scope and member commitments. `get_receipt(consumer, receipt_id)` exposes the immutable result; `get_provider()` exposes the configured provider. See [architecture](docs/architecture.md), [validation](docs/validation.md), and [submission draft](docs/submission-draft.md).

## Attribution

Receipt interpretation, paced read retries and recoverable SDK journal utilities are adapted from this author's ClauseDelta/SchemaWitness projects. The issue comparison dimensions, complete-edge group certificate, separate consumer contract, synthetic scenarios and related tests are new. This is not a renamed prior contribution or a GenLayer starter fork.

GenVM internal view calls follow [official IC interaction documentation](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-intelligent-contracts), cross-checked with the [v0.2.9 SDK source](https://sdk.genlayer.com/v0.2.9/_modules/genlayer/gl/genvm_contracts.html). Deployment/chain binding follows the [official transaction context API](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context). The precise runner dependency is pinned in both contract headers; a newer runner exists, so no claim of using the latest release is made.
