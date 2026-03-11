from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output" / "erasmus_budget_opening_granular_financial_breakdown.xlsx"

INPUT_BLUE = "0000FF"
FORMULA_BLACK = "000000"
HEADER_FILL = "1F4E78"
SECTION_FILL = "D9EAF7"
SUBTLE_FILL = "F4F7FB"
WHITE = "FFFFFF"
THIN = Side(style="thin", color="B7C9D6")

CURRENCY_FORMAT = '€#,##0.00;[Red](€#,##0.00);-'
PM_FORMAT = "0.00"


PARTNERS = [
    {
        "name": "UNIVERSITY OF MALTA (UM)",
        "wp": "Coordinator (WP1)",
        "personnel_total": 178607.48,
        "stated_total": 235000.00,
        "personnel": [
            {
                "name": "Prof. Matthew Montebello",
                "role": "Project Coordinator",
                "rate": 7232.93,
                "pms": 10.30,
                "cost": 74499.18,
            },
            {
                "name": "Dr. Vanessa Camilleri",
                "role": "Senior Researcher",
                "rate": 5112.52,
                "pms": 12.87,
                "cost": 65808.35,
            },
            {
                "name": "Research Support Officer",
                "role": "RSO II - Project Manager",
                "rate": 2976.60,
                "pms": 12.86,
                "cost": 38299.95,
            },
        ],
        "other_costs": {
            "Subcontracting": 15000.00,
            "Travel": 10000.00,
            "Equipment": 2000.00,
            "Other Goods": 15000.00,
            "Indirect": 14392.52,
        },
    },
    {
        "name": "HUMBOLDT-UNIVERSITÄT ZU BERLIN (UBER)",
        "wp": "WP3/WP4",
        "personnel_total": 172177.57,
        "stated_total": 196000.00,
        "personnel": [
            {
                "name": "Prof. Dr. Rüdiger Tiemann",
                "role": "Scientific Director / Pedagogical Lead",
                "rate": 8800.00,
                "pms": 5.00,
                "cost": 44000.00,
            },
            {
                "name": "Smita Singh",
                "role": "Researcher / Scientific Co-worker, TV-L E13 scaled",
                "rate": 7495.00,
                "pms": 17.10,
                "cost": 128177.57,
            },
        ],
        "other_costs": {
            "Subcontracting": 0.00,
            "Travel": 6000.00,
            "Equipment": 1000.00,
            "Other Goods": 4000.00,
            "Indirect": 12822.43,
        },
    },
    {
        "name": "ELLINOGERMANIKI AGOGI (EA)",
        "wp": "WP4",
        "personnel_total": 128859.81,
        "stated_total": 155000.00,
        "personnel": [
            {
                "name": "Dr. Sofoklis Sotiriou",
                "role": "Head of R&D",
                "rate": 5000.00,
                "pms": 2.80,
                "cost": 14000.00,
            },
            {
                "name": "Nikos Zygouritsas",
                "role": "Project Manager / Living Lab Coordinator",
                "rate": 5000.00,
                "pms": 8.60,
                "cost": 43000.00,
            },
            {
                "name": "Dimitra Dimitrakopoulou",
                "role": "ICT Teacher / Pedagogical Integration",
                "rate": 5000.00,
                "pms": 7.20,
                "cost": 36000.00,
            },
            {
                "name": "Dimitris Koulentianos",
                "role": "Researcher / AI Data Evaluation",
                "rate": 5000.00,
                "pms": 7.17,
                "cost": 35859.81,
            },
        ],
        "other_costs": {
            "Subcontracting": 0.00,
            "Travel": 8000.00,
            "Equipment": 3000.00,
            "Other Goods": 5000.00,
            "Indirect": 10140.19,
        },
    },
    {
        "name": "MALTA FURTHER AND HIGHER EDUCATION AUTHORITY (MFHEA)",
        "wp": "WP2",
        "personnel_total": 120102.81,
        "stated_total": 136000.00,
        "personnel": [
            {
                "name": "Dr. Jana Kazarjan",
                "role": "Senior Researcher / Policy Senior Manager",
                "rate": 3136.00,
                "pms": 10.70,
                "cost": 33555.20,
            },
            {
                "name": "Jessica Sammut",
                "role": "Researcher / Policy Officer",
                "rate": 3136.00,
                "pms": 9.20,
                "cost": 28851.20,
            },
            {
                "name": "Ryan Saliba",
                "role": "Researcher / Policy Officer",
                "rate": 3136.00,
                "pms": 9.20,
                "cost": 28851.20,
            },
            {
                "name": "Kamen Gechev",
                "role": "Researcher / Policy Officer",
                "rate": 3136.00,
                "pms": 9.20,
                "cost": 28845.21,
            },
        ],
        "other_costs": {
            "Subcontracting": 0.00,
            "Travel": 7000.00,
            "Equipment": 0.00,
            "Other Goods": 0.00,
            "Indirect": 8897.19,
        },
    },
    {
        "name": "CHAMBER OF COMMERCE, INDUSTRY AND SERVICES OF TERRASSA (CCIT)",
        "wp": "WP5",
        "personnel_total": 150224.30,
        "stated_total": 180000.00,
        "personnel": [
            {
                "name": "Josep Prats",
                "role": "Managing Director / Senior Expert",
                "rate": 6000.00,
                "pms": 2.80,
                "cost": 16800.00,
            },
            {
                "name": "Julia Puerta",
                "role": "Project Manager / WP5 Coordinator",
                "rate": 6000.00,
                "pms": 8.35,
                "cost": 50100.00,
            },
            {
                "name": "Alba Cabeza",
                "role": "Head of Digital Transformation",
                "rate": 6000.00,
                "pms": 6.94,
                "cost": 41640.00,
            },
            {
                "name": "Sonia Perez",
                "role": "Training Service Manager",
                "rate": 6000.00,
                "pms": 6.94,
                "cost": 41684.30,
            },
        ],
        "other_costs": {
            "Subcontracting": 0.00,
            "Travel": 8000.00,
            "Equipment": 0.00,
            "Other Goods": 10000.00,
            "Indirect": 11775.70,
        },
    },
    {
        "name": "T2 S.R.L.",
        "wp": "WP3",
        "personnel_total": 142532.71,
        "stated_total": 160000.00,
        "personnel": [
            {
                "name": "Valentin Paraschiva",
                "role": "Project Manager",
                "rate": 6691.00,
                "pms": 2.80,
                "cost": 18734.80,
            },
            {
                "name": "Ion Ungureanu",
                "role": "CTO / AI Architect",
                "rate": 6691.00,
                "pms": 4.30,
                "cost": 28771.30,
            },
            {
                "name": "George Dascalu",
                "role": "Team Leader AI Dev Team",
                "rate": 6691.00,
                "pms": 5.70,
                "cost": 38138.70,
            },
            {
                "name": "Daniela Cojoaca",
                "role": "AI Developer",
                "rate": 6691.00,
                "pms": 8.50,
                "cost": 56887.91,
            },
        ],
        "other_costs": {
            "Subcontracting": 0.00,
            "Travel": 7000.00,
            "Equipment": 0.00,
            "Other Goods": 0.00,
            "Indirect": 10467.29,
        },
    },
    {
        "name": "LITHUANIAN UNIVERSITY OF HEALTH SCIENCES (LSMU)",
        "wp": "WP2/WP4",
        "personnel_total": 167700.93,
        "stated_total": 188000.00,
        "personnel": [
            {
                "name": "Prof. Dr. Gvidas Urbonas",
                "role": "Lead & Senior Researcher / Head of Bioethics",
                "rate": 6280.00,
                "pms": 4.26,
                "cost": 26752.80,
            },
            {
                "name": "Prof. Dr. Kęstutis Petrikonis",
                "role": "Senior Researcher",
                "rate": 6280.00,
                "pms": 4.98,
                "cost": 31274.40,
            },
            {
                "name": "Dr. Renata Kudukytė-Gasperė",
                "role": "Researcher / Living Labs Coordinator",
                "rate": 4676.00,
                "pms": 12.80,
                "cost": 59852.80,
            },
            {
                "name": "Assoc. Prof. Dr. Vita Špečkauskienė",
                "role": "Researcher / AI Data Analytics",
                "rate": 4676.00,
                "pms": 10.65,
                "cost": 49820.93,
            },
        ],
        "other_costs": {
            "Subcontracting": 0.00,
            "Travel": 6000.00,
            "Equipment": 0.00,
            "Other Goods": 2000.00,
            "Indirect": 12299.07,
        },
    },
]


