# Organic Reactions Dataset Creator

A comprehensive project for creating structured datasets of organic reactions using AI-powered web scraping and data extraction.

## 📁 Project Structure

This project contains multiple approaches and implementations for processing organic reaction data:

### 🔧 Core Scripts

#### Local Processing Scripts
- **`gemini_extractor.py`** - Main script for processing all 828 reactions using Gemini Flash API
- **`grignard_gemini.py`** - Test script for single reaction extraction (Grignard example)
- **`process_hf_dataset.py`** - Earlier web scraping approach with regex parsing
- **`process_dataset.py`** - Package installation utility

#### Utility Scripts
- **`check_extracted_data.py`** - Script to examine extracted reaction data
- **`examine_page_structure.py`** - Tool to analyze webpage HTML structure
- **`list_models.py`** - Gemini API models listing utility

#### Hugging Face Space Files
- **`hf_space_app.py`** - Gradio application for HF Space deployment
- **`hf_space_requirements.txt`** - Dependencies for HF Space
- **`hf_space_README.md`** - HF Space documentation

## 🚀 Features

### ✅ Completed Features
- **AI-Powered Extraction**: Uses Google Gemini Flash API for intelligent reaction data extraction
- **Structured Output**: Generates comprehensive JSON with reactants, reagents, products, byproducts, conditions, mechanisms, and descriptions
- **SMILES Generation**: Automatically generates SMILES strings for all chemical components
- **Generic Processing**: Works for any organic reaction type (not limited to specific reactions)
- **Error Handling**: Robust retry logic and error recovery
- **Rate Limiting**: Respects API limits with intelligent delays
- **HF Space Integration**: Deployable on Hugging Face Spaces with Gradio interface

### 🎯 Output Dataset Structure

Each reaction entry contains:
```json
{
  "reaction_name": "Reaction Name",
  "reactants": ["reactant1", "reactant2"],
  "reagents": ["reagent1", "reagent2"],
  "products": ["product1", "product2"],
  "byproducts": ["byproduct1"],
  "conditions": "temperature, solvent, atmosphere details",
  "mechanism": "step-by-step reaction mechanism",
  "description": "reaction overview and significance",
  "reactants_smiles": ["SMILES1", "SMILES2"],
  "reagents_smiles": ["SMILES3", "SMILES4"],
  "products_smiles": ["SMILES5", "SMILES6"],
  "byproducts_smiles": ["SMILES7"],
  "url": "source URL"
}
```

## 🛠️ Installation & Setup

### Prerequisites
```bash
pip install requests beautifulsoup4 google-genai datasets huggingface_hub
```

### API Keys Required
1. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Hugging Face Token**: Get from [HF Settings](https://huggingface.co/settings/tokens)

## 📊 Usage

### Method 1: Hugging Face Space (Recommended)
1. Visit: https://huggingface.co/spaces/smitathkr1/organic-reactions-dataset-creator
2. Enter your API keys
3. Click "Start Processing All Reactions"
4. Wait ~2-3 hours for completion

### Method 2: Local Processing
```bash
# For all reactions
python gemini_extractor.py

# For single reaction test
python grignard_gemini.py
```

### Method 3: Check Results
```bash
python check_extracted_data.py
```

## 🔄 Processing Flow

1. **Data Loading**: Load 828 reactions from `smitathkr1/organic_reactions` dataset
2. **Web Scraping**: Extract text content from reaction URLs
3. **AI Processing**: Send content to Gemini Flash for structured extraction
4. **SMILES Generation**: AI generates SMILES strings for all chemicals
5. **Dataset Creation**: Compile results into Hugging Face dataset
6. **Upload**: Publish final dataset to Hugging Face Hub

## 📈 Performance & Limits

- **Processing Speed**: ~2 reactions/minute (with API rate limiting)
- **Total Time**: ~2-3 hours for all 828 reactions
- **API Limits**: Respects Gemini Flash free tier (15 requests/minute)
- **Error Recovery**: Automatic retries for failed requests
- **Cost**: Minimal (free tier usage)

## 🎯 Key Improvements Over Previous Approaches

### ✅ **AI vs Regex Parsing**
- **Before**: Manual regex patterns, limited chemical recognition
- **After**: AI understands context, generates SMILES, handles complex reactions

### ✅ **Generic vs Specific**
- **Before**: Hardcoded patterns for specific reactions only
- **After**: Works for any organic reaction type

### ✅ **SMILES Integration**
- **Before**: No SMILES strings
- **After**: Automatic SMILES generation for all chemical components

### ✅ **Deployment Ready**
- **Before**: Local scripts only
- **After**: HF Space deployment with web interface

## 📁 File Descriptions

| File | Purpose | Key Features |
|------|---------|--------------|
| `gemini_extractor.py` | Main processing script | Full dataset processing, AI extraction, SMILES generation |
| `hf_space_app.py` | Gradio web app | User interface, Space secrets support, progress tracking |
| `grignard_gemini.py` | Single reaction test | Gemini API testing, SMILES validation |
| `process_hf_dataset.py` | Legacy scraper | Regex-based parsing approach |
| `check_extracted_data.py` | Data inspection | Result validation and preview |
| `examine_page_structure.py` | HTML analysis | Webpage structure debugging |

## 🔍 Data Sources

- **Input Dataset**: `smitathkr1/organic_reactions` (828 reaction links)
- **Web Sources**: name-reaction.com, Wikipedia reaction pages
- **AI Model**: Google Gemini Flash 1.5
- **Output Dataset**: `smitathkr1/organic_reactions_structured_complete`

## 🚨 Important Notes

### API Keys Security
- Never commit API keys to version control
- Use environment variables or HF Space secrets
- Rotate keys regularly

### Rate Limiting
- Respects API provider limits
- Includes automatic retry logic
- May take several hours for full processing

### Data Quality
- AI extraction may occasionally miss details
- Manual review recommended for critical applications
- SMILES strings validated by AI model

## 🤝 Contributing

This project demonstrates multiple approaches to chemical data extraction:
1. **Regex-based web scraping** (traditional approach)
2. **AI-powered extraction** (modern approach)
3. **SMILES integration** (computational chemistry)
4. **Cloud deployment** (scalable processing)

## 📄 License

Educational and research purposes. Respect API terms and website usage policies.

## 🎉 Success Metrics

- ✅ **Processed**: 828 organic reactions
- ✅ **Generated**: Structured JSON with SMILES
- ✅ **Deployed**: Working HF Space application
- ✅ **Validated**: AI extraction accuracy
- ✅ **Scalable**: Ready for larger datasets

---

**Created for**: Automated chemical data extraction and curation
**Technology Stack**: Python, Gemini AI, Hugging Face, Gradio
**Dataset Size**: 828 reactions with comprehensive metadata
