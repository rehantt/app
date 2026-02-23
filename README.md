# DataTracker

A web application that lets users describe data they want to track in plain English and automatically creates a connected Google Sheet with proper columns, formulas, and formatting — plus a clean, modern dashboard to view, edit, and analyse the data.

## Features

- 🤖 **AI-powered setup** — describe what you want to track in plain English; Gemini parses it into columns and formulas
- 📊 **Google Sheets integration** — auto-creates a spreadsheet with headers, freeze rows, bold formatting, and a Summary tab
- 💳 **Auto-calculated formulas** — totals, cashback (default 2%), category breakdowns
- 📱 **Mobile-friendly dashboard** — bar charts, line charts, pie charts, and summary cards
- ✏️ **Inline editing** — add, edit, and delete rows; changes sync back to the sheet
- 🔐 **Google Sign-In** — Firebase Auth with Google OAuth; requests Sheets + Drive scopes
- 🗄️ **Firestore** — all tracker configs and row data stored in Firestore

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Auth | Firebase Authentication (Google) |
| Database | Cloud Firestore |
| AI | Google Gemini 1.5 Flash (REST API) |
| Sheets | Google Sheets API v4 (browser-side) |
| Hosting | Firebase Hosting |

## System Architecture

```
User Browser
│
├── React SPA (Firebase Hosting)
│   ├── LoginPage        – Google Sign-In with Sheets/Drive scopes
│   ├── SetupWizard      – plain-English input → Gemini → column preview → create sheet
│   ├── TrackerList      – dashboard of all trackers (from Firestore)
│   ├── TrackerView      – tabs: Dashboard (charts) | Data (editable grid)
│   ├── Dashboard        – summary cards, bar/line/pie charts (Recharts)
│   └── DataGrid         – inline add/edit/delete rows, synced to Sheets API
│
├── Firebase Services
│   ├── Auth             – Google OAuth (access token captured for Sheets API)
│   ├── Firestore        – /trackers/{id}, /rows/{id}
│   └── Hosting          – serves built React app
│
└── Google APIs (called directly from browser with OAuth token)
    ├── Sheets API v4    – createSpreadsheet, appendRow, updateRow, deleteRow, readRows
    └── Drive API v3     – optional: make sheet viewable by anyone
```

## Google Sheet Structure

For a tracker like "Track Pokémon cards I buy, purchase price, date, seller, and calculate total spend":

**Data tab**

| ID | Date | Price | Seller |
|---|---|---|---|
| abc | 2024-01-15 | 12.50 | eBay |
| def | 2024-01-22 | 8.00 | Local Shop |

**Summary tab**

| Label | Value |
|---|---|
| Total Spend | `=SUM(Data!C2:C1000)` |
| Count | `=COUNTA(Data!A2:A1000)` |

**Cashback formula (2%)**

```
=C2*0.02
```

Total cashback summary:
```
=SUM(Data!D2:D1000)
```

## Setup

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. Enable **Authentication** → Sign-in methods → Google
3. Enable **Cloud Firestore** (start in test mode for development)
4. Enable **Hosting**

### 2. Enable Google APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Enable **Google Sheets API** and **Google Drive API**
4. In Firebase Console → Authentication → Settings → Authorized domains, add your hosting domain

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your Firebase project config values from **Project Settings → General → Your apps**.

### 4. Install dependencies and run locally

```bash
npm install
npm run dev
```

### 5. Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project
npm run deploy
```

## Firestore Security Rules

Add these rules in Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trackers/{trackerId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /rows/{rowId} {
      allow read, write: if request.auth != null;
    }
  }
}
```
