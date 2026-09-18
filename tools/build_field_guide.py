"""Build the portable guide without modifying the 35 mushroom definitions."""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]


def sync_guide_texture(root=ROOT):
    target = root / 'pack/RP/textures/items/mycology_tools/field_guide.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / 'reference/field_guide/field_guide.png', target)


def build_guide(root=ROOT):
    bp, rp = root / 'pack/BP', root / 'pack/RP'
    def save(path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    save(bp / 'items/mycology_tools/field_guide.json', {
        'format_version': '1.21.90',
        'minecraft:item': {
            'description': {'identifier': 'pinene:mushroom_field_guide', 'menu_category': {'category': 'items'}},
            'components': {
                'minecraft:display_name': {'value': 'myco.field_guide.name'},
                'minecraft:icon': {'textures': {'default': 'pinene_myco_field_guide'}},
                'minecraft:max_stack_size': 1,
                'pinene:myco_field_guide': {}
            }
        }
    })
    save(bp / 'recipes/mycology_field_guide.json', {
        'format_version': '1.20.10',
        'minecraft:recipe_shapeless': {
            'description': {'identifier': 'pinene:mycology_field_guide'},
            'tags': ['crafting_table'],
            'unlock': [{'item': 'minecraft:book'}],
            'ingredients': [{'item': 'minecraft:book'}, {'item': 'minecraft:red_mushroom'}, {'item': 'minecraft:brown_mushroom'}],
            'result': {'item': 'pinene:mushroom_field_guide', 'count': 1}
        }
    })
    atlas_path = rp / 'textures/item_texture.json'
    atlas = json.loads(atlas_path.read_text(encoding='utf8'))
    atlas['texture_data']['pinene_myco_field_guide'] = {'textures': 'textures/items/mycology_tools/field_guide'}
    save(atlas_path, atlas)
    for locale, name in [('ja_JP', 'キノコ図鑑'), ('en_US', 'Mushroom Field Guide')]:
        path = rp / f'texts/{locale}.lang'
        lines = [line for line in path.read_text(encoding='utf8').splitlines() if not line.startswith('myco.field_guide.name=')]
        path.write_text('\n'.join(lines)+f'\nmyco.field_guide.name={name}\n', encoding='utf8')
    sync_guide_texture(root)


if __name__ == '__main__':
    build_guide()
