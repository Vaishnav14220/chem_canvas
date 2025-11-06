import os
import time
import json
from datasets import load_dataset, Dataset
from huggingface_hub import login
from google import genai
from google.genai import types
import pubchempy as pcp
from rdkit import Chem

# Authenticate HF
hf_token = os.getenv("HF_TOKEN")
if not hf_token:
    raise ValueError("HF_TOKEN environment variable not set")
login(hf_token)

# Gemini API keys
gemini_keys = os.getenv("GEMINI_API_KEYS", "").split(",")
key_index = 0

def get_next_key():
    global key_index
    key = gemini_keys[key_index]
    key_index = (key_index + 1) % len(gemini_keys)
    return key

# Load dataset
from datasets import load_from_disk
try:
    data = load_from_disk('./enhanced_dataset_v2')
    start_idx = len(data)
    print(f"Resuming from row {start_idx}")
except:
    data = load_from_disk('enhanced_dataset')
    start_idx = 0

# Function to get SMILES from name using PubChem
def get_smiles(name):
    try:
        compounds = pcp.get_compounds(name, 'name')
        if compounds:
            return compounds[0].smiles
        else:
            return None
    except Exception as e:
        print(f"Error getting SMILES for {name}: {e}")
        return None

# Function to generate missing data using Gemini
def generate_missing_data(reaction_name, existing_data):
    key = get_next_key()
    client = genai.Client(api_key=key)
    model = "gemini-flash-latest"  # Use a stable model

    # Prepare input text
    input_text = f"Reaction name: {reaction_name}\n"
    for key, value in existing_data.items():
        if value:
            input_text += f"{key}: {value}\n"
        else:
            input_text += f"{key}: [MISSING]\n"
    input_text += "Please fill in the missing fields with appropriate data for this organic reaction. For each chemical in reactants, reagents, products, byproducts, provide the corresponding SMILES string in the _smiles arrays. If you don't know the exact SMILES, provide a representative or generic one."

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=input_text),
            ],
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=genai.types.Schema(
            type=genai.types.Type.OBJECT,
            required=["reaction name", "reactants", "reagents", "products", "byproducts", "conditions", "mechanism", "description"],
            properties={
                "reaction name": genai.types.Schema(type=genai.types.Type.STRING),
                "reactants": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "reactants_smiles": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "reagents": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "reagents_smiles": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "products": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "products_smiles": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "byproducts": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "byproducts_smiles": genai.types.Schema(type=genai.types.Type.ARRAY, items=genai.types.Schema(type=genai.types.Type.STRING)),
                "conditions": genai.types.Schema(type=genai.types.Type.STRING),
                "mechanism": genai.types.Schema(type=genai.types.Type.STRING),
                "description": genai.types.Schema(type=genai.types.Type.STRING),
            },
        ),
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        return json.loads(response.text)
    except Exception as e:
        error_str = str(e)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            print(f"Quota exceeded, skipping row {reaction_name}")
            return None  # Skip updating
        else:
            print(f"Error generating data for {reaction_name}: {e}")
            return None

# Global cache for SMILES
smiles_cache = {}

# Process each row
new_data = list(data)  # Start with existing
for i in range(start_idx, len(data)):
    row = data[i]
    print(f"Processing row {i+1}/{len(data)}")

    # Extract existing data
    reaction_name = row.get('name', '')
    reactants = row.get('reactants', [])
    reactants_smiles = row.get('reactants_smiles', [])
    reagents = row.get('reagents', [])
    reagents_smiles = row.get('reagents_smiles', [])
    products = row.get('products', [])
    products_smiles = row.get('products_smiles', [])
    byproducts = row.get('byproducts', [])
    byproducts_smiles = row.get('byproducts_smiles', [])
    conditions = row.get('conditions', '')
    mechanism = row.get('mechanism', '')
    description = row.get('description', '')
    url = row.get('url', '')

    existing_data = {
        'reactants': reactants,
        'reactants_smiles': reactants_smiles,
        'reagents': reagents,
        'reagents_smiles': reagents_smiles,
        'products': products,
        'products_smiles': products_smiles,
        'byproducts': byproducts,
        'byproducts_smiles': byproducts_smiles,
        'conditions': conditions,
        'mechanism': mechanism,
        'description': description,
    }

    # Check if any SMILES are missing (None)
    smiles_lists = [reactants_smiles, reagents_smiles, products_smiles, byproducts_smiles]
    missing_smiles = any(None in lst for lst in smiles_lists if lst)

    if missing_smiles:
        generated = generate_missing_data(reaction_name, existing_data)
        if generated:
            reactants = generated['reactants']
            reactants_smiles = generated['reactants_smiles']
            reagents = generated['reagents']
            reagents_smiles = generated['reagents_smiles']
            products = generated['products']
            products_smiles = generated['products_smiles']
            byproducts = generated['byproducts']
            byproducts_smiles = generated['byproducts_smiles']
            conditions = generated['conditions']
            mechanism = generated['mechanism']
            description = generated['description']

    # Now get SMILES for all chemicals - but since Gemini provides, skip if not missing
    # all_chemicals = reactants + reagents + products + byproducts
    # for chem in all_chemicals:
    #     if chem and chem not in smiles_cache:
    #         smiles = get_smiles(chem)
    #         smiles_cache[chem] = smiles
    #         time.sleep(0.2)  # Rate limit

    new_row = {
        'name': reaction_name,
        'url': url,
        'reactants': reactants,
        'reactants_smiles': reactants_smiles,
        'reagents': reagents,
        'reagents_smiles': reagents_smiles,
        'products': products,
        'products_smiles': products_smiles,
        'byproducts': byproducts,
        'byproducts_smiles': byproducts_smiles,
        'conditions': conditions,
        'mechanism': mechanism,
        'description': description,
    }
    new_data[i] = new_row  # Update the list

    # Save every 10 rows
    if (i + 1) % 10 == 0:
        temp_ds = Dataset.from_list(new_data)
        temp_ds.save_to_disk("enhanced_dataset_v2")
        print(f"Saved progress at row {i+1}")

    # Rate limit for Gemini
    if missing_smiles:
        time.sleep(2)  # Increased sleep to reduce speed

# Create new dataset
new_dataset = Dataset.from_list(new_data)

# Save locally
new_dataset.save_to_disk("enhanced_dataset_v2")

# Push to HF
new_dataset.push_to_hub("smitathkr1/organic_reactions_enhanced")  # Use the original owner's repo or create new