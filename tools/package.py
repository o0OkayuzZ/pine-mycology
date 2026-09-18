#!/usr/bin/env python3
"""Pack only actual runtime files into mcaddon; keep docs and art sources separate."""
from pathlib import Path
import json,zipfile,io,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent
RUNTIME_NAME='Pinene_Mycology_Test_v1.2.0-handoff.mcaddon'
HANDOFF_NAME='Pinene_Mycology_Codex_v1.2.0-handoff.zip'
def zipbytes(folder):
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p in sorted(folder.rglob('*')):
   if p.is_file():z.write(p,p.relative_to(folder).as_posix())
 return out.getvalue()
bp=zipbytes(ROOT/'pack/BP');rp=zipbytes(ROOT/'pack/RP')
with zipfile.ZipFile(OUT/RUNTIME_NAME,'w',zipfile.ZIP_STORED) as z:
 z.writestr('Pinene_Mycology_BP.mcpack',bp);z.writestr('Pinene_Mycology_RP.mcpack',rp)
raw=sum(p.stat().st_size for p in (ROOT/'pack').rglob('*') if p.is_file())
sizes={'runtimeRawBytes':raw,'bpMcpackBytes':len(bp),'rpMcpackBytes':len(rp),'mcaddonBytes':(OUT/RUNTIME_NAME).stat().st_size,'mcaddonFile':RUNTIME_NAME,'note':'The handoff ZIP also contains docs, tests, sources and previews. The mcaddon contains only runtime packs. Self-referential handoff ZIP size is not embedded here.'}
(ROOT/'data/package_sizes.json').write_text(json.dumps(sizes,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
checks=[]
for p in sorted(ROOT.rglob('*')):
 if p.is_file() and p.name!='SHA256SUMS.txt' and '__pycache__' not in p.parts:
  checks.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(ROOT).as_posix())
(ROOT/'SHA256SUMS.txt').write_text('\n'.join(checks)+'\n',encoding='utf8')
with zipfile.ZipFile(OUT/HANDOFF_NAME,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(ROOT.rglob('*')):
  if p.is_file() and '__pycache__' not in p.parts:z.write(p,ROOT.name+'/'+p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(OUT/HANDOFF_NAME) as z:assert z.testzip() is None
with zipfile.ZipFile(OUT/RUNTIME_NAME) as z:
 assert z.testzip() is None
 for name in z.namelist():
  with zipfile.ZipFile(io.BytesIO(z.read(name))) as pack:
   assert 'manifest.json' in pack.namelist() and pack.testzip() is None
   assert not any('reference/' in n or 'previews/' in n or n.endswith(('.ttf','.otf','.ttc')) for n in pack.namelist())
sizes['handoffZipBytes']=(OUT/HANDOFF_NAME).stat().st_size
sizes['handoffZipSHA256']=hashlib.sha256((OUT/HANDOFF_NAME).read_bytes()).hexdigest()
sizes['mcaddonSHA256']=hashlib.sha256((OUT/RUNTIME_NAME).read_bytes()).hexdigest()
(OUT/'Pinene_Mycology_Download_Info.json').write_text(json.dumps(sizes,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(sizes,ensure_ascii=False,indent=2))
