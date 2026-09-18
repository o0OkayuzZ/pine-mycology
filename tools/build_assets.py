#!/usr/bin/env python3
"""Deterministic, editable pixel/UV sources. Pillow required; no image services.
Builds actual Bedrock geometry and texture; previews render that same mesh.
"""
from pathlib import Path
import json, math, random, sys
from build_items import sync_icons
# Validate canonical artwork before generating any assets.
sync_icons()
from build_field_guide import sync_guide_texture
sync_guide_texture()
if "--items-only" in sys.argv:
    raise SystemExit(0)
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
RP=ROOT/'pack/RP'
for p in ['textures/entity/mycology','models/entity','entity','animations','render_controllers','textures/items/mycology','textures/ui/mycology']:
    (RP/p).mkdir(parents=True,exist_ok=True)
def dump(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
PALETTES={
 'skin':['#79523b','#956449','#ad7e5d','#c2926b'],
 'robe':['#867355','#a18d6a','#b8a17b','#d0bb92'],
 'cream':['#9d8866','#bca57d','#d7c19b','#e8d5b1'],
 'red':['#752c2a','#963730','#b54837','#ce5c45'],
 'leather':['#3e2b21','#543927','#6b4930','#815d3c'],
 'boot':['#30271f','#433126','#5b412a','#735032'],
 'shirt':['#332c2c','#403534','#534440','#65524a'],
 'glass':['#426571','#668b94','#8fb4ba','#c2d8d3'],
 'paper':['#988265','#b9a27d','#d3be98','#e4d3b0'],
 'gold':['#806139','#a28248','#c2a36a','#d9c18a']}
def tex(w,h,kind,seed,face='north',motif=None):
    rng=random.Random(seed)
    im=Image.new('RGBA',(w,h)); d=ImageDraw.Draw(im); pal=PALETTES[kind]
    for y in range(h):
        for x in range(w):
            v=rng.choices([0,1,2,3],[5,30,53,12])[0]
            if x==w-1: v=max(0,v-1)
            im.putpixel((x,y), tuple(bytes.fromhex(pal[v][1:]))+(255,))
    if kind=='red' and w>=4 and h>=3:
        for x,y in [(max(1,w//4),1),(max(1,w*3//4),h//2),(w//3,max(1,h-3))]:
            d.rectangle((x,y,min(w-1,x+1),min(h-1,y+1)),fill='#decba6')
    if motif=='face' and face=='north':
        d.rectangle((0,0,w-1,1),fill='#60422f')
        d.rectangle((0,3,w-1,3),fill='#352b25')
        for x in [1,w-3]:
            d.rectangle((x,4,x+1,4),fill='#eee1be')
            d.point((x if x==1 else x+1,4),fill='#42703c')
        d.rectangle((1,h-3,w-2,h-1),fill='#423533')
        d.rectangle((2,h-2,w-3,h-1),fill='#55413b')
    if motif in ('coat','sleeve') and face in ('north','south','east','west'):
        d.rectangle((0,h-2,w-1,h-1),fill='#6e4c38')
        if w>=6 and h>=7:
            cx=w//2; cy=h-5
            d.rectangle((cx-2,cy,cx+2,cy+1),fill='#a13f35')
            d.rectangle((cx-1,cy-1,cx+1,cy),fill='#b34b3c')
            d.rectangle((cx,cy+2,cx,cy+3),fill='#735038')
    if motif=='torso' and face=='north':
        d.rectangle((w//2-1,0,w//2+1,h-1),fill='#503832')
        d.line((0,0,w-1,h-3),fill='#725033',width=2)
        d.rectangle((w//2,4,w//2+1,5),fill='#c5a56a')
        d.rectangle((0,h-3,w-1,h-2),fill='#60452d')
    if motif=='pack' and face=='south':
        d.rectangle((0,0,w-1,2),fill='#886340')
        for x in [1,w-3]:
            d.rectangle((x,0,x+1,h-1),fill='#39291f')
            d.rectangle((x,3,x+1,4),fill='#c4a267')
        d.rectangle((3,5,w-3,h-2),outline='#36291f',fill='#755132')
    if motif=='book' and face=='north':
        d.rectangle((0,0,w-1,h-1),outline='#39251e')
        if w>=3 and h>=4:
            d.rectangle((1,1,w-2,2),fill='#b34938');d.point((w//2,3),fill='#e4ceb0')
    if motif=='tag' and face in ('north','south'):
        d.point((w//2,0),fill='#63472e')
        if w>=3 and h>=4:
            d.rectangle((0,2,w-1,2),fill='#983d32');d.point((w//2,3),fill='#983d32')
    if motif=='vial' and face in ('north','south','east','west'):
        d.line((0,1,0,h-2),fill='#dae6d5')
        d.rectangle((1,h-3,w-1,h-2),fill='#a94330')
    return im
bones=[]; cubesmeta=[]
def bone(name,parent=None,pivot=(0,0,0)):
    b={'name':name,'pivot':list(pivot)}
    if parent:b['parent']=parent
    b['cubes']=[];bones.append(b);return b
root=bone('root');body=bone('body','root',(0,12,0));head=bone('head','body',(0,24,0))
la=bone('left_arm','body',(6,22,0));ra=bone('right_arm','body',(-6,22,0))
ll=bone('left_leg','root',(2,12,0));rl=bone('right_leg','root',(-2,12,0))
pack=bone('backpack','body',(0,22,4));book=bone('field_book','left_arm',(6,17,-3))
hood=bone('hood','head',(0,24,0));acc=bone('accessories','body',(0,16,0))
def cube(b,name,o,s,kind,motif=None):
    c={'origin':list(o),'size':list(s),'uv':{}}
    b['cubes'].append(c);cubesmeta.append({'name':name,'bone':b['name'],'cube':c,'kind':kind,'motif':motif})
cube(body,'torso',(-4,12,-3),(8,12,6),'robe','torso')
cube(body,'robe_skirt',(-4.5,5,-3.5),(9,8,7),'robe','coat')
cube(body,'front_scarf',(-1,6,-3.65),(2,13,.4),'red')
cube(head,'head',(-4,24,-4),(8,10,8),'skin','face')
cube(head,'nose',(-1,26,-6),(2,4,2),'skin')
cube(head,'beard',(-2,24,-4.5),(4,2,.6),'shirt')
for b,x in [(ll,0),(rl,-4)]:
    cube(b,b['name']+'_leg',(x,2,-2),(4,10,4),'shirt')
    cube(b,b['name']+'_boot',(x-.15,0,-2.5),(4.3,3,5),'boot')
for b,x in [(la,4),(ra,-8)]:
    cube(b,b['name']+'_sleeve',(x,15,-2),(4,8,4),'robe','sleeve')
    cube(b,b['name']+'_glove',(x,12,-2),(4,3,4),'leather')
# Open-faced hood. No opaque face-covering outer cube.
cube(hood,'hood_top',(-5,34,-5),(10,1,10),'red')
cube(hood,'hood_back',(-5,24,4),(10,10,1),'red')
cube(hood,'hood_left',(4,24,-4),(1,10,8),'red')
cube(hood,'hood_right',(-5,24,-4),(1,10,8),'red')
cube(hood,'hood_brow',(-5,32,-5),(10,2,1),'red')
cube(hood,'hood_trim_top',(-5,31,-5.1),(10,1,1.1),'cream')
cube(hood,'hood_trim_left',(4,24,-5.1),(1,7,1.1),'cream')
cube(hood,'hood_trim_right',(-5,24,-5.1),(1,7,1.1),'cream')
cube(hood,'hood_hem',(-5,23.5,3.9),(10,1,1.2),'cream')
cube(pack,'satchel',(-5,12,3),(10,12,4),'leather','pack')
cube(pack,'satchel_flap',(-5.2,21,3.1),(10.4,3,4.2),'leather')
cube(pack,'bedroll',(-5,24,3.4),(10,3,3),'cream')
for x in [-3.2,2.2]:cube(pack,'bedroll_strap_'+str(x),(x,23.9,3.3),(1,3.2,3.2),'leather')
cube(pack,'rear_label',(-1.8,15,7.15),(3,5,.35),'paper','tag')
cube(pack,'vial',(-7,15,4),(2,4,2),'glass','vial')
cube(pack,'vial_cork',(-6.7,19,4.3),(1.4,1,1.4),'leather')
cube(pack,'bag_mushroom_cap',(2.5,18.8,7),(3,1.5,1.5),'red')
cube(pack,'bag_mushroom_stem',(3.5,17,7.1),(1,2,1),'cream')
cube(acc,'belt_pouch',(-5.3,12,-3.3),(3,4,2),'leather')
cube(acc,'pouch_label',(-4.5,12.5,-3.5),(2,3,.3),'paper','tag')
cube(acc,'brooch_cap',(2,21,-3.5),(2.5,1.5,1),'red')
cube(acc,'brooch_stem',(2.8,20,-3.5),(1,1,1),'cream')
cube(book,'notebook',(4,14,-3.2),(4,6,1),'leather','book')
cube(book,'notebook_pages',(7.8,14.4,-3.1),(.25,5.2,.8),'paper')
lens=bone('magnifier','right_arm',(-6,14,-3))
cube(lens,'lens_handle',(-6.5,12,-3.8),(1,5,1),'leather')
cube(lens,'lens_top',(-8,20,-3.9),(4,1,.7),'gold')
cube(lens,'lens_bottom',(-8,16,-3.9),(4,1,.7),'gold')
cube(lens,'lens_left',(-8,17,-3.9),(1,3,.7),'gold')
cube(lens,'lens_right',(-5,17,-3.9),(1,3,.7),'gold')
cube(lens,'lens_glass',(-7,17,-3.8),(2,3,.3),'glass')
# Explicit per-face UVs; coordinates in pixels, no inferred projection.
faces=[]
for i,m in enumerate(cubesmeta):
    w,h,d=m['cube']['size']
    for face,a,b in [('north',w,h),('south',w,h),('east',d,h),('west',d,h),('up',w,d),('down',w,d)]:
        tw,th=max(1,math.ceil(a)),max(1,math.ceil(b))
        im=tex(tw,th,m['kind'],i*31+len(face)*7,face,m['motif'])
        faces.append({'m':m,'face':face,'image':im,'w':tw,'h':th})
# Shelf pack (large cells first) with a one-pixel gutter.
atlas=Image.new('RGBA',(128,128),(0,0,0,0));x=y=rowh=0;uvmap=[]
for f in sorted(faces,key=lambda f:(-f['h'],-f['w'])):
    w,h=f['w'],f['h']
    if x+w+1>128:x=0;y+=rowh;rowh=0
    if y+h+1>128:raise ValueError('UV atlas overflow')
    atlas.paste(f['image'],(x,y));f['m']['cube']['uv'][f['face']]={'uv':[x,y],'uv_size':[w,h]}
    uvmap.append({'cube':f['m']['name'],'bone':f['m']['bone'],'face':f['face'],'rect':[x,y,w,h]})
    x+=w+1;rowh=max(rowh,h+1)
atlas.save(RP/'textures/entity/mycology/mushroom_appraiser.png',optimize=True)
geometry={'format_version':'1.12.0','minecraft:geometry':[{'description':{'identifier':'geometry.pinene.mushroom_appraiser','texture_width':128,'texture_height':128,'visible_bounds_width':3,'visible_bounds_height':3,'visible_bounds_offset':[0,1.2,0]},'bones':bones}]}
dump(RP/'models/entity/mushroom_appraiser.geo.json',geometry)
dump(ROOT/'data/npc_uv_map.json',{'texture_size':[128,128],'cube_count':len(cubesmeta),'faces':uvmap})
dump(RP/'entity/mushroom_appraiser.entity.json',{'format_version':'1.10.0','minecraft:client_entity':{'description':{
 'identifier':'pinene:mushroom_appraiser','materials':{'default':'entity_alphatest'},
 'textures':{'default':'textures/entity/mycology/mushroom_appraiser'},
 'geometry':{'default':'geometry.pinene.mushroom_appraiser'},
 'animations':{'walk':'animation.pinene.myco.walk','look':'animation.pinene.myco.look'},
 'scripts':{'animate':['walk','look']},'render_controllers':['controller.render.pinene.myco'],
 'spawn_egg':{'base_color':'#A84035','overlay_color':'#D9C59F'}}}})
dump(RP/'render_controllers/mushroom_appraiser.render_controllers.json',{'format_version':'1.8.0','render_controllers':{'controller.render.pinene.myco':{'geometry':'Geometry.default','materials':[{'*':'Material.default'}],'textures':['Texture.default']}}})
dump(RP/'animations/mushroom_appraiser.animation.json',{'format_version':'1.8.0','animations':{
 'animation.pinene.myco.walk':{'loop':True,'bones':{
 'left_leg':{'rotation':['math.cos(query.modified_distance_moved * 38.17) * math.min(query.modified_move_speed, 0.5) * 65',0,0]},
 'right_leg':{'rotation':['-math.cos(query.modified_distance_moved * 38.17) * math.min(query.modified_move_speed, 0.5) * 65',0,0]},
 'left_arm':{'rotation':['-math.cos(query.modified_distance_moved * 38.17) * math.min(query.modified_move_speed, 0.5) * 18',0,0]},
 'right_arm':{'rotation':['math.cos(query.modified_distance_moved * 38.17) * math.min(query.modified_move_speed, 0.5) * 25',0,0]}}},
 'animation.pinene.myco.look':{'loop':True,'bones':{'head':{'rotation':['math.clamp(query.target_x_rotation, -25, 25)','math.clamp(query.target_y_rotation, -45, 45)',0]}}}}})
# Software orthographic renderer of the actual textured cubes, not a concept mockup.
def render(yaw,elev=12,size=(400,600),scale=14):
    ya,el=map(math.radians,[yaw,elev]);Y=np.array([[math.cos(ya),0,math.sin(ya)],[0,1,0],[-math.sin(ya),0,math.cos(ya)]])
    E=np.array([[1,0,0],[0,math.cos(el),math.sin(el)],[0,-math.sin(el),math.cos(el)]]);M=E@Y
    W,H=size;canvas=Image.new('RGBA',size,(0,0,0,0));draw=ImageDraw.Draw(canvas);polys=[]
    for m in cubesmeta:
        x,y,z=m['cube']['origin'];w,h,d=m['cube']['size']
        fdata={
         'north':([x+w,y+h,z],[-w,0,0],[0,-h,0],[0,0,-1]),
         'south':([x,y+h,z+d],[w,0,0],[0,-h,0],[0,0,1]),
         'east':([x+w,y+h,z+d],[0,0,-d],[0,-h,0],[1,0,0]),
         'west':([x,y+h,z],[0,0,d],[0,-h,0],[-1,0,0]),
         'up':([x,y+h,z],[w,0,0],[0,0,d],[0,1,0]),
         'down':([x,y,z+d],[w,0,0],[0,0,-d],[0,-1,0])}
        for face,(o,u,v,n) in fdata.items():
            if (M@np.array(n))[2]>=-0.001:continue
            uv=m['cube']['uv'][face];a,b=uv['uv'];tw,th=uv['uv_size']
            o,u,v=map(np.array,[o,u,v]); shade={'north':1,'south':.90,'east':.86,'west':.80,'up':1.06,'down':.65}[face]
            for j in range(th):
                for i in range(tw):
                    pts=[M@(o+u*ix/tw+v*jy/th) for ix,jy in [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]]
                    xy=[(W/2+p[0]*scale,H-45-p[1]*scale) for p in pts]
                    col=atlas.getpixel((a+i,b+j));col=tuple(min(255,int(c*shade)) for c in col[:3])+(255,)
                    polys.append((sum(p[2] for p in pts)/4,xy,col))
    for _,xy,c in sorted(polys,key=lambda p:-p[0]):draw.polygon(xy,fill=c)
    return canvas
font_path=next(str(p) for p in [Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('C:/Windows/Fonts/arial.ttf')] if p.exists())
f=ImageFont.truetype(font_path,22);f2=ImageFont.truetype(font_path,15)
preview=Image.new('RGB',(1600,710),'#efe9dd');dp=ImageDraw.Draw(preview)
dp.text((36,20),'PINENE  /  MUSHROOM APPRAISER',font=ImageFont.truetype(font_path,30),fill='#382f27')
dp.text((36, sixty:=62),'ACTUAL GEO + UV RENDER   |   128 x 128 atlas   |   lightweight Bedrock asset',font=f2,fill='#796d5d')
for idx,(yaw,label) in enumerate([(-27,'FRONT 3/4'),(0,'FRONT'),(90,'SIDE'),(180,'BACK')]):
    view=render(yaw,12 if idx in [0,3] else 0)
    preview.paste(view,(idx*400,85),view)
    dp.text((idx*400+35,675),label,font=f,fill='#4f4134')
preview.save(ROOT/'previews/NPC_actual_model.png',optimize=True)
render(-27,12,(500,650),16).save(ROOT/'previews/NPC_transparent.png',optimize=True)
atlas.resize((1024,1024),Image.Resampling.NEAREST).save(ROOT/'previews/NPC_UV_8x.png',optimize=True)
print('NPC',len(cubesmeta),'cubes',len(bones),'bones; UV',y+rowh,'of 128 rows')
# Legacy shape helper retained only for the unchanged unknown UI icon.
# IDs are canonical; old concept-sheet labels are NOT used.
RED=['#64291f','#94372c','#bc4736','#d66b44','#e9aa6b']
BROWN=['#423027','#694532','#8e6240','#b18857','#d6b987']
CREAM=['#70614a','#9c8764','#c9b18b','#e2cfaa']
GRAY=['#343234','#575052','#82736a','#ae9b87','#d0c0a6']
WHITE=['#777469','#a59f8d','#d0cbb6','#e9e2ce','#f5efd9']

def icon(kind='cap',palette=BROWN,seed=0,stem=CREAM,spots=False):
    im=Image.new('RGBA',(16,16),(0,0,0,0));rng=random.Random(seed)
    mask=Image.new('L',(16,16));dm=ImageDraw.Draw(mask)
    def fillpoly(poly,pal):
        mask.paste(0,(0,0,16,16));dm.polygon(poly,fill=255)
        for y in range(16):
            for x in range(16):
                if mask.getpixel((x,y)):
                    neighbors=[(x-1,y),(x+1,y),(x,y-1),(x,y+1)]
                    edge=any(not (0<=a<16 and 0<=b<16) or not mask.getpixel((a,b)) for a,b in neighbors)
                    k=1 if edge else (3 if x<8 and y<8 else 2)
                    if not edge:k=min(len(pal)-1,max(1,k+rng.choice([-1,0,0,0,1])))
                    if edge and (y>=12 or x>=12):k=0
                    im.putpixel((x,y),tuple(bytes.fromhex(pal[k][1:]))+(255,))
    di=ImageDraw.Draw(im)
    if kind in ['cap','point','amanita','bolete','black','slender']:
        if kind=='slender':st=[(7,7),(8,7),(9,14),(7,14)]
        elif kind=='bolete':st=[(6,7),(9,7),(11,13),(10,14),(5,14),(5,12)]
        else:st=[(6,7),(9,7),(9,14),(6,14)]
        fillpoly(st,stem)
        if kind in ['point','slender']:poly=[(7,1),(8,1),(10,4),(12,6),(14,8),(14,9),(2,9),(2,8),(4,6),(6,3)]
        else:poly=[(5,3),(10,3),(12,4),(13,6),(14,7),(14,9),(12,10),(3,10),(1,9),(1,7),(3,5)]
        if kind=='amanita':poly=[(xx,yy-2) for xx,yy in poly]
        fillpoly(poly,palette)
        if kind=='bolete':di.line((4,10,11,10),fill='#c6a44e')
        if spots:
            for x,y in [(5,5),(9,4),(11,7),(4,8),(8,8)]:di.point((x,y-2 if kind=='amanita' else y),fill='#e6d2ae')
        if kind=='amanita':
            fillpoly([(5,13),(6,12),(7,13),(9,12),(10,13),(10,14),(8,15),(6,15),(5,14)],WHITE)
            di.line((5,11,9,11),fill='#e7d5b2')
        if kind=='black':
            di.line((3,9,12,9),fill='#35272a');di.rectangle((10,8,13,9),fill='#423037')
    elif kind in ['club','coral','slimclub']:
        rods=([(5,4,7,14),(9,7,11,14)] if kind=='club' else [(3,6,4,14),(7,2,8,14),(11,5,12,14)] if kind=='slimclub' else [(2,5,4,11),(5,1,7,13),(9,5,11,13),(12,9,14,12)])
        for x1,y1,x2,y2 in rods:fillpoly([(x1,y1),(x2-1,y1),(x2,y1+1),(x2,y2),(x1,y2),(x1-1,y1+2)],palette)
        fillpoly([(4,11),(11,11),(10,14),(5,14)],palette)
    elif kind in ['shelf','rosette','cluster']:
        layers=([(2,3,11,7),(4,7,14,11)] if kind=='shelf' else [(5,1,11,5),(1,4,8,8),(8,5,14,9),(3,8,12,12)] if kind=='rosette' else [(1,6,6,9),(5,2,11,6),(10,5,14,8)])
        if kind=='cluster':
            for x in [4,8,12]:fillpoly([(x-1,7),(x+1,7),(x+1,14),(x-1,14)],stem)
        else:fillpoly([(6,8),(9,8),(9,14),(6,14)],stem)
        for x1,y1,x2,y2 in layers:
            fillpoly([(x1+1,y1),(x2-2,y1),(x2,y1+2),(x2,y2-1),(x1+2,y2),(x1,y2-1),(x1,y1+2)],palette)
            di.line((x1+2,y2,x2-1,y2-1),fill=stem[2])
    elif kind in ['cup','funnel']:
        fillpoly([(3,5),(5,3),(11,3),(14,5),(13,9),(10,12),(6,12),(3,10),(1,7)],palette)
        di.line([(3,5),(6,4),(10,4),(12,5),(12,7),(10,8),(6,8),(3,7),(3,5)],fill='#e6ac78',width=1)
        di.line((5,6,10,6),fill=palette[0])
        if kind=='funnel':
            di.rectangle((7,11,9,14),fill=palette[2]);di.line((7,11,7,13),fill=palette[3])
    elif kind=='star':
        fillpoly([(5,11),(10,11),(11,14),(9,15),(6,15),(4,13)],WHITE)
        for poly in [[(6,12),(6,4),(7,1),(9,2),(8,5),(8,12)],[(6,12),(3,7),(1,6),(1,4),(4,5),(8,12)],[(8,12),(11,6),(14,5),(15,7),(12,7),(10,12)],[(6,12),(3,10),(1,12),(2,14),(4,12),(7,13)]]:fillpoly(poly,palette)
        di.line((7,5,7,11),fill='#462c26')
    elif kind=='puff':
        fillpoly([(6,9),(10,9),(10,14),(6,14)],CREAM)
        fillpoly([(5,2),(10,2),(13,5),(13,8),(10,11),(5,11),(2,8),(2,5)],palette)
        for x,y in [(5,4),(8,3),(11,5),(4,7),(8,7),(10,9)]:di.point((x,y),fill=palette[1])
    elif kind in ['morel','veil']:
        fillpoly([(6,7),(9,7),(9,14),(6,14)],WHITE)
        if kind=='veil':
            fillpoly([(5,5),(10,5),(13,13),(12,14),(3,14),(2,13)],WHITE)
            for yy in range(7,14,2):
                for xx in range(4,12,3):
                    if (yy+xx)%3!=0:di.rectangle((xx,yy,xx,yy+1),fill=(0,0,0,0))
            fillpoly([(6,2),(9,2),(11,5),(10,7),(5,7),(4,5)],palette)
        else:
            fillpoly([(7,1),(9,2),(11,6),(12,10),(10,12),(5,12),(3,10),(4,6),(6,2)],palette)
            for x,y in [(7,3),(6,5),(9,5),(5,7),(8,7),(10,9),(6,10)]:
                di.rectangle((x,y,x+1,y+1),fill=palette[0]);di.point((x-1,y),fill=palette[3])
    else:raise ValueError(kind)
    return im

# IDs only: item pixels come exclusively from reference/final_32x32.
specs=[e['id'] for e in json.loads((ROOT/'data/mushrooms.json').read_text(encoding='utf8'))['mushrooms']]
unknown=icon('cap',['#292924','#404139','#585a4c','#747766','#8e917e'],999)
ImageDraw.Draw(unknown).text((6,2),'?',fill='#ded0af',font=ImageFont.load_default(size=10))
unknown.putalpha(unknown.getchannel('A').point(lambda a:255 if a>=128 else 0))
unknown.save(RP/'textures/ui/mycology/unknown.png',optimize=True)
# Poster is QA reference only; never included in RP.
regfile=ROOT/'data/mushrooms.json'
names={s['id']:s['nameJa'] for s in json.loads(regfile.read_text(encoding='utf8'))['mushrooms']} if regfile.exists() else {}
fonts=list(Path('/usr/share/fonts').rglob('*CJK*'))
fonts += [p for p in [Path('C:/Windows/Fonts/meiryo.ttc'),Path('C:/Windows/Fonts/YuGothM.ttc')] if p.exists()]
jfont=ImageFont.truetype(str(fonts[0]),18) if fonts else ImageFont.truetype(font_path,14)
sheet=Image.new('RGB',(1400,1100),'#ede6d8');dd=ImageDraw.Draw(sheet)
dd.text((32,22),'PINENE / 35 IDENTIFIED MUSHROOMS',font=ImageFont.truetype(font_path,30),fill='#3e342b')
dd.text((32,65),'16 x 16 RGBA  |  exact pixels  |  transparent backgrounds  |  canonical IDs',font=f2,fill='#796b58')
for i,ident in enumerate(specs):
    x=(i%7)*200;y=110+(i//7)*190
    dd.rectangle((x+10,y,x+190,y+175),fill='#f7f2e9')
    im=Image.open(RP/f'textures/items/mycology/{ident.lower()}.png').resize((112,112),Image.Resampling.NEAREST)
    sheet.paste(im,(x+44,y+6),im)
    dd.text((x+18,y+123),ident,font=f2,fill='#88725c')
    text=names.get(ident,ident)
    jf=jfont
    if fonts:
        for fs in range(18,9,-1):
            jf=ImageFont.truetype(str(fonts[0]),fs)
            if dd.textbbox((0,0),text,font=jf)[2]<=164:break
    dd.text((x+18,y+146),text,font=jf,fill='#463b30')
sheet.save(ROOT/'previews/Mushrooms_35.png',optimize=True)
print('35 textures built')


# CANONICAL_PREVIEW_REFRESH
# Refresh the contact sheet after canonical overrides so preview == runtime bytes.
sheet=Image.new('RGB',(1400,1100),'#ede6d8');dd=ImageDraw.Draw(sheet)
dd.text((32,22),'PINENE / 35 IDENTIFIED MUSHROOMS',font=ImageFont.truetype(font_path,30),fill='#3e342b')
dd.text((32,65),'32 x 32 RGBA  |  exact runtime pixels  |  canonical texture pass v1.4',font=f2,fill='#796b58')
for i,ident in enumerate(specs):
    x=(i%7)*200;y=110+(i//7)*190
    dd.rectangle((x+10,y,x+190,y+175),fill='#f7f2e9')
    im=Image.open(RP/f'textures/items/mycology/{ident.lower()}.png').resize((112,112),Image.Resampling.NEAREST)
    sheet.paste(im,(x+44,y+6),im)
    dd.text((x+18,y+123),ident,font=f2,fill='#88725c')
    text=names.get(ident,ident);jf=jfont
    if fonts:
        for fs in range(18,9,-1):
            jf=ImageFont.truetype(str(fonts[0]),fs)
            if dd.textbbox((0,0),text,font=jf)[2]<=164:break
    dd.text((x+18,y+146),text,font=jf,fill='#463b30')
sheet.save(ROOT/'previews/Mushrooms_35.png',optimize=True)
print('Canonical mushroom preview refreshed')