def border():
    return Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def set_input(cell, number_format=None):
    cell.font = Font(color=INPUT_BLUE)
    cell.border = border()
    if number_format:
        cell.number_format = number_format


def set_formula(cell, number_format=None):
    cell.font = Font(color=FORMULA_BLACK)
    cell.border = border()
    if number_format:
        cell.number_format = number_format


def set_text(cell, bold=False, fill=None, color="000000", align="left"):
    cell.font = Font(color=color, bold=bold)
    cell.border = border()
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
    if fill:
        cell.fill = PatternFill("solid", fgColor=fill)


def fill_row(ws, row, fill):
    for col in range(1, 9):
        ws.cell(row=row, column=col).fill = PatternFill("solid", fgColor=fill)


def write_overview(ws):
    ws.title = "Overview"
    ws.merge_cells("A1:H1")
    set_text(ws["A1"], bold=True, fill=HEADER_FILL, color=WHITE, align="center")
    ws["A1"] = "Opening: The Granular Financial Breakdown"

    ws.merge_cells("A2:H2")
    set_text(ws["A2"], fill=SUBTLE_FILL)
    ws["A2"] = (
        "Scaled personnel costs and partner budgets prepared for Erasmus+ internal planning "
        "and portal-ready audit checks."
    )

    headers = [
        "Partner",
        "Personnel (€)",
        "Subcontracting (€)",
        "Travel (€)",
        "Equipment (€)",
        "Other Goods (€)",
        "Indirect (€)",
        "Total Budget (€)",
    ]
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=5, column=col, value=header)
        set_text(cell, bold=True, fill=SECTION_FILL, align="center")

    for row, partner in enumerate(PARTNERS, start=6):
        other = partner["other_costs"]
        values = [
            partner["name"],
            partner["personnel_total"],
            other["Subcontracting"],
            other["Travel"],
            other["Equipment"],
            other["Other Goods"],
            other["Indirect"],
        ]
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row=row, column=col, value=value)
            if col == 1:
                set_text(cell)
            else:
                set_input(cell, CURRENCY_FORMAT)
        total_cell = ws.cell(row=row, column=8, value=f"=SUM(B{row}:G{row})")
        set_formula(total_cell, CURRENCY_FORMAT)

    total_row = 13
    total_labels = ["Consortium Total"]
    for col in range(1, 9):
        cell = ws.cell(row=total_row, column=col)
        set_text(cell, bold=True, fill=HEADER_FILL, color=WHITE)
    ws.cell(row=total_row, column=1, value=total_labels[0])
    for col_letter in "BCDEFGH":
        cell = ws[f"{col_letter}{total_row}"]
        cell.value = f"=SUM({col_letter}6:{col_letter}12)"
        set_formula(cell, CURRENCY_FORMAT)
        cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
        cell.font = Font(color=WHITE, bold=True)

    ws.freeze_panes = "A6"
    ws.auto_filter.ref = "A5:H12"
    widths = {"A": 46, "B": 16, "C": 18, "D": 14, "E": 14, "F": 16, "G": 14, "H": 16}
    for column, width in widths.items():
        ws.column_dimensions[column].width = width


