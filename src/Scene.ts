import * as THREE from 'three';

export class Scene {
    public node: THREE.Scene;

    private $camera: THREE.Camera;
    private $gui: THREE.Object3D;
    private $tanFOV: number;
    private $windowHeight: number;

    constructor(node?: null | THREE.Scene) {
        if (node) {
            this.node = node;
        } else {
            this.node = new THREE.Scene();
        }
    }

    public get camera(): THREE.Camera {
        return this.$camera;
    }

    public set camera(camera: THREE.Camera) {
        this.$camera = camera;
        if (camera.parent) {
            camera.removeFromParent();
        }
        if (camera instanceof THREE.PerspectiveCamera) {
            this.$tanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
            this.$windowHeight = window.innerHeight;
        }
        this.node.add(camera);
    }

    public onResize(): boolean {
        if (!this.$camera || !(this.$camera instanceof THREE.PerspectiveCamera)) {
            return false;
        }
        const camera = this.$camera;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.fov = (360 / Math.PI) * Math.atan(this.$tanFOV * (window.innerHeight / this.$windowHeight));
        camera.updateProjectionMatrix();
        camera.lookAt(this.node.position);
        return true;
    }

    public onWheel(event: WheelEvent) {
    }

    public get gui(): THREE.Object3D {
        if (!this.$gui) {
            this.$gui = new THREE.Object3D();
            this.$camera.attach(this.$gui);
        }
        return this.$gui;
    }

    update() {
    }
}
