"use strict";

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
    // return dish;
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
    var half = 0.5 * TERRAIN_SIZE; //If  change TERRAIN_SIZE to 16 and want the same relative hill shape, change that divisor to TERRAIN_SIZE / 2 as well.
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

    // Counter clockwise seen from above, which is what the cube already does
    // and what gl.CULL_FACE expects. Taking the cross product of the first two
    // edges of (i,j) -> (i,j+1) -> (i+1,j+1) gives +y, so the front face of
    // each triangle is its top. Wound the other way round, every triangle in
    // the landscape faces away from the camera and culling throws the whole
    // sheet away.
    for (i = 0; i < TERRAIN_N; i++) {
        for (j = 0; j < TERRAIN_N; j++) {
            corner(i,     j    );
            corner(i,     j + 1);
            corner(i + 1, j + 1);

            corner(i,     j    );
            corner(i + 1, j + 1);
            corner(i + 1, j    );
        }
    }

    // and a wall round the rim, so the land has a side to show
    addSkirt(positions, normals, h, step, half);

    return { positions: positions, normals: normals };
}


// ---------------------------------------------------------------------------
// the skirt
// ---------------------------------------------------------------------------
// buildTerrain on its own makes a sheet, and a sheet has a top and nothing
// else, so from a low camera it reads as a flat disc hanging in space. Walking
// the rim once and dropping a wall from the ground to a floor below the scene
// turns it into a block of land with a cut edge.

var SKIRT_FLOOR = -3.0;

function addSkirt(positions, normals, h, step, half)
{
    // The rim, walked once all the way round, counter clockwise seen from
    // above. Consecutive entries are always one grid step apart, corners
    // included, so no piece of the wall is ever degenerate.
    var loop = [];
    var k;
    for (k = 0;         k < TERRAIN_N; k++) loop.push([0, k]);           // x = -half  left edge
    for (k = 0;         k < TERRAIN_N; k++) loop.push([k, TERRAIN_N]);   // z = +half  , 2. Bottom edge
    for (k = TERRAIN_N; k > 0;         k--) loop.push([TERRAIN_N, k]);   // x = +half , 3. Right edge
    for (k = TERRAIN_N; k > 0;         k--) loop.push([k, 0]);           // z = -half  // 4. Top edge

    for (k = 0; k < loop.length; k++) {
        var a = loop[k];
        var b = loop[(k + 1) % loop.length];

        var ax = -half + a[0] * step, az = -half + a[1] * step;
        var bx = -half + b[0] * step, bz = -half + b[1] * step;

        // Which way is out. Turning the walking direction a quarter turn in
        // the ground plane gives the outward side, and it is the vertex normal
        // too, so the wall is lit as a vertical face and not as more ground.
        var n  = normalize(vec3(-(bz - az), 0.0, bx - ax));
        var n4 = vec4(n[0], n[1], n[2], 0.0);

        var aTop = vec4(ax, h[a[0]][a[1]], az, 1.0);
        var aBot = vec4(ax, SKIRT_FLOOR,   az, 1.0);
        var bBot = vec4(bx, SKIRT_FLOOR,   bz, 1.0);
        var bTop = vec4(bx, h[b[0]][b[1]], bz, 1.0);

        // top, bottom, bottom, top winds the piece counter clockwise seen
        // from outside
        var tri = [aTop, aBot, bBot, aTop, bBot, bTop];
        for (var v = 0; v < 6; v++) { positions.push(tri[v]); normals.push(n4); }
    }
}
