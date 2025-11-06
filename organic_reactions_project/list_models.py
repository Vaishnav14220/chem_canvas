#!/usr/bin/env python3

import os
from google import genai

def list_available_models():
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    try:
        models = client.models.list()
        print("Available Gemini models:")
        for model in models:
            print(f"  - {model.name}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_available_models()
