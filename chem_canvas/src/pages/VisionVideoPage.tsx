import React, { useState, useRef, useEffect } from 'react';
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
    Stack,
    Alert
} from '@mui/material';
import { Upload, Video as VideoIcon, Camera, Square, Radio } from 'lucide-react';
import { generateVideoContent } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

const VisionVideoPage = () => {
    const [mode, setMode] = useState<'upload' | 'webcam'>('upload');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("Perform a detailed analysis of this video. Describe the events, objects, and actions.");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Webcam state
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraActive(true);
            setRecordedBlob(null);
            setPreviewUrl(null);
            setError(null);
        } catch (err: any) {
            console.error("Error accessing webcam:", err);
            setError("Could not access webcam. Please ensure permissions are granted.");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
        setIsRecording(false);
    };

    const startRecording = () => {
        if (!streamRef.current) return;

        setRecordedChunks([]);
        const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                setRecordedChunks((prev) => [...prev, event.data]);
            }
        };

        mediaRecorder.onstop = () => {
            // Blob creation handled in effect or helper, but here we can do it directly:
            // We need to wait for state update? No, chunks are pushed. 
            // Better to handle blob creation here?
            // Actually `ondataavailable` fires periodically.
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            stopCamera(); // Stop camera preview after recording to show result
        }
    };

    // Effect to process chunks when recording stops
    useEffect(() => {
        if (!isRecording && recordedChunks.length > 0 && !isCameraActive) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            setRecordedBlob(blob);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            setRecordedChunks([]);
        }
    }, [isRecording, recordedChunks, isCameraActive]);


    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            if (file.size > 25 * 1024 * 1024) {
                setError("File is too large for client-side analysis. Please use a file smaller than 25MB.");
                return;
            }

            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            setError(null);
            setMode('upload');
            setRecordedBlob(null);
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('Failed to convert blob to base64'));
                }
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleAnalyze = async () => {
        // Source can be file OR recorded blob
        const blobToAnalyze = mode === 'upload' ? selectedFile : recordedBlob;

        if (!blobToAnalyze) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const base64 = await blobToBase64(blobToAnalyze);
            const mimeType = blobToAnalyze.type || 'video/mp4';
            // Note: MediaRecorder creates 'video/webm'. Gemini supports it.

            const responseText = await generateVideoContent(
                prompt,
                base64,
                mimeType,
                { timeout: 120000 }
            );

            setResult(responseText);
        } catch (err: any) {
            console.error('Video analysis failed:', err);
            setError(err.message || 'Failed to analyze video');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <VideoIcon size={32} />
                Vision Agent: Video Analysis
            </Typography>

            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                    {/* Mode Selection */}
                    <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
                        <Button
                            variant={mode === 'upload' ? "contained" : "outlined"}
                            startIcon={<Upload />}
                            onClick={() => { setMode('upload'); stopCamera(); }}
                        >
                            Upload Video
                        </Button>
                        <Button
                            variant={mode === 'webcam' ? "contained" : "outlined"}
                            startIcon={<Camera />}
                            onClick={() => { setMode('webcam'); }}
                        >
                            Use Webcam
                        </Button>
                    </Stack>

                    {/* Content Area */}
                    <Box
                        sx={{
                            border: '2px dashed #ccc',
                            borderRadius: 2,
                            p: 4,
                            textAlign: 'center',
                            minHeight: 300,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            bgcolor: 'background.default',
                            position: 'relative'
                        }}
                    >
                        {mode === 'upload' ? (
                            <>
                                <input
                                    type="file"
                                    hidden
                                    id="video-upload"
                                    accept="video/*"
                                    onChange={handleFileSelect}
                                />
                                {previewUrl ? (
                                    <video src={previewUrl} controls style={{ maxHeight: 400, maxWidth: '100%', borderRadius: 8 }} />
                                ) : (
                                    <label htmlFor="video-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <Upload size={48} color="#666" style={{ marginBottom: 16 }} />
                                        <Typography variant="h6" color="textSecondary">
                                            Click to Upload Video (Max 25MB)
                                        </Typography>
                                    </label>
                                )}
                            </>
                        ) : (
                            // Webcam Mode
                            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                {isCameraActive ? (
                                    <>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            muted
                                            style={{ maxHeight: 400, maxWidth: '100%', borderRadius: 8, transform: 'scaleX(-1)' }}
                                        />
                                        <Stack direction="row" spacing={2}>
                                            {!isRecording ? (
                                                <Button
                                                    variant="contained"
                                                    color="error"
                                                    startIcon={<Radio />}
                                                    onClick={startRecording}
                                                >
                                                    Start Recording
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="contained"
                                                    color="secondary"
                                                    startIcon={<Square />}
                                                    onClick={stopRecording}
                                                >
                                                    Stop Recording
                                                </Button>
                                            )}
                                        </Stack>
                                        {isRecording && (
                                            <Typography color="error" variant="caption" className="animate-pulse">
                                                Recording... (Keep it short, max 10s recommended)
                                            </Typography>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {previewUrl ? (
                                            <Box sx={{ textAlign: 'center' }}>
                                                <video src={previewUrl} controls style={{ maxHeight: 400, maxWidth: '100%', borderRadius: 8 }} />
                                                <Button sx={{ mt: 2 }} variant="outlined" onClick={startCamera}>Retake</Button>
                                            </Box>
                                        ) : (
                                            <Button
                                                variant="contained"
                                                size="large"
                                                startIcon={<Camera />}
                                                onClick={startCamera}
                                                sx={{ py: 2, px: 4 }}
                                            >
                                                Start Camera
                                            </Button>
                                        )}
                                    </>
                                )}
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
                        multiline
                        rows={2}
                    />

                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleAnalyze}
                        disabled={(!selectedFile && !recordedBlob) || loading}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VideoIcon />}
                        sx={{ py: 1.5, bgcolor: '#0ea5e9', '&:hover': { bgcolor: '#0284c7' } }}
                    >
                        {loading ? 'Analyzing Video...' : 'Analyze Video'}
                    </Button>

                    {/* Results */}
                    {error && (
                        <Alert severity="error">{error}</Alert>
                    )}

                    {result && (
                        <Card variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: '#0ea5e9' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="primary">
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

export default VisionVideoPage;
