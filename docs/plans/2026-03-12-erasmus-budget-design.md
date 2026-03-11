# Erasmus Budget Workbook Design

**Date:** 2026-03-12
**Topic:** Opening: The Granular Financial Breakdown

## Goal

Create a presentation-ready Excel workbook for an Erasmus+ consortium budget that is easy to read in internal planning, easy to audit against partner-level figures, and safe for later updates.

## Approved Structure

The workbook will use Option 1:

- `Overview`
- `Partner_Detail`
- `Checks`

## Sheet Design

### `Overview`

Purpose: give a one-screen financial summary for all seven partners.

Content:

- Workbook title: `Opening: The Granular Financial Breakdown`
- One summary row per partner
- Columns for personnel, subcontracting, travel, equipment, other goods, indirect, and total budget
- Grand total row for the consortium

### `Partner_Detail`

Purpose: preserve the granular personnel inputs and expose every named allocation.

Content:

- One row per person with partner, work-package label, person name, role, monthly rate, adjusted PMs, and personnel cost
- Partner-level “other costs” rows for subcontracting, travel, equipment, other goods, and indirect
- Formula-driven partner subtotals

### `Checks`

Purpose: provide fast audit controls.

Content:

- One control row per partner
- Stated budget versus calculated detail total
- Variance column
- Consortium total control against `€1,250,000.00`
- Clear `OK` / `CHECK` status

## Formatting Rules

- Hardcoded input values in blue font
- Formula cells in black font
- Euro amounts formatted with parentheses for negatives and `-` for zero
- PMs shown with two decimals where needed
- Frozen header rows and autofilters on tabular sections
- Strong section headers, light fills, and print-friendly column widths

## Assumptions

- The user wants a real `.xlsx` workbook, not a chat-only table
- The workbook should prioritize readability and auditability over portal-specific import structure
- The user-provided figures are authoritative, including the stated consortium ceiling of `€1,250,000.00`

## Output

- Generated Excel workbook saved in the workspace
- Supporting generator script saved in the workspace for future updates
- Validation test to confirm sheet names, totals, and control formulas
