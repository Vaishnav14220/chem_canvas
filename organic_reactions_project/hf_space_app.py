#!/usr/bin/env python3

import os
import time
import requests
from bs4 import BeautifulSoup
from datasets import Dataset
from huggingface_hub import HfApi
import gradio as gr
from google import genai
from google.genai import types
import json

def extract_reaction_data_with_gemini(url, reaction_name, api_key):
    """Extract reaction data using Gemini API"""
    try:
        # Fetch the webpage content
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Extract text content from the page
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.extract()

        # Get text content
        text_content = soup.get_text(separator='\n', strip=True)

        # Limit content to avoid token limits (keep most relevant parts)
        # Focus on main content areas
        content_parts = []

        # Try to find main content areas
        main_content = soup.find('main') or soup.find('article') or soup.find('div', class_='mw-content-ltr')
        if main_content:
            content_parts.append(main_content.get_text(separator=' ', strip=True)[:8000])

        # Also include title and first paragraphs
        title = soup.find('h1')
        if title:
            content_parts.insert(0, title.get_text(strip=True))

        # Get first few paragraphs
        paragraphs = soup.find_all('p')[:5]
        for p in paragraphs:
            content_parts.append(p.get_text(strip=True))

        full_content = '\n\n'.join(content_parts)[:10000]  # Limit total content

        if not full_content.strip():
            return {
                'reaction_name': reaction_name,
                'url': url,
                'reactants': [],
                'reagents': [],
                'products': [],
                'byproducts': [],
                'conditions': '',
                'mechanism': '',
                'description': f'Could not extract content from {url}'
            }

        # Use Gemini Flash API for structured extraction
        client = genai.Client(api_key=api_key)

        prompt = f"""
        Extract structured information about the organic reaction from the following webpage content.
        Focus on identifying the key components of the reaction.

        Reaction name: {reaction_name}
        URL: {url}

        Content:
        {full_content}

        Please extract:
        - reaction_name: The name of the reaction
        - reactants: Array of starting materials/reactants
        - reagents: Array of reagents/catalysts used
        - products: Array of main products formed
        - byproducts: Array of side products/byproducts
        - conditions: Reaction conditions (temperature, solvent, etc.)
        - mechanism: Brief description of reaction mechanism if mentioned
        - description: Summary of what the reaction does
        - reactants_smiles: SMILES strings for each reactant (use empty string if cannot determine)
        - reagents_smiles: SMILES strings for each reagent (use empty string if cannot determine)
        - products_smiles: SMILES strings for each product (use empty string if cannot determine)
        - byproducts_smiles: SMILES strings for each byproduct (use empty string if cannot determine)

        Be specific and accurate. If information is not available, use empty arrays or empty strings.
        """

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

        # Collect response
        full_response = ""
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            full_response += chunk.text

        # Parse the JSON response
        result = json.loads(full_response)
        # Convert field names to match our expected format
        result_formatted = {
            'reaction_name': result.get('reaction name', reaction_name),
            'reactants': result.get('reactants', []),
            'reagents': result.get('reagents', []),
            'products': result.get('products', []),
            'byproducts': result.get('byproducts', []),
            'conditions': result.get('conditions', ''),
            'mechanism': result.get('mechanism', ''),
            'description': result.get('description', ''),
            'reactants_smiles': result.get('reactants_smiles', []),
            'reagents_smiles': result.get('reagents_smiles', []),
            'products_smiles': result.get('products_smiles', []),
            'byproducts_smiles': result.get('byproducts_smiles', []),
            'url': url
        }

        return result_formatted

    except Exception as e:
        error_msg = str(e)
        print(f"Error processing {url}: {error_msg}")

        # Check if it's a rate limit error and retry after delay
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            print(f"Rate limit hit for {url}, waiting 60 seconds before retry...")
            time.sleep(60)
            try:
                # Retry once after waiting
                return extract_reaction_data_with_gemini(url, reaction_name, api_key)
            except Exception as retry_error:
                print(f"Retry also failed for {url}: {retry_error}")

        return {
            'reaction_name': reaction_name,
            'url': url,
            'reactants': [],
            'reagents': [],
            'products': [],
            'byproducts': [],
            'conditions': '',
            'mechanism': '',
            'description': f'Error: {error_msg}',
            'reactants_smiles': [],
            'reagents_smiles': [],
            'products_smiles': [],
            'byproducts_smiles': []
        }

