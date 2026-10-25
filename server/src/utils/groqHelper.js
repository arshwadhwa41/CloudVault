import { Groq } from 'groq-sdk';

// Groq client initialize kar rahe hain .env ki key se
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export const generateImageTags = async (fileBuffer, mimeType) => {
    try {
        if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
            console.error('Groq Tagging Error: Invalid image buffer');
            return [];
        }

        if (!mimeType || !mimeType.startsWith('image/')) {
            console.error('Groq Tagging Error: Invalid image MIME type');
            return [];
        }

        // Image ko Base64 data URL format mein convert karna (Groq/OpenAI vision format)
        const base64Image = fileBuffer.toString('base64');
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        // Groq Vision API Call (Using Qwen 2VL or Llama 3.2 Vision model available on Groq)
        const chatCompletion = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b', // Groq ka fast multimodal vision model
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Analyze this image carefully and generate 5 to 8 concise, highly relevant and searchable tags that accurately represent the visible content. Return ONLY a comma-separated list of lowercase tags, without any explanation, numbers, bullets, or markdown.',
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.2,
            max_tokens: 100,
        });

        const textResult = chatCompletion.choices?.[0]?.message?.content || '';

        const tags = textResult
            .split(',')
            .map((tag) => tag.trim())
            .map((tag) => tag.toLowerCase())
            .filter((tag) => tag.length > 0);

        const uniqueTags = [...new Set(tags)];
        return uniqueTags.slice(0, 8);

    } catch (error) {
        console.error('Groq Tagging Error:', error?.message || error);
        return [];
    }
};