require('dotenv').config();
const axios = require('axios');

async function optimizePrompt(originalPrompt) {
    try {
        // We use a small, blazingly fast model for this intermediary step
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant", 
            messages: [
                { 
                    role: "system", 
                    content: "You are a strict Prompt Minifier. DO NOT answer the user's question. Your ONLY job is to compress the user's text into a shorter instruction. Remove all polite phrases and conversational filler. OUTPUT ONLY THE COMPRESSED INSTRUCTION." 
                },
                { 
                    role: "user", 
                    content: originalPrompt 
                }
            ],
            temperature: 0.2 // Low temperature for consistent, strict rewriting
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content.trim();
        
    } catch (error) {
        console.error("Optimizer API Error:", error.response ? error.response.data : error.message);
        // Hackathon Hack: If the optimizer fails, just return the original prompt so the app doesn't crash during a demo
        return originalPrompt; 
    }
}

module.exports = { optimizePrompt };
