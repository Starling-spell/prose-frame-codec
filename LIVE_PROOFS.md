# StudioNet proofs

The deployed Python source matches the pinned repository source. All three
transactions below finalized with successful execution and majority agreement.
The journal records each signer, nonce, fee quote, fetched specification,
normalized layout, and verified readback.
[Deployment](https://explorer-studio.genlayer.com/address/0xE9517e8c06aC36b70F1711843E84C56594bc1B6f) ·
[Machine-readable journal](PROOFS.json)

| Transaction | Verified result |
| --- | --- |
| [Deploy](https://explorer-studio.genlayer.com/tx/0x7447c4705f093cf0b472f9d9b6874a0db0330207375e24765e34bca3d8d187cd) | The deployed source matched the pinned commit. |
| [Compile signed specification](https://explorer-studio.genlayer.com/tx/0x70051a93e9395086159d3cd31be2fa29f1b4886efd267c5181070af5bfa243e6) | `bd96` decoded to delta −3 and reading 37. Encoding returned `bd96`. |
| [Compile unsigned specification](https://explorer-studio.genlayer.com/tx/0x22d49d164ef25ca837b7fd3f1c56d725fa8b611b1c8c793c71b6a0fdb76fa718) | `bd96` decoded to delta 29 and reading 37. Encoding returned `bd96`. |

Both normalized layouts have field offsets 0, 3, 8, and 14 bits from the
beginning of the frame. The read-only call for `bd97` reverted on each
layout because the last two bits differ from the required binary `10`.
The specifications describe synthetic frames.
[Signed specification](https://github.com/Starling-spell/prose-frame-codec/blob/c69cf85f6276d9a4af83d2953ac6e858a9dcca50/fixtures/signed.txt) ·
[Unsigned specification](https://github.com/Starling-spell/prose-frame-codec/blob/c69cf85f6276d9a4af83d2953ac6e858a9dcca50/fixtures/unsigned.txt)

The runner submitted zero value to the contract. It paid StudioNet protocol
fees with test GEN from Studio's faucet in a temporary account.
