# Builds the listening room in Blender and renders it, golden hour and night, from one fixed camera.
# Mood: a mid-century walnut room by a sunset window (reference photo 3). CC0 Poly Haven assets for the
# plants, chair and textures; the sideboard, speakers, receiver, lamps and record ledges are built here.
#
# The browser lays the live record sleeves, the clock digits and the lamp switch over the image, so the
# script also writes where those land (layout.json, as fractions of the image).
#
# Fetch assets first: node scripts/room/fetch-assets.mjs
# Usage: Blender -b --python scripts/room/build.py -- <out_dir> [samples] [width] [modes, e.g. day or day,night]
import json
import math
import random
import sys

import bpy
import mathutils
from bpy_extras.object_utils import world_to_camera_view

ARGS = sys.argv[sys.argv.index("--") + 1 :]
OUT = ARGS[0]
SAMPLES = int(ARGS[1]) if len(ARGS) > 1 else 128
WIDTH = int(ARGS[2]) if len(ARGS) > 2 else 3600
MODES = ARGS[3].split(",") if len(ARGS) > 3 else ["day", "night"]
ASSETS = "/".join(__file__.split("/")[:-3]) + "/.cache/room"

random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
V = mathutils.Vector

# ---------- layout (metres; back wall is the plane y = 0, floor z = 0) ----------

CEILING = 3.3
WINDOW = {"x0": 2.15, "x1": 3.6, "z0": 0.12, "z1": 3.05}
LEDGE = {"x0": -0.9, "x1": 0.9, "z": [1.3 + i * 0.37 for i in range(5)], "depth": 0.1}  # bottom to top
SLEEVE = 0.31  # a 12-inch LP jacket
SLOT_GAP = (LEDGE["x1"] - LEDGE["x0"] - 5 * SLEEVE) / 6
LIP = 0.016  # the front lip rises this far above the shelf, hiding the bottom of each sleeve
BOARD = {"x0": -1.15, "x1": 1.15, "z0": 0.16, "z1": 0.62, "y0": -0.47, "y1": -0.02}  # sideboard carcass


# ---------- materials ----------

