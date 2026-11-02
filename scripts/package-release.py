"""Package tracked project files and the separately labelled rehearsal video."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root.parent
paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
paths = [name for name in paths if name and (root / name).is_file()]
if not paths:
    raise SystemExit("Stage the reviewed source files before packaging.")

source = destination / "PARALLAX_SOURCE.zip"
delivery = destination / "PARALLAX_ENTREGA.zip"
movie = root / "video" / "PARALLAX-demo-rehearsal-narrated.mp4"

def package(target, include_movie):
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name in paths:
            archive.write(root / name, "parallax/" + name)
        if include_movie:
            if not movie.is_file():
                raise SystemExit("The narrated rehearsal has not been exported.")
            archive.write(movie, "parallax/video/" + movie.name)
        manifest = {
            "files": len(paths),
            "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip(),
            "rehearsal_video_included": include_movie,
            "contest_submission_confirmed": False,
            "pending": ["real Twitch verification and footage", "authentic Codex screen footage", "repository publication", "YouTube upload", "Devpost submitted confirmation"],
        }
        archive.writestr("DELIVERY_MANIFEST.json", json.dumps(manifest, indent=2))
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity verification failed.")
    print(json.dumps({"file": str(target), "bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}))

package(source, False)
package(delivery, True)
