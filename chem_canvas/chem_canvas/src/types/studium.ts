import { Type } from "@google/genai";

export enum View {
    GENERATOR = 'GENERATOR',
    CHAT = 'CHAT',
    ANALYZER = 'ANALYZER'
}

export enum AspectRatio {
    SQUARE = '1:1',
    PORTRAIT_2_3 = '2:3',
    PORTRAIT_3_4 = '3:4',
    PORTRAIT_9_16 = '9:16',
    LANDSCAPE_3_2 = '3:2',
    LANDSCAPE_4_3 = '4:3',
    LANDSCAPE_16_9 = '16:9',
    CINEMATIC_21_9 = '21:9'
}

export enum ImageSize {
    K1 = '1K',
    K2 = '2K',
    K4 = '4K'
}

export interface InteractiveLabel {
    term: string;
    definition: string;
    funFact: string;
    coordinates: {
        ymin: number;
        xmin: number;
        ymax: number;
        xmax: number;
    };
}

export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
}

export interface GroundingSupport {
    segment: {
        startIndex: number;
        endIndex: number;
        text: string;
    };
    groundingChunkIndices: number[];
    confidenceScores: number[];
}

export interface GroundingMetadata {
    groundingChunks: GroundingChunk[];
    groundingSupports: GroundingSupport[];
    webSearchQueries: string[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    sources?: { uri: string; title: string }[];
    groundingMetadata?: GroundingMetadata;
    timestamp: number;
}

export interface GeneratedImage {
    url: string;
    prompt: string;
    labels?: InteractiveLabel[];
}

export const EducationalSchema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    term: { type: Type.STRING, description: "The term found in the image label" },
                    definition: { type: Type.STRING, description: "A simple educational definition" },
                    funFact: { type: Type.STRING, description: "A short, interesting fact about this part" },
                    coordinates: {
                        type: Type.OBJECT,
                        properties: {
                            ymin: { type: Type.NUMBER, description: "Top Y coordinate (0-1000)" },
                            xmin: { type: Type.NUMBER, description: "Left X coordinate (0-1000)" },
                            ymax: { type: Type.NUMBER, description: "Bottom Y coordinate (0-1000)" },
                            xmax: { type: Type.NUMBER, description: "Right X coordinate (0-1000)" }
                        },
                        required: ["ymin", "xmin", "ymax", "xmax"]
                    }
                },
                required: ["term", "definition", "funFact", "coordinates"]
            }
        }
    }
};

export const ImageGenerationPromptSchema = {
    type: Type.OBJECT,
    properties: {
        labels: {
            type: Type.OBJECT,
            description: "Details for the overlay text and indicating arrows.",
            properties: {
                include_labels: {
                    type: Type.BOOLEAN,
                    description: "Must be true to enable overlay generation."
                },
                annotations: {
                    type: Type.ARRAY,
                    description: "List of specific labels and where their arrows point.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label_text: {
                                type: Type.STRING,
                                description: "The actual text to display, e.g., 'Piston Head'."
                            },
                            arrow_target: {
                                type: Type.STRING,
                                description: "The specific element the arrow points to, e.g., 'The top surface of the piston'."
                            }
                        },
                        required: [
                            "label_text",
                            "arrow_target"
                        ]
                    }
                }
            },
            required: [
                "include_labels",
                "annotations"
            ]
        },
        request_metadata: {
            type: Type.OBJECT,
            properties: {
                topic: {
                    type: Type.STRING,
                    description: "The core subject, e.g., 'DNA Replication' or 'Turbine Engine'"
                },
                target_audience: {
                    type: Type.STRING,
                    description: "e.g., 'Grade 5', 'High School', 'PhD Candidate'"
                },
                visual_style_category: {
                    type: Type.STRING,
                    description: "The style of the image. NOTE: For engineering topics, this MUST be 'Technical Drawing' (not blueprint)."
                }
            },
            required: [
                "topic",
                "target_audience",
                "visual_style_category"
            ]
        },
        scientific_constraints: {
            type: Type.OBJECT,
            properties: {
                key_elements_required: {
                    type: Type.ARRAY,
                    description: "List of specific scientific parts that MUST be visible",
                    items: {
                        type: Type.STRING
                    }
                },
                accuracy_check: {
                    type: Type.STRING,
                    description: "Brief note on what makes this scientifically accurate"
                }
            },
            required: [
                "key_elements_required",
                "accuracy_check"
            ]
        },
        generation_parameters: {
            type: Type.OBJECT,
            properties: {
                final_prompt: {
                    type: Type.STRING,
                    description: "The massive, comma-separated string. If engineering, use 'technical drawing', 'schematic', 'clean lines', 'white background'. Do NOT use 'blueprint' or 'blue background'."
                },
                negative_prompt: {
                    type: Type.STRING,
                    description: "What to avoid to prevent hallucinations"
                },
                aspect_ratio: {
                    type: Type.STRING,
                    description: "e.g., '16:9', '1:1'"
                },
                guidance_scale: {
                    type: Type.NUMBER,
                    description: "Recommended CFG, usually 7.0 - 9.0"
                },
                steps: {
                    type: Type.INTEGER,
                    description: "Recommended steps, usually 25-50"
                }
            },
            required: [
                "final_prompt",
                "negative_prompt",
                "aspect_ratio",
                "guidance_scale",
                "steps"
            ]
        }
    },
    required: [
        "labels",
        "request_metadata",
        "scientific_constraints",
        "generation_parameters"
    ]
};

export interface ImageGenerationPrompt {
    labels: {
        include_labels: boolean;
        annotations: {
            label_text: string;
            arrow_target: string;
        }[];
    };
    request_metadata: {
        topic: string;
        target_audience: string;
        visual_style_category: string;
    };
    scientific_constraints: {
        key_elements_required: string[];
        accuracy_check: string;
    };
    generation_parameters: {
        final_prompt: string;
        negative_prompt: string;
        aspect_ratio: string;
        guidance_scale: number;
        steps: number;
    };
}