def write_detail(ws):
    ws.title = "Partner_Detail"
    ws.merge_cells("A1:H1")
    set_text(ws["A1"], bold=True, fill=HEADER_FILL, color=WHITE, align="center")
    ws["A1"] = "Partner Personnel and Other Eligible Costs"

    ws.merge_cells("A2:H2")
    set_text(ws["A2"], fill=SUBTLE_FILL)
    ws["A2"] = "Personnel rows are followed by other-cost rows; the Checks sheet validates all partner totals."

    headers = [
        "Partner",
        "Work Package",
        "Entry Type",
        "Item",
        "Role / Description",
        "Monthly Rate (€)",
        "Adjusted PMs",
        "Cost (€)",
    ]
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col, value=header)
        set_text(cell, bold=True, fill=SECTION_FILL, align="center")

    row = 5
    for partner in PARTNERS:
        for person in partner["personnel"]:
            values = [
                partner["name"],
                partner["wp"],
                "Personnel",
                person["name"],
                person["role"],
                person["rate"],
                person["pms"],
                person["cost"],
            ]
            for col, value in enumerate(values, start=1):
                cell = ws.cell(row=row, column=col, value=value)
                if col in {6, 8}:
                    set_input(cell, CURRENCY_FORMAT)
                elif col == 7:
                    set_input(cell, PM_FORMAT)
                else:
                    set_text(cell)
            row += 1

        for category, cost in partner["other_costs"].items():
            values = [
                partner["name"],
                partner["wp"],
                "Other Cost",
                category,
                category,
                None,
                None,
                cost,
            ]
            for col, value in enumerate(values, start=1):
                cell = ws.cell(row=row, column=col, value=value)
                if col == 8:
                    set_input(cell, CURRENCY_FORMAT)
                elif col in {6, 7} and value is None:
                    set_text(cell, fill=SUBTLE_FILL)
                else:
                    set_text(cell)
            row += 1

    ws.freeze_panes = "A5"
    ws.auto_filter.ref = f"A4:H{row - 1}"
    widths = {"A": 46, "B": 18, "C": 14, "D": 28, "E": 38, "F": 16, "G": 14, "H": 16}
    for column, width in widths.items():
        ws.column_dimensions[column].width = width


