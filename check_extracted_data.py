#!/usr/bin/env python3

from datasets import load_dataset
import os

# Set up Hugging Face authentication
hf_token = os.getenv("HF_TOKEN")
os.environ["HF_TOKEN"] = hf_token

# Load the dataset we just created
dataset = load_dataset("smitathkr1/organic_reactions_structured_gemini")

print("Extracted data from the first 5 reactions:")
print("=" * 50)

for i, example in enumerate(dataset['train']):
    print(f"\n{i+1}. {example['reaction_name']}")
    print(f"   URL: {example['url']}")
    print(f"   Reactants: {example['reactants']}")
    print(f"   Reagents: {example['reagents']}")
    print(f"   Products: {example['products']}")
    print(f"   Byproducts: {example['byproducts']}")
    print(f"   Conditions: {example['conditions'][:100]}..." if example['conditions'] else "   Conditions: (empty)")
    print(f"   Description length: {len(example['description'])} chars")
    print(f"   Description preview: {example['description'][:150]}..." if example['description'] else "   Description: (empty)")

    if i >= 4:  # Show first 5
        break
