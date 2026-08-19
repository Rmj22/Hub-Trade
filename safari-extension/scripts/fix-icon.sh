#!/bin/bash
# Fixes: "Build input file cannot be found: .../Hub Trade/Resources/Icon.png"
# Works entirely offline — NO custom domain, signing, or App Store account required.
#
# Usage:
#   bash scripts/fix-icon.sh /path/to/generated/Xcode/project-root [AppName]
#   (defaults: project root = current dir, AppName = "Hub Trade")
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../icons/Icon.png"
PROJ_ROOT="${1:-.}"
APP_NAME="${2:-Hub Trade}"

if [ ! -f "$SRC" ]; then
  echo "ERROR: source icon not found at $SRC" >&2
  exit 1
fi

copied=0

# 1) Place the loose Icon.png exactly where the build phase expects it.
DEST_DIR="$PROJ_ROOT/$APP_NAME/Resources"
mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_DIR/Icon.png"
echo "✓ Copied Icon.png -> $DEST_DIR/Icon.png"
copied=1

# 2) Belt-and-suspenders: satisfy any other 'Resources/Icon.png' references in the project.
while IFS= read -r res; do
  if [ ! -f "$res/Icon.png" ]; then
    cp "$SRC" "$res/Icon.png"
    echo "✓ Copied Icon.png -> $res/Icon.png"
    copied=1
  fi
done < <(find "$PROJ_ROOT" -type d -name Resources 2>/dev/null)

echo ""
echo "Done. Now in Xcode: Product ▸ Clean Build Folder (⇧⌘K), then Build (⌘B)."
echo "If Xcode still lists a RED (missing) Icon.png, it is now present on disk — just re-add it to the target's 'Copy Bundle Resources' or delete the stale reference."
[ "$copied" -eq 1 ] || { echo "No Resources folder found under $PROJ_ROOT — pass the project root as the first argument." >&2; exit 2; }
