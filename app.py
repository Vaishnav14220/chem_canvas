from __future__ import annotations

import os
import math
from textwrap import dedent
from typing import List, Sequence, Tuple

import gradio as gr
import plotly.graph_objects as go

from nist_kinetics_api import (
    Category,
    FieldName,
    LeftParenthesis,
    LogicalOperator,
    NistKineticsClient,
    ReactionDetail,
    Relation,
    RightParenthesis,
    SearchFilter,
    SearchRequest,
)

client = NistKineticsClient()
MAX_FILTERS = 5

FIELD_CHOICES = [
    ("Reactant", FieldName.reactants.value),
    ("Product", FieldName.products.value),
    ("Reaction Order", FieldName.rxn_order.value),
    ("Reference Reactant", FieldName.ref_rxn_reactants.value),
    ("Reference Product", FieldName.ref_rxn_products.value),
    ("Reference Reaction Order", FieldName.ref_rxn_order.value),
    ("Low Temperature", FieldName.t_low.value),
    ("High Temperature", FieldName.t_high.value),
    ("Low Pressure", FieldName.p_low.value),
    ("High Pressure", FieldName.p_high.value),
    ("Bath Gas", FieldName.bath_gas.value),
    ("Squib", FieldName.squib.value),
]

RELATION_CHOICES = [
    ("contains", Relation.contains.value),
    ("is", Relation.equals.value),
    ("is not", Relation.not_equals.value),
    ("does not contain", Relation.not_contains.value),
    ("<", Relation.lt.value),
    ("≤", Relation.lte.value),
    (">", Relation.gt.value),
    ("≥", Relation.gte.value),
]

PAREN_CHOICES = [
    (" ", ""),
    ("(", "("),
    ("((", "(("),
]

RPAREN_CHOICES = [
    (" ", ""),
    (")", ")"),
    ("))", "))"),
]

CATEGORY_CHOICES = [
    ("Any result type", str(Category.any.value)),
    ("Review", str(Category.review.value)),
    ("Experiment / experiment extrapolated by theory", str(Category.experiment.value)),
    ("Theory / estimate", str(Category.theory.value)),
]


def _build_filters(raw_values: Sequence[str]) -> List[SearchFilter]:
    filters: List[SearchFilter] = []
    stride = 6
    for idx in range(MAX_FILTERS):
        offset = idx * stride
        boolean_val, lp_val, field_val, relation_val, text_val, rp_val = raw_values[offset : offset + stride]
        text_val = (text_val or "").strip()
        if not text_val:
            continue

        try:
            filter_obj = SearchFilter(
                boolean=None if idx == 0 else LogicalOperator(boolean_val or LogicalOperator.and_.value),
                left_parenthesis=LeftParenthesis(lp_val or ""),
                field=FieldName(field_val or FieldName.reactants.value),
                relation=Relation(relation_val or Relation.contains.value),
                value=text_val,
                right_parenthesis=RightParenthesis(rp_val or ""),
            )
        except ValueError as exc:
            raise ValueError(f"Invalid filter configuration in row {idx + 1}: {exc}") from exc

        filters.append(filter_obj)

    return filters


def _summaries_to_table(results) -> List[List[str]]:
    table = []
    for idx, summary in enumerate(results, start=1):
        row = [idx, summary.record_count, summary.reaction, summary.detail_url]
        table.append(row)
    return table


def _summaries_to_dropdown(results) -> List[tuple[str, str]]:
    choices = []
    for idx, summary in enumerate(results, start=1):
        label = f"{idx}. ({summary.record_count} recs) {summary.reaction}"
        choices.append((label[:350], summary.detail_url))
    return choices


