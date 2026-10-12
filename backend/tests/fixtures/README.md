# Test fixtures

`synthetic_test_fixture_differential_expression.csv` is **not real data
from any NASA dataset**. This project never obtained OSD-720/GLDS-699's
actual processed files (see docs/data-sources.md — the OSDR file browser
requires manual interaction this project's tooling cannot do). This
fixture only mimics the *column-naming convention* GeneLab uses (confirmed
from a different, real dataset's file listing during research for Step 6 —
see docs/data-sources.md) so `app/services/ingestion.py` can be tested
against realistic headers. Every gene ID and numeric value in it is
fabricated for the test and must never be cited as a scientific finding.
