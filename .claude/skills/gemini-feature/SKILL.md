---
name: gemini-feature
description: How to build AI features in Here For YOU with Google Gemini — prescription-to-schedule drafts (text or photo), doctor-visit questions, weekly summaries — including prompts, zod output schemas, image upload limits, safety wording and tests with the model mocked. Use whenever a task involves Gemini, AI, prompts, src/lib/ai, reading prescriptions, or generating suggestions.
---

# Gemini features

## Use what exists
- `generateText()` / `generateJSON(schema, { system, prompt, images })` from `@/lib/ai/gemini` (server only, validated + one retry).
- `asUserData(label, text)` from `@/lib/ai/json` to fence user text.
- Throws `AIError` → routes return 502 with a friendly message.

## Prompt builders (`src/lib/ai/prompts.ts`)
Each feature exports `xxxPrompt(input) → { system, prompt }` and `XxxSchema`. System prompt structure:
role → task → rules → output. Always include:
> You help elderly people and their families organise medicines. You never diagnose, never change doses, and never invent medicines. If anything is unclear, put it in `uncertain`. A doctor or pharmacist makes all medical decisions.

### Prescription → draft schedule
- Input: pasted text (≤ 4000 chars) and/or one image (jpeg/png/webp ≤ 4 MB, base64).
- Output schema: `{ medications: Array<Partial MedicationInput with name, dose, times, instructions, purpose>, uncertain: string[] }`.
- Map common phrases: "1-0-1" → `["08:00","20:00"]`, "OD" → once daily, "BD" → twice, "TDS" → three times, "HS" → bedtime `["21:00"]`; state these mappings in the prompt.
- UI shows editable draft cards (prefilled `MedicationInput` form), each with a checkbox; **Save selected** posts to the normal medications route. Nothing is saved automatically.

### Doctor-visit questions
- Input: medicine names, last-30-day adherence summary, missed-dose count, appointment reason, elder's own notes. No emails or ids.
- Output: `{ questions: string[] (3–5, each ≤ 140 chars, plain language, first person "Should I…") }`.
- Saved to `appointment.questions`; included in reminder emails automatically.

## UI rules
Loading state with text ("Reading your prescription…"), result in `aria-live="polite"`, read-aloud button, error with retry, and under every result:
"Suggestion only — please check with your doctor or pharmacist."

## Tests
Mock `@/lib/ai/gemini` (`generateJSON: vi.fn()`). Cover: valid → 200 with draft; invalid body/oversized image → 400; `AIError` → 502; prompt builder wraps user text in `<user_input>`.
