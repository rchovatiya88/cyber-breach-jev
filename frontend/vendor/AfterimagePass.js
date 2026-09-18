(function() {
    class AfterimagePass extends THREE.Pass {
        constructor(damp = 0.94) {
            super();

            if (THREE.AfterimageShader === undefined) {
                console.error("THREE.AfterimagePass relies on THREE.AfterimageShader");
            }

            this.shader = THREE.AfterimageShader;
            this.uniforms = THREE.UniformsUtils.clone(this.shader.uniforms);
            this.uniforms["damp"].value = damp;

            this.textureComp = new THREE.ShaderMaterial({
                uniforms: this.uniforms,
                vertexShader: this.shader.vertexShader,
                fragmentShader: this.shader.fragmentShader
            });

            this.textureOld = new THREE.ShaderMaterial({
                uniforms: THREE.UniformsUtils.clone(THREE.CopyShader.uniforms),
                vertexShader: THREE.CopyShader.vertexShader,
                fragmentShader: THREE.CopyShader.fragmentShader
            });

            this.compFsQuad = new THREE.FullScreenQuad(this.textureComp);
            this.copyFsQuad = new THREE.FullScreenQuad(this.textureOld);

            const parameters = {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.HalfFloatType
            };

            this.renderTargetOld = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, parameters);
            this.renderTargetComp = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, parameters);
        }

        render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
            this.uniforms["tDiffuse"].value = readBuffer.texture;
            this.uniforms["tOldFrame"].value = this.renderTargetOld.texture;

            // Render composite into renderTargetComp
            renderer.setRenderTarget(this.renderTargetComp);
            this.compFsQuad.render(renderer);

            // Copy renderTargetComp to writeBuffer (or screen)
            this.textureOld.uniforms["tDiffuse"].value = this.renderTargetComp.texture;
            
            if (this.renderToScreen) {
                renderer.setRenderTarget(null);
                this.copyFsQuad.render(renderer);
            } else {
                renderer.setRenderTarget(writeBuffer);
                if (this.clear) renderer.clear();
                this.copyFsQuad.render(renderer);
            }

            // Ping-pong the two render targets
            let temp = this.renderTargetOld;
            this.renderTargetOld = this.renderTargetComp;
            this.renderTargetComp = temp;
        }

        setSize(width, height) {
            this.renderTargetOld.setSize(width, height);
            this.renderTargetComp.setSize(width, height);
        }
        
        dispose() {
            this.renderTargetOld.dispose();
            this.renderTargetComp.dispose();
            this.textureComp.dispose();
            this.textureOld.dispose();
            this.compFsQuad.dispose();
            this.copyFsQuad.dispose();
        }
    }

    THREE.AfterimagePass = AfterimagePass;
})();
