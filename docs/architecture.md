# Architecture and trust boundary

## Immutable graph, not an automatic global partition

Storage uses three maps keyed by creator address and batch ID: frozen batches, canonical sorted report pairs, and named candidate-group certificates. Each report preserves trimmed LF-only text and its complete line array. Inputs have fixed bounds: 2–6 reports, 40–2000 characters each, at most 24 lines; scope is 20–800 characters. No network fetch or external identity claim is made.

Pair evidence binds protocol version, actual provider contract address, chain ID, frozen batch digest, scope SHA-256, sorted report IDs and exact text hashes. Pair order is canonical, so reversing the call's IDs cannot obtain a second interpretation. Reports and pair results cannot be replaced. A new scope or report version requires a new batch ID.

## Consensus boundary

The leader and each validator independently produce the same five-field semantic tuple. The validator separately reads both full reports and audits the proposed substantive citation support; the leader's free-text explanation is removed from that audit. Model outputs cannot supply executable instructions, arbitrary fields, final group labels or fabricated quotation strings.

The tuple is deliberately stricter than keyword similarity. `scope_fit` must be `BOTH`; missing necessary facts or unresolved consistency produce `UNKNOWN`. A concrete disjoint trigger/context, different observable symptom or contradiction produces `DISTINCT`. Full equivalence across trigger, symptom and context produces `DUPLICATE`; remaining supported partial equivalence produces `OVERLAP`. Cited text is reconstructed from bounded canonical spans. This validates descriptions only, not that either report is true.

The independent audit is still model-mediated. Agreement cannot establish objective real-world truth, eliminate model bias or guarantee injection resistance. A disagreement aborts that transaction and leaves no stored pair. A committed `UNKNOWN` remains unresolved and cannot be rerolled inside that batch. These are different outcomes and documentation must not conflate them.

The local diagnostic revision logs the independently produced tuples, exact mismatched fields, actual audit flags and validator decision branch to stdout. Exceptions expose only their stage and type. It preserves the same strict acceptance rules and audit short-circuit order. The originally deployed source has no such diagnostics; its disagreement cannot retrospectively be assigned to a specific dimension or audit flag. See the source hashes and deployment boundary in `validation.md`.

## Certificate construction

`certify_group` is deterministic. It enumerates every sorted member pair and requires existing, same-batch/scope/member-bound `DUPLICATE` evidence. The resulting certificate binds ordered member hashes, exactly `n(n−1)/2` edge digests, protocol, owner, batch, provider and chain. A singleton, repeated member, foreign member, missing edge or unresolved edge fails. No union-find or transitive closure is used.

The certificate proves only completeness of its internal edge evidence under this policy. Candidate groups need not be disjoint, exhaustive, uniquely optimal or mutually different. The name is a receipt namespace, not a claim of a mathematical optimal partition.

## Separate consumer

`PartitionConsumer` pins one provider address in its constructor. A wallet sends exact intended digest, batch digest, scope hash and ordered member objects. The consumer uses `gl.get_contract_at(Address(provider)).view().get_certificate(...)`, checks current chain/provider identity and recomputes the certificate/membership digests and pair count. It records the consumer contract's own address and the calling wallet in its receipt. No source snapshot, pair, or old receipt is mutated.

The consumer trusts the reviewed deployed provider implementation to enforce pair consensus; it is not a generic verifier for arbitrary untrusted providers. The SDK harness pins both source hashes and reads both deployed sources before sending workflow transactions. A public digest alone is insufficient to identify a deployment: consumers must also pin the provider address and chain.

## Recovery and evidence

Keys live only under ignored `.local/` with mode 0600, in a 0700 directory. Plan mode does not create them. Journals bind actors, both deployment/source identities, preset digest and network. Expected rejections remain `ERROR` and are accepted only when full-validator majority agreed to the exact rollback payload; a terminal lifecycle alone is never success. Public transcripts contain selected RPC fields and test-actor addresses, never keys.
