import bpy

def add_ground():
    bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 0, 0))
    bpy.ops.rigidbody.object_add()
    bpy.context.object.rigid_body.type = 'PASSIVE'

def add_arch(x, y, z):
    beam_thickness = 2
    height = 14
    bpy.ops.mesh.primitive_cube_add(size=beam_thickness, location=(x, y, z + (beam_thickness / 2) + height))
    bpy.ops.rigidbody.object_add()        
    bpy.context.object.rigid_body.mass = 0.0001

    bpy.context.object.scale = [10, 1, 1]
    bpy.ops.mesh.primitive_cube_add(size=beam_thickness, location=(x - 10, y, z + 7))
    bpy.ops.rigidbody.object_add()        
    bpy.context.object.rigid_body.mass = 0.0001

    bpy.context.object.scale = [1, 1, height / 2]
    bpy.ops.mesh.primitive_cube_add(size=beam_thickness, location=(x + 10, y, z + 7))
    bpy.ops.rigidbody.object_add()        
    bpy.context.object.rigid_body.mass = 0.0001
    bpy.context.object.scale = [1, 1, height / 2]

def add_marble():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=4, location=(0, -1, 30))    
    bpy.ops.rigidbody.object_add()
    bpy.context.object.rigid_body.collision_shape = 'MESH'

add_ground()
add_marble()

for y in range (-5, 5):
    add_arch(0, y * 5, 0)