def perform_search(*inputs):
    raw_filter_values = inputs[: MAX_FILTERS * 6]
    decomposition_only = bool(inputs[MAX_FILTERS * 6])
    category_raw = inputs[MAX_FILTERS * 6 + 1] or str(Category.any.value)
    units_value = (inputs[MAX_FILTERS * 6 + 2] or "").strip() or None

    try:
        filters = _build_filters(raw_filter_values)
    except ValueError as exc:
        return [], f"⚠️ {exc}", gr.update(choices=[], value=None, interactive=False), []

    if not filters:
        return [], "⚠️ Enter at least one filter value.", gr.update(choices=[], value=None, interactive=False), []

    request = SearchRequest(
        filters=filters,
        decomposition_only=decomposition_only,
        category=Category(int(category_raw)),
        units=units_value,
    )

    try:
        results = client.search(request)
    except Exception as exc:  # pragma: no cover - network/parsing issues
        return [], f"🚨 Search failed: {exc}", gr.update(choices=[], value=None, interactive=False), []

    table_data = _summaries_to_table(results)
    dropdown_choices = _summaries_to_dropdown(results)
    status = f"✅ Found {len(results)} matching reactions." if results else "No records matched this query."
    dropdown_update = gr.update(
        choices=dropdown_choices,
        value=None,
        interactive=bool(dropdown_choices),
        label="Select a reaction from the latest search",
    )
    state_payload = [
        {"record_count": summary.record_count, "reaction": summary.reaction, "detail_url": summary.detail_url}
        for summary in results
    ]
    return table_data, status, dropdown_update, state_payload


def _format_detail_markdown(detail: ReactionDetail, detail_url: str) -> str:
    lines = []
    if detail.title:
        lines.append(f"### {detail.title}")
    if detail.rate_expression:
        lines.append(f"**Rate expression:** {detail.rate_expression}")
    if detail.rate_expression_units:
        ru = detail.rate_expression_units
        pieces = []
        if ru.first_order:
            pieces.append(f"1st order: `{ru.first_order}`")
        if ru.second_order:
            pieces.append(f"2nd order: `{ru.second_order}`")
        if ru.third_order:
            pieces.append(f"3rd order: `{ru.third_order}`")
        if pieces:
            lines.append("**Rate expression units**  " + " · ".join(pieces))
    if detail.physical_units:
        pu = detail.physical_units
        bullet_items = []
        for label, value in [
            ("Energy", pu.energy),
            ("Molecular", pu.molecular),
            ("Pressure", pu.pressure),
            ("Temperature", pu.temperature),
            ("Base volume", pu.base_volume),
            ("Reference Temp", pu.reference_temperature),
            ("Evaluation Temp", pu.evaluation_temperature),
        ]:
            if value:
                bullet_items.append(f"- **{label}:** {value}")
        if bullet_items:
            lines.append("**Unit settings**")
            lines.extend(bullet_items)

    lines.append(f"[View on NIST]({detail_url})")
    return "\n\n".join(lines)


def _datasets_to_table(detail: ReactionDetail) -> List[List[str]]:
    rows: List[List[str]] = []
    for entry in detail.datasets:
        rows.append(
            [
                entry.section or "",
                entry.squib or "",
                entry.temperature_range or "",
                entry.pre_exponential_factor or "",
                entry.temperature_exponent or "",
                entry.activation_energy or "",
                entry.rate_at_298 or "",
                entry.reaction_order or "",
                entry.squib_url or "",
            ]
        )
    return rows


def fetch_detail(selected_url: str, manual_url: str):
    detail_url = (manual_url or "").strip() or (selected_url or "").strip()
    if not detail_url:
        return "ℹ️ Select a reaction above or paste a detail URL.", []

    try:
        detail = client.fetch_reaction_detail(detail_url)
    except Exception as exc:  # pragma: no cover - network/parsing issues
        return f"🚨 Could not load detail: {exc}", []

    markdown = _format_detail_markdown(detail, detail_url)
    table = _datasets_to_table(detail)
    if not table:
        markdown += "\n\n_No kinetics datasets were returned for this reaction._"
    return markdown, table


