# MiniLedger mobile app

The React Native (Expo) client. See the [root README](../README.md) for setup
and [`docs/TEST_PLAN.md`](../docs/TEST_PLAN.md) for the manual UI checklist.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run ios` | Start and open the iOS Simulator |
| `npm run android` | Start and open an Android emulator |
| `npm run web` | Run in the browser |

## Pointing it at the API

`src/config.ts` resolves the base URL in this order:

1. `EXPO_PUBLIC_API_URL` environment variable
2. Platform default — `http://localhost:3000` (iOS/web) or
   `http://10.0.2.2:3000` (Android emulator)

On a physical device, use your machine's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000 npm start
```

## Layout

```
src/
├── api/
│   ├── client.ts          # Typed fetch wrapper, ApiRequestError
│   └── types.ts           # Loan, Summary, User …
├── auth/AuthContext.tsx   # Session state, SecureStore persistence
├── components/
│   ├── Button.tsx
│   ├── TextField.tsx
│   ├── SummaryCard.tsx    # The card at the top of the home screen
│   ├── EntryItem.tsx      # A ledger row, with the overdue highlight
│   ├── FilterTabs.tsx
│   └── EmptyState.tsx
├── screens/
│   ├── LoginScreen.tsx    # Phone → OTP
│   ├── HomeScreen.tsx     # Summary + list
│   └── AddEntryScreen.tsx # Form + receipt picker
├── utils/format.ts        # Formatting and validation
└── theme.ts               # Design tokens
```

## Notes

- The session token is stored in the device keystore via `expo-secure-store`,
  never in plain AsyncStorage.
- Overdue highlighting is driven by the server's `isOverdue` flag, so the
  client and the API can never disagree about what is late.
- The form mirrors the server's Zod rules, so validation errors appear
  instantly instead of after a round-trip.
