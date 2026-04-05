# Workspace Screen Filler (Plasma 6.6)

This KWin script manages maximized window placement on a two-screen setup:

1. New windows can be forced to open unmaximized (configurable).
2. A screen is considered occupied when it already has a maximized window.
3. First maximized window goes to primary screen on current workspace.
4. Next maximized window in the same workspace goes to secondary screen.
5. If both screens are occupied, placement continues on adjacent workspaces.
6. If no adjacent workspace exists, a new one is created automatically.
7. Ignored apps are excluded from placement enforcement and can maximize anywhere.

## Files

- `metadata.json`
- `contents/code/main.js`

## Configuration (kwinrc)

The script reads these keys from its config:

- `ForceUnmaximizeOnOpen` (bool, default: `true`)
- `PrimaryOutputName` (string, default: empty)
- `IgnoredApps` (comma-separated string, default: empty)

If `PrimaryOutputName` is empty, the script uses KWin's first screen as primary.

### Example config

```bash
kwriteconfig6 --file kwinrc --group Script-my-kwin-script --key ForceUnmaximizeOnOpen true
kwriteconfig6 --file kwinrc --group Script-my-kwin-script --key PrimaryOutputName "DP-1"
kwriteconfig6 --file kwinrc --group Script-my-kwin-script --key IgnoredApps "org.kde.dolphin,firefox,Alacritty"
```

`IgnoredApps` entries are matched against:

- `desktopFileName`
- `resourceClass`
- `resourceName`

Matching is case-insensitive.

## Install and enable

From this project directory:

```bash
kpackagetool6 --type KWin/Script -i .
kwriteconfig6 --file kwinrc --group Plugins --key my-kwin-scriptEnabled true
qdbus org.kde.KWin /KWin reconfigure
```

To update after editing:

```bash
kpackagetool6 --type KWin/Script -u .
qdbus org.kde.KWin /KWin reconfigure
```
