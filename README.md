# Study Pet + Quest Generator

This project now includes a browser-based version of the study companion so you can run it directly on your laptop or publish it with GitHub Pages.

## Browser version

Open [/Users/subhangi/working_folder/Codes/cardputer/index.html](/Users/subhangi/working_folder/Codes/cardputer/index.html) in a browser, or serve the folder locally for the smoothest experience.

What the browser app does:

- Shows a virtual pet with mood, XP, level, streak, and evolution stage
- Stores assignments in browser local storage
- Breaks assignments into small offline-generated quests
- Supports adaptive focus modes:
  - Locked In
  - Normal
  - Distracted
  - Exhausted
- Recommends the next assignment using local priority rules
- Tracks subject-specific skill levels over time

## Current architecture

This version is fully offline.

The website keeps assignments in browser storage, turns them into small quests using local rules, and updates the pet based on completed study steps.

## Run from GitHub

This repo is set up to deploy to GitHub Pages from the `main` branch.

After you push to GitHub:

1. Open your repo settings on GitHub
2. Go to `Pages`
3. Set `Source` to `GitHub Actions`
4. Push your latest changes to `main`

Your site URL should be:

- [https://subhangi-chatterjee.github.io/StudyPet/](https://subhangi-chatterjee.github.io/StudyPet/)

If GitHub Pages is already enabled for the repo, pushing to `main` should trigger deployment automatically through `.github/workflows/deploy-pages.yml`.

## Running locally

Simplest option:

- Open `index.html` directly in your browser

Better option:

- From this folder run `python3 -m http.server 8000`
- Open `http://localhost:8000`

## Website controls

- Add assignments with the form
- Switch focus modes from the brain-state panel
- Click an assignment to inspect its quests
- Use `Rebuild quests` to resize tasks around your current focus mode
- Use `Finish next quest` or the per-quest button to earn XP and level up

## Suggested roadmap

### Phase 1

- Manual assignment entry
- Local quest list
- Pet XP/streak/evolution
- Focus mode selection
- "What should I do now?" recommendation button

### Phase 2

- Session completion / partial completion flow
- Subject skill leveling
- Better streak logic and session tracking

### Phase 3

- Better assignment entry flow
- Smarter local prioritization
- Optional sync/import tools
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

## Cardputer firmware

The original Cardputer firmware is still in [/Users/subhangi/working_folder/Codes/cardputer/src/main.cpp](/Users/subhangi/working_folder/Codes/cardputer/src/main.cpp) if you want to keep developing the handheld version too.

## Notes

- The website is intentionally dependency-free so it can run locally with almost no setup.
- The browser version persists data in local storage on your laptop.
- Everything runs locally with no network dependency.
- The Cardputer firmware and the browser app currently share the same offline quest-generation logic at a high level.
