from __future__ import annotations

import json
import os
from pathlib import Path

from solcx import compile_standard, get_installed_solc_versions, install_solc


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "KoshunPay.sol"
ARTIFACTS_DIR = ROOT / "artifacts"
SOLCX_DIR = ROOT / ".solcx"
SOLC_VERSION = "0.8.24"


def main() -> None:
    os.environ["SOLCX_BINARY_PATH"] = str(SOLCX_DIR)
    SOLCX_DIR.mkdir(parents=True, exist_ok=True)
    try:
        install_solc(SOLC_VERSION, solcx_binary_path=str(SOLCX_DIR))
    except Exception as exc:
        installed = {str(v) for v in get_installed_solc_versions(solcx_binary_path=str(SOLCX_DIR))}
        if SOLC_VERSION not in installed:
            raise RuntimeError(
                "Solc is not installed and cannot be downloaded in this environment. "
                "Install solc 0.8.24 locally and re-run."
            ) from exc

    source = CONTRACT_PATH.read_text(encoding="utf-8")

    compiled = compile_standard(
        {
            "language": "Solidity",
            "sources": {"KoshunPay.sol": {"content": source}},
            "settings": {
                "optimizer": {"enabled": True, "runs": 200},
                "outputSelection": {"*": {"*": ["abi", "evm.bytecode.object"]}},
            },
        },
        solc_version=SOLC_VERSION,
    )

    contract = compiled["contracts"]["KoshunPay.sol"]["KoshunPay"]
    artifact = {
        "contractName": "KoshunPay",
        "abi": contract["abi"],
        "bytecode": contract["evm"]["bytecode"]["object"],
        "solcVersion": SOLC_VERSION,
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS_DIR / "KoshunPay.json").write_text(json.dumps(artifact, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
