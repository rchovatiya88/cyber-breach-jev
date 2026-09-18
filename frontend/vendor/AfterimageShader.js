(function() {
    THREE.AfterimageShader = {
        uniforms: {
            "damp": { value: 0.94 },
            "uZoom": { value: 0.996 },
            "tOldFrame": { value: null },
            "tDiffuse": { value: null }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float damp;
            uniform float uZoom;
            uniform sampler2D tOldFrame;
            uniform sampler2D tDiffuse;
            varying vec2 vUv;

            void main() {
                vec2 zoomedUv = (vUv - 0.5) * uZoom + 0.5;
                vec4 oldFrame = texture2D(tOldFrame, zoomedUv) * damp;
                vec4 currentFrame = texture2D(tDiffuse, vUv);
                // Soft blend: current frame always dominates, old frame adds subtle trails
                gl_FragColor = currentFrame + oldFrame * 0.15;
            }
        `
    };
})();
