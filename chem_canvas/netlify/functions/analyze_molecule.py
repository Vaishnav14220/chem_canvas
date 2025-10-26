import json
import math
from typing import Any, Dict, List, Optional

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors, rdPartialCharges
    RDKit_AVAILABLE = True
except ImportError:  # pragma: no cover
    RDKit_AVAILABLE = False


class AnalysisError(Exception):
    pass


def _response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        "body": json.dumps(body),
    }


def _parse_request(event: Dict[str, Any]) -> Dict[str, Any]:
    if event.get("httpMethod", "POST") == "OPTIONS":
        raise AnalysisError("preflight")

    raw_body = event.get("body")
    if not raw_body:
        raise AnalysisError("Missing request body")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise AnalysisError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(payload, dict):
        raise AnalysisError("Invalid payload shape")

    sdf = payload.get("sdf")
    if not sdf or not isinstance(sdf, str) or not sdf.strip():
        raise AnalysisError("Missing SDF data")

    return {
        "sdf": sdf,
        "metadata": payload.get("metadata") or {},
    }


def _load_molecule(sdf: str) -> Chem.Mol:
    if not RDKit_AVAILABLE:
        raise AnalysisError("RDKit is not available in this environment")

    mol = Chem.MolFromMolBlock(sdf, sanitize=True, removeHs=False)
    if mol is None:
        raise AnalysisError("Failed to parse SDF into a molecule")

    if mol.GetNumConformers() == 0:
        try:
            AllChem.EmbedMolecule(mol, useRandomCoords=True)
        except Exception as exc:  # pragma: no cover
            raise AnalysisError(f"Unable to generate 3D conformer: {exc}") from exc

    return mol


def _ensure_charges(mol: Chem.Mol) -> None:
    try:
        rdPartialCharges.ComputeGasteigerCharges(mol)
    except Exception as exc:  # pragma: no cover
        raise AnalysisError(f"Failed to compute Gasteiger charges: {exc}") from exc


def _score_atom(charge: float, electronegativity: float, atomic_num: int) -> float:
    polarity = -charge if charge < 0 else charge
    hetero_bonus = 0.25 if atomic_num not in (1, 6) else 0.0
    score = polarity + hetero_bonus + max(electronegativity - 3.0, 0) * 0.1
    return round(score, 3)


def _format_reason(label: str, charge: float, hybrid: str, ring_flag: bool) -> str:
    base = f"{label} flagged by partial charge ({charge:+.3f})"
    extras: List[str] = []
    if hybrid:
        extras.append(f"hybridization {hybrid}")
    if ring_flag:
        extras.append("ring member")
    return base + ("; " + ", ".join(extras) if extras else "")


def _analyse_atoms(mol: Chem.Mol) -> Dict[str, List[Dict[str, Any]]]:
    periodic = Chem.GetPeriodicTable()
    nucleophiles: List[Dict[str, Any]] = []
    electrophiles: List[Dict[str, Any]] = []

    for atom in mol.GetAtoms():
        idx = atom.GetIdx()
        atomic_num = atom.GetAtomicNum()
        symbol = atom.GetSymbol()
        hybrid = str(atom.GetHybridization())
        ring_flag = atom.IsInRing()

        try:
            charge = float(atom.GetProp("_GasteigerCharge"))
        except Exception:
            charge = 0.0

        if math.isnan(charge):
            charge = 0.0

        electronegativity = periodic.GetRcovalent(atomic_num)  # proxy when Pauling unavailable
        if symbol in {"O", "N", "S", "P", "F", "Cl", "Br", "I"}:
            electronegativity += 0.6

        score = _score_atom(charge, electronegativity, atomic_num)
        entry = {
            "atomIndex": idx,
            "label": "",
            "score": score,
            "type": "other",
            "reason": _format_reason("Site", charge, hybrid, ring_flag),
        }

        if charge < -0.15:
            entry["label"] = "Nucleophilic centre"
            entry["type"] = "nucleophile"
            entry["reason"] = _format_reason("Nucleophile", charge, hybrid, ring_flag)
            nucleophiles.append(entry)
        elif charge > 0.15:
            entry["label"] = "Electrophilic centre"
            entry["type"] = "electrophile"
            entry["reason"] = _format_reason("Electrophile", charge, hybrid, ring_flag)
            electrophiles.append(entry)
        elif atomic_num in (7, 8, 16) and atom.GetTotalValence() <= atom.GetImplicitValence() + 1:
            entry["label"] = "Potential lone pair donor"
            entry["type"] = "nucleophile"
            entry["reason"] = _format_reason("Lone pair donor", charge, hybrid, ring_flag)
            nucleophiles.append(entry)
        elif atomic_num in (5, 13, 15) and charge >= 0:
            entry["label"] = "Lewis acidic centre"
            entry["type"] = "electrophile"
            entry["reason"] = _format_reason("Lewis acid", charge, hybrid, ring_flag)
            electrophiles.append(entry)

    nucleophiles.sort(key=lambda item: item.get("score", 0.0), reverse=True)
    electrophiles.sort(key=lambda item: item.get("score", 0.0), reverse=True)

    return {
        "nucleophiles": nucleophiles,
        "electrophiles": electrophiles,
    }


def _collect_properties(mol: Chem.Mol) -> Dict[str, Any]:
    properties: Dict[str, Any] = {}

    try:
        properties["formula"] = rdMolDescriptors.CalcMolFormula(mol)
    except Exception:
        pass

    try:
        properties["molecularWeight"] = round(Descriptors.MolWt(mol), 3)
    except Exception:
        pass

    try:
        properties["logP"] = round(Descriptors.MolLogP(mol), 3)
    except Exception:
        pass

    try:
        properties["tpsa"] = round(rdMolDescriptors.CalcTPSA(mol), 3)
    except Exception:
        pass

    try:
        properties["hBondDonors"] = rdMolDescriptors.CalcNumHBD(mol)
    except Exception:
        pass

    try:
        properties["hBondAcceptors"] = rdMolDescriptors.CalcNumHBA(mol)
    except Exception:
        pass

    return properties


def _analyse_molecule(sdf: str) -> Dict[str, Any]:
    mol = _load_molecule(sdf)
    _ensure_charges(mol)

    site_data = _analyse_atoms(mol)
    properties = _collect_properties(mol)

    warnings: List[str] = []
    if not site_data["nucleophiles"] and not site_data["electrophiles"]:
        warnings.append("No strongly polarised centres detected; consider manual review")

    return {
        "nucleophiles": site_data["nucleophiles"],
        "electrophiles": site_data["electrophiles"],
        "properties": properties,
        "warnings": warnings,
    }


def handler(event: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    try:
        request = _parse_request(event)
    except AnalysisError as exc:
        if str(exc) == "preflight":
            return _response(200, {"status": "ok"})
        return _response(400, {"error": str(exc)})

    try:
        result = _analyse_molecule(request["sdf"])
    except AnalysisError as exc:
        return _response(500, {"error": str(exc)})

    payload = {
        "metadata": request.get("metadata"),
        **result,
    }

    return _response(200, payload)
