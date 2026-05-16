import { dbLoad } from './db.js';

export async function getStudyAdvice(uid) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
        // Fallback mock logic if no API key is provided
        const hour = new Date().getHours();
        let suggestion = "";
        if (hour < 12) {
            suggestion = "Morning peak! Priority: **EM-4**. Suggesting a 90-min deep focus session on past year papers.";
        } else if (hour < 18) {
            suggestion = "Afternoon dip. Switch to active recall or lighter tasks like **ALC Revision**.";
        } else {
            suggestion = "Evening wrap-up. Review today's mistakes and plan tomorrow's 3 critical targets.";
        }
        return `[MOCK] "Analyzing schedule... ${suggestion}"\n(Add VITE_GEMINI_API_KEY to .env for real AI)`;
    }

    try {
        // Prepare context data for the prompt
        const targets = await dbLoad(uid, 'power:targets', []);
        const sleep = await dbLoad(uid, 'power:sleep', { actual: 0 });
        
        const targetSummary = targets.map(t => `${t.text} (${t.done ? 'Done' : 'Pending'})`).join(', ');

        const prompt = `You are BOBBY.OS, an elite AI study and productivity advisor.
The user is a computer science student preparing for "CT2" exams (Continuous Test 2).
Here is their current state:
- Sleep last night: ${sleep.actual} hours (Target is 8.0h)
- Daily Targets: ${targetSummary || 'None set yet'}
- Current Time: ${new Date().toLocaleTimeString()}

Based on this, give a VERY short, punchy 1-2 sentence piece of advice or schedule optimization. Keep it under 150 characters. Use **bolding** for important concepts. Be authoritative but encouraging. Do not use pleasantries, just the advice.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 100,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return `"Error contacting AI Advisor. Focus on the next immediate task."`;
    }
}
