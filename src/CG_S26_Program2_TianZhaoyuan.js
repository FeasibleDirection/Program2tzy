"use strict";
var gl;
var canvas;

var aPositionLoc, aNormalLoc;
var uModelViewMatrixLoc, uProjectionMatrixLoc, uNormalMatrixLoc;
var uColorLoc, uLightDirLoc, uAmbientLoc, uShininessLoc, uSpecularLoc;

var cubeBuffer = {}, terrainBuffer = {};

var modelViewMatrix;        // the current transformation matrix
var viewMatrix;             // camera only, the base every object starts from
var stack = [];

// ---- joints, in degrees ----------------------------------------------------
var joint = {
    head: 0,
    lSh: 18, lEl: -25,
    rSh: -18, rEl: -25,
    lHip: -14, lKn: 12,
    rHip: 14, rKn: 12
};

// ---- where the figure stands ----------------------------------------------
var figX = -2.0, figZ = 1.5, facing = 35;

// ---- camera ----------------------------------------------------------------
var orbit = 38, elev = 22, dist = 13.0;
var CAMERA_CLEARANCE = 0.7;     // how far the eye is kept above the ground

// ---- sun -------------------------------------------------------------------
var sunDir = 55, sunElev = 46;
var sunMoving = false;

// ---- the walk --------------------------------------------------------------
var walking = false;
var walkClock = 0.0;
var lastFrame = 0;
// ---- part sizes, in world units --------------------------------------------
var TORSO_W = 0.62, TORSO_H = 0.80, TORSO_D = 0.36;
var HEAD_S  = 0.38;
var UARM_W  = 0.17, UARM_L = 0.42, UARM_D = 0.17;
var LARM_W  = 0.15, LARM_L = 0.38, LARM_D = 0.15;
var ULEG_W  = 0.21, ULEG_L = 0.46, ULEG_D = 0.21;
var LLEG_W  = 0.19, LLEG_L = 0.44, LLEG_D = 0.19;
var FOOT_W  = 0.23, FOOT_H = 0.11, FOOT_D = 0.40;

// how high the hip sits above the ground when the legs are straight
var HIP_HEIGHT = ULEG_L + LLEG_L + FOOT_H;

// ---- colours ---------------------------------------------------------------
var COL_TORSO = vec4(0.82, 0.33, 0.24, 1.0);
var COL_HEAD  = vec4(0.93, 0.84, 0.70, 1.0);
var COL_ARM   = vec4(0.30, 0.46, 0.62, 1.0);
var COL_LEG   = vec4(0.26, 0.31, 0.38, 1.0);
var COL_FOOT  = vec4(0.17, 0.19, 0.23, 1.0);
var COL_GROUND= vec4(0.38, 0.52, 0.33, 1.0);


window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = canvas.getContext('webgl2');
    if (!gl) { alert("WebGL 2.0 isn't available"); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.051, 0.067, 0.090, 1.0);
    gl.enable(gl.DEPTH_TEST);

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    aPositionLoc = gl.getAttribLocation(program, "aPosition");
    aNormalLoc   = gl.getAttribLocation(program, "aNormal");
    gl.enableVertexAttribArray(aPositionLoc);
    gl.enableVertexAttribArray(aNormalLoc);

    uModelViewMatrixLoc  = gl.getUniformLocation(program, "uModelViewMatrix");
    uProjectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");
    uNormalMatrixLoc     = gl.getUniformLocation(program, "uNormalMatrix");
    uColorLoc            = gl.getUniformLocation(program, "uColor");
    uLightDirLoc         = gl.getUniformLocation(program, "uLightDir");
    uAmbientLoc          = gl.getUniformLocation(program, "uAmbient");
    uShininessLoc        = gl.getUniformLocation(program, "uShininess");
    uSpecularLoc         = gl.getUniformLocation(program, "uSpecular");

    // Both meshes are built and sent to the GPU once, here. Nothing is
    // downloaded again while the program is running.
    cubeBuffer    = makeBuffers(buildCube());
    terrainBuffer = makeBuffers(buildTerrain());

    hookUpControls();

    lastFrame = 0;
    requestAnimationFrame(frame);
};


