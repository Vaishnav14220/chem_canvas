/**
 * Utility script to generate academic images for immersive learning sections 2, 3, and 4
 * using Google's Imagen API (imagen-4.0-generate-001)
 * 
 * Based on documentation: https://ai.google.dev/gemini-api/docs/imagen
 */

import { generateImagenImage } from '../services/immersiveLearningService';
import { AspectRatio } from '../types/studium';

export interface SectionImageConfig {
  sectionId: string;
  sectionTitle: string;
  imagePrompt: string;
  aspectRatio?: AspectRatio;
}

/**
 * Generates academic images for sections 2, 3, and 4 of immersive learning content
 * 
 * @param sections - Array of section configurations with imagePrompts
 * @param sectionIndices - Array of section indices to generate images for (default: [1, 2, 3] for sections 2, 3, 4)
 * @returns Object mapping section IDs to generated image URLs
 */
export const generateAcademicImagesForSections = async (
  sections: Array<{ id: string; title: string; imagePrompt?: string | null }>,
  sectionIndices: number[] = [1, 2, 3] // Sections 2, 3, 4 (0-indexed: 1, 2, 3)
): Promise<{ [sectionId: string]: string }> => {
  const generatedImages: { [sectionId: string]: string } = {};

  console.log(`🎨 Generating academic images for sections: ${sectionIndices.map(i => i + 1).join(', ')}`);

  for (const index of sectionIndices) {
    if (index < 0 || index >= sections.length) {
      console.warn(`⚠️ Section index ${index} is out of range. Skipping...`);
      continue;
    }

    const section = sections[index];
    
    if (!section.imagePrompt) {
      console.warn(`⚠️ Section "${section.title}" (index ${index}) has no imagePrompt. Skipping...`);
      continue;
    }

    try {
      console.log(`\n📸 Generating image for Section ${index + 1}: "${section.title}"`);
      console.log(`   Prompt: ${section.imagePrompt.substring(0, 100)}...`);

      // Generate academic image using Imagen API
      // Use 16:9 aspect ratio for academic/educational content (widescreen format)
      const imageUrl = await generateImagenImage(
        section.imagePrompt,
        AspectRatio.LANDSCAPE_16_9,
        1 // Generate 1 image per section
      );

      generatedImages[section.id] = imageUrl;
      console.log(`✅ Successfully generated image for Section ${index + 1}: ${section.id}`);
    } catch (error) {
      console.error(`❌ Failed to generate image for Section ${index + 1} (${section.title}):`, error);
      // Continue with other sections even if one fails
    }
  }

  console.log(`\n✨ Completed! Generated ${Object.keys(generatedImages).length} image(s)`);
  return generatedImages;
};

/**
 * Enhanced prompt generator for academic images
 * Adds academic/scientific styling to prompts for better textbook-quality results
 */
export const enhancePromptForAcademicImage = (basePrompt: string): string => {
  const academicEnhancements = [
    'scientific textbook-style illustration',
    'professional academic quality',
    'accurate proportions and labeled components',
    'clean white background',
    'publication-ready diagram',
    'educational illustration suitable for learning materials'
  ].join(', ');

  // If prompt already contains academic keywords, don't duplicate
  const hasAcademicKeywords = /textbook|academic|scientific|educational|diagram|illustration/i.test(basePrompt);
  
  if (hasAcademicKeywords) {
    return basePrompt;
  }

  return `${basePrompt}, ${academicEnhancements}`;
};

/**
 * Batch generate images with enhanced academic prompts
 */
export const generateAcademicImagesWithEnhancement = async (
  sections: Array<{ id: string; title: string; imagePrompt?: string | null }>,
  sectionIndices: number[] = [1, 2, 3]
): Promise<{ [sectionId: string]: string }> => {
  // Enhance prompts for academic quality
  const enhancedSections = sections.map(section => ({
    ...section,
    imagePrompt: section.imagePrompt ? enhancePromptForAcademicImage(section.imagePrompt) : null
  }));

  return generateAcademicImagesForSections(enhancedSections, sectionIndices);
};

