# 🌌 BOBBY.OS | The Elite Developer & Student Productivity Ecosystem

[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/vijaypagolu2007/BOBBY.OS)
[![Build](https://img.shields.io/badge/engine-vite-ffce44?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Database](https://img.shields.io/badge/cloud-firebase-ff9100?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Platform](https://img.shields.io/badge/platform-pwa%20%7C%20android-20d68a?style=for-the-badge)](https://capacitorjs.com/)

> **"Elite Productivity through Aesthetic Precision."**  
> BOBBY.OS is a premium personal dashboard and productivity shell designed specifically for developers and competitive programmers. It transforms your daily habits, study routines, and competitive stats into a unified, high-performance visual dashboard.

---

## 🚀 Key Feature Hubs

### ⏱️ Focus & Daily Logging
*   **Zen Pomodoro:** Integrated timer with customizable durations (25, 45, 60, 90 mins). Connect focus sessions directly to your habits.
*   **Sleep Tracker (Night Shift):** Log actual sleep, compare against targets, and visualize recovery efficiency trends.
*   **Daily Diary:** Structured logging for daily wins, challenges faced, lessons learned, and tomorrow's top priorities, complete with mood and energy indicators.
*   **The Big 3 (Smart Targets):** Set and cross off critical daily objectives to maintain consistent focus.

### 📊 Competitive Programming & Academics
*   **Codeforces Command Center:** Real-time stats integration (rating, rank, max rating) with automated handle extraction and delta tracking.
*   **Exam Countdown:** Visual countdown and cognitive load analysis for upcoming exams.
*   **CT2 Score Tracker:** Record, monitor, and visualize semester grades across all subjects.

### 📚 Study & Revision Vaults
*   **Formula Vault:** Subject-wise quick-reference boards for formulas and equations.
*   **Revision Checklist:** Interactive topic-wise syllabus tracker per subject.
*   **Wrong Answer Log:** A dedicated mistake log to record incorrect submissions, debug steps, and lessons learned.
*   **Subject Notes:** In-app markdown editor for organizing structured course material.

### 🎨 Personalization & Customization
*   **Dynamic Theme Engine:** Instantly swap between **Obsidian Void** (Midnight Purple), **Crimson Matrix** (Red), **Emerald Green** (Green), and **Matrix Monochrome** (Monochrome).
*   **UI Density Scaling:** Toggle between *Standard Layout* and *Compact Mode* for high-density information displays.
*   **Intelligent Alerts:** Browser push notifications for morning exam papers and 3:30 AM completeness checks.

---

## 🛠️ Technical Architecture

BOBBY.OS implements a **three-tier offline-first storage model** to achieve zero latency:
1.  **Memory Store (S):** Global reactive state cache for instant O(1) reads.
2.  **LocalStorage Cache:** Device-level persistence indexed by user UID to allow 100% functional offline use.
3.  **Firebase Firestore:** Real-time bi-directional cloud synchronization across devices (laptop and mobile) when internet is available.

---

## ⚙️ Installation & Setup

### Prerequisites
Make sure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18+)
*   [npm](https://www.npmjs.com/) (v9+)
*   [Android Studio](https://developer.android.com/studio) (only if compiling the native Android app)

### 1. Web App Setup
Clone the repository and install the dependencies:
```bash
# Clone the project repository
git clone https://github.com/vijaypagolu2007/BOBBY.OS.git

# Enter the project directory
cd BOBBYOS

# Install npm dependencies
npm install
```

### 2. Environment Variables Configuration
Configure the Firebase integration by setting up your local environment file:
1.  Create a `.env` file in the root of the project (copying `.env.example`):
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` and fill in your Firebase Web App configuration:
    ```ini
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

### 3. Run Locally (Web)
Start the local Vite development server:
```bash
# Start Vite development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 📱 Mobile Android Setup (Capacitor)

Capacitor bridges the web application into a native Android app wrapper.

### 1. Build and Sync Assets
Compile the static web bundle and sync it to the Android shell:
```bash
# Compile Vite production build
npm run build

# Sync web assets and capacitor configs to Android resources
npx cap sync android
```

### 2. Configure Live Reload (Optional for Development)
To sync laptop code updates to your phone in real-time over your local Wi-Fi:
1.  Find your laptop's local IPv4 Address (e.g. `192.168.1.5`).
2.  Open `capacitor.config.json` and add the `server` block:
    ```json
    {
      "appId": "com.bobbyos.app",
      "appName": "BOBBY.OS",
      "webDir": "dist",
      "server": {
        "url": "http://192.168.1.5:3000",
        "cleartext": true,
        "androidScheme": "http"
      }
    }
    ```
3.  Expose the local server to your Wi-Fi network:
    ```bash
    npm run dev -- --host
    ```

### 3. Deploy to Connected Phone
1.  Connect your phone to your computer via USB and verify USB debugging is authorized.
2.  Install the app from your laptop:
    ```bash
    npx cap run android
    ```

---

## 🔒 Firebase Security Rules (Firestore)

To enable data separation between users, set up the following security rules in your **Firebase Console ➔ Firestore ➔ Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🚀 Production Deployment (PWA)

To compile the application as a standalone Progressive Web App (PWA):
```bash
# Compile PWA build
npm run build

# Preview production build locally
npm run preview
```
Once hosted, users can tap **"Add to Home Screen"** on their mobile browsers for complete app installation with full offline capabilities.

---
*Developed with precision for the next generation of power users.*  
*© 2026 BOBBY.OS *
