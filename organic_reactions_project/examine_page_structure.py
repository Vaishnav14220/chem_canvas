#!/usr/bin/env python3

import requests
from bs4 import BeautifulSoup

def examine_page(url):
    """Examine the HTML structure of a reaction page"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        print(f"URL: {url}")
        print("=" * 50)

        # Look for all content on the page
        print("Page body content:")
        body = soup.find('body')
        if body:
            # Get all text content from the page
            all_text = body.get_text(separator='\n', strip=True)
            print(f"Total text length: {len(all_text)}")
            print("First 1000 characters:")
            print(all_text[:1000])
            print("\n" + "="*50 + "\n")

        # Look for any element that might contain reaction information
        all_divs = soup.find_all('div')
        print(f"Found {len(all_divs)} div elements")

        # Look for content in different possible containers
        possible_containers = [
            soup.find('main'),
            soup.find('article'),
            soup.find('div', class_='content'),
            soup.find('div', class_='entry'),
            soup.find('div', id='content'),
            soup.find('div', id='main'),
        ]

        content_found = False
        for i, container in enumerate(possible_containers):
            if container:
                print(f"\nContainer {i+1} found:")
                text = container.get_text(separator=' ', strip=True)[:500]
                print(f"  Text: {text}...")
                content_found = True

        if not content_found:
            print("No standard containers found. Looking at all divs with substantial content:")
            for i, div in enumerate(all_divs):
                text = div.get_text(strip=True)
                if len(text) > 100:  # Only show divs with substantial content
                    print(f"  DIV {i+1} (classes: {div.get('class', [])}): {text[:200]}...")

        # Check for scripts that might load content
        scripts = soup.find_all('script')
        print(f"\nFound {len(scripts)} script tags")
        for script in scripts:
            src = script.get('src', '')
            if 'load' in src.lower() or 'content' in src.lower() or 'data' in src.lower():
                print(f"  Script src: {src}")

        print("\nPage title:", soup.title.get_text() if soup.title else "No title")

    except Exception as e:
        print(f"Error: {e}")

# Test with one of the reaction pages
examine_page("https://www.name-reaction.com/appel-reaction")
