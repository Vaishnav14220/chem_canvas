from __future__ import annotations

import os
import re
from enum import Enum
from typing import List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field


class FieldName(str, Enum):
    """Fields exposed by the NIST advanced search form."""

    reactants = "reactants"
    products = "products"
    rxn_order = "rxn_order"
    ref_rxn_reactants = "ref_rxn_reactants"
    ref_rxn_products = "ref_rxn_products"
    ref_rxn_order = "ref_rxn_order"
    t_low = "t_low"
    t_high = "t_high"
    p_low = "p_low"
    p_high = "p_high"
    bath_gas = "bath_gas"
    squib = "kinetics.squib"


class Relation(str, Enum):
    """Comparison operators supported by NIST."""

    equals = "="
    not_equals = "!="  # HTML also exposes "<>" which NIST treats the same
    contains = "~*"
    not_contains = "!~*"
    lt = "<"
    lte = "<="
    gte = ">="
    gt = ">"


class LogicalOperator(str, Enum):
    and_ = "and"
    or_ = "or"


class LeftParenthesis(str, Enum):
    none = ""
    single = "("
    double = "(("


class RightParenthesis(str, Enum):
    none = ""
    single = ")"
    double = "))"


class Category(int, Enum):
    any = 0
    review = 1
    experiment = 2
    theory = 3


MAX_FIELDS = 5
SUMMARY_HEADER = "Reaction"


class SearchFilter(BaseModel):
    field: FieldName = Field(default=FieldName.reactants, description="Field to query")
    relation: Relation = Field(default=Relation.contains, description="Comparison operator")
    value: str = Field(..., min_length=0, description="Text entered into the NIST form field")
    boolean: LogicalOperator | None = Field(
        default=LogicalOperator.and_,
        description="Boolean operator to join this filter with the previous one. Ignored for the first row.",
    )
    left_parenthesis: LeftParenthesis = Field(default=LeftParenthesis.none)
    right_parenthesis: RightParenthesis = Field(default=RightParenthesis.none)


class SearchRequest(BaseModel):
    filters: List[SearchFilter] = Field(
        default_factory=list,
        min_length=1,
        max_length=MAX_FIELDS,
        description="Up to five filter rows mirroring the NIST form layout.",
    )
    decomposition_only: bool = Field(default=False, description="Populate the `decomp` checkbox on the site.")
    category: Category = Field(default=Category.any, description="Optional category restriction.")
    units: str | None = Field(
        default=None,
        description="Optional string passed through to the hidden Units field (rarely needed).",
    )


class ReactionSummary(BaseModel):
    record_count: int
    reaction: str
    detail_url: str


class SearchResponse(BaseModel):
    result_count: int
    results: List[ReactionSummary]


class ReactionDetailRequest(BaseModel):
    detail_url: str = Field(
        ...,
        description="Absolute or relative URL returned by the /api/search endpoint (e.g. /kinetics/ReactionSearch?...).",
    )


class RateExpressionUnits(BaseModel):
    first_order: Optional[str] = None
    second_order: Optional[str] = None
    third_order: Optional[str] = None


class PhysicalUnits(BaseModel):
    energy: Optional[str] = None
    molecular: Optional[str] = None
    pressure: Optional[str] = None
    temperature: Optional[str] = None
    base_volume: Optional[str] = None
    reference_temperature: Optional[str] = None
    evaluation_temperature: Optional[str] = None


class KineticsRecord(BaseModel):
    section: Optional[str] = Field(None, description="Section heading such as Theory or Experiment.")
    dataset_id: Optional[str] = None
    squib: Optional[str] = None
    squib_url: Optional[str] = None
    temperature_range: Optional[str] = None
    pre_exponential_factor: Optional[str] = None
    temperature_exponent: Optional[str] = None
    activation_energy: Optional[str] = None
    rate_at_298: Optional[str] = None
    reaction_order: Optional[str] = None


class ReactionDetail(BaseModel):
    title: Optional[str]
    rate_expression: Optional[str]
    rate_expression_units: RateExpressionUnits | None
    physical_units: PhysicalUnits | None
    datasets: List[KineticsRecord]


