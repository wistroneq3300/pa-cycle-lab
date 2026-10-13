"""Original, deterministic fabrication-scale texture authoring, not a photo scan.

Run with Python + Pillow + NumPy before Blender. PCB layout is read from the
same explicit layout.json as geometry. No downloaded product texture or random
component scattering is used. glTF normals are +Y (OpenGL), ORM G roughness/B metal.
"""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "textures"
OUT.mkdir(parents=True, exist_ok=True)
LAYOUT = json.loads((HERE / "layout.json").read_text())

def normal_from_height(height, strength):
    gy, gx = np.gradient(height.astype(np.float32))
    n = np.stack((-gx*strength, gy*strength, np.ones_like(height)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return np.uint8(np.clip(n*.5+.5,0,1)*255)

def write_set(name, base, rough, metal, height, normal_strength):
    base=np.uint8(np.clip(base,0,255)); h,w=base.shape[:2]
    orm=np.zeros((h,w,3),dtype=np.uint8);orm[:,:,0]=255
    orm[:,:,1]=np.uint8(np.clip(rough,0,1)*255)
    orm[:,:,2]=np.uint8(np.clip(metal,0,1)*255)
    Image.fromarray(base).save(OUT/f"{name}-basecolor.png")
    Image.fromarray(orm).save(OUT/f"{name}-metallicroughness.png")
    if normal_strength>0:
        Image.fromarray(normal_from_height(height,normal_strength)).save(OUT/f"{name}-normal.png")

# One unique board UV; soldermask relief, evidence-bounded pad openings
# and assembly witnesses are related to geometry rather than a tiled circuit image.
N=1024
b=LAYOUT['board']; left=b['x']-b['width']/2; rear=b['z']-b['depth']/2
def uv(x,z): return ((x-left)/b['width']*(N-1),(z-rear)/b['depth']*(N-1))
yy,xx=np.mgrid[:N,:N]
weave=(np.sin(xx*math.pi*.51)*np.sin(yy*math.pi*.47))*.6
base=np.empty((N,N,3),dtype=np.float32);base[:]=[18,47,34];base+=weave[:,:,None]
im=Image.fromarray(np.uint8(base)); d=ImageDraw.Draw(im)
height=Image.new('L',(N,N),128); hd=ImageDraw.Draw(height)
mask=Image.new('L',(N,N),0); md=ImageDraw.Draw(mask)
silk=(144,159,128); trace=(29,64,47)
fontpath=Path('C:/Windows/Fonts/consola.ttf')
font=ImageFont.truetype(str(fontpath),8) if fontpath.exists() else ImageFont.load_default()

def line(points,width=.0022):
    pts=[uv(x,z) for x,z in points]; w=max(1,int(width*N/b['width']))
    d.line(pts,fill=trace,width=w,joint='curve');hd.line(pts,fill=134,width=w)
def pad(x,z,w,h):
    p=[*uv(x-w/2,z-h/2),*uv(x+w/2,z+h/2)]
    d.rectangle(p,fill=(161,165,154));hd.rectangle(p,fill=140);md.rectangle(p,fill=255)
def mark(x,z,label): d.text(uv(x,z),label,font=font,fill=silk)

# No unverified netlist or decorative fake routing is drawn. Broad concealed
# areas use only soldermask finish. Pads align with explicit component islands.
for i,(x,z) in enumerate(LAYOUT['powerStages']):
    for j in [-1,1]:
        pad(x,z+j*.049,.095,.018)
        pad(x+j*.047,z+.112,.035,.048)
    mark(x-.045,z-.099,f'L{i+1:02d}')
for n,bank in enumerate(LAYOUT['passiveBanks']):
    for i in range(bank['count']):
        x=bank['x']+(i*bank['pitch'] if bank['axis']=='x' else 0)
        z=bank['z']+(i*bank['pitch'] if bank['axis']=='z' else 0)
        pad(x-.018,z,.015,.027);pad(x+.018,z,.015,.027)
        if i%3==0:mark(x-.029,z-.032,f'C{n*20+i+1}')
for p in LAYOUT['packages']:
    # Package edge silkscreen brackets remain outside the concealed substrate.
    for sx in [-1,1]:
      for sz in [-1,1]:
        x=p['x']+sx*(p['width']/2+.069);z=p['z']+sz*(p['depth']/2+.067)
        pt=uv(x,z);d.line([pt,uv(x-sx*.06,z)],fill=silk,width=2)
        d.line([pt,uv(x,z-sz*.055)],fill=silk,width=2)
    mark(p['x']-.08,p['z']+p['depth']/2+.084,p['id'].replace('_',' '))
# Copper annuli and phototool fiducials, away from component zones.
for x,z in [(-1.70,-2.69),(-.225,-2.69),(-1.70,-.67),(-.225,-.67)]:
    cx,cy=uv(x,z);r=10;d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(164,135,66))
    md.ellipse((cx-r,cy-r,cx+r,cy+r),fill=255)
for i in range(5):
    x=-1.10+i*.060;z=-2.715;cx,cy=uv(x,z)
    d.ellipse((cx-5,cy-5,cx+5,cy+5),fill=(149,120,60));md.ellipse((cx-5,cy-5,cx+5,cy+5),fill=255)
mark(-1.61,-2.80,'CB-01 / PROTOTYPE')
rough=np.full((N,N),.50);metal=np.asarray(mask,dtype=np.float32)/255*.85
rough[metal>.1]=.30
write_set('pcb',np.asarray(im),rough,metal,np.asarray(height)/255,3)

# Nickel finish: fine directional grinding, lower-frequency polishing bands and
# regular machining arcs. Physical amplitude is deliberately tiny, not scratches
# used to imply weathering or OEM measurement.
N=512; yy,xx=np.mgrid[:N,:N];u=xx/N;v=yy/N
grain=.55*np.sin(v*2639)+.25*np.sin(v*1667+u*.13)+.12*np.sin(v*4499)
bands=np.sin(v*24+u*.11)*.35
base=np.empty((N,N,3));base[:]=[178,185,184];base+=(grain*.60+bands)[:,:,None]
rough=.31+grain*.016+bands*.008
height=(grain*.003)+.001*np.sin(u*80)*np.sin(v*3)
write_set('nickel',base,rough,np.ones((N,N)),height,1.7)
base=np.empty((N,N,3));base[:]=[201,141,105];base+=(grain*.55+bands*.45)[:,:,None]
write_set('copper',base,.37+grain*.014+bands*.012,np.ones((N,N)),height,1.5)

# The package finish follows visible lapping/soft machining, with no borrowed
# brand, product number or artificial printed disclaimer covering the metal.
base=np.empty((N,N,3));base[:]=[176,178,169];base+=(grain*.70+bands*.28)[:,:,None]
write_set('package',base,.39+grain*.016+bands*.01,np.ones((N,N)),height*.38,1.4)

# Thin black/gold striped exterior seen on Lenovo coolers. Functional meaning is
# unknown: this is NOT a fin mesh, leak-sensor claim or copied vendor texture.
N=512; yy,xx=np.mgrid[:N,:N];u=xx/N;v=yy/N
stripes=(np.cos(xx*math.tau/6.0)>.15).astype(float)
base=np.empty((N,N,3));base[:]=[60,57,38]
base += stripes[:,:,None]*np.array([46,39,18])[None,None,:]
# Narrow edge border distinguishes a thin applied surface from deep channels.
border=(xx<12)|(xx>N-13)|(yy<12)|(yy>N-13)
base[border]=[51,49,35]
write_set('surface',base,.52-stripes*.05,.40+stripes*.15,np.zeros((N,N)),0)

# Matte black molded connector; periodic tiny tool grain, without fake dirt.
N=128;yy,xx=np.mgrid[:N,:N];tool=.18*np.sin(xx*2.18)*np.sin(yy*1.83)+.05*np.sin(xx*.17+yy*.11)
base=np.empty((N,N,3));base[:]=[27,31,32];base+=tool[:,:,None]*2
write_set('polymer',base,.55+tool*.04,np.zeros((N,N)),tool*.002,2)
print(json.dumps({'textures':len(list(OUT.glob('*.png'))),'output':str(OUT),'randomUsed':False}))
