"""
FastAPI backend for the medical coding tool
------------------------------------------------

This module exposes a handful of lightweight REST
endpoints that implement the core search and rule
checking functionality described in the design
document.  The implementation here is kept
intentionally simple: it relies on a small in‑memory
dataset of ICD‑10‑CM codes and modifier definitions
to demonstrate how a real service might operate.

Endpoints
=========

1. **/search/icd10** – search ICD‑10‑CM codes
   Accepts a ``query`` parameter and returns a list
   of possible matches along with their titles. The
   search is a hybrid of simple substring matching
   and fuzzy matching via Python's builtin sequence
   matcher.  In production one would replace this
   with a full‑text search engine or vector search.

2. **/search/modifier** – suggest CPT/HCPCS modifiers
   Based on keywords in the query, this endpoint
   recommends appropriate modifiers such as ``-25``
   (significant, separately identifiable evaluation
   and management service on the same day), ``LT``
   (left side), ``RT`` (right side), ``50``
   (bilateral procedure) and others.  The logic is
   intentionally straightforward to illustrate the
   concept of a "modifier wizard".  A real
   implementation would incorporate the full
   catalogue of modifiers and much more nuanced
   decision trees.

3. **/check/ncci** – check simple NCCI edits
   Accepts two CPT codes and returns a basic
   determination of whether the pair is allowed,
   bundled, or requires a modifier.  The logic
   relies on a very small sample table defined
   below.  Integrating the official CMS NCCI PTP
   table would be a straightforward extension.

The goal of this file is not to cover every edge
case in medical coding, but to provide a clear
template upon which to build.  All data (codes,
modifiers, pair edits) live in this file for
simplicity; in a real application these would be
loaded from a database.
"""

from __future__ import annotations

import csv
import difflib
import json
from pathlib import Path
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel


app = FastAPI(title="Medical Coding Tool API")


# ---------------------------------------------------------------------------
# Data models

class ICDCode(BaseModel):
    code: str
    title: str
    includes: List[str] | None = None
    excludes: List[str] | None = None
    synonyms: List[str] | None = None


class Modifier(BaseModel):
    code: str
    title: str
    reason: str


class NCCIResult(BaseModel):
    cpt_a: str
    cpt_b: str
    status: str
    message: str
    modifier_required: bool = False


# ---------------------------------------------------------------------------
# In‑memory datasets

# Load a small sample of ICD‑10‑CM codes.  A full implementation would load
# the entire CMS distribution from CSV.  For demonstration we include a
# handful of common diagnoses.
SAMPLE_ICD10_DATA: List[ICDCode] = [
    ICDCode(
        code="M25.561",
        title="Pain in right knee",
        includes=["Right knee pain"],
        excludes=["Pain in left knee (M25.562)"],
        synonyms=["knee pain right", "arthralgia right knee"],
    ),
    ICDCode(
        code="M25.562",
        title="Pain in left knee",
        includes=["Left knee pain"],
        excludes=["Pain in right knee (M25.561)"],
        synonyms=["knee pain left", "arthralgia left knee"],
    ),
    ICDCode(
        code="J10.1",
        title="Influenza due to other identified influenza virus with other respiratory manifestations",
        includes=["Influenza with pneumonia"],
        synonyms=["flu with respiratory manifestations", "influenza pneumonia"],
    ),
    ICDCode(
        code="M54.5",
        title="Low back pain",
        includes=["Lumbago"],
        synonyms=["back pain", "lower back pain"],
    ),
    ICDCode(
        code="R07.9",
        title="Chest pain, unspecified",
        includes=["Chest pain NOS"],
        synonyms=["chest discomfort", "unspecified chest pain"],
    ),
]


