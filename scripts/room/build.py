# Builds the listening room in Blender from CC0 Poly Haven assets and renders it, day and night,
# from one fixed camera. The interactive record walls, the clock digits and the lamp glow are layered
# on top in the browser, so the script also writes where those spots land in the image (layout.json).
#
# Fetch assets first: node scripts/room/fetch-assets.mjs
# Usage: Blender -b --python scripts/room/build.py -- <out_dir> [samples] [width]
import json
import math
import random
import sys

import bpy
import mathutils
from bpy_extras.object_utils import world_to_camera_view

ARGS = sys.argv[sys.argv.index("--") + 1 :]
OUT = ARGS[0]
SAMPLES = int(ARGS[1]) if len(ARGS) > 1 else 256
WIDTH = int(ARGS[2]) if len(ARGS) > 2 else 2400
ASSETS = "/".join(__file__.split("/")[:-3]) + "/.cache/room"

# The empty patch of wall the record walls cover (metres): centred above the cabinet.
SHELF = {"x0": -0.72, "x1": 0.72, "z0": 1.06, "z1": 2.6}

random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- helpers ----------

def textured(name, tex, scale=1.0, tint=None, rough_mul=1.0):
    """Principled material from a Poly Haven texture set (Diffuse / nor_gl / Rough)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(coord.outputs["UV"], mapping.inputs["Vector"])

    def img(map_name, color):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(f"{ASSETS}/textures/{tex}/{map_name}.jpg")
        n.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        nt.links.new(mapping.outputs["Vector"], n.inputs["Vector"])
        return n

    diff = img("Diffuse", True)
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(diff.outputs["Color"], mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1)
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    else:
        nt.links.new(diff.outputs["Color"], bsdf.inputs["Base Color"])
    rough = img("Rough", False)
    rm = nt.nodes.new("ShaderNodeMath")
    rm.operation = "MULTIPLY"
    rm.inputs[1].default_value = rough_mul
    nt.links.new(rough.outputs["Color"], rm.inputs[0])
    nt.links.new(rm.outputs[0], bsdf.inputs["Roughness"])
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(img("nor_gl", False).outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def flat(name, color, rough=0.5, metal=0.0, emit=None, strength=0.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = transmission
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def box(name, size, loc, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
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


def plane(name, size, loc, rot, mat, uv_scale=1.0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = (*size, 1)
    bpy.ops.object.transform_apply(scale=True)
    # UVs in metres, so textures keep their real-world size on any plane
    for loop in o.data.loops:
        uv = o.data.uv_layers.active.data[loop.index].uv
        uv.x *= size[0] / uv_scale
        uv.y *= size[1] / uv_scale
    o.data.materials.append(mat)
    return o


def asset(model, loc, rot_z=0.0, scale=1.0):
    """Import a Poly Haven model; returns its root objects, moved so its base sits at loc."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{ASSETS}/models/{model}/{model}.gltf")
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    pivot = bpy.data.objects.new(model, None)
    scene.collection.objects.link(pivot)
    for o in roots:
        o.parent = pivot
    pivot.scale = (scale, scale, scale)
    pivot.rotation_euler.z = rot_z
    pivot.location = loc
    return pivot


# ---------- the room ----------

WALL_X = -2.3  # left wall
wall_mat = textured("plaster", "beige_wall_001", scale=1.0, tint=(1.0, 0.96, 0.9))
plane("back_wall", (8, 3.4), (0.7, 0, 1.7), (math.pi / 2, 0, 0), wall_mat, uv_scale=1.6)
plane("left_wall", (6, 3.4), (WALL_X, -3, 1.7), (math.pi / 2, 0, math.pi / 2), wall_mat, uv_scale=1.6)
plane("floor", (8, 7), (0.7, -3.5, 0), (0, 0, 0), textured("floor", "old_wooden_floor_02", tint=(0.92, 0.8, 0.68), rough_mul=0.8), uv_scale=2.0)
skirting = flat("skirting", (0.86, 0.83, 0.78), rough=0.4)
box("skirting_back", (8, 0.018, 0.09), (0.7, -0.009, 0.045), skirting, bevel=0.004)
box("skirting_left", (0.018, 6, 0.09), (WALL_X + 0.009, -3, 0.045), skirting, bevel=0.004)

# Low walnut cabinet with slatted doors. The left door comes off so its six cubbies show the records.
CAB_Y = -0.3
asset("modern_wooden_cabinet", (0.0, CAB_Y, 0.0))
bpy.data.objects.remove(bpy.data.objects["modern_wooden_cabinet_door_l"])

