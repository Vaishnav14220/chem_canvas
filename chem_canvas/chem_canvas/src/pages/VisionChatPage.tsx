import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    IconButton,
    Avatar,
    CircularProgress,
    Chip
} from '@mui/material';
import { Send, Image as ImageIcon, Sparkles, User, X, Video, VideoOff, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { streamTextContent } from '../services/geminiService';

type Message = {
    id: string;
    role: 'user' | 'model';
    text: string;
    image?: string; // Base64 image
    isLiveAnalysis?: boolean;
};

const VisionChatPage = () => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'model', text: 'Hello! I am your Multimodal Vision Assistant. You can send me text messages, upload images, or start a **live webcam analysis** for real-time vision understanding. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Webcam state
    const [isWebcamActive, setIsWebcamActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const webcamStreamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analysisIntervalRef = useRef<NodeJS.Timeout | number | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Cleanup webcam on unmount
    useEffect(() => {
        return () => {
            stopWebcam();
        };
    }, []);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('Failed to convert file'));
                }
            };
            reader.onerror = reject;
        });
    };

    // Start webcam
    const startWebcam = useCallback(async () => {
        try {
            console.log('[Webcam] Starting...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 15 }
                }
            });

            webcamStreamRef.current = stream;
            setIsWebcamActive(true);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Add system message
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                text: '📹 **Webcam started!** I can now see what\'s in front of your camera. I\'ll analyze the video feed continuously and describe what I see. You can also ask questions about what\'s visible.',
                isLiveAnalysis: true
            }]);

            // Start continuous analysis
            startContinuousAnalysis();

        } catch (err) {
            console.error('[Webcam] Error:', err);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                text: '❌ Could not access webcam. Please check your camera permissions and try again.'
            }]);
        }
    }, []);

    // Stop webcam
    const stopWebcam = useCallback(() => {
        console.log('[Webcam] Stopping...');

        if (analysisIntervalRef.current) {
            clearInterval(analysisIntervalRef.current as number);
            analysisIntervalRef.current = null;
        }

        if (webcamStreamRef.current) {
            webcamStreamRef.current.getTracks().forEach(track => track.stop());
            webcamStreamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setIsWebcamActive(false);
        setIsAnalyzing(false);

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: '📹 **Webcam stopped.** Live analysis has ended.',
            isLiveAnalysis: true
        }]);
    }, []);

    // Capture frame and analyze
    const captureAndAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to video size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        const base64Data = canvas.toDataURL('image/jpeg', 0.7);
        const base64Content = base64Data.split(',')[1];

        setIsAnalyzing(true);

        // Create response placeholder
        const botMessageId = Date.now().toString();
        setMessages(prev => [...prev, {
            id: botMessageId,
            role: 'model',
            text: '',
            isLiveAnalysis: true
        }]);

        try {
            await streamTextContent(
                "Analyze this live webcam frame. Describe what you see briefly and concisely (2-3 sentences max). Focus on: people, objects, actions, or anything interesting/notable. Be conversational.",
                (chunk) => {
                    setMessages(prev => prev.map(msg =>
                        msg.id === botMessageId
                            ? { ...msg, text: msg.text + chunk }
                            : msg
                    ));
                },
                {
                    model: 'gemini-2.5-flash-preview-05-20',
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Content
                    }
                }
            );
        } catch (error) {
            console.error('[Vision] Analysis error:', error);
            setMessages(prev => prev.map(msg =>
                msg.id === botMessageId
                    ? { ...msg, text: '⚠️ Analysis failed. Retrying...' }
                    : msg
            ));
        } finally {
            setIsAnalyzing(false);
        }
    }, [isAnalyzing]);

    // Start continuous analysis loop
    const startContinuousAnalysis = useCallback(() => {
        // Initial analysis after 1 second
        setTimeout(() => {
            captureAndAnalyze();
        }, 1000);

        // Then every 3 seconds
        analysisIntervalRef.current = setInterval(() => {
            captureAndAnalyze();
        }, 3000);
    }, [captureAndAnalyze]);

    const handleSend = async () => {
        if ((!input.trim() && !selectedImage) || loading) return;

        const userMessageId = Date.now().toString();
        const newUserMessage: Message = {
            id: userMessageId,
            role: 'user',
            text: input,
            image: imagePreview || undefined
        };

        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setLoading(true);

        // Create a placeholder for the AI response
        const botMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: botMessageId, role: 'model', text: '' }]);

        const currentImage = selectedImage;
        const currentMimeType = selectedImage ? selectedImage.type : null;
        clearImage(); // Clear image input after sending

        try {
            let inlineData = undefined;

            // If webcam is active and no image uploaded, use current frame
            if (isWebcamActive && !currentImage && canvasRef.current && videoRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                    const base64Data = canvas.toDataURL('image/jpeg', 0.7);
                    inlineData = {
                        mimeType: 'image/jpeg',
                        data: base64Data.split(',')[1]
                    };
                }
            } else if (currentImage && currentMimeType) {
                const base64 = await fileToBase64(currentImage);
                inlineData = {
                    mimeType: currentMimeType,
                    data: base64
                };
            }

            await streamTextContent(
                newUserMessage.text || "Describe this image",
                (chunk) => {
                    setMessages(prev => prev.map(msg =>
                        msg.id === botMessageId
                            ? { ...msg, text: msg.text + chunk }
                            : msg
                    ));
                },
                {
                    model: 'gemini-2.5-flash-preview-05-20',
                    inlineData: inlineData
                }
            );

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => prev.map(msg =>
                msg.id === botMessageId
                    ? { ...msg, text: "I'm sorry, I encountered an error. Please try again." }
                    : msg
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Container maxWidth="md" sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', pt: 2 }}>
            <Paper
                elevation={3}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderRadius: 2,
                    bgcolor: 'background.default'
                }}
            >
                <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Sparkles size={24} />
                    <Typography variant="h6">Vision Agent Chat</Typography>
                    {isWebcamActive && (
                        <Chip
                            icon={<Eye size={14} />}
                            label={isAnalyzing ? "Analyzing..." : "Live"}
                            color="error"
                            size="small"
                            sx={{ ml: 'auto', animation: 'pulse 2s infinite' }}
                        />
                    )}
                </Box>

                <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Live Video Preview */}
                    {isWebcamActive && (
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: 400,
                                mx: 'auto',
                                borderRadius: 2,
                                overflow: 'hidden',
                                border: '3px solid',
                                borderColor: isAnalyzing ? 'warning.main' : 'success.main',
                                boxShadow: isAnalyzing ? '0 0 20px rgba(255,152,0,0.5)' : '0 0 20px rgba(76,175,80,0.5)'
                            }}
                        >
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{
                                    width: '100%',
                                    transform: 'scaleX(-1)', // Mirror
                                    display: 'block'
                                }}
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    bgcolor: 'rgba(0,0,0,0.7)',
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 2
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: isAnalyzing ? 'warning.main' : 'error.main',
                                        animation: 'pulse 1s infinite'
                                    }}
                                />
                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>
                                    {isAnalyzing ? 'ANALYZING' : 'LIVE'}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Hidden canvas for frame capture */}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {messages.map((msg) => (
                        <Box
                            key={msg.id}
                            sx={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '80%',
                                display: 'flex',
                                gap: 1.5,
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                            }}
                        >
                            <Avatar
                                sx={{
                                    bgcolor: msg.role === 'user' ? 'secondary.main' : msg.isLiveAnalysis ? 'success.main' : 'primary.main',
                                    width: 32,
                                    height: 32
                                }}
                            >
                                {msg.role === 'user' ? <User size={18} /> : msg.isLiveAnalysis ? <Eye size={18} /> : <Sparkles size={18} />}
                            </Avatar>
                            <Box>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        bgcolor: msg.role === 'user' ? 'primary.light' : msg.isLiveAnalysis ? 'success.light' : 'background.paper',
                                        color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary'
                                    }}
                                >
                                    {msg.image && (
                                        <Box
                                            component="img"
                                            src={msg.image}
                                            sx={{
                                                maxWidth: '100%',
                                                maxHeight: 200,
                                                borderRadius: 1,
                                                mb: 1,
                                                display: 'block'
                                            }}
                                        />
                                    )}
                                    <Box sx={{ '& p': { m: 0 } }}>
                                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </Box>
                                </Paper>
                            </Box>
                        </Box>
                    ))}
                    <div ref={messagesEndRef} />
                </Box>

                <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                    {imagePreview && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, width: 'fit-content' }}>
                            <Box component="img" src={imagePreview} sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: 150 }}>
                                {selectedImage?.name}
                            </Typography>
                            <IconButton size="small" onClick={clearImage}>
                                <X size={14} />
                            </IconButton>
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <input
                            type="file"
                            accept="image/*"
                            hidden
                            ref={fileInputRef}
                            onChange={handleImageSelect}
                        />
                        <IconButton
                            color={selectedImage ? "primary" : "default"}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isWebcamActive}
                        >
                            <ImageIcon />
                        </IconButton>

                        {/* Webcam Toggle Button */}
                        <IconButton
                            color={isWebcamActive ? "error" : "default"}
                            onClick={isWebcamActive ? stopWebcam : startWebcam}
                            sx={{
                                bgcolor: isWebcamActive ? 'error.light' : 'transparent',
                                '&:hover': {
                                    bgcolor: isWebcamActive ? 'error.main' : 'action.hover'
                                }
                            }}
                        >
                            {isWebcamActive ? <VideoOff /> : <Video />}
                        </IconButton>

                        <TextField
                            fullWidth
                            placeholder={isWebcamActive ? "Ask about what you see..." : "Type a message..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            size="small"
                            multiline
                            maxRows={4}
                            disabled={loading}
                        />
                        <IconButton
                            color="primary"
                            onClick={handleSend}
                            disabled={loading || (!input.trim() && !selectedImage && !isWebcamActive)}
                        >
                            {loading ? <CircularProgress size={24} /> : <Send />}
                        </IconButton>
                    </Box>
                </Box>
            </Paper>

            {/* CSS for pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </Container>
    );
};

export default VisionChatPage;
