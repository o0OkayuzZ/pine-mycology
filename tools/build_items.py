"""Copy approved 32x32 icons verbatim; never fall back to legacy artwork."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def sync_icons(root=ROOT):
    manifest = json.loads((root / 'docs/texture_v1.4/asset_manifest.json').read_text(encoding='utf8'))
    registry = json.loads((root / 'data/mushrooms.json').read_text(encoding='utf8'))['mushrooms']
    expected = {entry['id'].lower() + '.png' for entry in registry}
    source = root / 'reference/final_32x32'
    assert len(manifest) == len(expected) == 35
    assert {entry['id'].lower() + '.png' for entry in manifest} == expected
    assert {p.name for p in source.glob('*.png')} == expected, 'Missing or unexpected canonical icons'
    # Validate every source before changing any output.
    for entry in manifest:
        path = source / (entry['id'].lower() + '.png')
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['texture_sha256'], path
        with Image.open(path) as icon:
            assert icon.size == (32, 32) and icon.mode == 'RGBA', path
            assert set(icon.getchannel('A').tobytes()) <= {0, 255}, path
    target = root / 'pack/RP/textures/items/mycology'
    target.mkdir(parents=True, exist_ok=True)
    for name in sorted(expected):
        shutil.copyfile(source / name, target / name)
    print('Copied 35 canonical v1.4 icons without re-encoding')


if __name__ == '__main__':
    sync_icons()