# Records filed spine-out in the cubbies (measured from the model: three columns, two shelves).
# mostly black, white and brown card like a real collection, with the odd colour
SPINES = [(0.03, 0.03, 0.03)] * 5 + [(0.06, 0.05, 0.05)] * 3 + [(0.82, 0.8, 0.74)] * 3 + [(0.6, 0.55, 0.47)] * 2 + [
    (0.28, 0.2, 0.14), (0.42, 0.3, 0.2), (0.5, 0.12, 0.08), (0.14, 0.2, 0.28), (0.62, 0.48, 0.2), (0.2, 0.26, 0.18)]
spine_mats = [flat(f"spine{i}", c, rough=0.55) for i, c in enumerate(SPINES)]
COLUMNS = [(-1.17, -0.76), (-0.72, -0.31), (-0.27, -0.05)]
SHELVES = [(0.2, 0.17), (0.4, 0.21)]  # (floor of the cubby, sleeve height)
cubby_lights = []
for ci, (x0, x1) in enumerate(COLUMNS):
    for si, (z0, h) in enumerate(SHELVES):
        fill = random.uniform(0.55, 1.0) if (ci, si) != (2, 0) else 0.35
        x = x0 + 0.005
        while x < x0 + (x1 - x0) * fill:
            t = random.uniform(0.004, 0.009)
            o = box("record", (t, 0.2, h * random.uniform(0.92, 1.0)), (x + t / 2, CAB_Y + 0.12, z0 + h / 2), random.choice(spine_mats))
            o.rotation_euler.y = random.uniform(-0.03, 0.03)
            x += t + random.uniform(0.0, 0.0012)
        if fill < 0.98:  # the last sleeve leans into the gap
            o.rotation_euler.y = -0.22
            o.location.x += 0.02
        # warm LED strip along the top of each cubby, lit at night
        l = bpy.data.objects.new("cubby_led", bpy.data.lights.new("cubby_led", "AREA"))
        scene.collection.objects.link(l)
        l.data.shape = "RECTANGLE"
        l.data.size, l.data.size_y = x1 - x0 - 0.02, 0.02
        l.location = ((x0 + x1) / 2, CAB_Y - 0.02, z0 + h + 0.015)
        cubby_lights.append(l)

# On the cabinet: bulb lamp, vase, the digital clock, a small plant.
TOP = 0.68
walnut = textured("walnut", "walnut_veneer", scale=3.0, rough_mul=0.7)
# a bare Edison bulb on a turned walnut block, like the lamp in the reference
LAMP_X = -0.86
box("lamp_base", (0.09, 0.09, 0.12), (LAMP_X, -0.32, TOP + 0.06), walnut, bevel=0.01)
bulb = asset("lightbulb_01", (LAMP_X, -0.32, TOP + 0.12), scale=2.4)
BULB_AT = mathutils.Vector((LAMP_X, -0.32, TOP + 0.12 + 0.15))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.016, location=BULB_AT)
filament = bpy.context.object
filament.data.materials.append(flat("filament", (1, 0.6, 0.3), emit=(1.0, 0.55, 0.22), strength=0.0))

asset("ceramic_vase_02", (-0.45, -0.3, TOP), scale=0.9)

CLOCK = {"w": 0.32, "h": 0.13, "d": 0.09, "x": 0.42, "y": -0.32}
box("clock_body", (CLOCK["w"], CLOCK["d"], CLOCK["h"]), (CLOCK["x"], CLOCK["y"], TOP + CLOCK["h"] / 2), walnut, bevel=0.008)
face = box("clock_face", (CLOCK["w"] * 0.82, 0.002, CLOCK["h"] * 0.62), (CLOCK["x"], CLOCK["y"] - CLOCK["d"] / 2 - 0.001, TOP + CLOCK["h"] / 2), flat("glass", (0.02, 0.02, 0.025), rough=0.08))

asset("potted_plant_04", (0.92, -0.3, TOP), rot_z=0.6, scale=1.1)