def textured(name, tex, scale=1.0, tint=None, rough_mul=1.0, coord="UV"):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs[coord], mapping.inputs["Vector"])

    def img(map_name, color):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(f"{ASSETS}/textures/{tex}/{map_name}.jpg", check_existing=True)
        n.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        if coord == "Object":
            n.projection = "BOX"
            n.projection_blend = 0.2
        nt.links.new(mapping.outputs["Vector"], n.inputs["Vector"])
        return n

    diff = img("Diffuse", True)
    out = diff.outputs["Color"]
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(out, mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1)
        out = mix.outputs[2]
    nt.links.new(out, bsdf.inputs["Base Color"])
    rm = nt.nodes.new("ShaderNodeMath")
    rm.operation = "MULTIPLY"
    rm.inputs[1].default_value = rough_mul
    nt.links.new(img("Rough", False).outputs["Color"], rm.inputs[0])
    nt.links.new(rm.outputs[0], bsdf.inputs["Roughness"])
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(img("nor_gl", False).outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def flat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0, transmission=0.0, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = transmission
    b.inputs["Subsurface Weight"].default_value = sss
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def bumpy(m, scale, strength):
    """Add a fine noise bump (wool, plaster tooth, card)."""
    nt = m.node_tree
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 8
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    return m


walnut = textured("walnut", "walnut_veneer", scale=1.2, rough_mul=0.75, coord="Object")
walnut_dark = textured("walnut_dark", "walnut_veneer", scale=1.2, tint=(0.62, 0.5, 0.42), rough_mul=0.75, coord="Object")
brass = flat("brass", (0.78, 0.58, 0.3), rough=0.28, metal=1.0)
black_metal = flat("black_metal", (0.025, 0.025, 0.025), rough=0.4, metal=0.6)
black_plastic = flat("black_plastic", (0.02, 0.02, 0.02), rough=0.55)
rubber = flat("rubber", (0.015, 0.015, 0.015), rough=0.8)
candle_wax = flat("wax", (0.92, 0.88, 0.8), rough=0.5, sss=0.6)
flame = flat("flame", (1, 0.6, 0.2), emit=(1.0, 0.55, 0.18), strength=0.0)


# ---------- geometry helpers ----------

def box(name, size, loc, mat, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def plane(name, size, loc, rot, mat, uv_scale=1.0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (*size, 1)
    bpy.ops.object.transform_apply(scale=True)
    for loop in o.data.loops:  # UVs in metres
        uv = o.data.uv_layers.active.data[loop.index].uv
        uv.x *= size[0] / uv_scale
        uv.y *= size[1] / uv_scale
    o.data.materials.append(mat)
    return o


def asset(model, loc, rot_z=0.0, scale=1.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{ASSETS}/models/{model}/{model}.gltf")
    new = [o for o in bpy.data.objects if o not in before]
    pivot = bpy.data.objects.new(model, None)
    scene.collection.objects.link(pivot)
    for o in new:
        if o.parent is None:
            o.parent = pivot
    pivot.scale = (scale, scale, scale)
    pivot.rotation_euler.z = rot_z
    pivot.location = loc
    return pivot, new


def area_light(name, size, loc, rot, energy=0.0):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
    scene.collection.objects.link(l)
    l.data.shape = "RECTANGLE"
    l.data.size, l.data.size_y = size
    l.location = loc
    l.rotation_euler = rot
    l.data.energy = energy
    l.visible_camera = False  # light the room without showing up as a glowing panel
    return l


def point_light(name, loc, radius=0.02):
    l = bpy.data.objects.new(name, bpy.data.lights.new(name, "POINT"))
    scene.collection.objects.link(l)
    l.location = loc
    l.data.shadow_soft_size = radius
    return l


def kelvin(k):
    """Approximate RGB for a colour temperature, enough for light tints."""
    t = k / 100
    r = 1.0 if t <= 66 else 1.29293618606 * (t - 60) ** -0.1332047592
    g = (0.39008157876 * math.log(t) - 0.63184144378) if t <= 66 else 1.12989086089 * (t - 60) ** -0.0755148492
    b = 1.0 if t >= 66 else (0 if t <= 19 else 0.54320678911 * math.log(t - 10) - 1.19625408914)
    return tuple(min(1, max(0, c)) for c in (r, g, b))


night_lights = []  # (light object, energy at night): all off by day
night_emitters = []  # (material, emission strength at night)


def at_night(obj_or_mat, value):
    (night_emitters if isinstance(obj_or_mat, bpy.types.Material) else night_lights).append((obj_or_mat, value))


# ---------- the room shell ----------

plaster = bumpy(textured("plaster", "beige_wall_001", tint=(1.08, 1.06, 1.02), rough_mul=1.0), 60, 0.04)
# by day the plaster reads near-white; at night it keeps its warm cream (set per mode)
_pnt = plaster.node_tree
_base = _pnt.nodes["Principled BSDF"].inputs["Base Color"]
_src = _base.links[0].from_socket
plaster_white = _pnt.nodes.new("ShaderNodeMix")
plaster_white.data_type = "RGBA"
plaster_white.inputs[7].default_value = (0.88, 0.87, 0.85, 1)
_pnt.links.new(_src, plaster_white.inputs[6])
_pnt.links.new(plaster_white.outputs[2], _base)
# back wall around the tall window on the right
plane("wall_back", (WINDOW["x0"] + 3.4, CEILING), ((WINDOW["x0"] - 3.4) / 2, 0, CEILING / 2), (math.pi / 2, 0, 0), plaster, uv_scale=1.6)
plane("wall_above_window", (WINDOW["x1"] - WINDOW["x0"] + 0.6, CEILING - WINDOW["z1"]), ((WINDOW["x0"] + WINDOW["x1"]) / 2 + 0.3, 0, (CEILING + WINDOW["z1"]) / 2), (math.pi / 2, 0, 0), plaster)
plane("wall_below_window", (WINDOW["x1"] - WINDOW["x0"] + 0.6, WINDOW["z0"]), ((WINDOW["x0"] + WINDOW["x1"]) / 2 + 0.3, 0, WINDOW["z0"] / 2), (math.pi / 2, 0, 0), plaster)
plane("wall_left", (6, CEILING), (-3.4, -3, CEILING / 2), (math.pi / 2, 0, math.pi / 2), plaster, uv_scale=1.6)
plane("ceiling", (8, 7), (0.3, -3.5, CEILING), (math.pi, 0, 0), flat("ceiling", (0.88, 0.85, 0.8), rough=0.9))
floor = textured("floor", "old_wooden_floor_02", tint=(0.78, 0.6, 0.45), rough_mul=0.7)
plane("floor", (8, 7), (0.3, -3.5, 0), (0, 0, 0), floor, uv_scale=2.2)
skirting = flat("skirting", (0.9, 0.87, 0.82), rough=0.45)
box("skirting", (WINDOW["x0"] + 3.4, 0.016, 0.1), ((WINDOW["x0"] - 3.4) / 2, -0.008, 0.05), skirting, bevel=0.003)

# the window: black steel frame and mullions, glass, and a sky with a city skyline behind
frame_w = 0.045
for x in (WINDOW["x0"], WINDOW["x1"], (WINDOW["x0"] + WINDOW["x1"]) / 2):
    box("mullion", (frame_w, 0.06, WINDOW["z1"] - WINDOW["z0"]), (x, -0.02, (WINDOW["z0"] + WINDOW["z1"]) / 2), black_metal)
for z in (WINDOW["z0"], WINDOW["z1"], 1.05):
    box("transom", (WINDOW["x1"] - WINDOW["x0"], 0.06, frame_w), ((WINDOW["x0"] + WINDOW["x1"]) / 2, -0.02, z), black_metal)
# no glass pane: from across the room it would only add glare

sky = bpy.data.materials.new("sky")
sky.use_nodes = True
nt = sky.node_tree
nt.nodes.remove(nt.nodes["Principled BSDF"])
emission = nt.nodes.new("ShaderNodeEmission")
grad_coord = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(grad_coord.outputs["Generated"], sep.inputs["Vector"])
sky_ramp = nt.nodes.new("ShaderNodeValToRGB")
nt.links.new(sep.outputs["Y"], sky_ramp.inputs["Fac"])  # the plane's local Y runs bottom to top once it stands up
nt.links.new(sky_ramp.outputs["Color"], emission.inputs["Color"])
nt.links.new(emission.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
plane("sky", (40, 20), (8.0, 18.0, 4.0), (math.pi / 2, 0, 0), sky)  # far behind the skyline

# ---- night city: dark towers with lit windows ----
night_city = []
city = flat("city", (0.035, 0.033, 0.04), rough=0.9)
city_windows = flat("city_windows", (0.0, 0.0, 0.0), emit=(1.0, 0.72, 0.4), strength=0.0)
_before_city = set(bpy.data.objects)
for i in range(9):  # distant towers, only where the glass can see them
    w, h = random.uniform(0.5, 1.1), random.uniform(1.5, 5.0)
    x = 2.6 + i * 0.75 + random.uniform(-0.15, 0.15)
    tower = box("tower", (w, 0.5, h), (x, 7.0 + random.uniform(0, 0.8), h / 2), city)
    for k in range(1, int(h * 9)):  # rows of small lit windows, only at night
        for c in range(int(w * 9)):
            if random.random() < 0.18:
                box("lit", (0.035, 0.01, 0.028), (x - w / 2 + 0.06 + c * 0.11, tower.location.y - 0.26, k * 0.11), city_windows)
at_night(city_windows, 2.2)
night_city = [o for o in bpy.data.objects if o not in _before_city]

# ---- day skyline: a playful row of pastel buildings, seen from a few floors up ----
_before_sky = set(bpy.data.objects)


def facade(name, color):
    """Pastel facade with a grid of windows (a brick pattern: bricks are glass, mortar is wall)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.8
    tc = nt.nodes.new("ShaderNodeTexCoord")
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.0
    brick.inputs["Scale"].default_value = 1.6  # windows about half a metre wide: readable from across the street
    brick.inputs["Mortar Size"].default_value = 0.1
    brick.inputs["Brick Width"].default_value = 0.5
    brick.inputs["Row Height"].default_value = 0.6
    brick.inputs["Color1"].default_value = (0.32, 0.4, 0.5, 1)  # glass
    brick.inputs["Color2"].default_value = (0.4, 0.48, 0.58, 1)
    brick.inputs["Mortar"].default_value = (*color, 1)
    upright = nt.nodes.new("ShaderNodeMapping")  # map the pattern onto the facade (x, z), not the roof (x, y)
    upright.inputs["Rotation"].default_value = (math.radians(90), 0, 0)
    nt.links.new(tc.outputs["Object"], upright.inputs["Vector"])
    nt.links.new(upright.outputs["Vector"], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], b.inputs["Base Color"])
    return m


PASTELS = [(0.82, 0.45, 0.32), (0.5, 0.64, 0.5), (0.9, 0.76, 0.52), (0.45, 0.56, 0.76), (0.93, 0.88, 0.8), (0.72, 0.36, 0.3)]
pastel_mats = [facade(f"facade{i}", c) for i, c in enumerate(PASTELS)]
roof = flat("roof", (0.3, 0.28, 0.27), rough=0.8)
water_wood = flat("water_tower", (0.45, 0.3, 0.2), rough=0.85)
BASE = -12.0  # the street is far below the window
x = 2.25
for i, kind in enumerate(["deco", "spire", "block", "dome", "water", "deco", "crane", "block", "spire", "block"]):
    w = random.uniform(1.0, 1.7)
    top = random.uniform(1.0, 4.5)
    y = 9.0 + (i % 3) * 1.2
    cx_ = x + w / 2
    mat = pastel_mats[i % len(pastel_mats)]
    box("bldg", (w, 1.2, top - BASE), (cx_, y, (top + BASE) / 2), mat)
    if kind == "deco":  # stepped art-deco setbacks
        for k, f in enumerate((0.75, 0.5)):
            box("setback", (w * f, 1.0 * f, 0.7), (cx_, y, top + 0.35 + k * 0.7), mat)
    elif kind == "spire":
        bpy.ops.mesh.primitive_cone_add(radius1=w * 0.3, radius2=0.02, depth=1.6, location=(cx_, y, top + 0.8), vertices=4)
        bpy.context.object.data.materials.append(roof)
        cyl("antenna", 0.02, 1.2, (cx_, y, top + 2.2), roof, verts=8)
    elif kind == "dome":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=w * 0.42, location=(cx_, y, top), segments=32, ring_count=16)
        bpy.context.object.data.materials.append(flat("dome", (0.5, 0.68, 0.62), rough=0.4, metal=0.5))
    elif kind == "water":  # a wooden water tower on stilts on the roof
        for lx, ly in ((-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)):
            cyl("stilt", 0.02, 0.5, (cx_ + lx, y + ly, top + 0.25), roof, verts=8)
        cyl("tank", 0.28, 0.5, (cx_, y, top + 0.75), water_wood)
        bpy.ops.mesh.primitive_cone_add(radius1=0.32, radius2=0.0, depth=0.3, location=(cx_, y, top + 1.15))
        bpy.context.object.data.materials.append(roof)
    elif kind == "crane":  # a construction crane, mast and jib
        box("mast", (0.08, 0.08, 3.0), (cx_, y - 0.4, top + 1.5), flat("crane", (0.95, 0.72, 0.2), rough=0.6))
        box("jib", (2.4, 0.06, 0.06), (cx_ + 0.6, y - 0.4, top + 3.0), flat("crane", (0.95, 0.72, 0.2), rough=0.6))
    x += w + random.uniform(0.05, 0.3)

cloud = flat("cloud", (1, 1, 1), rough=1.0, emit=(1.0, 0.97, 0.94), strength=0.7)
for cx_, cz, sc in ((3.3, 5.2, 1.0), (5.4, 6.0, 1.3), (7.0, 4.6, 0.8)):  # a few soft clouds
    for k in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=sc * random.uniform(0.35, 0.55), location=(cx_ + k * 0.45 * sc, 14.0, cz + 1.5 + random.uniform(-0.1, 0.12)))
        o = bpy.context.object
        o.scale.z = 0.55
        o.data.materials.append(cloud)
        bpy.ops.object.shade_smooth()
# late sun on the building fronts, from outside: aimed away from the room so it never spills in
_sky_sun = bpy.data.objects.new("skyline_sun", bpy.data.lights.new("skyline_sun", "SPOT"))
scene.collection.objects.link(_sky_sun)
_sky_sun.location = (2.0, 3.5, 7.0)
_sky_sun.rotation_euler = (math.radians(-50), 0, math.radians(-25))  # pointing back and down at the facades
_sky_sun.data.spot_size = math.radians(60)
_sky_sun.data.energy = 1800
_sky_sun.data.color = kelvin(3400)
day_city = [o for o in bpy.data.objects if o not in _before_sky]


# ---------- the record ledges (the live sleeves are laid over these in the browser) ----------

LED = flat("led", (1.0, 0.85, 0.65), emit=(1.0, 0.72, 0.45), strength=0.0)
at_night(LED, 14.0)
for i, z in enumerate(LEDGE["z"]):
    length = LEDGE["x1"] - LEDGE["x0"]
    lx = (LEDGE["x0"] + LEDGE["x1"]) / 2
    box("ledge", (length, LEDGE["depth"], 0.035), (lx, -LEDGE["depth"] / 2, z - 0.0175), walnut, bevel=0.004)
    box("ledge_lip", (length, 0.018, 0.035 + LIP), (lx, -LEDGE["depth"] + 0.009, z - 0.0175 + LIP / 2), walnut, bevel=0.005)
    box("ledge_led", (length - 0.04, 0.008, 0.003), (lx, -LEDGE["depth"] + 0.025, z - 0.0365), LED)
    # its light falls down the wall onto the row below
    at_night(area_light("ledge_light", (length - 0.05, 0.02), (lx, -LEDGE["depth"] + 0.03, z - 0.04), (math.radians(-15), 0, 0)), 9.0)


# ---------- the sideboard: an open LP bay, a receiver bay, a slatted door ----------

B = BOARD
W, D, H = B["x1"] - B["x0"], B["y1"] - B["y0"], B["z1"] - B["z0"]
cy = (B["y0"] + B["y1"]) / 2
cx = (B["x0"] + B["x1"]) / 2
T = 0.025  # panel thickness
box("board_top", (W, D, T), (cx, cy, B["z1"] - T / 2), walnut, bevel=0.006)
box("board_bottom", (W, D, T), (cx, cy, B["z0"] + T / 2), walnut, bevel=0.003)
box("board_back", (W, T, H), (cx, B["y1"] - T / 2, (B["z0"] + B["z1"]) / 2), walnut_dark)
for x in (B["x0"] + T / 2, B["x1"] - T / 2, -0.38, 0.38):
    box("board_side", (T, D, H), (x, cy, (B["z0"] + B["z1"]) / 2), walnut, bevel=0.003)
box("board_shelf", (0.76 - T, D - T, T * 0.8), (0, cy, 0.4), walnut)
for x in (B["x0"] + 0.12, B["x1"] - 0.12):  # tapered, splayed legs
    for y in (B["y0"] + 0.08, B["y1"] - 0.08):
        bpy.ops.mesh.primitive_cone_add(radius1=0.014, radius2=0.022, depth=0.17, location=(x, y, 0.085), vertices=24)
        leg = bpy.context.object
        leg.rotation_euler = (0.12 * (1 if y > cy else -1), -0.12 * (1 if x > 0 else -1), 0)
        leg.data.materials.append(walnut)
        bpy.ops.object.shade_smooth()

# LPs filed spine-out in the left bay: mostly black, white and brown card, a few colours
SPINES = [(0.03, 0.03, 0.03)] * 5 + [(0.06, 0.05, 0.05)] * 3 + [(0.82, 0.8, 0.74)] * 3 + [(0.6, 0.55, 0.47)] * 2 + [
    (0.28, 0.2, 0.14), (0.42, 0.3, 0.2), (0.5, 0.12, 0.08), (0.14, 0.2, 0.28), (0.62, 0.48, 0.2), (0.2, 0.26, 0.18)]
spine_mats = [bumpy(flat(f"spine{i}", c, rough=0.6), 400, 0.05) for i, c in enumerate(SPINES)]
x = B["x0"] + T + 0.004
end = -0.38 - T / 2 - 0.01
last = None
while x < end - 0.06:
    t = random.uniform(0.003, 0.008)
    last = box("lp", (t, 0.31, 0.31 * random.uniform(0.985, 1.0)), (x + t / 2, cy + 0.03, B["z0"] + T + 0.156), random.choice(spine_mats))
    last.rotation_euler.y = random.uniform(-0.015, 0.015)
    x += t + random.uniform(0.0, 0.0008)
last.rotation_euler.y = -0.2  # the end of the run leans into the gap
last.location.x += 0.03
at_night(area_light("board_led", (0.7, 0.02), (-0.76, B["y0"] + 0.04, B["z1"] - T - 0.01), (0, 0, 0)), 8.0)

# receiver on the middle shelf, books below
box("receiver", (0.6, 0.34, 0.12), (0, cy + 0.02, 0.4 + T * 0.4 + 0.06), black_metal, bevel=0.004)
box("receiver_face", (0.6, 0.004, 0.1), (0, B["y0"] + 0.045, 0.4 + T * 0.4 + 0.06), flat("brushed", (0.55, 0.55, 0.56), rough=0.35, metal=1.0))
display = flat("display", (0.02, 0.02, 0.02), emit=(1.0, 0.6, 0.25), strength=0.6)
box("receiver_display", (0.16, 0.003, 0.03), (0.08, B["y0"] + 0.042, 0.4 + T * 0.4 + 0.075), display)
for kx in (-0.22, -0.12, 0.22):
    cyl("knob", 0.017, 0.02, (kx, B["y0"] + 0.035, 0.4 + T * 0.4 + 0.06), brass, rot=(math.pi / 2, 0, 0))
for i, c in enumerate([(0.75, 0.7, 0.6), (0.2, 0.25, 0.3), (0.55, 0.15, 0.1), (0.85, 0.83, 0.78)]):
    box("book", (0.36 - i * 0.03, 0.24, 0.035), (0.02, cy + 0.02, B["z0"] + T + 0.018 + i * 0.036), flat(f"book{i}", c, rough=0.7), bevel=0.002)

# the slatted sliding door on the right section
door_x0, door_x1 = 0.38 + T / 2 + 0.005, B["x1"] - T - 0.005
n = 22
pitch = (door_x1 - door_x0) / n
for i in range(n):
    cyl("slat", pitch * 0.42, H - 2 * T - 0.01, (door_x0 + pitch * (i + 0.5), B["y0"] + 0.02, (B["z0"] + B["z1"]) / 2), walnut, verts=16)
box("door_back", (door_x1 - door_x0, 0.012, H - 2 * T - 0.01), ((door_x0 + door_x1) / 2, B["y0"] + 0.035, (B["z0"] + B["z1"]) / 2), walnut_dark)

TOP = B["z1"]


# ---------- on the sideboard ----------

def speaker(x):
    box("speaker", (0.22, 0.25, 0.36), (x, -0.25, TOP + 0.18), walnut, bevel=0.008)
    box("baffle", (0.2, 0.006, 0.34), (x, -0.25 - 0.125, TOP + 0.18), flat("baffle", (0.04, 0.035, 0.03), rough=0.7))
    cyl("woofer_ring", 0.075, 0.01, (x, -0.38, TOP + 0.13), rubber, rot=(math.pi / 2, 0, 0))
    cyl("woofer", 0.062, 0.012, (x, -0.382, TOP + 0.13), flat("cone", (0.05, 0.05, 0.05), rough=0.6), rot=(math.pi / 2, 0, 0))
    cyl("dust_cap", 0.02, 0.016, (x, -0.386, TOP + 0.13), black_plastic, rot=(math.pi / 2, 0, 0))
    cyl("tweeter", 0.022, 0.012, (x, -0.382, TOP + 0.28), black_metal, rot=(math.pi / 2, 0, 0))


speaker(B["x0"] + 0.14)
speaker(B["x1"] - 0.14)

# brass dome lamp: the lamp switch in the browser
LAMP = V((0.62, -0.24, TOP))
cyl("lamp_base", 0.07, 0.014, LAMP + V((0, 0, 0.007)), brass)
cyl("lamp_stem", 0.006, 0.26, LAMP + V((0, 0, 0.14)), brass, verts=16)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, location=LAMP + V((0, 0, 0.27)), segments=64, ring_count=32)
dome = bpy.context.object
for e in (*dome.data.edges, *dome.data.polygons):
    e.select = False  # new meshes start fully selected
for v in dome.data.vertices:  # keep the upper hemisphere: a dome shade
    v.select = v.co.z < -0.001
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="VERT")
bpy.ops.object.mode_set(mode="OBJECT")
dome.modifiers.new("thick", "SOLIDIFY").thickness = 0.003
dome.data.materials.append(brass)
bpy.ops.object.shade_smooth()
lamp_bulb = flat("lamp_bulb", (1, 0.9, 0.7), emit=(1.0, 0.7, 0.4), strength=0.0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.03, location=LAMP + V((0, 0, 0.255)))
bpy.context.object.data.materials.append(lamp_bulb)
at_night(lamp_bulb, 30.0)
lamp_light = point_light("lamp_light", LAMP + V((0, 0, 0.25)), radius=0.04)
lamp_light.data.color = kelvin(2500)
at_night(lamp_light, 45.0)

# the digital clock: walnut block with a dark glass face (the browser draws the digits)
CLOCK = {"w": 0.3, "h": 0.12, "d": 0.09, "x": 0.18, "y": -0.3}
box("clock_body", (CLOCK["w"], CLOCK["d"], CLOCK["h"]), (CLOCK["x"], CLOCK["y"], TOP + CLOCK["h"] / 2), walnut, bevel=0.01)
box("clock_face", (CLOCK["w"] * 0.82, 0.002, CLOCK["h"] * 0.6), (CLOCK["x"], CLOCK["y"] - CLOCK["d"] / 2 - 0.001, TOP + CLOCK["h"] / 2), flat("clock_glass", (0.015, 0.015, 0.02), rough=0.08))

# a candle and a small plant
cyl("candle", 0.035, 0.08, (-0.25, -0.26, TOP + 0.04), candle_wax)
bpy.ops.mesh.primitive_cone_add(radius1=0.006, radius2=0.0, depth=0.02, location=(-0.25, -0.26, TOP + 0.092))
bpy.context.object.data.materials.append(flame)
candle_light = point_light("candle_light", (-0.25, -0.26, TOP + 0.1), radius=0.01)
candle_light.data.color = kelvin(1900)
at_night(candle_light, 4.0)
at_night(flame, 40.0)
asset("potted_plant_04", (-0.5, -0.27, TOP), rot_z=0.6, scale=1.05)


# ---------- around the room ----------

# framed vinyl print on the left
PRINT = {"x": -1.72, "z": 1.85, "w": 0.62, "h": 0.84}
box("frame", (PRINT["w"], 0.03, PRINT["h"]), (PRINT["x"], -0.016, PRINT["z"]), walnut_dark, bevel=0.004)
paper = bumpy(flat("paper", (0.9, 0.87, 0.8), rough=0.85), 300, 0.02)
plane("print", (PRINT["w"] - 0.08, PRINT["h"] - 0.08), (PRINT["x"], -0.032, PRINT["z"]), (math.pi / 2, 0, 0), paper)
ink = flat("ink", (0.025, 0.025, 0.025), rough=0.6)
for i, (r, mat) in enumerate(((0.19, ink), (0.06, paper), (0.008, ink))):
    cyl("print_disc", r, 0.001, (PRINT["x"], -0.0335 - i * 0.0006, PRINT["z"] + 0.12), mat, rot=(math.pi / 2, 0, 0), verts=96)
for i in range(9):  # ruled lines under the record, like the print in the reference
    box("print_line", (0.36, 0.0008, 0.004), (PRINT["x"], -0.0335, PRINT["z"] - 0.15 - i * 0.017), ink)

# floating shelf with a trailing pothos, a candle and a couple of records leaning
SHELF2 = {"x": 1.42, "z": 2.15}
box("float_shelf", (0.56, 0.18, 0.03), (SHELF2["x"], -0.09, SHELF2["z"]), walnut, bevel=0.003)
cyl("shelf_candle", 0.03, 0.07, (SHELF2["x"] + 0.18, -0.1, SHELF2["z"] + 0.05), candle_wax)
bpy.ops.mesh.primitive_cone_add(radius1=0.005, radius2=0.0, depth=0.018, location=(SHELF2["x"] + 0.18, -0.1, SHELF2["z"] + 0.094))
bpy.context.object.data.materials.append(flame)
shelf_candle_light = point_light("shelf_candle_light", (SHELF2["x"] + 0.18, -0.1, SHELF2["z"] + 0.1), radius=0.01)
shelf_candle_light.data.color = kelvin(1900)
at_night(shelf_candle_light, 3.0)
for i, c in enumerate([(0.05, 0.05, 0.05), (0.75, 0.68, 0.55)]):
    box("leaning_lp", (0.31, 0.004, 0.31), (SHELF2["x"] + 0.02 + i * 0.03, -0.03 - i * 0.012, SHELF2["z"] + 0.17), flat(f"lean{i}", c, rough=0.6), rot=(math.radians(-8), 0, 0))
asset("potted_plant_04", (SHELF2["x"] - 0.17, -0.1, SHELF2["z"] + 0.015), rot_z=1.9, scale=1.0)

bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=(0, 0, -10))
leaf_tmp = bpy.context.object
bpy.ops.object.shade_smooth()
leaf_mesh = leaf_tmp.data
bpy.data.objects.remove(leaf_tmp)  # the mesh lives on, shared by every leaf
leaf_mats = [flat(f"leaf{i}", c, rough=0.42, sss=0.25) for i, c in enumerate([(0.08, 0.2, 0.05), (0.12, 0.26, 0.07), (0.16, 0.3, 0.08)])]
leaf_mesh.materials.append(leaf_mats[0])
stem_mat = flat("stem", (0.15, 0.22, 0.08), rough=0.6)
for v in range(7):
    p = V((SHELF2["x"] - 0.24 + v * 0.05 + random.uniform(-0.02, 0.02), -0.15, SHELF2["z"] + 0.02))
    length = random.uniform(0.3, 1.2)
    points = [p.copy()]
    sway = random.uniform(0, math.tau)
    for s_ in range(int(length / 0.03)):
        p += V((0.014 * math.sin(sway + s_ * 0.3), -0.0015 if s_ < 4 else 0.0004, -0.03))
        p.y = min(p.y, -0.012)  # stays against the wall
        points.append(p.copy())
    curve = bpy.data.curves.new("vine", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.0016
    spl = curve.splines.new("POLY")
    spl.points.add(len(points) - 1)
    for i, q in enumerate(points):
        spl.points[i].co = (*q, 1)
    stem = bpy.data.objects.new("vine", curve)
    stem.data.materials.append(stem_mat)
    scene.collection.objects.link(stem)
    for i, q in enumerate(points[1:], 1):
        leaf = bpy.data.objects.new("leaf", leaf_mesh)
        scene.collection.objects.link(leaf)
        side = 1 if i % 2 else -1  # leaves alternate either side of the stem, pointing out and down
        size = random.uniform(0.75, 1.2) * (1 - 0.45 * i / len(points))
        leaf.location = q + V((side * 0.018 * size, -0.008, random.uniform(-0.006, 0.006)))
        leaf.scale = (0.03 * size, 0.004, 0.036 * size)
        leaf.rotation_euler = (random.uniform(-0.6, 0.1), random.uniform(-0.4, 0.4), side * random.uniform(0.5, 1.1))
        leaf.material_slots[0].link = "OBJECT"
        leaf.material_slots[0].material = random.choice(leaf_mats)

# fiddle-leaf fig in a concrete planter, by the window
concrete = textured("concrete", "concrete_floor", scale=1.5, tint=(0.82, 0.8, 0.77), coord="Object")
_, fig = asset("potted_plant_01", (1.72, -1.05, 0), rot_z=0.8, scale=1.3)
for o in fig:
    if o.type == "MESH" and o.name.endswith("_pot"):  # just the pot: "potted_plant" itself contains "pot"
        o.data.materials.clear()
        o.data.materials.append(concrete)

# black arc floor lamp on the left, its shade hanging over the corner
arc_base = V((-2.65, -0.7, 0))
cyl("arc_base", 0.16, 0.035, arc_base + V((0, 0, 0.0175)), flat("marble", (0.05, 0.05, 0.05), rough=0.25))
curve = bpy.data.curves.new("arc", "CURVE")
curve.dimensions = "3D"
curve.bevel_depth = 0.011
spl = curve.splines.new("BEZIER")
spl.bezier_points.add(1)
spl.bezier_points[0].co = arc_base + V((0, 0, 0.03))
spl.bezier_points[0].handle_left = arc_base + V((0, 0, -0.3))
spl.bezier_points[0].handle_right = arc_base + V((0.05, 0, 1.9))
spl.bezier_points[1].co = arc_base + V((0.85, 0.05, 2.0))
spl.bezier_points[1].handle_left = arc_base + V((0.4, 0.02, 2.35))
spl.bezier_points[1].handle_right = arc_base + V((1.0, 0.06, 1.9))
arc = bpy.data.objects.new("arc_pole", curve)
arc.data.materials.append(black_metal)
scene.collection.objects.link(arc)
bpy.ops.mesh.primitive_cone_add(radius1=0.2, radius2=0.04, depth=0.2, location=arc_base + V((0.88, 0.05, 1.9)), vertices=64)
shade = bpy.context.object
shade.modifiers.new("thick", "SOLIDIFY").thickness = 0.004
shade.data.materials.append(flat("shade", (0.03, 0.03, 0.03), rough=0.45, metal=0.3))
bpy.ops.object.shade_smooth()
arc_bulb = flat("arc_bulb", (1, 0.9, 0.75), emit=(1.0, 0.72, 0.42), strength=0.0)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=arc_base + V((0.88, 0.05, 1.83)))
bpy.context.object.data.materials.append(arc_bulb)
at_night(arc_bulb, 25.0)  # the bulb you see glowing under the shade: this lamp is the night switch
arc_light = point_light("arc_light", arc_base + V((0.88, 0.05, 1.78)), radius=0.06)
arc_light.data.color = kelvin(2600)
at_night(arc_light, 70.0)

# sherpa lounge chair, foreground right: the lounge chair, reupholstered in cream boucle
boucle = bumpy(flat("boucle", (0.86, 0.82, 0.74), rough=1.0, sss=0.08), 180, 0.6)
_, chair = asset("mid_century_lounge_chair", (-1.55, -2.55, 0), rot_z=math.radians(140), scale=1.0)
for o in chair:
    if o.type == "MESH":
        o.data.materials.clear()
        o.data.materials.append(boucle)

# berber rug
rug = flat("rug", (0.86, 0.82, 0.74), rough=1.0)
nt = rug.node_tree
bsdf = nt.nodes["Principled BSDF"]
tc = nt.nodes.new("ShaderNodeTexCoord")
lines = []
for ang in (0.785, -0.785):
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, ang)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 3.2
    wave.inputs["Distortion"].default_value = 0.6
    nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.9
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.97
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    lines.append(ramp)
both = nt.nodes.new("ShaderNodeMix")
both.data_type = "RGBA"
both.blend_type = "LIGHTEN"
both.inputs["Factor"].default_value = 1
nt.links.new(lines[0].outputs["Color"], both.inputs[6])
nt.links.new(lines[1].outputs["Color"], both.inputs[7])
tint = nt.nodes.new("ShaderNodeMix")
tint.data_type = "RGBA"
tint.inputs[6].default_value = (0.86, 0.82, 0.74, 1)
tint.inputs[7].default_value = (0.25, 0.2, 0.16, 1)
nt.links.new(both.outputs[2], tint.inputs["Factor"])
nt.links.new(tint.outputs[2], bsdf.inputs["Base Color"])
bumpy(rug, 900, 0.4)
box("rug", (3.0, 2.0, 0.012), (0.1, -1.6, 0.006), rug, bevel=0.004)


# ---------- camera ----------

cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
scene.collection.objects.link(cam)
cam.location = (0.2, -5.2, 1.6)
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = 32
cam.data.sensor_width = 36
scene.camera = cam
scene.render.resolution_x = WIDTH
scene.render.resolution_y = WIDTH * 10 // 16


# ---------- light ----------

world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(78), 0, math.radians(148))  # low, from beyond the window, raking into the room
sun.data.angle = math.radians(2.5)
window_glow = area_light("window_glow", (WINDOW["x1"] - WINDOW["x0"], WINDOW["z1"] - WINDOW["z0"]),
                         ((WINDOW["x0"] + WINDOW["x1"]) / 2, -0.05, (WINDOW["z0"] + WINDOW["z1"]) / 2), (math.radians(90), 0, 0))
fill = area_light("fill", (4, 2), (0.3, -4.8, 2.8), (math.radians(65), 0, 0))


def set_mode(mode):
    day = mode == "day"
    for o in day_city:
        o.hide_render = not day
    for o in night_city:
        o.hide_render = day
    plaster_white.inputs["Factor"].default_value = 0.6 if day else 0.0
    els = sky_ramp.color_ramp.elements
    if day:  # a clear late afternoon: warm at the horizon, blue above
        els[0].position, els[0].color = 0.32, (1.0, 0.66, 0.4, 1)
        els[1].position, els[1].color = 0.52, (0.3, 0.55, 0.95, 1)
        emission.inputs["Strength"].default_value = 0.45
    else:  # blue hour, late
        els[0].position, els[0].color = 0.0, (0.06, 0.05, 0.09, 1)
        els[1].position, els[1].color = 0.8, (0.015, 0.02, 0.05, 1)
        emission.inputs["Strength"].default_value = 1.0
    bg.inputs["Color"].default_value = (1.0, 0.97, 0.93, 1) if day else (0.04, 0.05, 0.09, 1)
    bg.inputs["Strength"].default_value = 0.5 if day else 0.015
    sun.data.energy = 5.0 if day else 0
    sun.data.color = kelvin(3800)  # cosy warm sun; the walls stay near-white
    window_glow.data.energy = 380 if day else 8
    window_glow.data.color = kelvin(4400) if day else (0.4, 0.5, 0.9)
    fill.data.energy = 170 if day else 0
    fill.data.color = kelvin(4700)  # warm enough to feel lived-in, white walls stay white
    for obj, energy in night_lights:
        obj.data.energy = 0 if day else energy
        if obj.data.type == "AREA":
            obj.data.color = kelvin(2700)
    for mat, strength in night_emitters:
        mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0 if day else strength
    display.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.6 if day else 3.0


scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices:
    d.use = True
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.file_format = "PNG"

for mode in MODES:
    set_mode(mode)
    scene.view_settings.exposure = 0.55 if mode == "day" else 0.9
    scene.render.filepath = f"{OUT}/{mode}.png"
    bpy.ops.render.render(write_still=True)


# ---------- layout for the browser (fractions of the image, origin top left) ----------

def project(p):
    v = world_to_camera_view(scene, cam, V(p))
    return (v.x, 1 - v.y)


def rect(points):
    pts = [project(p) for p in points]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return {"x": round(min(xs), 5), "y": round(min(ys), 5), "w": round(max(xs) - min(xs), 5), "h": round(max(ys) - min(ys), 5)}


slots = []  # 25 sleeve spots, row by row from the top ledge, matching slot numbers 0..24 on a wall
for z in reversed(LEDGE["z"]):
    for c in range(5):
        x0 = LEDGE["x0"] + SLOT_GAP + c * (SLEEVE + SLOT_GAP)
        y = -0.03  # sleeves lean back to the wall; their face sits a few cm out
        slots.append(rect([(x0, y, z + LIP), (x0 + SLEEVE, y, z + SLEEVE)]))

fy = CLOCK["y"] - CLOCK["d"] / 2
fw, fh = CLOCK["w"] * 0.82 / 2, CLOCK["h"] * 0.6 / 2
layout = {
    "aspect": [scene.render.resolution_x, scene.render.resolution_y],
    "wall": rect([(LEDGE["x0"] - 0.12, -0.03, LEDGE["z"][0] - 0.12), (LEDGE["x1"] + 0.12, -0.03, LEDGE["z"][-1] + SLEEVE + 0.12)]),
    "ledges": rect([(LEDGE["x0"], -0.03, LEDGE["z"][0]), (LEDGE["x1"], -0.03, LEDGE["z"][-1] + SLEEVE)]),
    "slots": slots,
    "clock": rect([(CLOCK["x"] - fw, fy, TOP + CLOCK["h"] / 2 - fh), (CLOCK["x"] + fw, fy, TOP + CLOCK["h"] / 2 + fh)]),
    # the arc floor lamp's shade is the night switch: the brass lamp sits behind the turntable
    "lamp": rect([arc_base + V((0.66, 0.05, 2.02)), arc_base + V((1.1, 0.05, 1.78))]),
}
with open(f"{OUT}/layout.json", "w") as f:
    json.dump(layout, f, indent=1)
print("LAYOUT", json.dumps({k: v for k, v in layout.items() if k != "slots"}))