def process_reactions(gemini_api_key, hf_token):
    """Process all reactions and create dataset"""
    from datasets import load_dataset

    # Load the original dataset
    print("Loading dataset from Hugging Face...")
    dataset = load_dataset("smitathkr1/organic_reactions")
    train_data = dataset['train']

    print(f"Processing {len(train_data)} reactions...")

    structured_data = []
    processed_count = 0

    for example in train_data:
        reaction_name = example['name']
        reaction_url = example['link']

        print(f"Processing {processed_count + 1}/{len(train_data)}: {reaction_name}")

        # Skip Wikipedia edit pages (they don't contain actual reaction data)
        if 'action=edit' in reaction_url or reaction_url.endswith('[edit]'):
            print(f"  Skipping Wikipedia edit page: {reaction_url}")
            structured_data.append({
                'reaction_name': reaction_name,
                'url': reaction_url,
                'reactants': [],
                'reagents': [],
                'products': [],
                'byproducts': [],
                'conditions': '',
                'mechanism': '',
                'description': f'Wikipedia edit page - no reaction data available'
            })
        else:
            # Extract data using Gemini
            reaction_data = extract_reaction_data_with_gemini(reaction_url, reaction_name, gemini_api_key)
            structured_data.append(reaction_data)

        processed_count += 1

        # Add delay to respect rate limits (free tier: ~15 requests per minute for Gemini Flash)
        time.sleep(2)  # 2 second delay between requests for faster processing

    print(f"Processed {len(structured_data)} reactions")

    # Create new dataset
    new_dataset = Dataset.from_list(structured_data)

    # Upload to Hugging Face
    new_dataset_name = "smitathkr1/organic_reactions_structured_complete"
    print(f"Uploading to {new_dataset_name}...")

    new_dataset.push_to_hub(new_dataset_name, token=hf_token)

    print("Upload completed successfully!")
    return f"Successfully processed {len(structured_data)} reactions and uploaded to {new_dataset_name}"

def create_interface():
    with gr.Blocks(title="Organic Reactions Dataset Creator") as interface:
        gr.Markdown("# Organic Reactions Dataset Creator")
        gr.Markdown("This app will process all 828 organic reactions from the dataset and create structured data using Gemini Flash API.")

        gr.Markdown("**Note:** You can either enter your API keys manually below, or set up Space Secrets for automatic use.")

        with gr.Row():
            use_secrets = gr.Checkbox(
                label="Use Space Secrets (if configured)",
                value=False
            )

        with gr.Row():
            gemini_key = gr.Textbox(
                label="Gemini API Key",
                placeholder="Enter your Gemini API key (AIzaSy...)",
                type="password",
                visible=True
            )
            hf_token = gr.Textbox(
                label="Hugging Face Token",
                placeholder="Enter your Hugging Face token (hf_...)",
                type="password",
                visible=True
            )

        def toggle_inputs(use_secrets):
            return gr.update(visible=not use_secrets), gr.update(visible=not use_secrets)

        use_secrets.change(
            fn=toggle_inputs,
            inputs=[use_secrets],
            outputs=[gemini_key, hf_token]
        )

        process_btn = gr.Button("Start Processing All Reactions")
        output = gr.Textbox(label="Status", lines=10)

        def process_with_secrets(use_secrets, gemini_key_input, hf_token_input):
            if use_secrets:
                # Try to get from environment/Space secrets
                import os
                gemini_key = os.getenv("GEMINI_API_KEY", gemini_key_input)
                hf_token = os.getenv("HF_TOKEN", hf_token_input)

                if not gemini_key or not hf_token:
                    return "Error: Space secrets not found. Please enter API keys manually or configure Space secrets."
            else:
                gemini_key = gemini_key_input
                hf_token = hf_token_input

            if not gemini_key or not hf_token:
                return "Error: Please provide both Gemini API key and Hugging Face token."

            return process_reactions(gemini_key, hf_token)

        process_btn.click(
            fn=process_with_secrets,
            inputs=[use_secrets, gemini_key, hf_token],
            outputs=output
        )

    return interface

if __name__ == "__main__":
    interface = create_interface()
    interface.launch()
