const fs = require('fs');
const readline = require('readline');

async function revert() {
    const fileStream = fs.createReadStream('C:\\Users\\hanhdth\\.gemini\\antigravity-ide\\brain\\ec9aea38-1615-4065-b123-2ac7798cc564\\.system_generated\\logs\\transcript_full.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let lastAppJs = '';
    let lastIndexHtml = '';
    let foundApp = false;
    let foundIndex = false;

    // We want the last known state BEFORE we started refactoring.
    // The refactoring started when we ran `mkdir js` or `split.js`.
    // Let's just collect all changes. We'll store an array of versions.
    const appJsVersions = [];
    const indexHtmlVersions = [];

    for await (const line of rl) {
        try {
            const step = JSON.parse(line);
            if (step.tool_calls) {
                for (const tc of step.tool_calls) {
                    if (tc.name === 'default_api:write_to_file') {
                        if (tc.arguments.TargetFile && tc.arguments.TargetFile.endsWith('app.js')) {
                            appJsVersions.push(tc.arguments.CodeContent);
                        }
                        if (tc.arguments.TargetFile && tc.arguments.TargetFile.endsWith('index.html')) {
                            indexHtmlVersions.push(tc.arguments.CodeContent);
                        }
                    }
                    if (tc.name === 'default_api:replace_file_content' || tc.name === 'default_api:multi_replace_file_content') {
                        // Actually replace_file_content doesn't give the full file, it just gives the chunk.
                        // We need the full file! 
                    }
                }
            }
            if (step.type === 'TOOL_RESPONSE' && step.content) {
                // If we viewed the file, we might have the full content in the output.
                if (step.content.includes('File Path: `file:///d:/TempM/prototype/app.js`') && step.content.includes('The above content shows the entire, complete file contents')) {
                    // Extract file content from view_file response
                    const match = step.content.match(/The following code has been modified.*?\n([\s\S]*?)\nThe above content shows the entire/);
                    if (match) {
                        // Remove line numbers: "1: /*" -> "/*"
                        const clean = match[1].replace(/^\d+: /gm, '');
                        appJsVersions.push(clean);
                    }
                }
                if (step.content.includes('File Path: `file:///d:/TempM/prototype/index.html`') && step.content.includes('The above content shows the entire, complete file contents')) {
                    const match = step.content.match(/The following code has been modified.*?\n([\s\S]*?)\nThe above content shows the entire/);
                    if (match) {
                        const clean = match[1].replace(/^\d+: /gm, '');
                        indexHtmlVersions.push(clean);
                    }
                }
            }
        } catch(e) {}
    }

    if (appJsVersions.length > 0) {
        // The last version in the array is the most recent full view.
        // Wait, what if we didn't view it recently? We can just dump the last 2 versions to check.
        fs.writeFileSync('app_backup.js', appJsVersions[appJsVersions.length - 1]);
        console.log('Restored app_backup.js');
    }
    if (indexHtmlVersions.length > 0) {
        fs.writeFileSync('index_backup.html', indexHtmlVersions[indexHtmlVersions.length - 1]);
        console.log('Restored index_backup.html');
    }
}

revert();
