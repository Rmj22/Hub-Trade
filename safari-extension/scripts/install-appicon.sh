#!/bin/bash
# Installs the provided AppIcon set into the generated Xcode app target's asset catalog.
# Removes the #1 cause of Organizer's generic "Exporting for App Store Distribution failed"
# (a missing app icon / CFBundleIconName). Fully offline — no domain/signing needed to run.
#
# Usage:
#   bash scripts/install-appicon.sh /path/to/generated/xcode/project-root [AppName]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../xcode-appicon/Assets.xcassets/AppIcon.appiconset"
PROJ_ROOT="${1:-.}"
APP_NAME="${2:-Hub Trade}"

[ -d "$SRC" ] || { echo "ERROR: source AppIcon.appiconset not found at $SRC" >&2; exit 1; }

# Prefer the app target's catalog; otherwise pick the first non-extension Assets.xcassets.
DEST_CATALOG="$PROJ_ROOT/$APP_NAME/Assets.xcassets"
if [ ! -d "$DEST_CATALOG" ]; then
  DEST_CATALOG="$(find "$PROJ_ROOT" -type d -name 'Assets.xcassets' 2>/dev/null | grep -vi 'Extension' | head -1 || true)"
fi
[ -n "${DEST_CATALOG:-}" ] && [ -d "$DEST_CATALOG" ] || {
  echo "ERROR: could not find the app's Assets.xcassets under $PROJ_ROOT" >&2
  echo "Pass the project root as arg 1 (and the app name as arg 2)." >&2
  exit 2
}

mkdir -p "$DEST_CATALOG/AppIcon.appiconset"
cp "$SRC"/* "$DEST_CATALOG/AppIcon.appiconset/"
echo "✓ Installed AppIcon.appiconset -> $DEST_CATALOG/AppIcon.appiconset"
echo ""
echo "Then in Xcode (app target):"
echo "  • Build Settings ▸ 'Asset Catalog App Icon Set Name' = AppIcon"
echo "  • General ▸ App Icons and Launch Screen: App Icon Source = AppIcon"
echo "  • Product ▸ Clean Build Folder, then re-Archive and Distribute."
