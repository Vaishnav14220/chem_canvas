"""
Scholarly API - Hugging Face Space
A FastAPI wrapper around the scholarly Python library for Google Scholar data.

Deploy this to Hugging Face Spaces as a Gradio or Docker space.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
from functools import lru_cache
import json

# Import scholarly
from scholarly import scholarly, ProxyGenerator

# Initialize FastAPI app
app = FastAPI(
    title="Scholarly API",
    description="API for searching Google Scholar publications and citations",
    version="1.0.0"
)

# Add CORS middleware for cross-origin requests from your React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up proxy to avoid Google Scholar blocking
# Using free proxies - for production, consider ScraperAPI or similar
try:
    pg = ProxyGenerator()
    pg.FreeProxies()
    scholarly.use_proxy(pg)
    print("✅ Proxy configured successfully")
except Exception as e:
    print(f"⚠️ Could not configure proxy: {e}")
    print("Running without proxy - may be rate limited")

# ==========================================
# Pydantic Models
# ==========================================

class Author(BaseModel):
    name: str
    affiliation: Optional[str] = None
    scholar_id: Optional[str] = None
    citedby: Optional[int] = None
    interests: Optional[List[str]] = None

class Publication(BaseModel):
    title: str
    authors: List[str]
    year: Optional[int] = None
    abstract: Optional[str] = None
    venue: Optional[str] = None
    citations: Optional[int] = None
    url: Optional[str] = None
    bibtex: Optional[str] = None
    scholar_url: Optional[str] = None

class SearchResult(BaseModel):
    publications: List[Publication]
    total_results: Optional[int] = None
    query: str

class CitationResult(BaseModel):
    citing_papers: List[Publication]
    total_citations: int
    original_title: str

class SimilarPapersResult(BaseModel):
    similar_papers: List[Publication]
    original_title: str

# ==========================================
# Helper Functions
# ==========================================

def parse_publication(pub: Dict[Any, Any], fill_details: bool = False) -> Publication:
    """Convert scholarly publication dict to our Publication model"""
    try:
        if fill_details:
            pub = scholarly.fill(pub)
        
        bib = pub.get('bib', {})
        
        # Extract authors
        authors = bib.get('author', '')
        if isinstance(authors, str):
            authors = [a.strip() for a in authors.split(' and ')]
        elif isinstance(authors, list):
            authors = authors
        else:
            authors = []
        
        # Extract year
        year = bib.get('pub_year') or bib.get('year')
        if year:
            try:
                year = int(year)
            except:
                year = None
        
        return Publication(
            title=bib.get('title', 'Unknown Title'),
            authors=authors,
            year=year,
            abstract=bib.get('abstract', ''),
            venue=bib.get('venue', '') or bib.get('journal', '') or bib.get('booktitle', ''),
            citations=pub.get('num_citations', 0),
            url=pub.get('pub_url', ''),
            bibtex=pub.get('bibtex', ''),
            scholar_url=pub.get('url_scholarbib', '')
        )
    except Exception as e:
        print(f"Error parsing publication: {e}")
        return Publication(
            title=str(pub.get('bib', {}).get('title', 'Unknown')),
            authors=[],
            year=None
        )

# ==========================================
# API Endpoints
# ==========================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "Scholarly API is running",
        "endpoints": [
            "/search/publications",
            "/search/author",
            "/citations",
            "/similar",
            "/bibtex"
        ]
    }

@app.get("/search/publications", response_model=SearchResult)
async def search_publications(
    query: str = Query(..., description="Search query for publications"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results")
):
    """
    Search for publications on Google Scholar.
    
    - **query**: The search query (e.g., "machine learning chemistry")
    - **limit**: Maximum number of results to return (default: 10, max: 50)
    """
    try:
        search_query = scholarly.search_pubs(query)
        publications = []
        
        for i, pub in enumerate(search_query):
            if i >= limit:
                break
            publications.append(parse_publication(pub, fill_details=False))
        
        return SearchResult(
            publications=publications,
            total_results=len(publications),
            query=query
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/search/author")
async def search_author(
    name: str = Query(..., description="Author name to search"),
    limit: int = Query(5, ge=1, le=20, description="Maximum number of authors")
):
    """
    Search for authors on Google Scholar.
    
    - **name**: The author's name to search
    - **limit**: Maximum number of results
    """
    try:
        search_query = scholarly.search_author(name)
        authors = []
        
        for i, author in enumerate(search_query):
            if i >= limit:
                break
            authors.append(Author(
                name=author.get('name', 'Unknown'),
                affiliation=author.get('affiliation', ''),
                scholar_id=author.get('scholar_id', ''),
                citedby=author.get('citedby', 0),
                interests=author.get('interests', [])
            ))
        
        return {"authors": authors, "query": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Author search failed: {str(e)}")

@app.get("/citations", response_model=CitationResult)
async def get_citations(
    title: str = Query(..., description="Title of the paper to get citations for"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of citations")
):
    """
    Get papers that cite a specific publication.
    
    - **title**: The title of the paper
    - **limit**: Maximum number of citing papers to return
    """
    try:
        # First, find the paper
        search_query = scholarly.search_pubs(title)
        paper = next(search_query, None)
        
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # Fill the paper details
        paper = scholarly.fill(paper)
        
        # Get citations
        citing_papers = []
        citations_iterator = scholarly.citedby(paper)
        
        for i, citation in enumerate(citations_iterator):
            if i >= limit:
                break
            citing_papers.append(parse_publication(citation, fill_details=False))
        
        return CitationResult(
            citing_papers=citing_papers,
            total_citations=paper.get('num_citations', len(citing_papers)),
            original_title=paper.get('bib', {}).get('title', title)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get citations: {str(e)}")

@app.get("/similar")
async def get_similar_papers(
    title: str = Query(..., description="Title of the paper to find similar papers for"),
    limit: int = Query(10, ge=1, le=30, description="Maximum number of similar papers")
):
    """
    Find papers similar to a given publication using keyword-based search.
    
    - **title**: The title of the paper
    - **limit**: Maximum number of similar papers to return
    """
    try:
        # Search for the original paper
        search_query = scholarly.search_pubs(title)
        paper = next(search_query, None)
        
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # Extract keywords from title for related search
        bib = paper.get('bib', {})
        original_title = bib.get('title', title)
        
        # Use title words as keywords for similar paper search
        keywords = ' '.join(original_title.split()[:5])  # First 5 words
        
        similar_search = scholarly.search_pubs(keywords)
        similar_papers = []
        
        for i, pub in enumerate(similar_search):
            if i >= limit + 1:  # +1 to skip original
                break
            pub_title = pub.get('bib', {}).get('title', '')
            # Skip the original paper
            if pub_title.lower() != original_title.lower():
                similar_papers.append(parse_publication(pub, fill_details=False))
        
        return SimilarPapersResult(
            similar_papers=similar_papers[:limit],
            original_title=original_title
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to find similar papers: {str(e)}")

@app.get("/bibtex")
async def get_bibtex(
    title: str = Query(..., description="Title of the paper to get BibTeX for")
):
    """
    Get BibTeX citation for a publication.
    
    - **title**: The title of the paper
    """
    try:
        search_query = scholarly.search_pubs(title)
        paper = next(search_query, None)
        
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # Fill to get full details including bibtex
        paper = scholarly.fill(paper)
        
        bib = paper.get('bib', {})
        
        # Generate BibTeX manually if not available
        bibtex = paper.get('bibtex', '')
        if not bibtex:
            # Create a basic BibTeX entry
            entry_type = 'article'
            if 'booktitle' in bib:
                entry_type = 'inproceedings'
            elif 'journal' not in bib and 'venue' not in bib:
                entry_type = 'misc'
            
            author = bib.get('author', 'Unknown')
            title = bib.get('title', 'Unknown')
            year = bib.get('pub_year', bib.get('year', ''))
            venue = bib.get('venue', '') or bib.get('journal', '') or bib.get('booktitle', '')
            
            # Create cite key from first author last name and year
            first_author = author.split(' and ')[0] if ' and ' in author else author
            last_name = first_author.split()[-1] if first_author else 'unknown'
            cite_key = f"{last_name.lower()}{year}"
            
            bibtex = f"@{entry_type}{{{cite_key},\n"
            bibtex += f"  author = {{{author}}},\n"
            bibtex += f"  title = {{{title}}},\n"
            if year:
                bibtex += f"  year = {{{year}}},\n"
            if venue:
                if entry_type == 'inproceedings':
                    bibtex += f"  booktitle = {{{venue}}},\n"
                else:
                    bibtex += f"  journal = {{{venue}}},\n"
            bibtex += "}"
        
        return {
            "title": bib.get('title', title),
            "bibtex": bibtex,
            "authors": bib.get('author', ''),
            "year": bib.get('pub_year', bib.get('year', '')),
            "venue": bib.get('venue', '') or bib.get('journal', '')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get BibTeX: {str(e)}")

@app.get("/publication/details")
async def get_publication_details(
    title: str = Query(..., description="Title of the paper to get full details")
):
    """
    Get full details of a publication including abstract, citations, etc.
    
    - **title**: The title of the paper
    """
    try:
        search_query = scholarly.search_pubs(title)
        paper = next(search_query, None)
        
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found")
        
        # Fill to get full details
        paper = scholarly.fill(paper)
        
        return {
            "publication": parse_publication(paper, fill_details=False),
            "raw_data": {
                "bib": paper.get('bib', {}),
                "num_citations": paper.get('num_citations', 0),
                "citedby_url": paper.get('citedby_url', ''),
                "pub_url": paper.get('pub_url', '')
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get details: {str(e)}")

# ==========================================
# Main entry point for Hugging Face Spaces
# ==========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
