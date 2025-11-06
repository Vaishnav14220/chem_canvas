#!/usr/bin/env python3

import os
import time
import requests
from bs4 import BeautifulSoup
from datasets import load_dataset, DatasetDict, Dataset
from huggingface_hub import HfApi
import json

def scrape_reaction_data(url, reaction_name):
    """Scrape reaction data from name-reaction.com"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        reaction_data = {
            'name': reaction_name,
            'url': url,
            'reactants': [],
            'reagents': [],
            'products': [],
            'byproducts': [],
            'conditions': '',
            'mechanism': '',
            'description': ''
        }

        # Find main content area - based on actual page structure
        # Look for divs that contain substantial text content
        all_divs = soup.find_all('div')
        content_divs = []

        for div in all_divs:
            text = div.get_text(strip=True)
            if len(text) > 200:  # Substantial content
                content_divs.append(div)

        if not content_divs:
            return reaction_data

        # Use the first substantial content div
        content = content_divs[0]

        # Extract description from the first paragraph or content
        paragraphs = content.find_all('p')
        description_parts = []
        for p in paragraphs[:3]:  # First few paragraphs usually contain description
            text = p.get_text(strip=True)
            if text and len(text) > 20:  # Avoid very short texts
                description_parts.append(text)

        reaction_data['description'] = ' '.join(description_parts)[:2000]

        # Look for reaction scheme images or structured reaction data
        # Many chemistry websites use specific classes or structures for reactions

        # Try to find reaction schemes in various formats
        reaction_schemes = []

        # Look for img tags with reaction in alt or src
        images = content.find_all('img')
        for img in images:
            alt_text = img.get('alt', '').lower()
            src = img.get('src', '').lower()
            if any(keyword in alt_text or keyword in src for keyword in ['reaction', 'scheme', 'equation']):
                # Try to extract reaction from alt text if available
                if alt_text and len(alt_text) > 10:
                    reaction_schemes.append(alt_text)

        # Look for divs or sections that might contain reaction information
        reaction_divs = content.find_all(['div', 'section'], class_=lambda x: x and any(term in x.lower() for term in ['reaction', 'scheme', 'equation', 'chemistry']))

        # Look for preformatted text or code blocks that might contain reactions
        pre_blocks = content.find_all(['pre', 'code'])
        for block in pre_blocks:
            text = block.get_text(strip=True)
            if text and any(char in text for char in ['→', '⇒', '⇌', '+', '=']):
                reaction_schemes.append(text)

        # Look for tables that might contain reaction data
        tables = content.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                row_text = ' '.join(cell.get_text(strip=True) for cell in cells)
                if row_text and any(char in row_text for char in ['→', '+', '=']):
                    reaction_schemes.append(row_text)

        # Extract information from the main content text
        full_text = content.get_text(separator=' ', strip=True)

        # Extract compounds from the main description
        import re

        # Common chemical patterns in organic reactions
        compound_patterns = [
            r'\b(triphenylphosphine|phosphine|PPh3)\b',  # Specific reagents
            r'\b(tetrahalomethane|carbon tetrachloride|CCl4)\b',
            r'\b(alcohol|alkoxide|alkyl halide|halide)\b',  # Functional groups/classes
            r'\b(CH3|CH2|COOH|COOR|NH2|OH|Br|Cl|I|F)\b',  # Common functional groups
            r'\b[A-Z][a-z]{0,2}\d*\b',  # Elements and simple formulas
            r'\b[A-Z][a-z]{0,2}\d+[A-Z][a-z]{0,2}\d*\b',  # Binary compounds like HCl, NaOH
        ]

        all_compounds = []
        for pattern in compound_patterns:
            matches = re.findall(pattern, full_text, re.IGNORECASE)
            all_compounds.extend(matches)

        # Extract conditions and reaction details
        conditions_text = []

        # Look for common reaction conditions
        condition_indicators = [
            r'\b\d+°C\b', r'\b\d+\s*°\s*C\b',  # Temperatures
            r'\broom temperature\b', r'\breflux\b', r'\bheat\b',
            r'\b(solvent|catalyst|base|acid)\b',  # Reaction components
            r'\bSN2\b', r'\bSN1\b', r'\bE2\b', r'\bE1\b',  # Mechanisms
        ]

        for indicator in condition_indicators:
            matches = re.findall(indicator, full_text, re.IGNORECASE)
            conditions_text.extend(matches)

        # Clean and deduplicate compounds
        cleaned_compounds = []
        for compound in all_compounds:
            compound = compound.strip()
            if len(compound) > 1 and compound.lower() not in cleaned_compounds:
                # Filter out very short or common words
                if compound.lower() not in ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'has', 'let', 'put', 'say', 'she', 'too', 'use']:
                    cleaned_compounds.append(compound.lower())

        # Categorize compounds based on reaction type and common patterns
        reactants = []
        reagents = []
        products = []
        byproducts = []

        # Extract specific information based on reaction name and content
        reaction_name_lower = reaction_name.lower()

        # Common reaction patterns
        if 'appel' in reaction_name_lower:
            # Appel reaction: alcohol + PPh3 + CCl4 → alkyl chloride + Ph3P=O
            reactants = ['alcohol', 'ROH'] if any(word in full_text.lower() for word in ['alcohol', 'hydroxyl']) else []
            reagents = ['triphenylphosphine', 'PPh3', 'tetrahalomethane', 'CCl4'] if any(word in full_text.lower() for word in ['phosphine', 'triphenyl', 'tetrahalo']) else []
            products = ['alkyl halide', 'RCl'] if 'halide' in full_text.lower() else []
            byproducts = ['triphenylphosphine oxide', 'Ph3P=O'] if 'oxide' in full_text.lower() else []

        elif 'grignard' in reaction_name_lower:
            reactants = ['alkyl halide', 'R-X'] if 'halide' in full_text.lower() else []
            reagents = ['magnesium', 'Mg'] if 'magnesium' in full_text.lower() else []
            products = ['grignard reagent', 'RMgX'] if 'grignard' in full_text.lower() else []

        elif 'wittig' in reaction_name_lower:
            reactants = ['carbonyl compound', 'aldehyde', 'ketone'] if any(word in full_text.lower() for word in ['carbonyl', 'aldehyde', 'ketone']) else []
            reagents = ['phosphorus ylide', 'wittig reagent'] if 'phosphorus' in full_text.lower() or 'ylide' in full_text.lower() else []
            products = ['alkene'] if 'alkene' in full_text.lower() else []
            byproducts = ['triphenylphosphine oxide', 'Ph3P=O'] if 'oxide' in full_text.lower() else []

        else:
            # Generic categorization for other reactions
            # Look for common patterns in the text
            text_lower = full_text.lower()

            # Common reactant patterns
            if any(word in text_lower for word in ['alcohol', 'hydroxyl', 'phenol']):
                reactants.append('alcohol')
            if any(word in text_lower for word in ['ketone', 'aldehyde', 'ester', 'acid']):
                reactants.append('carbonyl compound')
            if any(word in text_lower for word in ['alkene', 'alkyne']):
                reactants.append('unsaturated compound')
            if 'halide' in text_lower and 'starting' in text_lower:
                reactants.append('alkyl halide')

            # Common reagent patterns
            if any(word in text_lower for word in ['base', 'catalyst']):
                reagents.append('base catalyst')
            if any(word in text_lower for word in ['acid', 'hcl', 'h2so4']):
                reagents.append('acid catalyst')
            if any(word in text_lower for word in ['grignard', 'organometallic']):
                reagents.append('organometallic reagent')

            # Common product patterns
            if any(word in text_lower for word in ['amide', 'lactam']):
                products.append('amide')
            if any(word in text_lower for word in ['ester', 'carboxylate']):
                products.append('ester')
            if any(word in text_lower for word in ['alkene', 'olefin']) and 'product' in text_lower:
                products.append('alkene')

            # Extract meaningful chemical terms from the compound list
            chemical_terms = []
            common_words = {
                'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
                'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new',
                'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'has', 'let', 'put', 'say',
                'she', 'too', 'use', 'from', 'with', 'into', 'this', 'that', 'they', 'will', 'each',
                'which', 'their', 'time', 'what', 'about', 'would', 'there', 'could', 'other', 'than',
                'then', 'only', 'also', 'first', 'even', 'made', 'many', 'some', 'these', 'such',
                'when', 'year', 'your', 'them', 'said', 'here', 'come', 'both', 'been', 'where',
                'after', 'back', 'well', 'much', 'went', 'good', 'look', 'want', 'give', 'just',
                'over', 'think', 'also', 'back', 'use', 'find', 'give', 'just', 'know', 'take',
                'people', 'year', 'could', 'them', 'thing', 'come', 'work', 'make', 'like', 'look',
                'being', 'where', 'water', 'right', 'think', 'place', 'hand', 'part', 'against',
                'house', 'world', 'last', 'left', 'took', 'since', 'while', 'help', 'after', 'line',
                'before', 'turn', 'cause', 'same', 'mean', 'move', 'right', 'boy', 'old', 'too',
                'does', 'tell', 'why', 'ask', 'went', 'men', 'read', 'need', 'land', 'different',
                'home', 'us', 'move', 'try', 'kind', 'hand', 'picture', 'again', 'change', 'off',
                'play', 'spell', 'air', 'away', 'animal', 'house', 'point', 'page', 'letter', 'mother',
                'answer', 'found', 'study', 'still', 'learn', 'should', 'america', 'world', 'high',
                'every', 'near', 'add', 'food', 'between', 'own', 'below', 'country', 'plant',
                'last', 'school', 'father', 'keep', 'tree', 'never', 'start', 'city', 'earth',
                'eye', 'light', 'thought', 'head', 'under', 'story', 'saw', 'left', 'don\'t', 'few',
                'while', 'along', 'might', 'close', 'something', 'seem', 'next', 'hard', 'open',
                'example', 'begin', 'life', 'always', 'those', 'both', 'paper', 'together', 'got',
                'group', 'often', 'run', 'important', 'until', 'children', 'side', 'feet', 'car',
                'mile', 'night', 'walk', 'white', 'sea', 'began', 'grow', 'took', 'river', 'four',
                'carry', 'state', 'once', 'book', 'hear', 'stop', 'without', 'second', 'later',
                'miss', 'idea', 'enough', 'eat', 'face', 'watch', 'far', 'indian', 'really', 'almost',
                'let', 'above', 'girl', 'sometimes', 'mountain', 'cut', 'young', 'talk', 'soon',
                'list', 'song', 'being', 'leave', 'family', 'body', 'music', 'color', 'stand',
                'sun', 'questions', 'fish', 'area', 'mark', 'dog', 'horse', 'birds', 'problem',
                'complete', 'room', 'knew', 'since', 'ever', 'piece', 'told', 'usually', 'didn\'t',
                'friends', 'easy', 'heard', 'order', 'red', 'door', 'sure', 'become', 'top', 'ship',
                'across', 'today', 'during', 'short', 'better', 'best', 'however', 'low', 'hours',
                'black', 'products', 'happened', 'whole', 'measure', 'remember', 'early', 'waves',
                'reached', 'listen', 'wind', 'rock', 'space', 'covered', 'fast', 'several', 'hold',
                'himself', 'toward', 'five', 'step', 'morning', 'passed', 'vowel', 'true', 'hundred',
                'against', 'pattern', 'numeral', 'table', 'north', 'slowly', 'money', 'serve', 'appear',
                'road', 'map', 'science', 'rule', 'govern', 'pull', 'cold', 'notice', 'voice', 'unit',
                'power', 'town', 'fine', 'certain', 'fly', 'fall', 'lead', 'cry', 'dark', 'machine',
                'note', 'wait', 'plan', 'figure', 'star', 'box', 'noun', 'field', 'rest', 'able',
                'pound', 'done', 'beauty', 'drive', 'stood', 'contain', 'front', 'teach', 'week',
                'final', 'gave', 'green', 'quick', 'develop', 'ocean', 'warm', 'free', 'minute',
                'strong', 'special', 'mind', 'behind', 'clear', 'tail', 'produce', 'fact', 'street',
                'inch', 'multiply', 'nothing', 'course', 'stay', 'wheel', 'full', 'force', 'blue',
                'object', 'decide', 'surface', 'deep', 'moon', 'island', 'foot', 'system', 'busy',
                'test', 'record', 'boat', 'common', 'gold', 'possible', 'plane', 'stead', 'dry',
                'wonder', 'laugh', 'thousand', 'ago', 'ran', 'check', 'game', 'shape', 'equate',
                'hot', 'miss', 'brought', 'heat', 'snow', 'tire', 'bring', 'yes', 'distant', 'fill',
                'east', 'paint', 'language', 'among', 'grand', 'ball', 'yet', 'wave', 'drop', 'heart',
                'am', 'present', 'heavy', 'dance', 'engine', 'position', 'arm', 'wide', 'sail',
                'material', 'size', 'vary', 'settle', 'speak', 'weight', 'general', 'ice', 'matter',
                'circle', 'pair', 'include', 'divide', 'syllable', 'felt', 'perhaps', 'pick', 'sudden',
                'count', 'square', 'reason', 'length', 'represent', 'art', 'subject', 'region', 'energy',
                'hunt', 'probable', 'bed', 'brother', 'egg', 'ride', 'cell', 'believe', 'fraction',
                'forest', 'sit', 'race', 'window', 'store', 'summer', 'train', 'sleep', 'prove',
                'lone', 'leg', 'exercise', 'wall', 'catch', 'mount', 'wish', 'sky', 'board', 'joy',
                'winter', 'sat', 'written', 'wild', 'instrument', 'kept', 'glass', 'grass', 'cow',
                'job', 'edge', 'sign', 'visit', 'past', 'soft', 'fun', 'bright', 'gas', 'weather',
                'month', 'million', 'bear', 'finish', 'happy', 'hope', 'flower', 'clothe', 'strange',
                'gone', 'jump', 'baby', 'eight', 'village', 'meet', 'root', 'buy', 'raise', 'solve',
                'metal', 'whether', 'push', 'seven', 'paragraph', 'third', 'shall', 'held', 'hair',
                'describe', 'cook', 'floor', 'either', 'result', 'burn', 'hill', 'safe', 'cat', 'century',
                'consider', 'type', 'law', 'bit', 'coast', 'copy', 'phrase', 'silent', 'tall', 'sand',
                'soil', 'roll', 'temperature', 'finger', 'industry', 'value', 'fight', 'lie', 'beat',
                'excite', 'natural', 'view', 'sense', 'ear', 'else', 'quite', 'broke', 'case', 'middle',
                'kill', 'son', 'lake', 'moment', 'scale', 'loud', 'spring', 'observe', 'child', 'straight',
                'consonant', 'nation', 'dictionary', 'milk', 'speed', 'method', 'organ', 'pay', 'age',
                'section', 'dress', 'cloud', 'surprise', 'quiet', 'stone', 'tiny', 'climb', 'cool',
                'design', 'poor', 'lot', 'experiment', 'bottom', 'key', 'iron', 'single', 'stick',
                'flat', 'twenty', 'skin', 'smile', 'crease', 'hole', 'trade', 'melody', 'trip', 'office',
                'receive', 'row', 'mouth', 'exact', 'symbol', 'die', 'least', 'trouble', 'shout', 'except',
                'wrote', 'seed', 'tone', 'join', 'suggest', 'clean', 'break', 'lady', 'yard', 'rise',
                'bad', 'blow', 'oil', 'blood', 'touch', 'grew', 'cent', 'mix', 'team', 'wire', 'cost',
                'lost', 'brown', 'wear', 'garden', 'equal', 'sent', 'choose', 'fell', 'fit', 'flow',
                'fair', 'bank', 'collect', 'save', 'control', 'decimal', 'gentle', 'woman', 'captain',
                'practice', 'separate', 'difficult', 'doctor', 'please', 'protect', 'noon', 'whose',
                'locate', 'ring', 'character', 'insect', 'caught', 'period', 'indicate', 'radio', 'spoke',
                'atom', 'human', 'history', 'effect', 'electric', 'expect', 'crop', 'modern', 'element',
                'hit', 'student', 'corner', 'party', 'supply', 'bone', 'rail', 'imagine', 'provide',
                'agree', 'thus', 'capital', 'won\'t', 'chair', 'danger', 'fruit', 'rich', 'thick', 'soldier',
                'process', 'operate', 'guess', 'necessary', 'sharp', 'wing', 'create', 'neighbor', 'wash',
                'bat', 'rather', 'crowd', 'corn', 'compare', 'poem', 'string', 'bell', 'depend', 'meat',
                'rub', 'tube', 'famous', 'dollar', 'stream', 'fear', 'sight', 'thin', 'triangle', 'planet',
                'hurry', 'chief', 'colony', 'clock', 'mine', 'tie', 'enter', 'major', 'fresh', 'search',
                'send', 'yellow', 'gun', 'allow', 'print', 'dead', 'spot', 'desert', 'suit', 'current',
                'lift', 'rose', 'continue', 'block', 'chart', 'sell', 'success', 'company', 'subtract',
                'event', 'particular', 'deal', 'swim', 'term', 'opposite', 'wife', 'shoe', 'shoulder',
                'spread', 'arrange', 'camp', 'invent', 'cotton', 'born', 'determine', 'quart', 'nine',
                'truck', 'noise', 'level', 'chance', 'gather', 'shop', 'stretch', 'throw', 'shine',
                'property', 'column', 'molecule', 'select', 'wrong', 'gray', 'repeat', 'require', 'broad',
                'prepare', 'salt', 'nose', 'plural', 'anger', 'claim', 'continent'
            }

            for compound in cleaned_compounds:
                if compound not in common_words and len(compound) > 2:
                    # Keep if it looks like a chemical term
                    if any(char in compound for char in ['C', 'H', 'O', 'N', 'P', 'S', 'F', 'Cl', 'Br', 'I']) or compound in ['acid', 'base', 'salt', 'water', 'alcohol', 'ketone', 'aldehyde', 'ester', 'amide']:
                        chemical_terms.append(compound)

            # Add chemical terms to reagents (limit to avoid clutter)
            for term in chemical_terms[:2]:
                if term not in [r.lower() for r in reagents]:  # Avoid duplicates
                    reagents.append(term)

        # Fallback: if no specific categorization, use the found compounds
        if not reactants and not reagents and not products:
            # Distribute compounds roughly
            if cleaned_compounds:
                reactants = cleaned_compounds[:2]
                reagents = cleaned_compounds[2:4]
                products = cleaned_compounds[4:6]

        reaction_data['reactants'] = reactants[:3]  # Limit to 3 items
        reaction_data['reagents'] = reagents[:3]
        reaction_data['products'] = products[:3]
        reaction_data['byproducts'] = byproducts[:3]
        reaction_data['conditions'] = ' '.join(list(set(conditions_text)))[:500] if conditions_text else ''

        return reaction_data

    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return {
            'name': reaction_name,
            'url': url,
            'reactants': [],
            'reagents': [],
            'products': [],
            'byproducts': [],
            'conditions': '',
            'mechanism': '',
            'description': f'Error loading data: {str(e)}'
        }

def main():
    # Set up Hugging Face authentication
    hf_token = os.getenv("HF_TOKEN")
    os.environ["HF_TOKEN"] = hf_token

    # Load the dataset
    print("Loading dataset from Hugging Face...")
    dataset_name = "smitathkr1/organic_reactions"
    dataset = load_dataset(dataset_name)

    print(f"Dataset loaded successfully!")
    print(f"Dataset structure: {dataset}")

    # Get the train split
    train_data = dataset['train']

    print(f"Number of reactions to process: {len(train_data)}")

    # Process each reaction
    structured_data = []
    processed_count = 0

    for example in train_data:
        reaction_name = example['name']
        reaction_url = example['link']

        print(f"Processing {processed_count + 1}/{len(train_data)}: {reaction_name}")

        # Scrape the reaction data
        reaction_data = scrape_reaction_data(reaction_url, reaction_name)
        structured_data.append(reaction_data)

        processed_count += 1

        # Add a small delay to be respectful to the website
        time.sleep(0.5)

        # Process all reactions

    print(f"Processed {len(structured_data)} reactions")

    # Create new dataset
    new_dataset = Dataset.from_list(structured_data)

    # Upload to Hugging Face
    new_dataset_name = "smitathkr1/organic_reactions_structured"
    print(f"Uploading to {new_dataset_name}...")

    new_dataset.push_to_hub(new_dataset_name, token=hf_token)

    print("Upload completed successfully!")
    print(f"New dataset available at: https://huggingface.co/datasets/{new_dataset_name}")

if __name__ == "__main__":
    main()
