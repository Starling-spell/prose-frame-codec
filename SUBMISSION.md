**Contribution type** Builder → Intelligent Contracts

**Title** ProseFrameCodec — Onchain Binary Codecs from Published Specifications

ProseFrameCodec turns a published binary frame specification into an
executable onchain codec. The leader and validators independently fetch the
full commit-pinned source, verify its SHA-256, and interpret the ordered field
names, widths, signedness, and constant bits. They compare the source text and
every normalized layout field. Those fields determine the bits produced by the
encoder and the values returned by the decoder.

The demo compiles two authored specifications for the same two-byte frame.
Changing only the delta field from signed to unsigned changes the decoded
value of `bd96` from −3 to 29. Both layouts regenerate the original frame
from those decoded values and reject a frame with an invalid trailer.
Hardware compatibility depends on the published format and its agreed
interpretation. Local tests cover all 4,096 valid fixture payloads.

- [Repository](https://github.com/Starling-spell/prose-frame-codec)
- [Pinned deployed source](https://github.com/Starling-spell/prose-frame-codec/blob/c69cf85f6276d9a4af83d2953ac6e858a9dcca50/contracts/ProseFrameCodec.py)
- [StudioNet deployment](https://explorer-studio.genlayer.com/address/0xE9517e8c06aC36b70F1711843E84C56594bc1B6f)
- [Finalized receipts and codec readbacks](https://github.com/Starling-spell/prose-frame-codec/blob/main/LIVE_PROOFS.md)
