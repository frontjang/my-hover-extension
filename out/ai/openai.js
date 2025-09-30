"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOpenAIStyleExplanation = fetchOpenAIStyleExplanation;
const http = require("http");
const https = require("https");
const types_1 = require("./types");
function coerceOpenAIErrorMessage(provider, statusCode, body) {
    if (!body) {
        return `${types_1.PROVIDER_LABELS[provider]} request failed with status ${statusCode ?? 'unknown'}.`;
    }
    try {
        const parsed = JSON.parse(body);
        const message = parsed.error?.message?.trim();
        if (message) {
            return `${types_1.PROVIDER_LABELS[provider]} request failed with status ${statusCode ?? 'unknown'}: ${message}`;
        }
    }
    catch (parseError) {
        // Ignore JSON parse errors and fall back to the raw body below.
    }
    const sanitized = body.length > 500 ? `${body.slice(0, 497)}...` : body;
    return `${types_1.PROVIDER_LABELS[provider]} request failed with status ${statusCode ?? 'unknown'}: ${sanitized.trim() || 'Unknown error.'}`;
}
async function fetchOpenAIStyleExplanation(messages, endpoint, apiKey, model, token, provider) {
    if (messages.length === 0) {
        return { error: 'Prompt did not include any messages.' };
    }
    if (!endpoint) {
        return { error: `${types_1.PROVIDER_LABELS[provider]} endpoint is not configured.` };
    }
    if (!apiKey) {
        return { error: `${types_1.PROVIDER_LABELS[provider]} API key is not configured.` };
    }
    if (!model) {
        return { error: `${types_1.PROVIDER_LABELS[provider]} model is not configured.` };
    }
    const payload = JSON.stringify({
        model,
        messages
    });
    const url = new URL(endpoint);
    return new Promise((resolve) => {
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            resolve({ error: `${types_1.PROVIDER_LABELS[provider]} endpoint must use HTTP or HTTPS.` });
            return;
        }
        const transport = url.protocol === 'http:' ? http : https;
        const req = transport.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                Authorization: `Bearer ${apiKey}`
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
                        const choice = json.choices?.find((c) => !!c.message?.content);
                        const text = choice?.message?.content?.trim();
                        resolve(text ? { text } : { error: `${types_1.PROVIDER_LABELS[provider]} returned an empty response.` });
                    }
                    catch (error) {
                        console.error(`[MyHoverExtension] Failed to parse ${types_1.PROVIDER_LABELS[provider]} response:`, error);
                        const message = error instanceof Error ? error.message : 'Unknown parsing error.';
                        resolve({ error: `Failed to parse ${types_1.PROVIDER_LABELS[provider]} response: ${message}` });
                    }
                }
                else {
                    console.error(`[MyHoverExtension] ${types_1.PROVIDER_LABELS[provider]} request failed with status ${res.statusCode}: ${body}`);
                    resolve({ error: coerceOpenAIErrorMessage(provider, res.statusCode, body) });
                }
            });
        });
        req.on('error', (error) => {
            if (!token.isCancellationRequested) {
                console.error(`[MyHoverExtension] ${types_1.PROVIDER_LABELS[provider]} request error:`, error);
            }
            const message = error instanceof Error ? error.message : String(error);
            resolve({ error: `${types_1.PROVIDER_LABELS[provider]} request error: ${message}` });
        });
        token.onCancellationRequested(() => {
            req.destroy(new Error('Cancelled'));
            resolve({ error: `${types_1.PROVIDER_LABELS[provider]} request was cancelled.` });
        });
        req.write(payload);
        req.end();
    });
}
//# sourceMappingURL=openai.js.map