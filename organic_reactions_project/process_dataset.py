#!/usr/bin/env python3

import sys
import subprocess

def install_package(package):
    """Install a Python package using pip"""
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Check and install required packages
required_packages = ['datasets', 'huggingface_hub', 'requests', 'beautifulsoup4']

for package in required_packages:
    try:
        __import__(package.replace('-', '_'))
        print(f"{package} is already installed")
    except ImportError:
        print(f"Installing {package}...")
        install_package(package)

print("All required packages are now available!")
