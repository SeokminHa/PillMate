---
name: RN Web Alert unreliable
description: Alert.alert does not surface on React Native Web in this Expo app; use toast / window.confirm
---

`Alert.alert(...)` calls silently no-op (or only show a title) on the Expo web build for this project. An e2e test confirmed an error path that fired `Alert.alert` produced no visible UI even though the API returned an error.

**Rule:** For user feedback (errors, success), use a custom in-app toast component rendered in the screen, which works on web + native. For yes/no confirmations, branch on `Platform.OS === "web"` and use `window.confirm(...)`, falling back to `Alert.alert` with buttons on native.

**Why:** keeps feedback visible on all platforms (the app runs on Expo web on port 8081 and is tested there). **How to apply:** whenever adding success/error/confirm UX in any screen, do not rely on `Alert.alert` alone.
