import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Button,
    TextField,
    CircularProgress,
    Card,
    CardContent,
    CardMedia
} from '@mui/material';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { generateVisionContent } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

const VisionAnalyzePage = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("Describe this image in detail.");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            setError(null);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('Failed to convert file to base64'));
                }
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleAnalyze = async () => {
        if (!selectedFile) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const base64 = await fileToBase64(selectedFile);
            const mimeType = selectedFile.type || 'image/jpeg';

            const responseText = await generateVisionContent(prompt, base64, mimeType);

            setResult(responseText);
        } catch (err: any) {
            console.error('Vision analysis failed:', err);
            setError(err.message || 'Failed to analyze image');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 4 }}>
                Vision Agent: Image Analysis
            </Typography>

            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                    {/* Upload Section */}
                    <Box
                        sx={{
                            border: '2px dashed #ccc',
                            borderRadius: 2,
                            p: 4,
                            textAlign: 'center',
                            cursor: 'pointer',
                            bgcolor: 'background.default',
                            '&:hover': { bgcolor: 'action.hover' }
                        }}
                        component="label"
                    >
                        <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                        {previewUrl ? (
                            <Box sx={{ position: 'relative', height: 300, display: 'flex', justifyContent: 'center' }}>
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    style={{ maxHeight: '100%', objectFit: 'contain' }}
                                />
                            </Box>
                        ) : (
                            <Box sx={{ py: 4 }}>
                                <Upload size={48} color="#666" style={{ marginBottom: 16 }} />
                                <Typography variant="h6" color="textSecondary">
                                    Click to Upload Image
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Controls */}
                    <TextField
                        fullWidth
                        label="Prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                        variant="outlined"
                    />

                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleAnalyze}
                        disabled={!selectedFile || loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ImageIcon />}
                        sx={{ py: 1.5 }}
                    >
                        {loading ? 'Analyzing...' : 'Analyze Image'}
                    </Button>

                    {/* Results */}
                    {error && (
                        <Paper sx={{ p: 2, bgcolor: '#ffebee', color: '#c62828' }}>
                            <Typography>{error}</Typography>
                        </Paper>
                    )}

                    {result && (
                        <Card variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Analysis Result:
                                </Typography>
                                <Box sx={{
                                    typography: 'body1',
                                    '& p': { marginBottom: 2 },
                                    '& ul, & ol': { paddingLeft: 3 }
                                }}>
                                    <ReactMarkdown>{result}</ReactMarkdown>
                                </Box>
                            </CardContent>
                        </Card>
                    )}

                </Box>
            </Paper>
        </Container>
    );
};

export default VisionAnalyzePage;
