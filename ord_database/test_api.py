import requests
import json

def test_ord_api(api_url, test_queries=None):
    """
    Test the ORD API with various queries.

    Args:
        api_url (str): The deployed Apps Script URL
        test_queries (list): List of test queries to run
    """
    if test_queries is None:
        test_queries = [
            "",  # All reactions
            "Buchwald",  # Search by reaction type
            "CCO",  # Search by SMILES fragment
            "coupling",  # Search by keyword
        ]

    print(f"Testing ORD API: {api_url}")
    print("=" * 50)

    for query in test_queries:
        try:
            url = api_url
            if query:
                url += f"?query={query}"

            print(f"\nTesting query: '{query}'")
            print(f"URL: {url}")

            response = requests.get(url, timeout=30)
            response.raise_for_status()

            data = response.json()
            print(f"Status: {response.status_code}")
            print(f"Results: {len(data)} reactions")

            if data:
                # Show first result
                first = data[0]
                print(f"Sample reaction ID: {first.get('reaction_id', 'N/A')}")
                reaction_smiles = first.get('reaction_smiles', '')
                if reaction_smiles:
                    # Truncate long SMILES for display
                    truncated = reaction_smiles[:100] + "..." if len(reaction_smiles) > 100 else reaction_smiles
                    print(f"Sample SMILES: {truncated}")
            else:
                print("No results found")

        except requests.exceptions.RequestException as e:
            print(f"Error: {e}")
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Response text: {response.text[:500]}...")

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python test_api.py <api_url>")
        print("Example: python test_api.py 'https://script.google.com/macros/s/YOUR_ID/exec'")
        sys.exit(1)

    api_url = sys.argv[1]
    test_ord_api(api_url)

if __name__ == "__main__":
    main()