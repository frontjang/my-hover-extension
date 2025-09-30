"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchGeminiExplanation = fetchGeminiExplanation;
const http = require("http");
const https = require("https");
function coerceGeminiErrorMessage(statusCode, body) {
    if (!body) {
        return `Gemini request failed with status ${statusCode ?? 'unknown'}.`;
    }
    try {
        const parsed = JSON.parse(body);
        const message = parsed.error?.message?.trim();
        if (message) {
            return `Gemini request failed with status ${statusCode ?? 'unknown'}: ${message}`;
        }
    }
    catch (parseError) {
        // Ignore JSON parsing issues and fall back to the raw body below.
    }
    const sanitized = body.length > 500 ? `${body.slice(0, 497)}...` : body;
    return `Gemini request failed with status ${statusCode ?? 'unknown'}: ${sanitized.trim() || 'Unknown error.'}`;
}
async function fetchGeminiExplanation(prompt, baseEndpoint, model, apiKey, token) {
    if (!prompt.trim()) {
        return { error: 'Prompt text was empty.' };
    }
    if (!baseEndpoint) {
        return { error: 'Gemini endpoint is not configured.' };
    }
    if (!model) {
        return { error: 'Gemini model is not configured.' };
    }
    if (!apiKey) {
        return { error: 'Gemini API key is not configured.' };
    }
    const payload = JSON.stringify({
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ]
    });
    const url = new URL(`${baseEndpoint.replace(/\/$/, '')}/${model}:generateContent`);
    return new Promise((resolve) => {
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            resolve({ error: 'Gemini endpoint must use HTTP or HTTPS.' });
            return;
        }
        const transport = url.protocol === 'http:' ? http : https;
        const req = transport.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'X-Goog-Api-Key': apiKey
            }
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => {
                chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
            });
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(body);
                        const candidate = json.candidates?.find((c) => c.content?.parts?.length);
                        const text = candidate?.content?.parts
                            ?.map((part) => part.text ?? '')
                            .join('\n')
                            .trim();
                        resolve(text ? { text } : { error: 'Gemini returned an empty response.' });
                    }
                    catch (error) {
                        console.error('[MyHoverExtension] Failed to parse Gemini response:', error);
                        const message = error instanceof Error ? error.message : 'Unknown parsing error.';
                        resolve({ error: `Failed to parse Gemini response: ${message}` });
                    }
                }
                else {
                    console.error(`[MyHoverExtension] Gemini request failed with status ${res.statusCode}: ${body}`);
                    resolve({ error: coerceGeminiErrorMessage(res.statusCode, body) });
                }
            });
        });
        req.on('error', (error) => {
            if (!token.isCancellationRequested) {
                console.error('[MyHoverExtension] Gemini request error:', error);
            }
            const message = error instanceof Error ? error.message : String(error);
            resolve({ error: `Gemini request error: ${message}` });
        });
        token.onCancellationRequested(() => {
            req.destroy(new Error('Cancelled'));
            resolve({ error: 'Gemini request was cancelled.' });
        });
        req.write(payload);
        req.end();
    });
}
//# sourceMappingURL=gemini.js.map