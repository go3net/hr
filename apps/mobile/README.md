# Go3net Office — Mobile (Flutter)

Android/iOS app for employees: GPS/QR attendance, leave requests, payslips, tasks, chat, push notifications — offline-first.

## Status

Scaffold. The API (apps/api) is the contract; feature build-out follows the architecture in `docs/03-architecture.md` §4:

- **State:** Riverpod · **HTTP:** Dio with auth + `X-Tenant` interceptors · **Navigation:** go_router
- **Offline:** Drift (SQLite) cache + mutation outbox; attendance clock-ins queue locally with GPS + timestamp and sync when online
- **Security:** tokens in secure storage, biometric app-lock
- **Push:** Firebase Cloud Messaging

## Getting started

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```

Platform folders (`android/`, `ios/`) are generated on first `flutter create .` in this directory.

## Feature roadmap

1. Auth (login, 2FA, workspace picker)
2. Attendance (GPS geofence + QR scan, offline queue)
3. Leave (balances, request, approvals for managers)
4. Payslips (list + PDF viewer)
5. Tasks (my tasks, complete/comment)
6. Chat (WebSocket, push)
