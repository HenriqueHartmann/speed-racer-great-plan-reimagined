#!/usr/bin/env bash
#
# Regenerate public/models/mach5.glb from the original artifact.
#
# The chain is: original .dcr -> XMED chunk -> macromelt -> glTF 2.0.
#
# macromelt (https://github.com/Dilaz/macromelt, Apache-2.0) decodes Director's
# Shockwave 3D cast members, including the arithmetic-coded CLOD geometry our
# own reader does not. It is source-available, runs locally, needs no Director
# and touches no copy-protection mechanism, which is why it is the one
# third-party decoder this project uses.
#
# The revision is pinned. Do not build from main without re-auditing.
#
# Usage:  tools/extract_mesh.sh [output-dir]

set -euo pipefail

MACROMELT_REPO="https://github.com/Dilaz/macromelt.git"
MACROMELT_REV="78f1ad6c5e8ce8b4f9a36dd1a25ca8682f3976e6"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT="$ROOT/Speed Racer Demon on Wheels The Great Plan Full"
OUT="${1:-$ROOT/public/models}"
WORK="${TMPDIR:-/tmp}/speedracer-mesh"

if [[ ! -d "$ARTIFACT" ]]; then
  echo "error: original artifact directory not found at:" >&2
  echo "  $ARTIFACT" >&2
  echo "See docs/research/artifact-inventory.md." >&2
  exit 1
fi

command -v cargo >/dev/null || {
  echo "error: cargo not found. Install a Rust toolchain (1.85+) first." >&2
  exit 1
}

mkdir -p "$WORK" "$OUT"

# 1. Build the decoder at the pinned revision.
if [[ ! -x "$WORK/macromelt/target/release/macromelt" ]]; then
  echo "==> building macromelt at $MACROMELT_REV"
  rm -rf "$WORK/macromelt"
  git clone --quiet "$MACROMELT_REPO" "$WORK/macromelt"
  git -C "$WORK/macromelt" checkout --quiet "$MACROMELT_REV"
  ( cd "$WORK/macromelt" && cargo build --release --locked )
fi
MACROMELT="$WORK/macromelt/target/release/macromelt"

# 2. Pull the XMED chunks out of the movie.
#
# The whole chunk is needed, 3DEM header included - macromelt parses that
# header. Our own tools/extract_dcr.py strips it, which is right for the IFX
# reader and wrong here.
echo "==> extracting XMED chunks"
python3 - "$ARTIFACT" "$WORK/xmed" <<'PY'
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path.cwd() / 'tools'))
from extract_dcr import AfterburnerMovie

artifact, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for movie in ['SR_level_1', 'SR_MAIN']:
    src = artifact / f'{movie}.dcr'
    mv = AfterburnerMovie(src.read_bytes(), src.name)
    for res in mv.resources:
        if res['tag'] != 'XMED':
            continue
        data = mv.payload(res)
        if data[:4] != b'3DEM':
            continue
        (out / f"{movie}_{res['id']}.xmed").write_bytes(data)
        print(f"   {movie}_{res['id']}.xmed  {len(data)} bytes")
PY

# 3. Decode the Mach 5. Resource 7589 of SR_level_1 is the player's car;
#    docs/research/asset-catalog.md lists what the other resources are.
echo "==> decoding the Mach 5"
"$MACROMELT" "$WORK/xmed/SR_level_1_7589.xmed" --export-glb "$OUT/mach5.glb"

# 4. Decode the track. Resource 7587 is the level: 760 models, of which the 37
#    named SEG_1..SEG_37 are the drivable surface.
echo "==> decoding the track"
"$MACROMELT" "$WORK/xmed/SR_level_1_7587.xmed" --export-glb "$OUT/track.glb"

# 5. Reduce it to the ground data the simulation reads. The renderer uses the
#    .glb; src/sim/ must never need a glTF loader.
echo "==> building the ground data"
node "$ROOT/tools/build_track_ground.mjs" "$OUT/track.glb" "$OUT/track-ground.bin"

echo
echo "wrote:"
sha256sum "$OUT/mach5.glb" "$OUT/track.glb" "$OUT/track-ground.bin"
