"use strict";

// ---------------------------------------------------------------------------
// the unit cube
// ---------------------------------------------------------------------------

// The eight corners of a cube one unit on a side, centred on the origin.
var CUBE_CORNERS = [
    vec4(-0.5, -0.5,  0.5, 1.0),
    vec4(-0.5,  0.5,  0.5, 1.0),
    vec4( 0.5,  0.5,  0.5, 1.0),
    vec4( 0.5, -0.5,  0.5, 1.0),
    vec4(-0.5, -0.5, -0.5, 1.0),
    vec4(-0.5,  0.5, -0.5, 1.0),
    vec4( 0.5,  0.5, -0.5, 1.0),
    vec4( 0.5, -0.5, -0.5, 1.0)
];

// One face of the cube, as two triangles over four corners given counter
// clockwise. The normal is the cross product of two edges of the face, which is
// how we found the normal of a triangle in class.
function cubeFace(a, b, c, d, positions, normals)
{
    var p = CUBE_CORNERS;

    var t1 = subtract(p[b], p[a]);
    var t2 = subtract(p[c], p[a]);
    var n  = normalize(cross(t1, t2));
    var n4 = vec4(n[0], n[1], n[2], 0.0);

    var order = [a, b, c, a, c, d];
    for (var i = 0; i < order.length; i++) {
        positions.push(p[order[i]]);
        normals.push(n4);
    }
}

// Six faces, 36 vertices. Every face is wound counter clockwise seen from
// outside, so the cube is solid from every direction and has no holes in it.
function buildCube()
{
    var positions = [];
    var normals   = [];

    cubeFace(1, 0, 3, 2, positions, normals);   // front
    cubeFace(2, 3, 7, 6, positions, normals);   // right
    cubeFace(3, 0, 4, 7, positions, normals);   // bottom
    cubeFace(6, 5, 1, 2, positions, normals);   // top
    cubeFace(4, 5, 6, 7, positions, normals);   // back
    cubeFace(5, 4, 0, 1, positions, normals);   // left

    return { positions: positions, normals: normals };
}
