
const fs = require('fs');
const path = require('path');

async function listModels() {
    let apiKey = '';
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
    } catch (e) { }

    if (!apiKey) {
        console.error("❌ No GEMINI_API_KEY found");
        return;
    }

    console.log(`🔑 key: ...${apiKey.slice(-5)}`);

    try {
        console.log("📡 Fetching available models from Google API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.models) {
            console.log("\n✅ AVAILABLE GENERATE_CONTENT MODELS:");
            const contentModels = data.models.filter(m =>
                m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
            );

            const names = contentModels.map(m => m.name.replace('models/', ''));
            fs.writeFileSync(path.join(__dirname, 'models.json'), JSON.stringify(names, null, 2));
            console.log("✅ Models written to scripts/models.json");

            if (contentModels.length === 0) {
                console.warn("⚠️ No models support generateContent!");
            }
        } else {
            console.error("❌ Could not list models:", data);
        }

    } catch (error) {
        console.error("❌ Network error listing models:", error.message);
    }
}

listModels();
