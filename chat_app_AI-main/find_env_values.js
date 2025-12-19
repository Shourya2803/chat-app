const fs = require('fs');
const path = require('path');

const files = [
    'd:\\Downloads\\chat_app_AI-main\\chat_app_AI-main\\.env.local',
    'd:\\Downloads\\chat_app_AI-main\\chat_app_AI-main\\.env',
    'd:\\Downloads\\chat_app_AI-main\\chat_app_AI-main\\frontend\\.env.local',
    'd:\\Downloads\\chat_app_AI-main\\chat_app_AI-main\\backend\\.env'
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        const lines = content.split('\n').filter(l => l.includes('CLOUDINARY'));
        console.log(`FILE: ${f}`);
        lines.forEach(l => console.log(`  ${l.trim()}`));
    } else {
        console.log(`FILE: ${f} (NOT FOUND)`);
    }
});
