"""
OCR Extraction Function using PaddleOCR
Extracts text, tables, and diagrams from uploaded documents

This function uses PP-StructureV3 for comprehensive document parsing
including layout analysis, table extraction, and figure detection.
"""

import json
import base64
import os
import tempfile
from typing import Dict, List, Any, Optional

# Note: For Netlify deployment, PaddleOCR needs to be installed
# For local development, install with: pip install paddleocr

def handler(event, context):
    """
    Netlify function handler for OCR extraction
    
    Expects POST request with:
    - body: JSON with 'image' (base64) or 'file_url' field
    - Optional: 'extract_type' ('text', 'table', 'all')
    """
    
    # Handle CORS
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        image_data = body.get('image')  # Base64 encoded image
        file_url = body.get('file_url')  # URL to fetch
        extract_type = body.get('extract_type', 'all')  # 'text', 'table', 'figure', 'all'
        
        if not image_data and not file_url:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'No image data or file URL provided'})
            }
        
        # Try to import PaddleOCR
        try:
            from paddleocr import PaddleOCR
        except ImportError:
            # Fallback: use alternative OCR or return mock data for testing
            return fallback_ocr_response(body, headers)
        
        # Save image to temp file
        temp_path = None
        if image_data:
            # Decode base64
            image_bytes = base64.b64decode(image_data)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as f:
                f.write(image_bytes)
                temp_path = f.name
        elif file_url:
            import urllib.request
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as f:
                urllib.request.urlretrieve(file_url, f.name)
                temp_path = f.name
        
        try:
            result = process_with_paddleocr(temp_path, extract_type)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result)
            }
        finally:
            # Cleanup temp file
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)})
        }


def process_with_paddleocr(image_path: str, extract_type: str) -> Dict[str, Any]:
    """
    Process image using PaddleOCR PP-StructureV3
    
    Returns extracted text, tables, and figures
    """
    from paddleocr import PaddleOCR
    
    result = {
        'success': True,
        'text_blocks': [],
        'tables': [],
        'figures': [],
        'formulas': [],
        'raw_text': ''
    }
    
    # Initialize OCR with structure detection
    ocr = PaddleOCR(
        use_doc_orientation_classify=True,
        use_doc_unwarping=True,
        use_textline_orientation=True,
        lang='en'
    )
    
    # Run OCR
    ocr_result = ocr.predict(input=image_path)
    
    # Process results
    all_text = []
    
    for res in ocr_result:
        if hasattr(res, 'rec_texts'):
            for i, text in enumerate(res.rec_texts):
                text_block = {
                    'text': text,
                    'confidence': float(res.rec_scores[i]) if hasattr(res, 'rec_scores') else 1.0,
                    'bbox': res.dt_polys[i].tolist() if hasattr(res, 'dt_polys') else None
                }
                result['text_blocks'].append(text_block)
                all_text.append(text)
    
    result['raw_text'] = ' '.join(all_text)
    
    # Try PP-StructureV3 for table/figure extraction if available
    try:
        from paddleocr import PPStructure
        
        structure = PPStructure(
            recovery=True,
            lang='en'
        )
        
        structure_result = structure(image_path)
        
        for item in structure_result:
            item_type = item.get('type', 'text')
            
            if item_type == 'table':
                table_data = {
                    'type': 'table',
                    'bbox': item.get('bbox', []),
                    'html': item.get('res', {}).get('html', ''),
                    'cells': item.get('res', {}).get('cells', [])
                }
                result['tables'].append(table_data)
                
            elif item_type == 'figure':
                figure_data = {
                    'type': 'figure',
                    'bbox': item.get('bbox', []),
                    'caption': item.get('res', {}).get('caption', '')
                }
                result['figures'].append(figure_data)
                
            elif item_type == 'equation':
                formula_data = {
                    'type': 'formula',
                    'bbox': item.get('bbox', []),
                    'latex': item.get('res', {}).get('latex', '')
                }
                result['formulas'].append(formula_data)
                
    except ImportError:
        # PP-Structure not available, continue with basic OCR
        pass
    
    return result


def fallback_ocr_response(body: dict, headers: dict) -> dict:
    """
    Fallback response when PaddleOCR is not available
    Uses browser-based OCR or returns structured placeholder
    """
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'success': True,
            'fallback': True,
            'message': 'PaddleOCR not available on server. Using client-side extraction.',
            'text_blocks': [],
            'tables': [],
            'figures': [],
            'formulas': [],
            'raw_text': '',
            'use_client_ocr': True
        })
    }
