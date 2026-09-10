import { GoogleGenAI } from '@google/genai';

// ============================================================
// Gemini AI Client
// ============================================================
//
// Gemini API key .env file se aa rahi hai.
//
// .env file mein:
// GEMINI_API_KEY=your_gemini_api_key_here
//
// API key ko kabhi bhi directly code mein hard-code mat karna.
//
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});


/**
 * ============================================================
 * generateImageTags()
 * ============================================================
 *
 * Image Buffer ko Gemini Vision model ke paas bhejta hai aur
 * image ke liye 5-8 useful/searchable tags generate karta hai.
 *
 * Ye function image auto-tagging aur visual search system
 * ke liye use kiya ja sakta hai.
 *
 * Flow:
 *
 * Image
 *   ↓
 * Multer Buffer
 *   ↓
 * Base64 conversion
 *   ↓
 * Gemini Vision
 *   ↓
 * AI generated tags
 *   ↓
 * Clean + lowercase + duplicate remove
 *   ↓
 * string[] return
 *
 *
 * @param {Buffer} fileBuffer
 * Multer se receive hua image buffer.
 *
 * Example:
 * req.file.buffer
 *
 *
 * @param {string} mimeType
 * Image ka MIME type.
 *
 * Examples:
 * image/jpeg
 * image/png
 * image/webp
 *
 *
 * @returns {Promise<string[]>}
 * Cleaned tags ka array return karega.
 *
 * Example:
 *
 * [
 *   "red honda civic",
 *   "sedan",
 *   "honda",
 *   "parking lot",
 *   "license plate"
 * ]
 */
export const generateImageTags = async (fileBuffer, mimeType) => {

    try {

        // ========================================================
        // 1. Image Buffer Validation
        // ========================================================
        //
        // Agar image buffer nahi mila ya valid Buffer nahi hai,
        // to Gemini API ko request bhejne ka koi fayda nahi.
        //
        // Is situation mein empty array return kar rahe hain.
        //
        if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {

            console.error(
                'Gemini Tagging Error: Invalid image buffer'
            );

            return [];
        }


        // ========================================================
        // 2. MIME Type Validation
        // ========================================================
        //
        // Check kar rahe hain ki file actually image hai.
        //
        // Example valid MIME types:
        //
        // image/jpeg
        // image/png
        // image/webp
        //
        if (!mimeType || !mimeType.startsWith('image/')) {

            console.error(
                'Gemini Tagging Error: Invalid image MIME type'
            );

            return [];
        }


        // ========================================================
        // 3. Image Buffer ko Base64 mein Convert Karna
        // ========================================================
        //
        // Gemini ke inlineData mein image data Base64 format
        // mein bhejna hota hai.
        //
        // IMPORTANT:
        //
        // "base62" galat hai.
        // Yahan "base64" use karna zaroori hai.
        //
        const base64Image = fileBuffer.toString('base64');


        // ========================================================
        // 4. Gemini Vision API Call
        // ========================================================
        //
        // Gemini ko:
        //
        // 1. Image
        // 2. Detailed tagging instructions
        //
        // dono bhej rahe hain.
        //
        const response = await ai.models.generateContent({

            // Fast aur efficient image analysis ke liye
            // Gemini Flash model use kar rahe hain.
            model: 'gemini-3.6-flash',

            contents: [

                // ------------------------------------------------
                // Image Data
                // ------------------------------------------------
                {
                    inlineData: {

                        // Base64 encoded image
                        data: base64Image,

                        // Original image MIME type
                        mimeType: mimeType,
                    },
                },


                // ------------------------------------------------
                // AI Tagging Instructions
                // ------------------------------------------------
                `
You are an image tagging engine for a visual image-search system.

Analyze the image carefully and generate 5 to 8 concise,
highly relevant and searchable tags that accurately represent
the visible content of the image.

The main goal is to create tags that help a user find this
exact image later through keyword search or semantic search.

TAG PRIORITY:

1. Specific main objects, subjects, people, animals,
   products, or entities.

2. Brands, logos, product names, models, landmarks,
   or recognizable items when clearly visible.

3. Clearly readable visible text, names, numbers,
   or important keywords.

4. Document type or interface type when applicable.

5. Distinctive colors and important visual attributes.

6. Scene, environment, location, activity, or context.

7. Other visually important details that improve
   searchability.

RULES:

1. Use ONLY information that is clearly visible in the image.

2. Never guess, hallucinate, or infer information that
   cannot be confidently seen.

3. Prefer specific and searchable tags over broad
   generic tags.

4. Include important readable text when it is useful
   for searching.

5. Avoid generic tags such as:
   "image", "photo", "picture", "thing", "object"
   unless they provide meaningful search value.

6. Do not repeat the same concept using multiple
   near-duplicate tags.

7. Keep each tag short, preferably 1 to 4 words.

8. Use natural, normalized lowercase text.

9. Generate between 5 and 8 tags.

10. Order tags from most important/searchable
    to least important.

11. Do not create full sentences.

12. Do not include explanations, numbering, bullets,
    quotes, or markdown.

13. Return ONLY a comma-separated list of tags.

IMPORTANT:

If readable text is present, include the most useful
text as tags when it helps identify or search the image.

For documents, prioritize:
- document type
- company/name
- important keywords
- readable identifiers
- other clearly visible searchable information.

GOOD EXAMPLE:

red honda civic, sedan, honda, parking lot, license plate, outdoor

RECEIPT EXAMPLE:

walmart receipt, grocery receipt, purchase, total amount, transaction date

DOCUMENT EXAMPLE:

employment contract, company name, signature, legal document, printed text
                `,
            ],
        });


        // ========================================================
        // 5. Gemini Response se Text Nikalna
        // ========================================================
        //
        // Gemini ka generated response response.text mein
        // milta hai.
        //
        // Agar kisi reason se text empty hai to empty string
        // use karenge.
        //
        const textResult = response.text || '';


        // ========================================================
        // 6. AI Response ko Tags mein Convert Karna
        // ========================================================
        //
        // Gemini expected format:
        //
        // red car, honda, sedan, parking lot, outdoor
        //
        // Isko comma ke basis par split karke array banayenge.
        //
        const tags = textResult
            .split(',')

            // Har tag ke beginning/end ke spaces remove
            .map((tag) => tag.trim())

            // Sab tags lowercase mein convert
            .map((tag) => tag.toLowerCase())

            // Empty tags remove
            .filter((tag) => tag.length > 0);


        // ========================================================
        // 7. Duplicate Tags Remove Karna
        // ========================================================
        //
        // Agar Gemini accidentally same tag multiple times
        // return kare to database mein duplicate tags save
        // nahi honge.
        //
        // Example:
        //
        // ["car", "honda", "car", "sedan"]
        //
        // becomes:
        //
        // ["car", "honda", "sedan"]
        //
        const uniqueTags = [...new Set(tags)];


        // ========================================================
        // 8. Maximum 8 Tags
        // ========================================================
        //
        // Prompt mein 5-8 tags maange hain.
        //
        // Lekin agar model kabhi 8 se zyada tags return kare,
        // to hum maximum 8 tags hi database mein rakhenge.
        //
        return uniqueTags.slice(0, 8);


    } catch (error) {

        // ========================================================
        // 9. Error Handling
        // ========================================================
        //
        // Agar Gemini API fail ho jaye, image upload ka
        // poora server flow crash na ho.
        //
        // Isliye error log karke empty tags return karenge.
        //
        console.error(
            'Gemini Tagging Error:',
            error?.message || error
        );

        return [];
    }
};