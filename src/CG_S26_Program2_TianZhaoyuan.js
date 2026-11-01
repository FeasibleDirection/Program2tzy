"use strict";
var gl;
var canvas;

var aPositionLoc;
var uModelViewMatrixLoc, uProjectionMatrixLoc, uColorLoc;

var cubeBuffer = {};

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
    gl.enableVertexAttribArray(aPositionLoc);

    uModelViewMatrixLoc  = gl.getUniformLocation(program, "uModelViewMatrix");
    uProjectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");
    uColorLoc            = gl.getUniformLocation(program, "uColor");

    var cube = buildCube();
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cube.positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(aPositionLoc, 4, gl.FLOAT, false, 0, 0);
    cubeBuffer = { count: cube.positions.length };

    linkSlider("sOrbit", "vOrbit", function (v) { orbit = v; }, 0);
    linkSlider("sElev",  "vElev",  function (v) { elev = v; },  0);
    linkSlider("sDist",  "vDist",  function (v) { dist = v; },  1);

    render();
};

function cameraEye()
{
    var t = (90.0 - elev) * Math.PI / 180.0;
    var p = orbit * Math.PI / 180.0;
    return vec3(dist * Math.sin(t) * Math.cos(p),
                dist * Math.cos(t),
                dist * Math.sin(t) * Math.sin(p));
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var viewMatrix = lookAt(cameraEye(), vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));

    var projectionMatrix = perspective(50.0, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(uProjectionMatrixLoc, false, flatten(projectionMatrix));

    gl.uniformMatrix4fv(uModelViewMatrixLoc, false, flatten(viewMatrix));
    gl.uniform4fv(uColorLoc, vec4(0.82, 0.33, 0.24, 1.0));
    gl.drawArrays(gl.TRIANGLES, 0, cubeBuffer.count);
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
