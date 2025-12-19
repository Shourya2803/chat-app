const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const lines = content.split('\n');
console.log('--- ROOT .env.local KEYS ---');
lines.forEach(line => {
    if (line.includes('=')) {
        const key = line.split('=')[0].trim();
        console.log(`Key: [${key}]`);
    }
});
