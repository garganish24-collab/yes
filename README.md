# Habit Tracker

A simple black and red desktop habit tracker. Your data is saved to a file on your computer after every click, so closing the app never loses anything.

## What's in it

- **Home**: a month calendar. Each day's red bar fills up with the non-negotiables you did. Each negotiable you did adds a white pip on top of the bar as a bonus. Click a day to tick habits.
- **Grid**: the monthly tracker. Habits are rows and days are columns. A red dot means a non-negotiable was done, a white dot means a negotiable was done. Click any box to add or remove a dot.
- **75 Day**: the challenge.
  - Hit every non-negotiable in a day to get +1.
  - Miss any of them and you go back 10 days, but never below 0.
  - Reach 75 to finish.
  - If you forgot to tick an old day, fixing it corrects the count.
- **Habits**:
  - Add, rename, remove and restore habits.
  - Switch a habit between non-negotiable and negotiable.
  - Export or import a backup.

## Setup (one time)

1. Install Node.js (LTS) from https://nodejs.org
2. Open a terminal in this folder and run:
   ```
   npm install
   ```

## Run it

```
npm start
```

## Put it on your desktop

Build an installer on your own computer:

- Windows: `npm run dist:win`, then run the installer in `dist/`. It adds a desktop shortcut.
- Mac: `npm run dist:mac`, then open the `.dmg` in `dist/` and drag the app to Applications. Drag it from Applications to the Dock or desktop to pin it.

## Where your data lives

The exact path is shown at the bottom of the Habits tab.

- Windows: `%APPDATA%\Habit Tracker\habits.json`
- Mac: `~/Library/Application Support/Habit Tracker/habits.json`

How it stays safe:
- `habits.backup.json` sits next to it and holds the version from before your last change.
- If the main file ever gets damaged, the app loads the backup and keeps a copy of the damaged file.
- Use **Export backup** now and then to keep a copy somewhere else, like Google Drive.

## Tests

```
npm test
```
