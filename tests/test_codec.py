import hashlib
import json
import re
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
BASE = "Starling-spell/prose-frame-codec/" + "a" * 40 + "/fixtures/"


def response(delta_kind):
    return {"status": "READY", "fields": [
        {"name": "sync", "width": 3, "kind": "constant", "value": 5},
        {"name": "delta", "width": 5, "kind": delta_kind, "value": None},
        {"name": "reading", "width": 6, "kind": "unsigned", "value": None},
        {"name": "trailer", "width": 2, "kind": "constant", "value": 2},
    ]}


@pytest.fixture
def codec(direct_deploy):
    instance = direct_deploy(str(ROOT / "contracts/ProseFrameCodec.py"))
    return instance, sys.modules[type(instance._instance).__module__]


def mock(vm, name, body, answer, status=200):
    coordinate = BASE + name + ".txt"
    vm.clear_mocks()
    vm.mock_web(re.escape("https://raw.githubusercontent.com/" + coordinate) + "$", {
        "method": "GET", "response": {"status": status, "headers": {}, "body": body},
    })
    vm.mock_llm(r".*PROSE FRAME CODEC.*", json.dumps(answer))
    return coordinate


@pytest.mark.parametrize(("kind", "delta"), [("signed", -3), ("unsigned", 29)])
def test_compilation_changes_codec_semantics(codec, direct_vm, kind, delta):
    contract, mod = codec
    body = (ROOT / "fixtures" / (kind + ".txt")).read_bytes()
    coordinate = mock(direct_vm, kind, body, response(kind))
    digest = hashlib.sha256(body).hexdigest()
    key = contract.compile_format(coordinate, digest)
    assert direct_vm.run_validator()
    record = contract.get_format(key)
    assert record["text"] == body.decode()
    assert [field["offset"] for field in record["layout"]["fields"]] == [0, 3, 8, 14]
    opposite = {"signed": "unsigned", "unsigned": "signed"}[kind]
    forged = {**record, "layout": mod.validate_layout(response(opposite))}
    assert not direct_vm.run_validator(leader_result=mod.canonical(forged))
    mock(direct_vm, kind, body + b" ", response(kind))
    assert not direct_vm.run_validator()
    assert contract.compile_format(coordinate, digest) == key
    assert contract.decode(key, "bd96") == {"delta": delta, "reading": 37}
    assert contract.encode(key, json.dumps({"delta": delta, "reading": 37})) == "bd96"
    with direct_vm.expect_revert("Constant bits do not match"):
        contract.decode(key, "bd97")
    with direct_vm.expect_revert("Value outside its field range"):
        contract.encode(key, '{"delta":32,"reading":37}')


def test_every_demo_payload_matches_independent_bit_arithmetic(codec):
    _, mod = codec
    for kind, start in (("signed", -16), ("unsigned", 0)):
        layout = mod.validate_layout(response(kind))
        for delta in range(start, start + 32):
            for reading in range(64):
                values = {"delta": delta, "reading": reading}
                frame = bytes([160 + delta % 32, 4 * reading + 2]).hex()
                assert mod.encode_packet(layout, json.dumps(values)) == frame
                assert mod.decode_packet(layout, frame) == values


@pytest.mark.parametrize("field", [
    {"name": "sync", "width": 8, "kind": "constant", "value": 256},
    {"name": "bad-name", "width": 8, "kind": "unsigned", "value": None},
    {"name": "delta", "width": True, "kind": "unsigned", "value": None},
    {"name": "delta", "width": 7, "kind": "signed", "value": None},
])
def test_invalid_layouts_are_rejected(codec, field):
    _, mod = codec
    with pytest.raises(ValueError):
        mod.validate_layout({"status": "READY", "fields": [field]})


def test_source_failure_and_unknown_format(codec, direct_vm):
    contract, _ = codec
    body = (ROOT / "fixtures/signed.txt").read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    unknown = {"status": "UNKNOWN", "fields": []}
    coordinate = mock(direct_vm, "signed", body, unknown, 404)
    with direct_vm.expect_revert("acquisition or interpretation failed"):
        contract.compile_format(coordinate, digest)
    mock(direct_vm, "signed", body, unknown)
    key = contract.compile_format(coordinate, digest)
    assert contract.get_format(key)["layout"] == {"status": "UNKNOWN", "length_bytes": None, "fields": []}
    with direct_vm.expect_revert("Frame format is unresolved"):
        contract.decode(key, "bd96")