# A framed print to the left of the record walls: a record and "music sounds better with you".
PRINT = {"x": -1.48, "z": 1.62, "w": 0.52, "h": 0.72}
box("frame", (PRINT["w"], 0.03, PRINT["h"]), (PRINT["x"], -0.016, PRINT["z"]), walnut, bevel=0.004)
paper = flat("paper", (0.9, 0.87, 0.8), rough=0.85)
plane("print", (PRINT["w"] - 0.07, PRINT["h"] - 0.07), (PRINT["x"], -0.032, PRINT["z"]), (math.pi / 2, 0, 0), paper)
vinyl_black = flat("print_ink", (0.03, 0.03, 0.03), rough=0.6)
bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.001, location=(PRINT["x"], -0.034, PRINT["z"] + 0.12), rotation=(math.pi / 2, 0, 0))
bpy.context.object.data.materials.append(vinyl_black)
bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.0012, location=(PRINT["x"], -0.035, PRINT["z"] + 0.12), rotation=(math.pi / 2, 0, 0))
bpy.context.object.data.materials.append(paper)
for i, word in enumerate(["MUSIC", "SOUNDS", "BETTER", "WITH YOU"]):
    bpy.ops.object.text_add(location=(PRINT["x"] - 0.15, -0.035, PRINT["z"] - 0.1 - i * 0.045), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object
    t.data.body = word
    t.data.size = 0.032
    t.data.space_character = 1.25
    t.data.materials.append(vinyl_black)

# A small floating walnut shelf to the right with a trailing pothos; its vines hang down the wall.
VINE_SHELF = {"x": 1.3, "z": 1.98}
box("vine_shelf", (0.46, 0.17, 0.03), (VINE_SHELF["x"], -0.085, VINE_SHELF["z"]), walnut, bevel=0.003)
asset("potted_plant_04", (VINE_SHELF["x"] - 0.05, -0.09, VINE_SHELF["z"] + 0.015), rot_z=1.9, scale=1.0)
bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=1, location=(0, 0, -10))
leaf_template = bpy.context.object
bpy.ops.object.shade_smooth()
leaf_mesh = leaf_template.data
bpy.data.objects.remove(leaf_template)  # the mesh lives on, shared by every leaf
leaf_mats = [flat(f"leaf{i}", c, rough=0.45) for i, c in enumerate([(0.08, 0.2, 0.05), (0.12, 0.26, 0.07), (0.16, 0.3, 0.08)])]
for m in leaf_mats:
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Subsurface Weight"].default_value = 0.25
leaf_mesh.materials.append(leaf_mats[0])
stem_mat = flat("stem", (0.15, 0.22, 0.08), rough=0.6)
for v in range(6):
    p = mathutils.Vector((VINE_SHELF["x"] - 0.15 + v * 0.06 + random.uniform(-0.02, 0.02), -0.13, VINE_SHELF["z"] + 0.02))
    length = random.uniform(0.3, 1.1)
    points = [p.copy()]
    sway = random.uniform(0, math.tau)
    steps = int(length / 0.03)
    for s_ in range(steps):
        p += mathutils.Vector((0.014 * math.sin(sway + s_ * 0.3), -0.0015 if s_ < 4 else 0.0004, -0.03))
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
        leaf.location = q + mathutils.Vector((side * 0.018 * size, -0.008, random.uniform(-0.006, 0.006)))
        leaf.scale = (0.03 * size, 0.004, 0.036 * size)
        leaf.rotation_euler = (random.uniform(-0.6, 0.1), random.uniform(-0.4, 0.4), side * random.uniform(0.5, 1.1))
        leaf.material_slots[0].link = "OBJECT"
        leaf.material_slots[0].material = random.choice(leaf_mats)

# A berber rug: cream wool with a faint diamond lattice.
rug = flat("rug", (0.84, 0.8, 0.72), rough=1.0)
nt = rug.node_tree
bsdf = nt.nodes["Principled BSDF"]
coord = nt.nodes.new("ShaderNodeTexCoord")
lines = []
for ang in (0.785, -0.785):
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, ang)
    mp.inputs["Scale"].default_value = (1, 1, 1)
    nt.links.new(coord.outputs["Object"], mp.inputs["Vector"])
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
tint.inputs[6].default_value = (0.84, 0.8, 0.72, 1)
tint.inputs[7].default_value = (0.25, 0.2, 0.16, 1)
nt.links.new(both.outputs[2], tint.inputs["Factor"])
nt.links.new(tint.outputs[2], bsdf.inputs["Base Color"])
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 900
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.35
nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
box("rug", (2.6, 1.7, 0.012), (0.1, -1.55, 0.006), rug, bevel=0.004)

# Floor: a small fig tree in the corner, a leafy plant by the cabinet, a lounge chair in the foreground.
asset("potted_plant_01", (-1.72, -0.6, 0), rot_z=0.4, scale=1.5)
asset("potted_plant_02", (1.62, -0.42, 0), rot_z=-0.5, scale=1.05)
asset("mid_century_lounge_chair", (2.0, -1.55, 0), rot_z=math.radians(-125), scale=1.0)

# ---------- camera ----------

cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
scene.collection.objects.link(cam)
cam.location = (0.15, -4.7, 1.32)
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = 35
cam.data.sensor_width = 36
cam.data.shift_y = 0.02
scene.camera = cam
scene.render.resolution_x = WIDTH
scene.render.resolution_y = WIDTH * 10 // 16

