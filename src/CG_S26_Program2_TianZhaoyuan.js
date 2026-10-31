"use strict";

// Step 02 - a page, a canvas and a WebGL 2 context
//
// Nothing is drawn yet. This proves the canvas exists, that the browser gives
// back a WebGL 2 context, and that clearing works. Depth testing goes on here
// rather than later, because everything in this project is three dimensional
// and the far side of a solid must not paint over the near side.

var gl;
var canvas;

var aPositionLoc;
var uModelViewMatrixLoc, uProjectionMatrixLoc, uColorLoc;
var cubeBuffer = {};

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = canvas.getContext('webgl2');
    if (!gl) { alert("WebGL 2.0 isn't available"); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.051, 0.067, 0.090, 1.0);
    gl.enable(gl.DEPTH_TEST);

    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    aPositionLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPositionLoc);

    uModelViewMatrixLoc  = gl.getUniformLocation(program, "uModelViewMatrix");
    uProjectionMatrixLoc = gl.getUniformLocation(program, "uProjectionMatrix");
    uColorLoc            = gl.getUniformLocation(program, "uColor");

    // the mesh is built and sent to the GPU once, here, and never again
    var cube = buildCube();
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cube.positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(aPositionLoc, 4, gl.FLOAT, false, 0, 0);
    cubeBuffer = { count: cube.positions.length };

    render();
};

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var eye = vec3(4.0, 3.0, 6.0);
    var viewMatrix = lookAt(eye, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));

    var projectionMatrix = perspective(50.0, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(uProjectionMatrixLoc, false, flatten(projectionMatrix));

    gl.uniformMatrix4fv(uModelViewMatrixLoc, false, flatten(viewMatrix));
    gl.uniform4fv(uColorLoc, vec4(0.82, 0.33, 0.24, 1.0));
    gl.drawArrays(gl.TRIANGLES, 0, cubeBuffer.count);
}