def write_checks(ws):
    ws.title = "Checks"
    ws.merge_cells("A1:G1")
    set_text(ws["A1"], bold=True, fill=HEADER_FILL, color=WHITE, align="center")
    ws["A1"] = "Audit Controls"

    ws.merge_cells("A2:G2")
    set_text(ws["A2"], fill=SUBTLE_FILL)
    ws["A2"] = "All control variances should resolve to zero after formula recalculation."

    headers = [
        "Partner",
        "Stated Budget (€)",
        "Calculated Detail Total (€)",
        "Variance (€)",
        "Check Type",
        "Threshold (€)",
        "Status",
    ]
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col, value=header)
        set_text(cell, bold=True, fill=SECTION_FILL, align="center")

    for row, partner in enumerate(PARTNERS, start=5):
        ws.cell(row=row, column=1, value=partner["name"])
        ws.cell(row=row, column=2, value=partner["stated_total"])
        ws.cell(row=row, column=3, value=f'=SUMIF(Partner_Detail!$A:$A,A{row},Partner_Detail!$H:$H)')
        ws.cell(row=row, column=4, value=f"=B{row}-C{row}")
        ws.cell(row=row, column=5, value="Partner")
        ws.cell(row=row, column=6, value=0.01)
        ws.cell(row=row, column=7, value=f'=IF(ABS(D{row})<0.01,"OK","CHECK")')
        for col in range(1, 8):
            cell = ws.cell(row=row, column=col)
            if col == 1:
                set_text(cell)
            elif col in {2, 6}:
                set_input(cell, CURRENCY_FORMAT)
            else:
                set_formula(cell, CURRENCY_FORMAT if col in {3, 4} else None)

    total_row = 13
    ws.cell(row=total_row, column=1, value="Consortium Total")
    ws.cell(row=total_row, column=2, value=1250000)
    ws.cell(row=total_row, column=3, value="=SUM(C5:C11)")
    ws.cell(row=total_row, column=4, value="=B13-C13")
    ws.cell(row=total_row, column=5, value="Consortium")
    ws.cell(row=total_row, column=6, value=0.01)
    ws.cell(row=total_row, column=7, value='=IF(ABS(D13)<0.01,"OK","CHECK")')
    for col in range(1, 8):
        cell = ws.cell(row=total_row, column=col)
        if col == 1:
            set_text(cell, bold=True, fill=HEADER_FILL, color=WHITE)
        elif col in {2, 6}:
            set_input(cell, CURRENCY_FORMAT)
            cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
            cell.font = Font(color=WHITE, bold=True)
        else:
            set_formula(cell, CURRENCY_FORMAT if col in {3, 4} else None)
            cell.fill = PatternFill("solid", fgColor=HEADER_FILL)
            cell.font = Font(color=WHITE, bold=True)

    ws.freeze_panes = "A5"
    ws.auto_filter.ref = "A4:G11"
    widths = {"A": 46, "B": 18, "C": 24, "D": 14, "E": 14, "F": 14, "G": 12}
    for column, width in widths.items():
        ws.column_dimensions[column].width = width


def build_budget_workbook(output_path: Path | str = DEFAULT_OUTPUT) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    wb = Workbook()
    overview = wb.active
    detail = wb.create_sheet("Partner_Detail")
    checks = wb.create_sheet("Checks")

    write_overview(overview)
    write_detail(detail)
    write_checks(checks)

    wb.properties.creator = "OpenAI Codex"
    wb.properties.title = "Opening: The Granular Financial Breakdown"
    wb.calculation.calcMode = "auto"
    wb.calculation.fullCalcOnLoad = True
    wb.calculation.forceFullCalc = True
    wb.save(output_path)
    return output_path


if __name__ == "__main__":
    path = build_budget_workbook(DEFAULT_OUTPUT)
    print(path)
