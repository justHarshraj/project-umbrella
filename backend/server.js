require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios'); 

// Import our new services
const { optimizePrompt } = require('./services/aiOptimizer');
const { findGreenestRegion } = require('./services/wattTime');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/green-query', async (req, res) => {
    try {
        const { originalPrompt } = req.body;
        
        if (!originalPrompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        console.log(`[1] Received original prompt length: ${originalPrompt.length} chars`);

        // Step 1 & 2: Execute sequentially with Safety Fallbacks
        let greenestGrid;
        try {
            greenestGrid = await findGreenestRegion();
        } catch (e) {
            console.error("WattTime Warning:", e.message);
        }
        
        // THE SAFETY NET: If WattTime fails, don't crash. Use a fallback grid.
        if (!greenestGrid || !greenestGrid.region) {
            console.log("⚠️ Grid API unavailable. Using fallback data.");
            greenestGrid = { region: "US-West (Fallback)", emissionRating: 30 };
        }

        let optimizedPrompt = await optimizePrompt(originalPrompt);
        
        // THE SAFETY NET: If Optimizer fails, use the original prompt.
        if (!optimizedPrompt) {
            console.log("⚠️ Optimizer failed. Using original prompt.");
            optimizedPrompt = originalPrompt;
        }

        console.log(`[2] Optimized prompt length: ${optimizedPrompt.length} chars`);
        console.log(`[3] Selected Grid: ${greenestGrid.region} (Emissions: ${greenestGrid.emissionRating}%)`);

        // Step 3: Dynamic Model Selection & Execution
        let finalAnswer = "";
        let targetModel = "llama-3.3-70b-versatile"; // Default to the heavy lifter
        let modelDownscaleBonus = 0; // Bonus carbon savings if we switch to a smaller model

        // THE COMPLEXITY CHECK: If the optimized prompt is short, downgrade the model!
        if (optimizedPrompt.length < 150) {
            targetModel = "llama-3.1-8b-instant";
            modelDownscaleBonus = 15.0; // Flat bonus for using an 8B model instead of 70B
            console.log(`[4] Task is simple. Downscaling to ${targetModel} for extra efficiency!`);
        } else {
            console.log(`[4] Task is complex. Maintaining ${targetModel}.`);
        }

        try {
            console.log("Executing final prompt...");
            const executeResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: targetModel, 
                messages: [
                    { 
                        role: "system", 
                        content: "You are a highly intelligent, direct assistant. Answer the user's prompt immediately and accurately. Do NOT use introductory conversational filler like 'Here is the answer' or 'That is a great question'." 
                    },
                    { 
                        role: "user", 
                        content: optimizedPrompt 
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            finalAnswer = executeResponse.data.choices[0].message.content;
        } catch (execError) {
            console.error("Execution failed:", execError.message);
            finalAnswer = "Error: Failed to generate the final AI response. Check your API key.";
        }

        // Step 4: The Advanced Math Engine (Calculating Savings)
        const charactersSaved = originalPrompt.length - optimizedPrompt.length;
        
        // Base savings from shrinking the prompt (if any)
        const promptShrinkSavings = (charactersSaved > 0 ? charactersSaved : 0) * 0.05;
        
        // Savings from routing to a greener grid (based on total prompt size)
        const gridCleanlinessMultiplier = (100 - greenestGrid.emissionRating) / 100;
        const gridRoutingSavings = originalPrompt.length * 0.02 * gridCleanlinessMultiplier;

        // TOTAL: Prompt Shrink + Grid Routing + Model Downscale
        const totalSavedGrams = (promptShrinkSavings + gridRoutingSavings + modelDownscaleBonus).toFixed(2);

        res.json({
            success: true,
            originalPrompt,
            optimizedPrompt,
            targetRegion: greenestGrid.region,
            emissionRating: greenestGrid.emissionRating,
            modelUsed: targetModel,
            finalAnswer,
            carbonSavedGrams: parseFloat(totalSavedGrams)
        });

    } catch (error) {
        console.error("Pipeline Error:", error);
        res.status(500).json({ error: 'Failed to process green query' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`☂️ Project Umbrella Gateway running on port ${PORT}`));
