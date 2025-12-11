import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    IconButton,
    Avatar,
    CircularProgress
} from '@mui/material';
import { Send, Image as ImageIcon, Sparkles, User, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { streamTextContent } from '../services/geminiService';

type Message = {
    id: string;
    role: 'user' | 'model';
    text: string;
    image?: string; // Base64 image
};

const VisionChatPage = () => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'model', text: 'Hello! I am your Multimodal Vision Assistant. You can send me text messages or upload images for me to analyze. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
            if (currentImage && currentMimeType) {
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
                    model: 'gemini-1.5-flash',
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
                </Box>

                <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                                    bgcolor: msg.role === 'user' ? 'secondary.main' : 'primary.main',
                                    width: 32,
                                    height: 32
                                }}
                            >
                                {msg.role === 'user' ? <User size={18} /> : <Sparkles size={18} />}
                            </Avatar>
                            <Box>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        bgcolor: msg.role === 'user' ? 'primary.light' : 'background.paper',
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
                            <Typography variant="caption" sx={{ maxWidth: 150, noWrap: true }}>
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
                        >
                            <ImageIcon />
                        </IconButton>
                        <TextField
                            fullWidth
                            placeholder="Type a message..."
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
                            disabled={loading || (!input.trim() && !selectedImage)}
                        >
                            {loading ? <CircularProgress size={24} /> : <Send />}
                        </IconButton>
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
};

export default VisionChatPage;
