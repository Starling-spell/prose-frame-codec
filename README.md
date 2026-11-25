# ProseFrameCodec

ProseFrameCodec compiles a published binary frame specification into an
onchain codec. The leader and validators independently fetch the complete
commit-pinned UTF-8 source, verify its SHA-256, and extract the ordered
field names, bit widths, encodings, and fixed values. Consensus compares
the full source and exact layout. The stored layout determines how the
codec reads and writes each bit.

The demo specifications use the same two-byte structure with one semantic
difference. One defines the five-bit delta as signed two's complement, and
the other defines it as unsigned. The same bytes `bd96` decode to delta
−3 or 29 respectively. Both layouts enforce the sync and trailer bits.
Encoding those decoded values regenerates the original packet.

- `compile_format(coordinate, sha256)` installs the immutable layout and returns its ID.
- `get_format(key)` returns the acquired prose, SHA-256, normalized fields, and offsets.
- `decode(key, frame_hex)` returns variable field values from a hex string.
- `encode(key, values_json)` encodes a JSON object containing exactly the variable fields.

Offsets count from the first byte's most significant bit. The codec supports
one to eight whole bytes, up to twelve fields, and field widths of 1–16 bits.
Each field is signed, unsigned, or fixed. Decoding verifies every fixed field
and encoding inserts those bits automatically. Unclear specifications can
produce an UNKNOWN record with no executable layout. The examples are authored
packet formats. The resulting codec is conditional on the published prose and
the agreed interpretation. [GenLayer equivalence principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)

```sh
python -m pip install -r requirements-dev.txt
genvm-lint check contracts/ProseFrameCodec.py
python -m pytest tests -q
```

[StudioNet proofs](LIVE_PROOFS.md) · [Submission text](SUBMISSION.md)

Replay the published receipt, source, and codec checks using read-only RPC.

```sh
npm ci --ignore-scripts
node scripts/live.mjs --verify-only
```
