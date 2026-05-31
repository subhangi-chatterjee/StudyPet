# Study Pet + Quest Generator for Cardputer

This project is a starter firmware app for a `Cardputer`-based study companion designed for students with ADHD.

## What this MVP does

- Shows a virtual pet with mood, XP, level, streak, and evolution stage
- Stores assignments locally on the device
- Breaks assignments into smaller quests
- Supports adaptive focus modes:
  - Locked In
  - Normal
  - Distracted
  - Exhausted
- Connects over Wi-Fi to an OpenAI-powered endpoint for:
  - quest generation
  - study prioritization
  - ADHD-style study coaching

## Important architecture note

The Cardputer should not literally "run ChatGPT" on-device. The realistic pattern is:

1. Cardputer captures assignment text and user state
2. Cardputer sends a small HTTPS request
3. An OpenAI-backed API returns structured quest data and coaching text
4. Cardputer displays the results and updates the pet/progression state

For a quick prototype you can call OpenAI directly from the device, but for a real student-facing build you should use your own small backend so the API key is not embedded in firmware.

## Suggested roadmap

### Phase 1

- Manual assignment entry
- Local quest list
- Pet XP/streak/evolution
- Focus mode selection
- "What should I do now?" recommendation button

### Phase 2

- OpenAI-generated quest chains
- Session completion / partial completion flow
- Subject skill leveling
- Save data in flash

### Phase 3

- PDF upload pipeline through a phone/web companion
- Canvas integration via backend
- Google Calendar integration via backend
- Cosmetic unlocks and pet inventory

## Data model

### Assignment

- title
- subject
- dueAt
- estimatedMinutes
- progressPercent

### Quest

- title
- description
- xpReward
- estimatedMinutes
- done

### Pet

- name
- xp
- level
- streakDays
- evolutionStage
- mood

## API contract

The firmware expects an endpoint like:

- `POST /quests`
- `POST /coach`

Example `/quests` request body:

```json
{
  "assignment": {
    "title": "History essay due Friday",
    "subject": "History",
    "due_at": "2026-06-03",
    "estimated_minutes": 120
  },
  "focus_mode": "distracted"
}
```

Example `/quests` response body:

```json
{
  "quests": [
    {
      "title": "Choose a topic",
      "description": "Pick one essay angle and write one sentence explaining it.",
      "xp_reward": 10,
      "estimated_minutes": 10
    },
    {
      "title": "Find 3 sources",
      "description": "Collect three usable articles or books and note why each helps.",
      "xp_reward": 15,
      "estimated_minutes": 15
    }
  ]
}
```

Example `/coach` request body:

```json
{
  "focus_mode": "normal",
  "assignments": [
    {
      "title": "Math homework",
      "due_at": "2026-05-31",
      "estimated_minutes": 25
    },
    {
      "title": "Chemistry quiz",
      "due_at": "2026-06-05",
      "estimated_minutes": 45
    }
  ]
}
```

## OpenAI prompt shape

Use the OpenAI Responses API and ask for JSON output with:

- small actionable quests
- no punishment language
- ADHD-friendly tone
- urgency-aware prioritization
- short, concrete descriptions

Official docs used for this architecture:

- [Responses API](https://platform.openai.com/docs/api-reference/responses/compact?api-mode=responses)
- [Text generation guide](https://platform.openai.com/docs/guides/text?api-mode=responses)
- [Authentication guide](https://platform.openai.com/docs/api-reference/authentication?api-mode=responses)
- [Migrate to Responses API](https://platform.openai.com/docs/guides/migrate-to-responses)

## Backend setup

1. Go to `backend/`
2. Install dependencies with `npm install`
3. Set `OPENAI_API_KEY`
4. Start the service with `npm start`
5. Point the Cardputer firmware `API_BASE_URL` at that backend

## Firmware setup

Update these constants in `src/main.cpp`:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `API_BASE_URL`

Optional direct-to-OpenAI approach:

- replace your backend URL with `https://api.openai.com/v1/responses`
- add bearer auth
- return simplified JSON for the device

## Notes

- The current UI is intentionally simple and menu-driven for a first handheld prototype.
- The firmware includes sample assignments so you can test the game loop before wiring real input forms.
- If the exact Cardputer library API differs in your environment, only the display/keyboard glue should need adjustment.
