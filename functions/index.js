const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

// Store the Gemini key as a Firebase Secret (never bundled client-side)
// Set with: firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const GENERATION_CONFIG = {
    temperature: 0.7,
    maxOutputTokens: 120,
};

exports.geminiProxy = onRequest(
    { secrets: [GEMINI_API_KEY], cors: true },
    async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        const prompt = req.body?.prompt;
        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Missing or invalid "prompt" field in request body.' });
            return;
        }

        try {
            const upstream = await fetch(
                `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY.value()}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: GENERATION_CONFIG,
                    }),
                }
            );

            const data = await upstream.json();

            if (!upstream.ok) {
                const message = data?.error?.message || `Gemini API error ${upstream.status}`;
                res.status(upstream.status).json({ error: message });
                return;
            }

            res.status(200).json(data);
        } catch (err) {
            console.error('geminiProxy error:', err);
            res.status(500).json({ error: 'Proxy internal error.' });
        }
    }
);
