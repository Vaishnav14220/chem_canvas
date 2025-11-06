---
title: Organic Reactions Dataset Creator
emoji: 🧪
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: "4.44.1"
app_file: app.py
pinned: false
---

# Organic Reactions Dataset Creator

This Hugging Face Space processes organic reaction data from the `smitathkr1/organic_reactions` dataset and creates structured data using Google's Gemini Flash API.

## Features

- Extracts structured reaction information including reactants, reagents, products, byproducts, conditions, mechanism, and description
- Processes all 828 reactions from the original dataset
- Uses Gemini Flash for accurate chemical data extraction
- Outputs structured JSON data for each reaction
- Automatically uploads the processed dataset back to Hugging Face

## Usage

1. Enter your Gemini API key (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))
2. Enter your Hugging Face token (get it from your [Hugging Face settings](https://huggingface.co/settings/tokens))
3. Click "Start Processing All Reactions"
4. Wait for processing to complete (approximately 2-3 hours for all reactions)
5. The processed dataset will be uploaded to `smitathkr1/organic_reactions_structured_complete`

## Output Dataset Structure

Each reaction entry contains:
- `reaction_name`: Name of the reaction
- `reactants`: Array of starting materials
- `reagents`: Array of reagents/catalysts used
- `products`: Array of main products formed
- `byproducts`: Array of side products/byproducts
- `conditions`: Reaction conditions (temperature, solvent, etc.)
- `mechanism`: Brief description of reaction mechanism
- `description`: Summary of what the reaction does
- `reactants_smiles`: SMILES strings for each reactant
- `reagents_smiles`: SMILES strings for each reagent
- `products_smiles`: SMILES strings for each product
- `byproducts_smiles`: SMILES strings for each byproduct
- `url`: Source URL of the reaction information

## Requirements

- Gemini API key with sufficient quota
- Hugging Face account and token
- Internet connection for web scraping and API calls

## License

This space is for educational and research purposes. Please respect the terms of service of all APIs and websites used.