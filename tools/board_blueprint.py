# board_blueprint.py: draw docs/party-board-art/blueprint-<map>.png from layout.json, a top-down
# plan in 3D world units for building board environment models (needs Pillow).
#   node tools/board-layout.mjs && python3 tools/board_blueprint.py
import json, math, os
from PIL import Image, ImageDraw, ImageFont

DOCS = os.path.join(os.path.dirname(__file__), '..', 'docs', 'party-board-art')
L = json.load(open(os.path.join(DOCS, 'layout.json')))
PX = 40                      # pixels per world unit
X0, X1, Z0, Z1 = -18, 18, -17, 13
W, H = (X1 - X0) * PX, (Z1 - Z0) * PX + 70
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f_small, f_tile, f_title = ImageFont.truetype(FONT, 13), ImageFont.truetype(BOLD, 15), ImageFont.truetype(BOLD, 24)
COLORS = {'start': '#f8fafc', 'blue': '#2563eb', 'red': '#dc2626', 'event': '#16a34a', 'bonus': '#9333ea',
          'shop': '#f59e0b', 'warp': '#0891b2'}
KEEP_TILE, KEEP_PATH = L['keepOut']['aroundTile'], L['keepOut']['aroundPath']
GROUND_RX, GROUND_RZ = 14.5, 14.5 * 0.66   # the current ground's top edge (an ellipse)

def P(x, z):
    return ((x - X0) * PX, (z - Z0) * PX + 70)

for mid, m in L['maps'].items():
    img = Image.new('RGB', (W, H), '#f4efe2')
    d = ImageDraw.Draw(img, 'RGBA')
    # zones: behind the board (tall props welcome) and in front (keep low: the camera looks over it)
    d.rectangle([P(X0, Z0), P(X1, -10)], fill=(120, 160, 220, 40))
    d.text((P(X0 + 0.3, Z0 + 0.3)), 'BACKDROP ZONE (z < -10): tall set pieces welcome (a volcano, a castle, cliffs)', font=f_small, fill='#1e3a8a')
    d.rectangle([P(X0, 7.5), P(X1, Z1)], fill=(220, 120, 120, 35))
    d.text((P(X0 + 0.3, Z1 - 0.6)), 'FOREGROUND (z > 7.5): keep props under 1.5 tall, the camera looks over this edge', font=f_small, fill='#7f1d1d')
    # grid
    for x in range(X0, X1 + 1):
        d.line([P(x, Z0), P(x, Z1)], fill=(0, 0, 0, 60 if x % 5 == 0 else 18), width=2 if x == 0 else 1)
        if x % 5 == 0: d.text((P(x, Z0)[0] + 3, P(x, Z0)[1] + 3), str(x), font=f_small, fill='#555')
    for z in range(Z0, Z1 + 1):
        d.line([P(X0, z), P(X1, z)], fill=(0, 0, 0, 60 if z % 5 == 0 else 18), width=2 if z == 0 else 1)
        if z % 5 == 0: d.text((P(X0, z)[0] + 3, P(X0, z)[1] + 2), str(z), font=f_small, fill='#555')
    # the current ground edge
    d.ellipse([P(-GROUND_RX, -GROUND_RZ), P(GROUND_RX, GROUND_RZ)], outline=(90, 70, 40, 160), width=3)
    sp = m['spaces']
    # keep-out halos (paths, then tiles)
    for s in sp:
        for n in s['next']:
            t = sp[n]
            d.line([P(s['x'], s['z']), P(t['x'], t['z'])], fill=(239, 68, 68, 45), width=int(KEEP_PATH * 2 * PX))
    for s in sp:
        r = KEEP_TILE
        d.ellipse([P(s['x'] - r, s['z'] - r), P(s['x'] + r, s['z'] + r)], fill=(239, 68, 68, 45))
    # paths with arrows
    for s in sp:
        for n in s['next']:
            t = sp[n]
            a, b = P(s['x'], s['z']), P(t['x'], t['z'])
            d.line([a, b], fill='#6b4f2a', width=6)
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            pts = [(mx + 9 * math.cos(ang), my + 9 * math.sin(ang)),
                   (mx + 9 * math.cos(ang + 2.5), my + 9 * math.sin(ang + 2.5)),
                   (mx + 9 * math.cos(ang - 2.5), my + 9 * math.sin(ang - 2.5))]
            d.polygon(pts, fill='#facc15' if s.get('fork') else '#3f2d14')
    # warps: dashed curves
    for s in sp:
        if s['type'] == 'warp':
            t = sp[s['warp']]
            a, b = P(s['x'], s['z']), P(t['x'], t['z'])
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 80
            pts = [((1 - u) ** 2 * a[0] + 2 * (1 - u) * u * mx + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * my + u * u * b[1]) for u in [k / 40 for k in range(41)]]
            for k in range(0, 40, 2): d.line([pts[k], pts[k + 1]], fill='#0891b2', width=3)
    # tiles
    rt = L['tile']['diameter'] / 2 * PX
    for s in sp:
        cx, cy = P(s['x'], s['z'])
        d.ellipse([cx - rt, cy - rt, cx + rt, cy + rt], fill=COLORS.get(s['type'], '#64748b'), outline='#111', width=2)
        if s.get('starCandidate'): d.ellipse([cx - rt - 5, cy - rt - 5, cx + rt + 5, cy + rt + 5], outline='#eab308', width=4)
        d.text((cx, cy), str(s['i']), font=f_tile, fill='#111' if s['type'] == 'start' else 'white', anchor='mm')
    d.rectangle([0, 0, W, 66], fill='#1f2937')
    d.text((16, 10), f"{m['name'].split(' ', 1)[1]} ({mid}, {m['tier']}): top-down plan, 1 square = 1 world unit", font=f_title, fill='white')
    d.text((16, 42), "+X right, +Z toward the camera. Red haze = keep out (tiles r 1.0, paths 0.6). Brown ellipse = current ground edge. "
                     "Gold ring = star spot, yellow arrow = fork, dashed cyan = warp.", font=f_small, fill='#d1d5db')
    out = os.path.join(DOCS, f'blueprint-{mid}.png')
    img.save(out, optimize=True)
    print(out)
