---
name: Metro stale skill-dir watch crash
description: Expo/Metro frontend workflow crashes with ENOENT watching a deleted .local/skills/.old-* directory; restart fixes it.
---

The "Start Frontend" (Expo/Metro) workflow can crash on startup with:
`Error: ENOENT: no such file or directory, watch '/home/runner/workspace/.local/skills/.old-deployment-*/references'`

**Why:** Metro's file-map watcher walks `.local/skills` and tries to watch a skill directory that was removed (e.g. an `.old-deployment-*` leftover) after the watch list was computed. The directory is already gone, so it's a stale/transient watch target, not a code bug.

**How to apply:** This is NOT caused by app code. Confirm no broken symlinks remain under `.local/skills`, then just `restart_workflow("Start Frontend")` — it bundles cleanly on the retry. Do not chase it in application source.
