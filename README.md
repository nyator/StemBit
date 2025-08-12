# StemBit

StemBit is a React Native mobile application designed for musicians and performers. It provides an integrated suite of tools including a metronome, loop player, pad interface, and session manager, all accessible through a modern, tab-based interface. The app aims to streamline practice, performance, and session management for users.

---

## Table of Contents

- [Features](#features)
  - [Metronome](#metronome)
  - [Loop](#loop)
  - [Pad](#pad)
  - [Session](#session)
  - [Profile & Auth](#profile--auth)
  - [Settings](#settings)
- [Technical Stack](#technical-stack)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Contribution Guidelines](#contribution-guidelines)

---

## Features

### Metronome (`metro.tsx`)
- Accurate beat scheduling with drift correction.
- Custom time signatures and tap tempo.
- Visual feedback with animated beat indicators.

### Loop (`loop.tsx`)
- Select and play preset loops.
- BPM control and tap tempo.
- Visual feedback and play/pause controls.

### Pad (`pad.tsx`)
- Play musical pads in major/minor keys.
- Audio playback with looping and stop controls.
- Visual feedback for active pads.

### Session (`session.tsx`)
- Manage session setlists.
- Add/edit sessions (future expansion).
- Scrollable list of sessions with details.

### Profile & Auth (`app/(profile)`, `app/(auths)`)
- User profile management.
- Authentication: register, login, forgot/reset password.
- Animated splash/onboarding screens.

### Settings (`index.tsx`)
- Placeholder for user preferences and app settings.

---

## Technical Stack

- **Framework:** React Native
- **Navigation:** expo-router
- **UI Styling:** Tailwind CSS (NativeWind)
- **Audio:** expo-audio
- **Icons:** @expo/vector-icons
- **Animation:** react-native Animated API, moti
- **Backend:** Appwrite (authentication and data)
- **Other:** Expo, TypeScript

---

## Installation & Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/stembit.git
   cd stembit
   ```

2. **Install dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```

3. **Start the Expo development server:**
   ```sh
   npm start
   # or
   yarn start
   ```

4. **Run on your device:**
   - Use the Expo Go app or an emulator.

---

## Usage

- **Onboarding:** Launch the app to view animated splash screens. Use "Skip" or the forward button to proceed.
- **Authentication:** Register or log in to access main features.
- **Tabs:**
  - **Loop:** Select and play loops, adjust BPM, tap tempo.
  - **Pad:** Play musical pads in major/minor keys.
  - **Session:** Manage setlists and sessions.
  - **Metronome:** Use the metronome with custom time signatures and tap tempo.
- **Profile:** View and edit user info.
- **Settings:** (Coming soon) Configure app preferences.

---

## Contribution Guidelines

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Write clear, concise commits and include tests if applicable.
4. Submit a pull request with a detailed description.

**Code Style:**  
- Use TypeScript for all files.
- Follow the existing folder structure.
- Use Tailwind CSS classes for styling.
- Keep components modular and reusable.

---


## File Structure Overview

- `app/` - Main application screens and navigation
  - `(tabs)/` - Main tab screens: `loop.tsx`, `pad.tsx`, `session.tsx`, `metro.tsx`
  - `(auths)/` - Authentication screens: `login.tsx`, `register.tsx`, etc.
  - `(profile)/` - User profile and help screens
  - `index.tsx` - Settings/configuration
- `components/` - Reusable UI components (e.g., header, buttons, toast)
- `constants/` - Static assets and configuration (icons, audio)
- `context/` - React context providers (e.g., AuthContext)
- `lib/` - API and backend integration (e.g., Appwrite)
- `assets/` - Images, icons, fonts
- `global.css` - Global styles (used with NativeWind)
- `tailwind.config.js` - Tailwind/NativeWind configuration

---

## Contact

For questions or support, open an issue or contact me.