def _parse_points(text: str) -> Tuple[List[float], List[float], List[str]]:
    temps: List[float] = []
    rates: List[float] = []
    errors: List[str] = []

    if not text.strip():
        return temps, rates, errors

    for idx, line in enumerate(text.strip().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        if "," in line:
            parts = [p.strip() for p in line.split(",", 1)]
        else:
            parts = line.split()
        if len(parts) != 2:
            errors.append(f"Line {idx}: expected 'T,k' (comma or whitespace separated).")
            continue
        try:
            T_val = float(parts[0])
            k_val = float(parts[1])
            if T_val <= 0 or k_val <= 0:
                raise ValueError
        except ValueError:
            errors.append(f"Line {idx}: invalid numeric pair '{line}'.")
            continue
        temps.append(T_val)
        rates.append(k_val)
    return temps, rates, errors


def generate_arrhenius_plot(A, n, Ea, Tmin, Tmax, num_points, point_text):
    try:
        Tmin = float(Tmin)
        Tmax = float(Tmax)
        num_points = int(num_points)
    except (TypeError, ValueError):
        return None, "⚠️ Temperature limits and sample count must be numeric."

    if Tmin <= 0 or Tmax <= 0 or Tmin >= Tmax:
        return None, "⚠️ Temperature bounds must be positive with Tmin < Tmax."
    if num_points < 2 or num_points > 2000:
        return None, "⚠️ Number of samples must be between 2 and 2000."
    if A <= 0:
        return None, "⚠️ Pre-exponential factor A must be positive."

    temps = [Tmin + (Tmax - Tmin) * i / (num_points - 1) for i in range(num_points)]
    R = 8.314462618  # J/mol·K
    rates = [
        A * ((t / 298.0) ** n) * math.exp(-Ea / (R * t))
        for t in temps
    ]
    arrhenius_x = [1000.0 / t for t in temps]
    arrhenius_y = [math.log(k) for k in rates]

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=arrhenius_x,
            y=arrhenius_y,
            mode="lines",
            name="Fitted k(T)",
            line=dict(color="#2563eb"),
        )
    )

    obs_t, obs_k, errors = _parse_points(point_text or "")
    if obs_t:
        fig.add_trace(
            go.Scatter(
                x=[1000.0 / t for t in obs_t],
                y=[math.log(k) for k in obs_k],
                mode="markers",
                name="Data points",
                marker=dict(size=10, color="#dc2626"),
                hovertemplate="T = %{customdata[0]:.0f} K<br>k = %{customdata[1]:.3e}",
                customdata=list(zip(obs_t, obs_k)),
            )
        )

    fig.update_layout(
        title="Arrhenius Plot (ln k vs 1000/T)",
        xaxis_title="1000 / T (K⁻¹)",
        yaxis_title="ln k",
        template="plotly_white",
        height=500,
    )

    summary = (
        f"Plotted Arrhenius curve for A={A:.3e}, n={n:.3f}, Ea={Ea:.1f} J/mol "
        f"across {Tmin:.0f}-{Tmax:.0f} K."
    )
    if errors:
        summary += "\n\n⚠️ Data point issues:\n- " + "\n- ".join(errors)
    elif obs_t:
        summary += f"\nOverlayed {len(obs_t)} experimental point(s)."

    return fig, summary


