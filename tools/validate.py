#!/usr/bin/env python3
"""Static consistency + pure and mocked-engine tests. Not an official Bedrock validator."""
from pathlib import Path
import json,subprocess,re,sys,hashlib,datetime
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];BP=ROOT/'pack/BP';RP=ROOT/'pack/RP'
checks=[]
def ok(name,condition=True):
 if not condition: raise AssertionError(name)
 checks.append(name)
def load(p):return json.loads(p.read_text(encoding='utf8'))
for p in ROOT.rglob('*.json'):load(p)
ok('All JSON files parse as UTF-8 JSON')
import jsonschema
jsonschema.validate(load(ROOT/'data/mushrooms.json'),load(ROOT/'data/mushrooms.schema.json'))
ok('Authoring JSON passes project schema (not official Mojang schema)')
E=load(ROOT/'data/mushrooms.json')['mushrooms'];S=load(ROOT/'data/sources.json')
ok('35 registry entries',len(E)==35)
ok('15 red, 20 brown',sum(e['group']=='red' for e in E)==15 and sum(e['group']=='brown' for e in E)==20)
for field in ['id','itemId','textureKey']:ok('Unique '+field,len({e[field] for e in E})==35)
T=load(RP/'textures/item_texture.json')['texture_data']
ok('Texture index has 35 mushroom keys and field guide',set(T)=={e['textureKey'] for e in E}|{'pinene_myco_field_guide'})
for e in E:
 k=e['id'].lower();p=RP/(e['texturePath']+'.png');im=Image.open(p)
 ok(e['id']+' is a real 32x32 RGBA PNG',im.size==(32,32) and im.mode=='RGBA')
 al=set(im.getchannel('A').tobytes());ok(e['id']+' binary transparency',al=={0,255})
 item=load(BP/f'items/mycology/{k}.json')['minecraft:item'];c=item['components']
 ok(e['id']+' item/texture linkage',item['description']['identifier']==e['itemId'] and c['minecraft:icon']['textures']['default']==e['textureKey'] and T[e['textureKey']]['textures']==e['texturePath'])
 ok(e['id']+' source references resolve',all(s in S for s in e['sourceIds']))
 ok(e['id']+' stable ordinal',e['indexInGroup']==int(e['id'][1:])-1)
 ok(e['id']+' food mode consistent',('minecraft:food' in c)==(e['useMode']=='eat'))
 if e['useMode']!='specimen':ok(e['id']+' shared cooldown',c['minecraft:cooldown']=={'category':'pinene_mushroom','duration':4})
for locale in ['en_US','ja_JP']:
 lines=(RP/f'texts/{locale}.lang').read_text(encoding='utf8').splitlines();keys=[s.split('=',1)[0] for s in lines if s and not s.startswith('#')]
 ok(locale+' no duplicate keys',len(keys)==len(set(keys)))
 for e in E:
  for suffix in ['name','science','game','joke']:ok(f'{locale} {e["id"]} {suffix}',f'myco.{e["id"].lower()}.{suffix}' in keys)
geo=load(RP/'models/entity/mushroom_appraiser.geo.json')['minecraft:geometry'][0];bones=geo['bones'];names={b['name'] for b in bones};desc=geo['description']
ok('Unique bones',len(names)==len(bones));ok('45 cubes / 12 bones',sum(len(b.get('cubes',[])) for b in bones)==45 and len(bones)==12)
atlas=Image.open(RP/'textures/entity/mycology/mushroom_appraiser.png');ok('128x128 actual atlas',atlas.size==(128,128))
occupied=set();rectcount=0
for b in bones:
 ok('Bone parent exists: '+b['name'],not b.get('parent') or b['parent'] in names)
 for c in b.get('cubes',[]):
  ok('Six UV faces',set(c['uv'])=={'north','south','east','west','up','down'})
  for f,v in c['uv'].items():
   x,y=v['uv'];w,h=v['uv_size'];ok('UV bounds',0<=x and 0<=y and x+w<=128 and y+h<=128 and w>0 and h>0)
   cells={(xx,yy) for yy in range(y,y+h) for xx in range(x,x+w)}
   ok('UV no overlap',occupied.isdisjoint(cells));occupied.update(cells);rectcount+=1
ok('270 explicit UV rectangles',rectcount==270)
for b in bones:
 visited=set();cur=b
 while cur.get('parent'):
  ok('Acyclic bone graph',cur['name'] not in visited);visited.add(cur['name']);cur=next(x for x in bones if x['name']==cur['parent'])
ani=load(RP/'animations/mushroom_appraiser.animation.json')['animations']
for a in ani.values():ok('Animation bones resolve',set(a['bones']).issubset(names))
ce=load(RP/'entity/mushroom_appraiser.entity.json')['minecraft:client_entity']['description']
ok('Client geometry resolves',ce['geometry']['default']==desc['identifier'])
ok('Client animations resolve',set(ce['animations'].values()).issubset(ani))
for path in ce['textures'].values():ok('Client texture exists',(RP/(path+'.png')).exists())
rc=load(RP/'render_controllers/mushroom_appraiser.render_controllers.json')['render_controllers'];ok('Render controller resolves',set(ce['render_controllers']).issubset(rc))
ids=[]
for side in [BP,RP]:
 m=load(side/'manifest.json');ids += [m['header']['uuid']]+[x['uuid'] for x in m['modules']]
