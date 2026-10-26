# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Example cross-contract consumer; no value transfer or claim of root cause."""
from genlayer import *
import hashlib
import json
import re

PROTOCOL = "semanticpartition-complete-edge-v1"


def _json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _hash(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _fail(message):
    raise gl.vm.UserError(message)


def _address(value):
    if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", value):
        _fail("Invalid 20-byte address")
    return value.lower()


class PartitionConsumer(gl.Contract):
    provider: str
    receipts: TreeMap[str, str]

    def __init__(self, provider_address: str):
        self.provider = _address(provider_address)

    @gl.public.write
    def consume(self, receipt_id: str, owner: str, batch_id: str, certificate_id: str,
                expected_digest: str, expected_batch_digest: str, expected_scope_sha256: str,
                expected_members_json: str) -> None:
        if not isinstance(receipt_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", receipt_id):
            _fail("Invalid receipt identifier")
        sender = _address(gl.message.sender_address.as_hex)
        key = sender + ":" + receipt_id
        if key in self.receipts:
            _fail("Consumer receipt is immutable")
        owner = _address(owner)
        # Primary API source: official documentation's synchronous IC view calls.
        provider = gl.get_contract_at(Address(self.provider))
        raw = provider.view().get_certificate(owner, batch_id, certificate_id)
        try:
            certificate = json.loads(raw)
            members = json.loads(expected_members_json)
        except (ValueError, TypeError):
            _fail("Certificate and intended members must be JSON")
        if not isinstance(certificate, dict) or certificate.get("protocol") != PROTOCOL or certificate.get("relation") != "COMPLETE_DUPLICATE_CLIQUE":
            _fail("Provider has no compatible complete group certificate")
        if certificate.get("provider") != self.provider or certificate.get("chain_id") != int(gl.message.chain_id):
            _fail("Certificate belongs to another provider or chain")
        if certificate.get("owner") != owner or certificate.get("batch_id") != batch_id or certificate.get("id") != certificate_id:
            _fail("Certificate identity differs from consumer intent")
        without_digest = {field: value for field, value in certificate.items() if field != "digest"}
        if certificate.get("digest") != _hash(_json(without_digest)) or certificate["digest"] != expected_digest:
            _fail("Certificate digest differs from consumer intent")
        if certificate.get("batch_digest") != expected_batch_digest or certificate.get("scope_sha256") != expected_scope_sha256:
            _fail("Batch or scope differs from consumer intent")
        if not isinstance(members, list) or not 2 <= len(members) <= 6 or members != certificate.get("members"):
            _fail("Group membership differs from consumer intent")
        if certificate.get("members_sha256") != _hash(_json(members)):
            _fail("Group membership commitment is invalid")
        pair_count = len(members) * (len(members) - 1) // 2
        if certificate.get("pair_count") != pair_count or len(certificate.get("pair_digests", [])) != pair_count:
            _fail("Complete pair coverage is missing")
        receipt = {"id": receipt_id, "consumer": sender, "provider": self.provider,
                   "chain_id": int(gl.message.chain_id), "consumer_contract": _address(gl.message.contract_address.as_hex), "owner": owner,
                   "batch_id": batch_id, "certificate_id": certificate_id, "certificate_digest": expected_digest,
                   "batch_digest": expected_batch_digest, "scope_sha256": expected_scope_sha256,
                   "members_sha256": certificate["members_sha256"], "members": members,
                   "pair_count": pair_count, "purpose": "Explicit reliance on an immutable bounded report group"}
        receipt["digest"] = _hash(_json(receipt))
        self.receipts[key] = _json(receipt)

    @gl.public.view
    def get_receipt(self, consumer: str, receipt_id: str) -> str:
        return self.receipts.get(_address(consumer) + ":" + receipt_id, "null")

    @gl.public.view
    def get_provider(self) -> str:
        return self.provider
