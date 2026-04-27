document.addEventListener('DOMContentLoaded', () => {
    // Load lifetime savings on startup
    chrome.storage.local.get(['lifetimeSavings'], (result) => {
        if (result.lifetimeSavings) {
            document.getElementById('totalSaved').innerText = result.lifetimeSavings.toFixed(2);
        }
    });
});

document.getElementById('submitBtn').addEventListener('click', async () => {
    const prompt = document.getElementById('promptInput').value;
    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('statusText');
    const responseBox = document.getElementById('aiResponse');
    const metaInfo = document.getElementById('metaInfo');

    if (!prompt) return;

    // UI Loading State
    btn.disabled = true;
    status.innerText = "Optimizing & Routing to Green Grid...";
    responseBox.innerText = "";
    metaInfo.innerText = "";
    document.getElementById('copyBtn').style.display = "none";

    try {
        const response = await fetch('http://localhost:3000/api/green-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalPrompt: prompt })
        });

        const data = await response.json();

        if (data.success) {
            status.innerText = "Success!";
            
            // Update Grid Badge
            const gridBadge = document.getElementById('gridBadge');
            gridBadge.innerText = `Grid: ${data.targetRegion}`;
            gridBadge.className = 'grid-badge'; // reset
            if (data.emissionRating < 40) gridBadge.classList.add('grid-green');
            else if (data.emissionRating < 70) gridBadge.classList.add('grid-yellow');
            else gridBadge.classList.add('grid-red');

            metaInfo.innerText = `[Model: ${data.modelUsed}] | [Saved: ${data.carbonSavedGrams}g]`;
            responseBox.innerText = data.finalAnswer;
            document.getElementById('copyBtn').style.display = "block";

            // Update lifetime savings
            chrome.storage.local.get(['lifetimeSavings'], (result) => {
                const current = result.lifetimeSavings || 0;
                const updated = current + data.carbonSavedGrams;
                chrome.storage.local.set({ lifetimeSavings: updated }, () => {
                    totalSavedDisplay.innerText = updated.toFixed(2);
                });
            });
        } else {
            status.innerText = "Error processing query.";
        }
    } catch (error) {
        status.innerText = "Error: Backend unreachable.";
        console.error(error);
    } finally {
        btn.disabled = false;
        setTimeout(() => { if(status.innerText === "Success!") status.innerText = ""; }, 3000);
    }
});

// NEW COPY BUTTON LOGIC
document.getElementById('copyBtn').addEventListener('click', async () => {
    const textToCopy = document.getElementById('aiResponse').innerText;
    const copyBtn = document.getElementById('copyBtn');
    
    try {
        await navigator.clipboard.writeText(textToCopy);
        // Visual feedback
        copyBtn.innerText = "✅ Copied to Clipboard!";
        copyBtn.style.background = "#4ade80";
        copyBtn.style.color = "#121212";
        
        // Reset the button after 2 seconds
        setTimeout(() => {
            copyBtn.innerText = "Copy Answer";
            copyBtn.style.background = "transparent";
            copyBtn.style.color = "#4ade80";
        }, 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
        copyBtn.innerText = "❌ Copy Failed";
    }
});
