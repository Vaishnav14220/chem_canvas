/**
 * Netlify Serverless Function for LaTeX Compilation
 * 
 * This function acts as a CORS-free proxy to compile LaTeX documents
 * using multiple online LaTeX compilation services for reliability.
 * Based on latexit approach but adapted for serverless environment.
 */

const fetch = require('node-fetch');
const FormData = require('form-data');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { content, filename = 'main.tex' } = JSON.parse(event.body);

    if (!content) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No LaTeX content provided' })
      };
    }

    // Compilation services in order of reliability
    const compilationServices = [
      { name: 'YtoTech', fn: compileWithYtoTech },
      { name: 'LaTeX.Online', fn: compileWithLatexOnline },
      { name: 'TexLive.net', fn: compileWithTexLive }
    ];

    let lastError = null;

    for (const service of compilationServices) {
      try {
        console.log(`Trying ${service.name}...`);
        const result = await service.fn(content, filename);
        if (result.success) {
          console.log(`${service.name} succeeded`);
          return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
          };
        }
      } catch (err) {
        console.log(`${service.name} failed:`, err.message);
        lastError = err;
      }
    }

    // All services failed
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: lastError?.message || 'All compilation services failed',
        log: 'Unable to compile LaTeX. Please check your document for errors or try Overleaf.',
        suggestions: [
          'Check for missing packages or incorrect syntax',
          'Ensure all \\begin{} have matching \\end{}',
          'Check for special characters that need escaping',
          'Try a simpler document to test'
        ]
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};

// YtoTech LaTeX API - Most reliable
async function compileWithYtoTech(content, filename) {
  const response = await fetch('https://latex.ytotech.com/builds/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      compiler: 'pdflatex',
      resources: [
        {
          main: true,
          content: content
        }
      ]
    }),
    timeout: 60000
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YtoTech API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/pdf')) {
    const pdfBuffer = await response.buffer();
    const pdfBase64 = pdfBuffer.toString('base64');
    
    return {
      success: true,
      pdf: pdfBase64,
      log: 'Compiled successfully with YtoTech LaTeX API'
    };
  }

  // Check if it's an error response
  const responseData = await response.json().catch(() => null);
  if (responseData?.logs) {
    throw new Error(`Compilation errors:\n${responseData.logs}`);
  }
  
  throw new Error('YtoTech compilation failed - no PDF returned');
}

// LaTeX.Online - Good fallback
async function compileWithLatexOnline(content, filename) {
  const form = new FormData();
  form.append('file', Buffer.from(content), {
    filename: filename,
    contentType: 'text/plain'
  });

  const response = await fetch('https://latexonline.cc/compile?command=pdflatex', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
    timeout: 60000
  });

  if (response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      const pdfBuffer = await response.buffer();
      const pdfBase64 = pdfBuffer.toString('base64');
      
      return {
        success: true,
        pdf: pdfBase64,
        log: 'Compiled successfully with LaTeX.Online'
      };
    }
  }

  const errorText = await response.text();
  throw new Error(errorText || 'LaTeX.Online compilation failed');
}

// TexLive.net - Secondary fallback
async function compileWithTexLive(content, filename) {
  const params = new URLSearchParams();
  params.append('filecontents[]', content);
  params.append('filename[]', filename);
  params.append('engine', 'pdflatex');
  params.append('return', 'pdf');

  const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString(),
    timeout: 60000
  });

  if (response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      const pdfBuffer = await response.buffer();
      const pdfBase64 = pdfBuffer.toString('base64');
      
      return {
        success: true,
        pdf: pdfBase64,
        log: 'Compiled successfully with TexLive.net'
      };
    }
  }

  throw new Error('TexLive.net compilation failed');
}
