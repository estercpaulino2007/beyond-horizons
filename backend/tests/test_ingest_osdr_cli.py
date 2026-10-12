"""End-to-end test for scripts/ingest_osdr.py, run as a real subprocess
(not imported), so this also catches wiring bugs the unit tests for
app.services.ingestion/provenance wouldn't (argument parsing, the sys.path
setup, JSON serialization of the final payload).
"""

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "ingest_osdr.py"
FIXTURE = Path(__file__).parent / "fixtures" / "synthetic_test_fixture_differential_expression.csv"


def _run(*extra_args: str, output: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [
            sys.executable, str(SCRIPT),
            "--input", str(FIXTURE),
            "--source-url", "https://osdr.nasa.gov/bio/repo/data/studies/OSD-720",
            "--organism", "Mus musculus",
            "--tissue", "Left ventricle",
            "--condition", "ground_based_simulated_radiation",
            "--limitation", "TEST FIXTURE: fabricated values, not real GLDS-699 data",
            "--output", str(output),
            *extra_args,
        ],
        capture_output=True,
        text=True,
    )


def test_cli_succeeds_for_a_verified_dataset_id(tmp_path):
    output = tmp_path / "result.json"
    proc = _run("--dataset-id", "OSD-720", output=output)
    assert proc.returncode == 0, proc.stderr
    assert "6/10 DEGs" in proc.stdout

    payload = json.loads(output.read_text())
    assert payload["evidence"]["dataset_id"] == "OSD-720"
    assert payload["column_mapping"]["gene_id_col"] == "gene_id"
    assert payload["summary"]["deg_count"] == 6


def test_cli_fails_cleanly_for_an_unverified_dataset_id(tmp_path):
    output = tmp_path / "should_not_exist.json"
    proc = _run("--dataset-id", "GLDS-473", output=output)
    assert proc.returncode == 1
    assert "not in the verified-source registry" in proc.stderr
    assert not output.exists()


def test_cli_requires_either_input_or_url(tmp_path):
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--dataset-id", "OSD-720",
         "--source-url", "https://osdr.nasa.gov/bio/repo/data/studies/OSD-720",
         "--condition", "ground_based_simulated_radiation", "--limitation", "x"],
        capture_output=True, text=True,
    )
    assert proc.returncode != 0
    assert "--input" in proc.stderr or "required" in proc.stderr.lower()


def test_cli_rejects_invalid_condition_choice(tmp_path):
    output = tmp_path / "result.json"
    proc = _run("--dataset-id", "OSD-720", "--condition", "not_a_real_condition", output=output)
    assert proc.returncode != 0
