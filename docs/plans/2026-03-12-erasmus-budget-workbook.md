# Erasmus Budget Workbook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable Python generator that creates a formatted Excel workbook titled `Opening: The Granular Financial Breakdown` with summary, detail, and audit sheets for the Erasmus+ consortium budget.

**Architecture:** Store the partner budget inputs in a single Python data structure, generate workbook sheets with `openpyxl`, and use Excel formulas for all rollups and control checks. Validate the workbook with a test that opens the generated file and asserts sheet structure, totals, and key control outputs.

**Tech Stack:** Python 3.14, `openpyxl`, standard-library `unittest`

---

### Task 1: Add the failing workbook validation test

**Files:**
- Create: `tests/test_erasmus_budget_workbook.py`
- Test: `tests/test_erasmus_budget_workbook.py`

**Step 1: Write the failing test**

Write a `unittest` module that:
- Imports the generator module
- Calls the workbook creation entry point into a temporary file
- Asserts the workbook contains `Overview`, `Partner_Detail`, and `Checks`
- Asserts the overview grand total is `1250000`
- Asserts the checks sheet reports zero variance for all partners and the consortium

**Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_erasmus_budget_workbook -v`
Expected: FAIL because the generator module does not exist yet

**Step 3: Write minimal implementation**

Create the generator module with the smallest working data structure and workbook builder needed to satisfy the test.

**Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_erasmus_budget_workbook -v`
Expected: PASS

### Task 2: Implement workbook formatting and formulas

**Files:**
- Create: `scripts/create_erasmus_budget_workbook.py`
- Modify: `tests/test_erasmus_budget_workbook.py`
- Test: `tests/test_erasmus_budget_workbook.py`

**Step 1: Write the failing test**

Extend the test to assert:
- Title text exists on `Overview`
- Summary rows cover all seven partners
- Formula cells exist for partner totals and check variances
- Workbook metadata or output filename is stable

**Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_erasmus_budget_workbook -v`
Expected: FAIL on missing formatting/formula expectations

**Step 3: Write minimal implementation**

Implement:
- Shared styles
- Column widths and freeze panes
- Overview formulas referencing detail totals where appropriate
- Checks formulas comparing stated versus calculated totals

**Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_erasmus_budget_workbook -v`
Expected: PASS

### Task 3: Generate the production workbook and inspect it

**Files:**
- Modify: `scripts/create_erasmus_budget_workbook.py`
- Create: `output/erasmus_budget_opening_granular_financial_breakdown.xlsx`
- Test: `tests/test_erasmus_budget_workbook.py`

**Step 1: Write the failing test**

Add a test that runs the production output path and confirms the workbook can be reopened without corruption.

**Step 2: Run test to verify it fails**

Run: `python -m unittest tests.test_erasmus_budget_workbook -v`
Expected: FAIL if output generation path or workbook save flow is incomplete

**Step 3: Write minimal implementation**

Add a CLI entry point that saves the workbook to `output/erasmus_budget_opening_granular_financial_breakdown.xlsx`.

**Step 4: Run test to verify it passes**

Run: `python -m unittest tests.test_erasmus_budget_workbook -v`
Expected: PASS

### Task 4: Recalculate and verify workbook integrity

**Files:**
- Modify: `scripts/create_erasmus_budget_workbook.py` if verification reveals issues
- Test: `output/erasmus_budget_opening_granular_financial_breakdown.xlsx`

**Step 1: Generate workbook**

Run: `python scripts/create_erasmus_budget_workbook.py`
Expected: Workbook created under `output/`

**Step 2: Recalculate formulas**

Run: `python chem_canvas/skills/skills/xlsx/recalc.py output/erasmus_budget_opening_granular_financial_breakdown.xlsx`
Expected: Success or an explicit error list to fix

**Step 3: Re-open workbook and verify control outputs**

Run a Python one-liner or the test suite to confirm totals and sheet structure remain correct after recalculation.

**Step 4: Commit**

Run:
```bash
git add docs/plans/2026-03-12-erasmus-budget-design.md docs/plans/2026-03-12-erasmus-budget-workbook.md tests/test_erasmus_budget_workbook.py scripts/create_erasmus_budget_workbook.py output/erasmus_budget_opening_granular_financial_breakdown.xlsx
git commit -m "feat: add Erasmus budget workbook generator"
```