# A very small table of modifier explanations.  Real modifier logic is much
# more complex and depends on the context of the procedure and payer rules.
MODIFIER_TABLE: List[Modifier] = [
    Modifier(code="25", title="Significant, separately identifiable evaluation and management service on the same day of the procedure", reason="Use when a separately documented E/M service is performed on the same day as another procedure."),
    Modifier(code="59", title="Distinct procedural service", reason="Indicates a procedure or service was distinct or independent from other services performed on the same day."),
    Modifier(code="50", title="Bilateral procedure", reason="Used when the same procedure is performed on both sides of the body during the same session."),
    Modifier(code="LT", title="Left side", reason="Procedures performed on the left side of the body."),
    Modifier(code="RT", title="Right side", reason="Procedures performed on the right side of the body."),
    Modifier(code="76", title="Repeat procedure or service by same physician", reason="Indicates a repeat procedure by the same physician."),
    Modifier(code="77", title="Repeat procedure by another physician", reason="Indicates a repeat procedure by a different physician."),
    Modifier(code="26", title="Professional component", reason="Used when only the professional component of a service is being billed (e.g., interpretation of radiologic studies)."),
    Modifier(code="TC", title="Technical component", reason="Used when only the technical component of a service is being billed (e.g., use of equipment)."),
]


# Example NCCI pair edits for demonstration.  In the real world there are
# thousands of these combinations.  Each entry defines whether two CPT
# codes are bundled (not separately payable), require a modifier to unbundle
# (if appropriate), or are allowed to be billed together without
# modification.
NCCI_PAIRS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "11719": {  # trimming of non‑dystrophic nails
        "11720": {
            "status": "denied",
            "message": "CPT 11719 is bundled into 11720; they should not be billed together without appropriate modifier.",
            "modifier_required": True,
        }
    },
    "17000": {  # destruction of first benign lesion
        "17110": {
            "status": "allowed",
            "message": "CPT 17000 and 17110 may be reported together with modifier 59 if lesions are separate/distinct sites.",
            "modifier_required": True,
        }
    },
    "71045": {  # radiologic exam chest single view
        "71046": {
            "status": "allowed",
            "message": "Two different chest X‑ray views are generally allowed together.",
            "modifier_required": False,
        }
    },
}


# ---------------------------------------------------------------------------
# Utility functions

def icd_search(query: str, limit: int = 5) -> List[ICDCode]:
    """Return a list of ICD codes best matching the given query.

    This function performs a naive search across the code titles,
    includes, excludes and synonyms.  Results are scored based on
    substring matches and a simple fuzzy ratio, then sorted by their
    score in descending order.  Only the top ``limit`` results are
    returned.
    """
    query_lower = query.lower().strip()
    scored: List[tuple[ICDCode, float]] = []
    for entry in SAMPLE_ICD10_DATA:
        score = 0.0
        # Direct substring match in code or title
        if query_lower in entry.code.lower():
            score += 2.0
        if query_lower in entry.title.lower():
            score += 1.5
        # Include/exclude text
        for section in (entry.includes or []):
            if query_lower in section.lower():
                score += 1.0
        for section in (entry.excludes or []):
            if query_lower in section.lower():
                score += 0.5
        # Synonyms
        for syn in (entry.synonyms or []):
            if query_lower in syn.lower():
                score += 1.0
        # Fuzzy match ratio on title
        ratio = difflib.SequenceMatcher(None, query_lower, entry.title.lower()).ratio()
        score += ratio
        if score > 0:
            scored.append((entry, score))
    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)
    # Return top N entries
    return [item[0] for item in scored[:limit]]


