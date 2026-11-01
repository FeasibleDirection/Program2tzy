"use strict";

var gl;
var canvas;

var aPositionLoc, aNormalLoc;
var uModelViewMatrixLoc, uProjectionMatrixLoc, uNormalMatrixLoc;
var uColorLoc, uLightDirLoc, uAmbientLoc, uShininessLoc, uSpecularLoc;

var cubeBuffer = {}, terrainBuffer = {};
var modelViewMatrix, viewMatrix;

var orbit = 38, elev = 22, dist = 13.0;

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

    cubeBuffer    = makeBuffer(buildCube());
    terrainBuffer = makeBuffer(buildTerrain());

    linkSlider("sOrbit", "vOrbit", function (v) { orbit = v; }, 0);
    linkSlider("sElev",  "vElev",  function (v) { elev = v; },  0);
    linkSlider("sDist",  "vDist",  function (v) { dist = v; },  1);

    render();
};

// one buffer per mesh, filled once. Nothing is downloaded again while the
// program runs, which the brief asks for explicitly.
function makeBuffer(mesh)
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
function useMesh(m)
{
    gl.bindBuffer(gl.ARRAY_BUFFER, m.position);
    gl.vertexAttribPointer(aPositionLoc, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, m.normal);
    gl.vertexAttribPointer(aNormalLoc, 4, gl.FLOAT, false, 0, 0);
}

function part(w, h, d, color, down)
{
    var shift = down ? -0.5 * h : 0.5 * h;
    var t = mult(modelViewMatrix, mult(translate(0.0, shift, 0.0), scale(w, h, d)));
    gl.uniformMatrix4fv(uModelViewMatrixLoc, false, flatten(t));
    gl.uniformMatrix3fv(uNormalMatrixLoc, false, flatten(normalMatrix(t, true)));
    gl.uniform4fv(uColorLoc, color);
    gl.drawArrays(gl.TRIANGLES, 0, cubeBuffer.count);
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var t = (90.0 - elev) * Math.PI / 180.0;
    var p = orbit * Math.PI / 180.0;
    var eye = vec3(dist * Math.sin(t) * Math.cos(p),
                   dist * Math.cos(t),
                   dist * Math.sin(t) * Math.sin(p));

    viewMatrix = lookAt(eye, vec3(0.0, 0.6, 0.0), vec3(0.0, 1.0, 0.0));
    gl.uniformMatrix4fv(uProjectionMatrixLoc, false,
        flatten(perspective(50.0, canvas.width / canvas.height, 0.1, 100.0)));

    // the sun, given in world coordinates then carried into eye coordinates by
    // the view matrix so it stays put while the camera moves
    var sunWorld = vec4(0.45, 0.72, 0.52, 0.0);
    var sunEye = mult(viewMatrix, sunWorld);
    gl.uniform3fv(uLightDirLoc, flatten(vec3(sunEye[0], sunEye[1], sunEye[2])));
    gl.uniform1f(uAmbientLoc, 0.30);
    gl.uniform1f(uShininessLoc, 28.0);
    gl.uniform1f(uSpecularLoc, 0.22);

    useMesh(terrainBuffer);
    modelViewMatrix = viewMatrix;
    gl.uniformMatrix4fv(uModelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix3fv(uNormalMatrixLoc, false, flatten(normalMatrix(modelViewMatrix, true)));
    gl.uniform4fv(uColorLoc, vec4(0.38, 0.52, 0.33, 1.0));
    gl.drawArrays(gl.TRIANGLES, 0, terrainBuffer.count);

    useMesh(cubeBuffer);
    modelViewMatrix = mult(viewMatrix, translate(0.0, terrainHeight(0.0, 0.0) + 0.4, 0.0));
    part(0.62, 0.80, 0.36, vec4(0.82, 0.33, 0.24, 1.0), false);
}

function linkSlider(sliderId, labelId, setter, decimals)
{
    var s = document.getElementById(sliderId);
    var out = document.getElementById(labelId);
    s.oninput = function (event) {
        var v = Number(event.target.value);
        setter(v);
        out.textContent = v.toFixed(decimals);
        render();
    };
}
