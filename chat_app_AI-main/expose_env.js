const fs = require('fs');
const path = require('path');
const f = 'd:\\Downloads\\chat_app_AI-main\\chat_app_AI-main\\.env.local';
if (fs.existsSync(f)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    console.log(`TOTAL LINES: ${lines.length}`);
    lines.forEach((l, i) => console.log(`${i + 1}: [${l.trim()}]`));
} else {
    console.log('NOT FOUND');
}