def modifier_suggestions(query: str) -> List[Modifier]:
    """Suggest modifiers based on keywords in the query.

    This is a very simple keyword mapper.  A real implementation
    could use natural language understanding and context from
    the encounter to drive a rule engine.
    """
    q = query.lower()
    suggestions: List[Modifier] = []
    # Bilateral procedures
    if any(word in q for word in ["bilateral", "both sides", "both limbs"]):
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "50"))
    # Left or right
    if "left" in q or "lt" in q:
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "LT"))
    if "right" in q or "rt" in q:
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "RT"))
    # Repeat
    if "repeat" in q or "again" in q:
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "76"))
    # Distinct or separate
    if any(word in q for word in ["distinct", "different site", "separate session"]):
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "59"))
    # E/M separate from procedure
    if "evaluation" in q or "e/m" in q:
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "25"))
    # Professional component
    if "interpretation" in q or "professional" in q:
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "26"))
    # Technical component
    if "equipment" in q or "technical" in q:
        suggestions.append(next(mod for mod in MODIFIER_TABLE if mod.code == "TC"))
    # Remove duplicates while preserving order
    seen = set()
    unique: List[Modifier] = []
    for suggestion in suggestions:
        if suggestion.code not in seen:
            seen.add(suggestion.code)
            unique.append(suggestion)
    return unique


def check_ncci_pair(code_a: str, code_b: str) -> NCCIResult:
    """Return a simple NCCI determination for a pair of CPT codes.

    If the pair exists in our sample table, we return the stored
    status and message.  Otherwise we assume the pair is allowed.
    The result indicates whether a modifier is required when
    appropriate.  Real implementation would consult the full
    National Correct Coding Initiative (NCCI) PTP table.
    """
    # Normalize to string numbers (strip decimals and whitespace)
    code_a = code_a.strip()
    code_b = code_b.strip()
    # Try direct match in sample table
    if code_a in NCCI_PAIRS and code_b in NCCI_PAIRS[code_a]:
        rec = NCCI_PAIRS[code_a][code_b]
        return NCCIResult(
            cpt_a=code_a,
            cpt_b=code_b,
            status=rec["status"],
            message=rec["message"],
            modifier_required=rec["modifier_required"],
        )
    # Check reversed pair
    if code_b in NCCI_PAIRS and code_a in NCCI_PAIRS[code_b]:
        rec = NCCI_PAIRS[code_b][code_a]
        return NCCIResult(
            cpt_a=code_a,
            cpt_b=code_b,
            status=rec["status"],
            message=rec["message"],
            modifier_required=rec["modifier_required"],
        )
    # Default: allowed
    return NCCIResult(
        cpt_a=code_a,
        cpt_b=code_b,
        status="allowed",
        message="No known NCCI bundling issues between these CPT codes.",
        modifier_required=False,
    )


# ---------------------------------------------------------------------------
# API endpoints

@app.get("/search/icd10", response_model=List[ICDCode])
def search_icd10(query: str = Query(..., min_length=1, description="Free‑text clinical description to match"), limit: int = 5) -> List[ICDCode]:
    """Search the sample ICD‑10‑CM database.

    Returns up to ``limit`` matching codes.  If no matches are
    found an empty list is returned.  Clients should handle the
    case where no suggestions are appropriate.
    """
    results = icd_search(query, limit=limit)
    return results


@app.get("/search/modifier", response_model=List[Modifier])
def search_modifier(query: str = Query(..., min_length=1, description="Description of the clinical scenario")) -> List[Modifier]:
    """Suggest modifiers based on the provided clinical description.
    
    The suggestions are derived from simple keyword logic.  If the
    description does not match any known pattern the result will be
    empty.
    """
    return modifier_suggestions(query)


@app.get("/check/ncci", response_model=NCCIResult)
def check_ncci(cpt_a: str = Query(..., min_length=5, max_length=5, description="First CPT code"), cpt_b: str = Query(..., min_length=5, max_length=5, description="Second CPT code")) -> NCCIResult:
    """Check a pair of CPT codes against the sample NCCI table.

    The two codes are treated as an unordered pair; if they exist in
    our sample table the corresponding status and message are
    returned.  Otherwise the pair is assumed to be allowed.
    """
    return check_ncci_pair(cpt_a, cpt_b)


@app.get("/health")
def health() -> Dict[str, str]:
    """Healthcheck endpoint."""
    return {"status": "ok"}