# ---------- lighting ----------

world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]

window = bpy.data.objects.new("window", bpy.data.lights.new("window", "AREA"))
scene.collection.objects.link(window)
window.data.shape = "RECTANGLE"
window.data.size, window.data.size_y = 1.6, 2.0
window.location = (WALL_X + 0.05, -1.9, 1.6)
window.rotation_euler = (0, math.radians(-90), 0)  # faces +x, into the room

fill = bpy.data.objects.new("fill", bpy.data.lights.new("fill", "AREA"))
scene.collection.objects.link(fill)
fill.data.size = 4
fill.location = (0.6, -4.5, 2.9)
fill.rotation_euler = (math.radians(60), 0, 0)

# at night: a warm wash where the record walls hang (their under-ledge LEDs), drawn again live in CSS
wash = bpy.data.objects.new("wash", bpy.data.lights.new("wash", "AREA"))
scene.collection.objects.link(wash)
wash.data.shape = "RECTANGLE"
wash.data.size, wash.data.size_y = 2.2, 1.0
wash.location = (0, -0.9, 3.3)
wash.rotation_euler = (math.radians(-38), 0, 0)

lamp = bpy.data.objects.new("lamp", bpy.data.lights.new("lamp", "POINT"))
scene.collection.objects.link(lamp)
lamp.location = BULB_AT
lamp.data.shadow_soft_size = 0.02


def blackbody(k):
    """Rough RGB for a colour temperature, enough for light tints."""
    t = k / 100
    r = 1.0 if t <= 66 else min(1, max(0, 1.29293618606 * (t - 60) ** -0.1332047592))
    g = (0.39008157876 * math.log(t) - 0.63184144378) if t <= 66 else 1.12989086089 * (t - 60) ** -0.0755148492
    b = 1.0 if t >= 66 else (0 if t <= 19 else 0.54320678911 * math.log(t - 10) - 1.19625408914)
    return (r, min(1, max(0, g)), min(1, max(0, b)))


def set_mode(mode):
    day = mode == "day"
    bg.inputs["Color"].default_value = (*((0.85, 0.9, 1.0) if day else (0.05, 0.06, 0.09)), 1)
    bg.inputs["Strength"].default_value = 0.35 if day else 0.02
    window.data.energy = 900 if day else 6
    window.data.color = blackbody(5600) if day else (0.45, 0.55, 0.9)  # late-evening blue outside
    fill.data.energy = 120 if day else 0
    lamp.data.energy = 0 if day else 140
    lamp.data.color = blackbody(2300)
    wash.data.energy = 0 if day else 70
    wash.data.color = blackbody(2600)
    for l in cubby_lights:
        l.data.energy = 0 if day else 4
        l.data.color = blackbody(2700)
        l.rotation_euler = (0, 0, 0)  # area lights face down by default
    filament.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0 if day else 90


# ---------- render ----------

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

for mode in ("day", "night"):
    set_mode(mode)
    scene.view_settings.exposure = 0.0 if mode == "day" else 1.1
    scene.render.filepath = f"{OUT}/{mode}.png"
    bpy.ops.render.render(write_still=True)


# ---------- layout for the browser: where things land in the image, as fractions ----------

def project(p):
    v = world_to_camera_view(scene, cam, mathutils.Vector(p))
    return (round(v.x, 4), round(1 - v.y, 4))


def rect(points):
    pts = [project(p) for p in points]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return {"x": min(xs), "y": min(ys), "w": round(max(xs) - min(xs), 4), "h": round(max(ys) - min(ys), 4)}


fy = CLOCK["y"] - CLOCK["d"] / 2
fw, fh = CLOCK["w"] * 0.82 / 2, CLOCK["h"] * 0.62 / 2
layout = {
    "aspect": [scene.render.resolution_x, scene.render.resolution_y],
    "shelves": rect([(SHELF["x0"], -0.001, SHELF["z0"]), (SHELF["x1"], -0.001, SHELF["z1"])]),
    "clock": rect([(CLOCK["x"] - fw, fy, TOP + CLOCK["h"] / 2 - fh), (CLOCK["x"] + fw, fy, TOP + CLOCK["h"] / 2 + fh)]),
    "bulb": rect([(BULB_AT.x - 0.05, BULB_AT.y, BULB_AT.z - 0.06), (BULB_AT.x + 0.05, BULB_AT.y, BULB_AT.z + 0.05)]),
}
with open(f"{OUT}/layout.json", "w") as f:
    json.dump(layout, f, indent=2)
print("LAYOUT", json.dumps(layout))