class NistKineticsClient:
    """
    Thin wrapper that mirrors the public HTML form exposed on https://kinetics.nist.gov.

    The official site does not provide a documented JSON API. This class assembles the same payload
    the browser would send, performs the POST, and parses the resulting HTML.
    """

    BASE_URL = "https://kinetics.nist.gov/kinetics/"
    SEARCH_ENDPOINT = "Search.jsp"

    def __init__(self, timeout: int = 30) -> None:
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )

    def search(self, request: SearchRequest) -> List[ReactionSummary]:
        payload = self._build_payload(request)
        html = self._post(self.SEARCH_ENDPOINT, payload)
        return self._parse_search_results(html)

    def fetch_reaction_detail(self, detail_url: str) -> ReactionDetail:
        sanitized_url = self._sanitize_url(detail_url)
        html = self._get_absolute(sanitized_url)
        return self._parse_reaction_detail(html, sanitized_url)

    def _post(self, endpoint: str, payload: dict[str, str]) -> str:
        response = self.session.post(urljoin(self.BASE_URL, endpoint), data=payload, timeout=self.timeout)
        response.raise_for_status()
        return response.text

    def _get_absolute(self, url: str) -> str:
        absolute_url = urljoin(self.BASE_URL, url)
        response = self.session.get(absolute_url, timeout=self.timeout)
        response.raise_for_status()
        return response.text

    def _build_payload(self, request: SearchRequest) -> dict[str, str]:
        payload: dict[str, str] = {
            "doc": "SearchForm",
            "type": "java",
            "database": "kinetics",
            "numberOfFields": str(MAX_FIELDS),
            "category": str(int(request.category.value)),
        }

        if request.units:
            payload["Units"] = request.units

        if request.decomposition_only:
            payload["decomp"] = "true"

        filters = request.filters
        for idx in range(MAX_FIELDS):
            human_index = idx + 1
            boolean_key = f"boolean{human_index}"
            lp_key = f"lp{human_index}"
            field_key = f"field{human_index}"
            relate_key = f"relate{human_index}"
            text_key = f"text{human_index}"
            rp_key = f"rp{human_index}"

            if idx < len(filters):
                view = filters[idx]
                payload[boolean_key] = "" if idx == 0 else (view.boolean.value if view.boolean else "and")
                payload[lp_key] = self._format_parenthesis(view.left_parenthesis)
                payload[field_key] = view.field.value
                payload[relate_key] = view.relation.value
                payload[text_key] = view.value
                payload[rp_key] = self._format_parenthesis(view.right_parenthesis)
            else:
                payload[boolean_key] = "" if idx == 0 else "and"
                payload[lp_key] = " "
                payload[field_key] = FieldName.reactants.value
                payload[relate_key] = Relation.equals.value
                payload[text_key] = ""
                payload[rp_key] = " "

        return payload

    @staticmethod
    def _format_parenthesis(choice: LeftParenthesis | RightParenthesis) -> str:
        return choice.value if choice.value else " "

    def _parse_search_results(self, html: str) -> List[ReactionSummary]:
        soup = BeautifulSoup(html, "html.parser")
        table = None
        intro = soup.find(string=lambda text: isinstance(text, str) and "Click on a link in the table" in text)
        if intro:
            if isinstance(intro, NavigableString):
                intro_parent = intro.parent
            else:
                intro_parent = intro
            table = intro_parent.find_next("table")
        if not table:
            table = self._find_table_with_headers(soup, ["Records", SUMMARY_HEADER])
        if not table:
            # When 0 records are returned, no table is rendered.
            return []

        summaries: List[ReactionSummary] = []
        for row in table.find_all("tr")[1:]:
            cells = row.find_all("td")
            if len(cells) < 3:
                continue

            count_text = cells[0].get_text(strip=True)
            match = re.search(r"(\d+)", count_text)
            record_count = int(match.group(1)) if match else 0

            anchor = cells[0].find("a")
            href = anchor["href"] if anchor and anchor.has_attr("href") else None
            detail_url = self._sanitize_url(href) if href else ""
            reaction_str = cells[-1].get_text(" ", strip=True)
            summaries.append(
                ReactionSummary(record_count=record_count, reaction=reaction_str, detail_url=detail_url)
            )

        return summaries

    def _parse_reaction_detail(self, html: str, source_url: str) -> ReactionDetail:
        soup = BeautifulSoup(html, "html.parser")
        title_div = soup.find("div", attrs={"align": "center"})
        title = title_div.get_text(" ", strip=True) if title_div else None

        rate_expression = None
        for bold in soup.find_all("b"):
            text = bold.get_text(strip=True)
            if text.startswith("Rate expression"):
                rate_expression = text.replace("\xa0", " ")
                break

        rate_units = self._parse_rate_units(soup)
        physical_units = self._parse_physical_units(soup)
        datasets = self._parse_kinetics_table(soup)

        return ReactionDetail(
            title=title,
            rate_expression=rate_expression,
            rate_expression_units=rate_units,
            physical_units=physical_units,
            datasets=datasets,
        )

    @staticmethod
    def _parse_rate_units(soup: BeautifulSoup) -> RateExpressionUnits | None:
        anchor = None
        for bold in soup.find_all("b"):
            if "Rate expression units" in bold.get_text():
                anchor = bold
                break
        if not anchor:
            return None

        values: dict[str, str] = {}
        current_label: Optional[str] = None
        for node in anchor.next_siblings:
            if isinstance(node, Tag) and node.name == "b":
                break
            if isinstance(node, Tag) and node.name == "hr":
                break
            if isinstance(node, NavigableString):
                text = str(node).strip()
            else:
                text = node.get_text(" ", strip=True)
            if not text:
                continue
            if text.endswith(":"):
                current_label = text[:-1]
                continue
            if current_label:
                values[current_label] = text
                current_label = None

        if not values:
            return None

        return RateExpressionUnits(
            first_order=values.get("First order"),
            second_order=values.get("Second order"),
            third_order=values.get("Third order"),
        )

    @staticmethod
    def _parse_physical_units(soup: BeautifulSoup) -> PhysicalUnits | None:
        table = None
        for candidate in soup.find_all("table"):
            if candidate.find(string=lambda text: isinstance(text, str) and "Energy Units" in text):
                table = candidate
                break
        if not table:
            return None

        fields = {}
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 7:
                continue
            label_a = cells[0].get_text(strip=True)
            value_a = cells[2].get_text(strip=True)
            label_b = cells[4].get_text(strip=True)
            value_b = cells[6].get_text(strip=True)
            if label_a:
                fields[label_a] = value_a
            if label_b:
                fields[label_b] = value_b

        if not fields:
            return None

        return PhysicalUnits(
            energy=fields.get("Energy Units"),
            molecular=fields.get("Molecular Units"),
            pressure=fields.get("Pressure Units"),
            temperature=fields.get("Temperature Units"),
            base_volume=fields.get("Base Volume Unit"),
            reference_temperature=fields.get("Reference Temperature"),
            evaluation_temperature=fields.get("Evaluation Temperature"),
        )

    def _parse_kinetics_table(self, soup: BeautifulSoup) -> List[KineticsRecord]:
        table = self._find_table_with_headers(soup, ["Squib", "Temp [K]"])
        if not table:
            return []

        datasets: List[KineticsRecord] = []
        current_section: Optional[str] = None

        for row in table.find_all("tr")[1:]:
            header_cells = row.find_all("th")
            if header_cells:
                continue

            data_cells = row.find_all("td")
            if not data_cells:
                continue

            if data_cells[0].get("colspan"):
                current_section = data_cells[0].get_text(" ", strip=True)
                continue

            if len(data_cells) < 15:
                continue

            dataset_id = self._find_hidden_value(data_cells[0], prefix="id")
            squib_cell = data_cells[2]
            squib_link = squib_cell.find("a")
            squib_text = squib_link.get_text(strip=True) if squib_link else squib_cell.get_text(strip=True)
            squib_url = self._sanitize_url(squib_link["href"]) if squib_link and squib_link.has_attr("href") else None

            record = KineticsRecord(
                section=current_section,
                dataset_id=dataset_id,
                squib=squib_text,
                squib_url=squib_url,
                temperature_range=data_cells[4].get_text(strip=True) or None,
                pre_exponential_factor=data_cells[6].get_text(strip=True) or None,
                temperature_exponent=data_cells[8].get_text(strip=True) or None,
                activation_energy=data_cells[10].get_text(strip=True) or None,
                rate_at_298=data_cells[12].get_text(strip=True) or None,
                reaction_order=data_cells[14].get_text(strip=True) or None,
            )
            datasets.append(record)

        return datasets

    @staticmethod
    def _find_hidden_value(cell, prefix: str) -> Optional[str]:
        for hidden in cell.find_all("input"):
            name = hidden.get("name") or ""
            if name.startswith(prefix):
                return hidden.get("value")
        return None

    @staticmethod
    def _sanitize_url(url: Optional[str]) -> str:
        if not url:
            return ""
        cleaned = re.sub(r";jsessionid=[^?]*", "", url)
        return urljoin(NistKineticsClient.BASE_URL, cleaned)

    @staticmethod
    def _find_table_with_headers(soup: BeautifulSoup, headers: List[str]):
        required = [header.strip() for header in headers]
        for table in soup.find_all("table"):
            th_texts = [th.get_text(strip=True) for th in table.find_all("th")]
            if all(req in th_texts for req in required):
                return table
        return None


client = NistKineticsClient()
app = FastAPI(
    title="Unofficial NIST Kinetics API",
    description=(
        "A thin REST wrapper around the public NIST Chemical Kinetics search form. "
        "All data is fetched live from kinetics.nist.gov; please cache results and respect their terms of use."
    ),
    version="1.0.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> SearchResponse:
    try:
        results = await run_in_threadpool(client.search, request)
        return SearchResponse(result_count=len(results), results=results)
    except requests.HTTPError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=502, detail=f"Failed to query NIST: {exc}") from exc


@app.post("/api/reaction-detail", response_model=ReactionDetail)
async def reaction_detail(request: ReactionDetailRequest) -> ReactionDetail:
    try:
        return await run_in_threadpool(client.fetch_reaction_detail, request.detail_url)
    except requests.HTTPError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=502, detail=f"Failed to fetch reaction detail: {exc}") from exc


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    port = int(os.environ.get("PORT", os.environ.get("HF_SPACE_PORT", 7860)))
    uvicorn.run("nist_kinetics_api:app", host="0.0.0.0", port=port, reload=bool(os.environ.get("DEBUG")))
