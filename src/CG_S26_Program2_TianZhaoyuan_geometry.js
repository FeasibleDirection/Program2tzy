"use strict";

// CG Program 2 - geometry
// Zhaoyuan Tian, CS 5382/7382 Computer Graphics
//
// Plain data only. Nothing in this file touches WebGL. It builds two things:
//
//   buildCube()      one unit cube, centred on the origin, with face normals.
//                    Every part of the robot is this cube with its own
//                    instance transform.
//
//   buildTerrain()   a heightfield on the XZ-plane, with a smooth normal at
//                    every vertex.
//
// terrainHeight(x, z) is exported as well, because the walking code has to ask
// how high the ground is under the figure's feet.


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


// ---------------------------------------------------------------------------
// the landscape
// ---------------------------------------------------------------------------

var TERRAIN_SIZE = 14.0;    // the patch runs from -7 to 7 in x and z
var TERRAIN_N    = 60;      // cells per side

// The height of the ground at any point. Two sine waves at different
// frequencies crossed with a cosine, which gives rolling hills rather than a
// regular egg box, and a wide dish term so the middle of the map sits lower
// than the rim and the figure has somewhere to walk down into.
function terrainHeight(x, z)
{
    var hills =
          0.80 * Math.sin(0.55 * x) * Math.cos(0.42 * z)
        + 0.45 * Math.sin(0.31 * z + 1.3)
        + 0.25 * Math.cos(0.90 * x + 0.7) * Math.sin(0.70 * z);

    var r    = Math.sqrt(x * x + z * z) / (0.5 * TERRAIN_SIZE);
    var dish = 0.9 * r * r;          // rises towards the edges

    return hills + dish;
}

// The normal of the surface at a grid point, from the heights of its four
// neighbours. The vector along x and the vector along z are both tangent to
// the surface, so their cross product is perpendicular to it.
//
// Taking the neighbours rather than the corners of one triangle is what makes
// the normal smooth across the whole sheet: neighbouring triangles share it,
// so the landscape shades as a curved surface instead of showing facets.
function terrainNormal(x, z, step)
{
    var hL = terrainHeight(x - step, z);
    var hR = terrainHeight(x + step, z);
    var hD = terrainHeight(x, z - step);
    var hU = terrainHeight(x, z + step);

    var alongX = vec3(2.0 * step, hR - hL, 0.0);
    var alongZ = vec3(0.0, hU - hD, 2.0 * step);

    return normalize(cross(alongZ, alongX));
}

// The grid, as two triangles per cell. x and z run across the ground and the
// height goes into y, which is what puts the sheet in the XZ-plane, and the
// grid is centred on the world origin.
function buildTerrain()
{
    var positions = [];
    var normals   = [];

    var step = TERRAIN_SIZE / TERRAIN_N;
    var half = 0.5 * TERRAIN_SIZE;
    var i, j;

    // heights and normals first, so each is computed once per grid point
    // rather than once per triangle that uses it
    var h = [], n = [];
    for (i = 0; i <= TERRAIN_N; i++) {
        h.push([]); n.push([]);
        var x = -half + i * step;
        for (j = 0; j <= TERRAIN_N; j++) {
            var z = -half + j * step;
            h[i].push(terrainHeight(x, z));
            n[i].push(terrainNormal(x, z, step));
        }
    }

    function corner(i, j)
    {
        var x = -half + i * step;
        var z = -half + j * step;
        positions.push(vec4(x, h[i][j], z, 1.0));
        var v = n[i][j];
        normals.push(vec4(v[0], v[1], v[2], 0.0));
    }

    for (i = 0; i < TERRAIN_N; i++) {
        for (j = 0; j < TERRAIN_N; j++) {
            corner(i,     j    );
            corner(i + 1, j    );
            corner(i + 1, j + 1);

            corner(i,     j    );
            corner(i + 1, j + 1);
            corner(i,     j + 1);
        }
    }

    return { positions: positions, normals: normals };
}