def build_interface() -> gr.Blocks:
    with gr.Blocks(title="NIST Kinetics Explorer") as demo:
        gr.Markdown(
            dedent(
                """
                # NIST Chemical Kinetics Explorer

                Search the [NIST Chemical Kinetics Database](https://kinetics.nist.gov/kinetics/)
                directly from Hugging Face Spaces. This tool mirrors the public advanced search form,
                sends the same query to NIST, and formats summary plus detailed kinetics data.

                ⚠️ *All results come from the live NIST website. Please respect their usage policies
                and keep queries reasonable.*
                """
            )
        )

        results_state = gr.State([])

        with gr.Tab("Search"):
            gr.Markdown("Configure up to five filter rows. Leave unused rows blank.")
            filter_components = []
            for idx in range(MAX_FILTERS):
                with gr.Row():
                    boolean = gr.Dropdown(
                        label="Boolean",
                        value=LogicalOperator.and_.value,
                        choices=[(label.upper(), label) for label in (op.value for op in LogicalOperator)],
                        interactive=idx != 0,
                        visible=True,
                    )
                    lp = gr.Dropdown(label="(", choices=PAREN_CHOICES, value=PAREN_CHOICES[0][1])
                    field = gr.Dropdown(label="Field", choices=FIELD_CHOICES, value=FieldName.reactants.value)
                    relation = gr.Dropdown(label="Relation", choices=RELATION_CHOICES, value=Relation.contains.value)
                    text = gr.Textbox(label=f"Value #{idx + 1}", placeholder="e.g. CH3")
                    rp = gr.Dropdown(label=")", choices=RPAREN_CHOICES, value=RPAREN_CHOICES[0][1])
                filter_components.extend([boolean, lp, field, relation, text, rp])

            with gr.Row():
                decomp = gr.Checkbox(label="Only decomposition reactions", value=False)
                category = gr.Dropdown(label="Result type filter", choices=CATEGORY_CHOICES, value=str(Category.any.value))
                units = gr.Textbox(
                    label="Optional Units token",
                    placeholder="Leave blank to use NIST account defaults",
                )

            search_button = gr.Button("Search NIST", variant="primary")
            search_status = gr.Markdown()
            result_table = gr.Dataframe(
                headers=["#", "Records", "Reaction", "Detail URL"],
                datatype=["number", "number", "str", "str"],
                interactive=False,
                wrap=True,
                height=400,
            )

        with gr.Tab("Reaction Detail"):
            selection = gr.Dropdown(
                label="Select a reaction from the latest search",
                choices=[],
                interactive=False,
            )
            manual_url = gr.Textbox(
                label="Or paste a NIST detail URL",
                placeholder="https://kinetics.nist.gov/kinetics/ReactionSearch?....",
            )
            detail_button = gr.Button("Fetch Reaction Detail")
            detail_markdown = gr.Markdown()
            dataset_table = gr.Dataframe(
                headers=["Section", "Squib", "Temp [K]", "A", "n", "Ea [J/mole]", "k(298 K)", "Order", "Squib URL"],
                datatype=["str"] * 9,
                interactive=False,
                wrap=True,
                height=400,
            )

        search_button.click(
            fn=perform_search,
            inputs=filter_components + [decomp, category, units],
            outputs=[result_table, search_status, selection, results_state],
        )

        detail_button.click(
            fn=fetch_detail,
            inputs=[selection, manual_url],
            outputs=[detail_markdown, dataset_table],
        )

        with gr.Tab("Arrhenius Plot"):
            gr.Markdown(
                "Provide Arrhenius parameters (in cgs units) to preview ln k vs 1000/T. "
                "Optional data points can be entered as `T,k` per line."
            )
            with gr.Row():
                A_input = gr.Number(label="Pre-exponential factor A (cm³/molecule·s)", value=1.3e-9)
                n_input = gr.Number(label="Temperature exponent n", value=-0.495)
                Ea_input = gr.Number(label="Activation energy Ea (J/mol)", value=1150)
            with gr.Row():
                Tmin_input = gr.Number(label="Min temperature (K)", value=500)
                Tmax_input = gr.Number(label="Max temperature (K)", value=2500)
                Samples_input = gr.Number(label="# Samples", value=100, precision=0)
            point_box = gr.Textbox(
                label="Optional data points (T,k per line)",
                placeholder="1425,1e-10",
                lines=4,
                value="1425,1e-10",
            )
            plot_button = gr.Button("Generate Arrhenius Plot", variant="primary")
            plot_output = gr.Plot(height=500)
            plot_status = gr.Markdown()

            plot_button.click(
                fn=generate_arrhenius_plot,
                inputs=[A_input, n_input, Ea_input, Tmin_input, Tmax_input, Samples_input, point_box],
                outputs=[plot_output, plot_status],
            )

    return demo


demo = build_interface()

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))