// one position buffer and one normal buffer for a mesh, filled once
function makeBuffers(mesh)
{
    var pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(mesh.positions), gl.STATIC_DRAW);

    var nor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nor);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(mesh.normals), gl.STATIC_DRAW);

    return { position: pos, normal: nor, count: mesh.positions.length };
}

// vertexAttribPointer records whichever buffer is bound when it is called, so
// switching meshes means calling it again
function useMesh(buffers)
{
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(aPositionLoc, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(aNormalLoc, 4, gl.FLOAT, false, 0, 0);
}


// ---------------------------------------------------------------------------
// the matrix stack
// ---------------------------------------------------------------------------
function push() { stack.push(modelViewMatrix); }
function pop()  { modelViewMatrix = stack.pop(); }

// Draw the unit cube as one part of the figure. w, h and d scale it, and the
// part is placed so that it hangs downward from the current origin when down
// is true, which is what a limb segment wants: the next joint is then at the
// far end of it.
function part(w, h, d, color, down)
{
    var shift = down ? -0.5 * h : 0.5 * h;
    var instanceMatrix = mult(translate(0.0, shift, 0.0), scale(w, h, d));
    var t = mult(modelViewMatrix, instanceMatrix);

    gl.uniformMatrix4fv(uModelViewMatrixLoc, false, flatten(t));
    gl.uniformMatrix3fv(uNormalMatrixLoc, false, flatten(normalMatrix(t, true)));
    gl.uniform4fv(uColorLoc, color);
    gl.drawArrays(gl.TRIANGLES, 0, cubeBuffer.count);
}

// one arm: shoulder joint, upper arm, elbow joint, lower arm
function arm(sideX, shoulderAngle, elbowAngle)
{
    push();
        modelViewMatrix = mult(modelViewMatrix, translate(sideX, TORSO_H * 0.40, 0.0));
        modelViewMatrix = mult(modelViewMatrix, rotateX(shoulderAngle));
        part(UARM_W, UARM_L, UARM_D, COL_ARM, true);

        modelViewMatrix = mult(modelViewMatrix, translate(0.0, -UARM_L, 0.0));
        modelViewMatrix = mult(modelViewMatrix, rotateX(elbowAngle));
        part(LARM_W, LARM_L, LARM_D, COL_ARM, true);
    pop();
}

// one leg: hip joint, thigh, knee joint, shin, and a foot on the end
function leg(sideX, hipAngle, kneeAngle)
{
    push();
        modelViewMatrix = mult(modelViewMatrix, translate(sideX, 0.0, 0.0));
        modelViewMatrix = mult(modelViewMatrix, rotateX(hipAngle));
        part(ULEG_W, ULEG_L, ULEG_D, COL_LEG, true);

        modelViewMatrix = mult(modelViewMatrix, translate(0.0, -ULEG_L, 0.0));
        modelViewMatrix = mult(modelViewMatrix, rotateX(kneeAngle));
        part(LLEG_W, LLEG_L, LLEG_D, COL_LEG, true);

        modelViewMatrix = mult(modelViewMatrix, translate(0.0, -LLEG_L, 0.0));
        modelViewMatrix = mult(modelViewMatrix, rotateX(-kneeAngle - hipAngle));
        modelViewMatrix = mult(modelViewMatrix, translate(0.0, 0.0, FOOT_D * 0.22));
        part(FOOT_W, FOOT_H, FOOT_D, COL_FOOT, true);
    pop();
}

function drawRobot()
{
    useMesh(cubeBuffer);

    // Where the figure stands in the scene. The ground is not flat, so the
    // height comes from the same heightfield function the landscape is built
    // from, which is what keeps the feet on the surface.
    var groundY = terrainHeight(figX, figZ);

    modelViewMatrix = mult(viewMatrix, translate(figX, groundY + HIP_HEIGHT, figZ));
    modelViewMatrix = mult(modelViewMatrix, rotateY(facing));

    // hips are the root of the figure
    push();
        // torso sits on the hips
        part(TORSO_W, TORSO_H, TORSO_D, COL_TORSO, false);

        push();
            modelViewMatrix = mult(modelViewMatrix, translate(0.0, TORSO_H, 0.0));
            modelViewMatrix = mult(modelViewMatrix, rotateY(joint.head));
            part(HEAD_S, HEAD_S, HEAD_S, COL_HEAD, false);
        pop();

        arm( (TORSO_W + UARM_W) * 0.5, joint.lSh, joint.lEl);
        arm(-(TORSO_W + UARM_W) * 0.5, joint.rSh, joint.rEl);
    pop();

    leg( TORSO_W * 0.26, joint.lHip, joint.lKn);
    leg(-TORSO_W * 0.26, joint.rHip, joint.rKn);
}

function drawLandscape()
{
    useMesh(terrainBuffer);

    modelViewMatrix = viewMatrix;
    gl.uniformMatrix4fv(uModelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix3fv(uNormalMatrixLoc, false,
                        flatten(normalMatrix(modelViewMatrix, true)));
    gl.uniform4fv(uColorLoc, COL_GROUND);
    gl.drawArrays(gl.TRIANGLES, 0, terrainBuffer.count);
}


// ---------------------------------------------------------------------------
// one frame
// ---------------------------------------------------------------------------
function frame(now)
{
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000.0, 0.05) : 0.0;
    lastFrame = now;

    if (walking) stepTheWalk(dt);
    if (sunMoving) {
        sunDir = (sunDir + 18.0 * dt) % 360.0;
        setSlider("sSunDir", "vSunDir", sunDir, 0);
    }

    render();
    requestAnimationFrame(frame);
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ---- camera ----------------------------------------------------------
    // Two angles and a distance place the eye, the way the camera was
    // described in class: one angle around the scene, one above the ground.
    var t = (90.0 - elev) * Math.PI / 180.0;
    var p = orbit * Math.PI / 180.0;

    var eye = vec3(dist * Math.sin(t) * Math.cos(p),
                   dist * Math.cos(t),
                   dist * Math.sin(t) * Math.sin(p));

    // At a low height the orbit would put the eye underneath a hill and the
    // view would end up inside the ground. Asking the heightfield how high the
    // land is at the eye's own x and z, and lifting the eye above it, keeps
    // every camera setting outside the terrain.
    var underfoot = terrainHeight(eye[0], eye[2]) + CAMERA_CLEARANCE;
    if (eye[1] < underfoot) eye[1] = underfoot;

    viewMatrix = lookAt(eye, vec3(0.0, 0.6, 0.0), vec3(0.0, 1.0, 0.0));

    var projectionMatrix = perspective(50.0, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(uProjectionMatrixLoc, false, flatten(projectionMatrix));

    // ---- the sun ---------------------------------------------------------
    // The light is given in world coordinates and then turned into eye
    // coordinates by the view matrix, so it stays put in the scene while the
    // camera orbits around it.
    var st = (90.0 - sunElev) * Math.PI / 180.0;
    var sp = sunDir * Math.PI / 180.0;
    var sunWorld = vec4(Math.sin(st) * Math.cos(sp),
                        Math.cos(st),
                        Math.sin(st) * Math.sin(sp), 0.0);
    var sunEye = mult(viewMatrix, sunWorld);

    gl.uniform3fv(uLightDirLoc, flatten(vec3(sunEye[0], sunEye[1], sunEye[2])));
    gl.uniform1f(uAmbientLoc, 0.30);
    gl.uniform1f(uShininessLoc, 28.0);
    gl.uniform1f(uSpecularLoc, 0.22);

    drawLandscape();
    drawRobot();
}


// ---------------------------------------------------------------------------
// the walk: a sequence of animated motions
// ---------------------------------------------------------------------------
// Every joint angle becomes a function of one clock. The legs swing out of
// phase with each other, the arms swing opposite their own leg, and the figure
// is carried forward along the direction it is facing. Because the ground is a
// heightfield, walking over a hill lifts the whole figure with it.
function stepTheWalk(dt)
{
    walkClock += dt * 3.4;

    var s = Math.sin(walkClock);
    var c = Math.cos(walkClock);

    joint.lHip = 26.0 * s;
    joint.rHip = -26.0 * s;
    joint.lKn  = 22.0 * Math.max(0.0, -s) + 6.0;
    joint.rKn  = 22.0 * Math.max(0.0,  s) + 6.0;

    joint.lSh  = -20.0 * s;
    joint.rSh  =  20.0 * s;
    joint.lEl  = -28.0 + 10.0 * c;
    joint.rEl  = -28.0 - 10.0 * c;
    joint.head = 9.0 * Math.sin(walkClock * 0.5);

    // forward along the facing direction, and turned back at the edge of the map
    var speed = 1.25 * dt;
    var rad = facing * Math.PI / 180.0;
    var nx = figX + speed * Math.sin(rad);
    var nz = figZ + speed * Math.cos(rad);

    if (Math.abs(nx) > 5.0 || Math.abs(nz) > 5.0) {
        facing = (facing + 180.0 + 37.0) % 360.0;
        setSlider("sFace", "vFace", facing, 0);
    } else {
        figX = nx; figZ = nz;
        setSlider("sPosX", "vPosX", figX, 1);
        setSlider("sPosZ", "vPosZ", figZ, 1);
    }

    showJointSliders();
}

function showJointSliders()
{
    setSlider("sHead", "vHead", joint.head, 0);
    setSlider("sLSh", "vLSh", joint.lSh, 0);
    setSlider("sLEl", "vLEl", joint.lEl, 0);
    setSlider("sRSh", "vRSh", joint.rSh, 0);
    setSlider("sREl", "vREl", joint.rEl, 0);
    setSlider("sLHip", "vLHip", joint.lHip, 0);
    setSlider("sLKn", "vLKn", joint.lKn, 0);
    setSlider("sRHip", "vRHip", joint.rHip, 0);
    setSlider("sRKn", "vRKn", joint.rKn, 0);
}


// ---------------------------------------------------------------------------
// the controls
// ---------------------------------------------------------------------------
function hookUpControls()
{
    linkSlider("sHead", "vHead", function (v) { joint.head = v; }, 0);
    linkSlider("sLSh",  "vLSh",  function (v) { joint.lSh  = v; }, 0);
    linkSlider("sLEl",  "vLEl",  function (v) { joint.lEl  = v; }, 0);
    linkSlider("sRSh",  "vRSh",  function (v) { joint.rSh  = v; }, 0);
    linkSlider("sREl",  "vREl",  function (v) { joint.rEl  = v; }, 0);
    linkSlider("sLHip", "vLHip", function (v) { joint.lHip = v; }, 0);
    linkSlider("sLKn",  "vLKn",  function (v) { joint.lKn  = v; }, 0);
    linkSlider("sRHip", "vRHip", function (v) { joint.rHip = v; }, 0);
    linkSlider("sRKn",  "vRKn",  function (v) { joint.rKn  = v; }, 0);

    linkSlider("sPosX", "vPosX", function (v) { figX = v; },   1);
    linkSlider("sPosZ", "vPosZ", function (v) { figZ = v; },   1);
    linkSlider("sFace", "vFace", function (v) { facing = v; }, 0);

    linkSlider("sOrbit", "vOrbit", function (v) { orbit = v; }, 0);
    linkSlider("sElev",  "vElev",  function (v) { elev = v; },  0);
    linkSlider("sDist",  "vDist",  function (v) { dist = v; },  1);

    linkSlider("sSunDir", "vSunDir", function (v) { sunDir = v; },  0);
    linkSlider("sSunEl",  "vSunEl",  function (v) { sunElev = v; }, 0);

    document.getElementById("bWalk").onclick = function () {
        walking = !walking;
        this.textContent = walking ? "Stop" : "Walk";
    };

    document.getElementById("bSun").onclick = function () {
        sunMoving = !sunMoving;
        this.textContent = sunMoving ? "Hold the sun" : "Move the sun";
    };

    document.getElementById("bPose").onclick = function () {
        walking = false;
        document.getElementById("bWalk").textContent = "Walk";
        joint = { head: 0, lSh: 18, lEl: -25, rSh: -18, rEl: -25,
                  lHip: -14, lKn: 12, rHip: 14, rKn: 12 };
        showJointSliders();
    };
}

function linkSlider(sliderId, labelId, setter, decimals)
{
    var s = document.getElementById(sliderId);
    var out = document.getElementById(labelId);
    s.oninput = function (event) {
        var v = Number(event.target.value);
        setter(v);
        out.textContent = v.toFixed(decimals);
    };
}

function setSlider(sliderId, labelId, value, decimals)
{
    document.getElementById(sliderId).value = value;
    document.getElementById(labelId).textContent = value.toFixed(decimals);
}
