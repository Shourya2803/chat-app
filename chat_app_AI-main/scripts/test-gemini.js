
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function testGemini() {
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

    const genAI = new GoogleGenerativeAI(apiKey);

    const modelsToTest = [
        "gemini-1.5-flash-001", // Often the specific version name
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-pro",           // Legacy stable
        "gemini-1.0-pro"
    ];

    console.log("🔍 Testing multiple model names...");

    for (const modelName of modelsToTest) {
        console.log(`\n🤖 Testing: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            console.log(`✅ SUCCESS with [${modelName}]!`);
            return; // Exit on first success
        } catch (error) {
            console.error(`❌ [${modelName}] Failed: ${error.message.split('[')[0]}...`); // Short error
        }
    }
    console.error("\n❌ ALL MODELS FAILED. Check API Key validity.");
}

testGemini();
