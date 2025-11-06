#!/usr/bin/env python3

import os
import json
from google import genai
from google.genai import types

def extract_grignard_reaction():
    # Gemini API key
    api_key = os.getenv("GEMINI_API_KEY")

    client = genai.Client(api_key=api_key)

    prompt = """Please generate a detailed JSON object describing the organic reaction from the provided content.

The JSON object must include the following keys:

reaction name

reactants (List all starting materials/reactants)

reagents (List all reagents, catalysts, and solvents used)

products (List all main products formed)

byproducts (List all side products or byproducts)

conditions (Specify reaction conditions: temperature, solvent, atmosphere, pressure, time, workup procedure)

mechanism (Provide a step-by-step description of the reaction mechanism if available)

description (Give a brief overview of what this reaction does and its significance)

reactants_smiles (Provide SMILES strings for each reactant, use empty string if SMILES cannot be determined)

reagents_smiles (Provide SMILES strings for each reagent, use empty string if SMILES cannot be determined)

products_smiles (Provide SMILES strings for each product, use empty string if SMILES cannot be determined)

byproducts_smiles (Provide SMILES strings for each byproduct, use empty string if SMILES cannot be determined)"""

    model = "gemini-flash-latest"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=genai.types.Schema(
            type=genai.types.Type.OBJECT,
            required=["reaction name", "reactants", "reagents", "products", "byproducts", "conditions", "mechanism", "description", "reactants_smiles", "reagents_smiles", "products_smiles", "byproducts_smiles"],
            properties={
                "reaction name": genai.types.Schema(
                    type=genai.types.Type.STRING,
                ),
                "reactants": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "reagents": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "products": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "byproducts": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "conditions": genai.types.Schema(
                    type=genai.types.Type.STRING,
                ),
                "mechanism": genai.types.Schema(
                    type=genai.types.Type.STRING,
                ),
                "description": genai.types.Schema(
                    type=genai.types.Type.STRING,
                ),
                "reactants_smiles": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "reagents_smiles": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "products_smiles": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
                "byproducts_smiles": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                ),
            },
        ),
    )

    print("Sending request to Gemini API...")

    response_text = ""
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        response_text += chunk.text

    print("Response received:")
    print(response_text)

    # Parse and pretty print the JSON
    try:
        parsed_json = json.loads(response_text)
        print("\nFormatted JSON:")
        print(json.dumps(parsed_json, indent=2))
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")

if __name__ == "__main__":
    extract_grignard_reaction()
