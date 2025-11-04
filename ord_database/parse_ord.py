import gzip
import csv
import os
import sys
from pathlib import Path
from ord_schema.proto import dataset_pb2
from ord_schema.message_helpers import load_message
import pandas as pd

def parse_single_ord_file(input_file):
    """
    Parse a single ORD .pb.gz file and extract reaction data.

    Args:
        input_file (str): Path to the .pb.gz file

    Returns:
        list: List of reaction dictionaries
    """
    reactions = []

    try:
        # Use ord_schema's load_message function
        dataset = load_message(input_file, dataset_pb2.Dataset)

        # Process each reaction in the dataset
        for reaction in dataset.reactions:
            reaction_data = extract_reaction_data(reaction)
            if reaction_data:
                reaction_data['source_file'] = input_file
                reactions.append(reaction_data)

    except Exception as e:
        print(f"Failed to parse {input_file}: {e}")
        return []

    return reactions

def extract_reaction_data(reaction):
    """
    Extract relevant data from a parsed reaction object.

    Args:
        reaction: Parsed reaction protobuf object

    Returns:
        dict: Dictionary with reaction data
    """
    try:
        # Extract reaction ID
        reaction_id = getattr(reaction, 'reaction_id', '') or f"unknown_{hash(str(reaction))}"

        # Extract reactants SMILES from identifiers
        reactants_smiles = []
        if hasattr(reaction, 'inputs') and reaction.inputs:
            for input_compounds in reaction.inputs.values():
                for component in input_compounds.components:
                    if hasattr(component, 'identifiers') and component.identifiers:
                        for identifier in component.identifiers:
                            # Check if this is a SMILES identifier (type 2)
                            if hasattr(identifier, 'type') and identifier.type == 2:  # SMILES type
                                if hasattr(identifier, 'value') and identifier.value:
                                    reactants_smiles.append(identifier.value)

        # Extract products SMILES from identifiers
        products_smiles = []
        if hasattr(reaction, 'outcomes') and reaction.outcomes:
            for outcome in reaction.outcomes:
                if hasattr(outcome, 'products'):
                    for product in outcome.products:
                        if hasattr(product, 'identifiers') and product.identifiers:
                            for identifier in product.identifiers:
                                # Check if this is a SMILES identifier (type 2)
                                if hasattr(identifier, 'type') and identifier.type == 2:  # SMILES type
                                    if hasattr(identifier, 'value') and identifier.value:
                                        products_smiles.append(identifier.value)

        # Extract conditions (simplified)
        conditions = ""
        if hasattr(reaction, 'setup') and reaction.setup:
            if hasattr(reaction.setup, 'conditions') and reaction.setup.conditions:
                if hasattr(reaction.setup.conditions, 'description'):
                    conditions = reaction.setup.conditions.description or ""

        # Create reaction string (reactants >> products)
        reactants_str = '.'.join(reactants_smiles)
        products_str = '.'.join(products_smiles)
        reaction_smiles = f"{reactants_str}>>{products_str}" if reactants_str and products_str else ""

        # Only return if we have meaningful data
        if reaction_smiles and len(reaction_smiles) > 3:  # More than just ">>"
            return {
                'reaction_id': reaction_id,
                'reactants_smiles': reactants_str,
                'products_smiles': products_str,
                'reaction_smiles': reaction_smiles,
                'conditions': conditions,
                'source_file': ''
            }

    except Exception as e:
        print(f"Error extracting data from reaction: {e}")

    return None

def parse_ord_directory(data_dir, output_csv=None, max_files=None):
    """
    Parse all ORD files in a directory and its subdirectories.

    Args:
        data_dir (str): Root directory containing ORD data
        output_csv (str): Output CSV file path (optional)
        max_files (int): Maximum number of files to process (optional)

    Returns:
        list: List of all reaction dictionaries
    """
    all_reactions = []
    processed_files = 0

    data_path = Path(data_dir)

    # Find all .pb.gz files
    pb_files = list(data_path.rglob("*.pb.gz"))

    print(f"Found {len(pb_files)} .pb.gz files")

    for pb_file in pb_files:
        if max_files and processed_files >= max_files:
            break

        print(f"Processing {pb_file}...")
        reactions = parse_single_ord_file(str(pb_file))

        # Add source file info
        for reaction in reactions:
            reaction['source_file'] = str(pb_file)

        all_reactions.extend(reactions)
        processed_files += 1

        if processed_files % 10 == 0:
            print(f"Processed {processed_files} files, found {len(all_reactions)} reactions so far")

    print(f"Total: Processed {processed_files} files, extracted {len(all_reactions)} reactions")

    # Save to CSV if requested
    if output_csv and all_reactions:
        df = pd.DataFrame(all_reactions)
        df.to_csv(output_csv, index=False)
        print(f"Saved {len(all_reactions)} reactions to {output_csv}")

    return all_reactions

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_ord.py <data_directory> [output_csv] [max_files]")
        print("Example: python parse_ord.py ./ord-data/data reactions.csv 50")
        sys.exit(1)

    data_dir = sys.argv[1]
    output_csv = sys.argv[2] if len(sys.argv) > 2 else None
    max_files = int(sys.argv[3]) if len(sys.argv) > 3 else None

    if not os.path.exists(data_dir):
        print(f"Error: Directory {data_dir} does not exist")
        sys.exit(1)

    reactions = parse_ord_directory(data_dir, output_csv, max_files)

    print(f"\nSummary:")
    print(f"- Processed files: {len(set(r['source_file'] for r in reactions))}")
    print(f"- Total reactions: {len(reactions)}")
    print(f"- Reactions with SMILES: {len([r for r in reactions if r['reaction_smiles']])}")

if __name__ == "__main__":
    main()