ok('Standalone manifest UUIDs unique',len(ids)==len(set(ids)))
for p in BP.rglob('*.js'):
 r=subprocess.run(['node','--check',str(p)],capture_output=True,text=True);ok('JS syntax '+p.name,r.returncode==0)
 for rel in re.findall(r"from\s+['\"](\.[^'\"]+)['\"]|import\s+['\"](\.[^'\"]+)['\"]",p.read_text()):
  path=rel[0] or rel[1];ok('Relative JS import resolves: '+path,(p.parent/path).exists())
for forbidden in ['*.ttf','*.otf','*.ttc']:
 ok('No redistributed fonts '+forbidden,not list(ROOT.rglob(forbidden)))
report=[];passed=0
for command in [['node','--test','tests/core.test.mjs'],['node','--experimental-loader','./tests/mock-loader.mjs','--test','tests/adapters.test.mjs'],['node','--experimental-loader','./tests/mock-loader.mjs','--test','tests/field-guide.test.mjs']]:
 r=subprocess.run(command,cwd=ROOT,capture_output=True,text=True);report.append('$ '+' '.join(command)+'\n'+r.stdout+r.stderr)
 ok('Node tests pass: '+command[-1],r.returncode==0)
 passed+=sum(int(x) for x in re.findall(r'^# pass (\d+)',r.stdout,re.M))
(ROOT/'docs/TEST_OUTPUT.txt').write_text('\n'.join(report),encoding='utf8')
# Check generated runtime content matches the authoring data without importing any engine modules.
r=subprocess.run(['node','--input-type=module','-e',"import {MUSHROOMS} from './pack/BP/scripts/mycology/registry.js';console.log(JSON.stringify(MUSHROOMS));"],cwd=ROOT,capture_output=True,text=True,check=True)
runtime=json.loads(r.stdout)
for a,b in zip(E,runtime):
 for k,v in b.items():ok('Generated registry matches '+a['id']+' '+k,a[k]==v)
ok('No forgotten runtime entries',len(runtime)==len(E))
raw_bp=sum(p.stat().st_size for p in BP.rglob('*') if p.is_file());raw_rp=sum(p.stat().st_size for p in RP.rglob('*') if p.is_file())
pngbytes=sum(p.stat().st_size for p in RP.rglob('*.png'))
summary={'date':'2026-09-10','status':'static_and_mock_tests_passed_engine_untested','assertionsPassed':len(checks),'nodeTestsPassed':passed,'registryEntries':35,'redWeightSum':sum(2**(10-e['rarity']) for e in E if e['group']=='red'),'brownWeightSum':sum(2**(10-e['rarity']) for e in E if e['group']=='brown'),'npcCubes':45,'npcBones':12,'npcAtlas':[128,128],'uvRectangles':270,'runtimeFiles':sum(1 for p in (ROOT/'pack').rglob('*') if p.is_file()),'rawBPBytes':raw_bp,'rawRPBytes':raw_rp,'runtimeRawBytes':raw_bp+raw_rp,'rpPNGBytes':pngbytes,'bedrockEngineExecuted':False,'officialTypesChecked':False,'officialSchemasChecked':False}
(ROOT/'data/validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
lines=['# 検証レポート','',f'実行日：2026-09-10。**自動テスト {passed}件 合格。Bedrock実機テストは未実施。**','',f'内部整合チェック：{len(checks)}アサーション合格。これは公式スキーマの全検証件数ではありません。','',
'## 確認できたこと','', '- 全JSONの構文、35種のID・画像・ローカライズ参照、JS構文と相対import。','- 赤2899・茶3183の全整数チケットを列挙し、各種の割当数がウェイトに一致。','- 1〜64個の保存則、最初の既存スタックだけ消費、余剰集約、別メタデータを保護。','- 30bit分割・追加種の非干渉、旧進捗移行、破損データの勝手な初期化を拒否。','- 模擬APIで一括鑑定、書込例外のロールバック、出力失敗の再配布、曖昧な記録の停止。','- 模擬APIで遅延毒保存、再摂取の先送り禁止、牛乳による保留取消、R06の固定コスト。','- 模擬APIで自然死亡64＋64・再通知二重出力なし、管理個体0、古いtoken退場、期限猶予。','- NPC45 cubes / 12 bones、270 UV矩形が128×128内で重複なし。アニメーションbone参照も存在。','- 実際のgeometry/UVからプレビューを作成し、目視確認。全35アイコンの一覧も目視確認。','',
'## 未確認','', '- Bedrockクライアント／サーバーによるJSONロード、Molangの実行、3Dのゲーム内表示・可動。','- コントローラー／タッチ／キーボードでのフォーム実動。','- NPC死亡時のentityアクセス、チャンク再読込と再起動の実際のイベント順。','- ネイティブ食品消費・共通クールダウン・牛乳完了イベント。','- TPS、CPU、RAM、通信遅延。ファイルサイズと実行負荷を同一視しない。','- @minecraft/server2.7.0公式型定義を使った型検査。取得用ネットワークが利用できず未実施。','',
'## 容量（圧縮前・ファイル内容の合計）','', f'- BP：{raw_bp:,} bytes',f'- RP：{raw_rp:,} bytes',f'- 実行用合計：{raw_bp+raw_rp:,} bytes',f'- RP内のPNG全体：{pngbytes:,} bytes','', 'ZIP／mcaddonの圧縮後容量は `data/package_sizes.json` を参照。資料やプレビューのサイズをサーバー導入量に足さない。','',
'## 判定','', '**Codexへの統合・実機確認に渡せる実装候補。無確認での本番投入を承認するレポートではない。**', '自動テストの生ログは `TEST_OUTPUT.txt`、実機項目は `ACCEPTANCE_TESTS.md`。']
(ROOT/'docs/VALIDATION_REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
