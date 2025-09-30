const https = require('https');
const { PROVIDER_LABELS } = require('./types');

function coerceOpenAIErrorMessage(provider, statusCode, body) {
  if (!body) {
    return `${PROVIDER_LABELS[provider]} request failed with status ${statusCode ?? 'unknown'}.`;
  }

  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message?.trim();

    if (message) {
      return `${PROVIDER_LABELS[provider]} request failed with status ${statusCode ?? 'unknown'}: ${message}`;
    }
  } catch (error) {
    // Ignore JSON parse errors and fall back to the raw body below.
  }

  const sanitized = body.length > 500 ? `${body.slice(0, 497)}...` : body;
  return `${PROVIDER_LABELS[provider]} request failed with status ${statusCode ?? 'unknown'}: ${
    sanitized.trim() || 'Unknown error.'
  }`;
}

async function fetchOpenAIStyleExplanation(messages, endpoint, apiKey, model, token, provider) {
  if (messages.length === 0) {
    return { error: 'Prompt did not include any messages.' };
  }

  if (!endpoint) {
    return { error: `${PROVIDER_LABELS[provider]} endpoint is not configured.` };
  }

  if (!apiKey) {
    return { error: `${PROVIDER_LABELS[provider]} API key is not configured.` };
  }

  if (!model) {
    return { error: `${PROVIDER_LABELS[provider]} model is not configured.` };
  }

  const payload = JSON.stringify({
    model,
    messages
  });

  const url = new URL(endpoint);

  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Bearer ${apiKey}`
        }
      },
      (res) => {
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

              resolve(
                text
                  ? { text }
                  : { error: `${PROVIDER_LABELS[provider]} returned an empty response.` }
              );
            } catch (error) {
              console.error(
                `[MyHoverExtension] Failed to parse ${PROVIDER_LABELS[provider]} response:`,
                error
              );
              const message = error instanceof Error ? error.message : 'Unknown parsing error.';
              resolve({ error: `Failed to parse ${PROVIDER_LABELS[provider]} response: ${message}` });
            }
          } else {
            console.error(
              `[MyHoverExtension] ${PROVIDER_LABELS[provider]} request failed with status ${res.statusCode}: ${body}`
            );
            resolve({ error: coerceOpenAIErrorMessage(provider, res.statusCode, body) });
          }
        });
      }
    );

    req.on('error', (error) => {
      if (!token.isCancellationRequested) {
        console.error(`[MyHoverExtension] ${PROVIDER_LABELS[provider]} request error:`, error);
      }
      const message = error instanceof Error ? error.message : String(error);
      resolve({ error: `${PROVIDER_LABELS[provider]} request error: ${message}` });
    });

    token.onCancellationRequested(() => {
      req.destroy(new Error('Cancelled'));
      resolve({ error: `${PROVIDER_LABELS[provider]} request was cancelled.` });
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  fetchOpenAIStyleExplanation
};
