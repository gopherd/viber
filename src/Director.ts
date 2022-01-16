import * as THREE from 'three';
import * as util from './util';
import * as heap from './heap';
import { Handler } from './Handler';
import { Scene } from './Scene';
import { Timer } from './Ticker';
import { ActionManager } from './Action';
import Stats from 'three/examples/jsm/libs/stats.module'

export interface DirectorOptions extends THREE.WebGLRendererParameters {
    stats?: boolean;
}

export class Director {
    private static $renderer: THREE.Renderer;
    private static $stats: Stats;
    private static $lastShowDrawCalls: number;
    private static $running = false;

    private static $scenes: Scene[] = [];
    private static $lastUpdatedAt: number = 0;
    private static $deltaTime: number = 0;
    private static $tickers: Handler[] = [];
    private static $timers: heap.Heap<Timer, heap.Map<Timer>> = heap.map<Timer>(null, (t1: Timer, t2: Timer): boolean => {
        return t1.next() < t2.next();
    });
    private static $actions = new ActionManager();
    private static $winSize: util.Size;

    /**
     * start initializes the application and starts main loop
     * @param entrypoint Function
     * @returns 
     */
    public static start(entrypoint: Function, parameters?: DirectorOptions) {
        if (this.$running) {
            return;
        }
        this.$running = true;
        this.resetSize();

        this.$lastUpdatedAt = this.now();
        this.$renderer = new THREE.WebGLRenderer(parameters);
        this.$renderer.setSize(window.innerWidth, window.innerHeight);
        if (parameters && parameters.stats) {
            this.$stats = Stats();
            document.body.appendChild(this.$stats.dom);
        }

        entrypoint();

        document.body.appendChild(this.$renderer.domElement);
        window.addEventListener('resize', this.onResize.bind(this), false);
        window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        function animate() {
            requestAnimationFrame(animate);
            Director.update();
        }
        animate();
    }

    private static onResize() {
        const scene = this.getRunningScene();
        if (!scene || !scene.camera || !scene.node) {
            return;
        }
        this.resetSize();
        if (scene.onResize()) {
            this.$renderer.setSize(this.$winSize.width, this.$winSize.height);
        }
    }

    private static resetSize() {
        this.$winSize = util.size(window.innerWidth, window.innerHeight)
    }

    private static onWheel(event: WheelEvent) {
        event.preventDefault();
        const scene = this.getRunningScene();
        if (!scene || !scene.camera || !scene.node) {
            return;
        }
        scene.onWheel(event);
    }

    public static get winSize(): util.Size {
        return this.$winSize;
    }

    public static get renderer(): THREE.Renderer {
        return this.$renderer;
    }

    /**
     * now returns current timestamp with seconds
     * @returns number
     */
    public static now(): number {
        return (new Date()).getTime() / 1000;
    }

    public static get deltaTime(): number {
        return this.$deltaTime;
    }

    /**
     * tick appends a ticker function which should be called in every frame
     * @param handler Function
     * @param args any[]
     */
    public static tick(handler: Function, ...args: any[]) {
        this.$tickers.push(new Handler(handler, ...args));
    }

    /**
     * setInterval adds a timer
     * @param handler Function
     * @param interval number
     * @param args any[]
     * @returns number
     */
    public static setInterval(handler: Function, interval: number, ...args: any[]): number {
        const ticker = new Timer(new Handler(handler, ...args), this.now(), interval, false);
        this.$timers.push(ticker);
        return ticker.id;
    }

    /**
     * setTimeourt adds a timer which at most called once
     * @param handler Function
     * @param interval number
     * @param args any[]
     * @returns number
     */
    public static setTimeout(handler: Function, timeout: number, ...args: any[]): number {
        const ticker = new Timer(new Handler(handler, ...args), this.now(), timeout, true);
        this.$timers.push(ticker);
        return ticker.id;
    }

    /**
     * clearInterval remove the timer
     * @param id number
     */
    public static clearInterval(id: number) {
        const i = this.$timers.container.indexof(id);
        if (i >= 0) {
            this.$timers.remove(i);
        }
    }

    /**
     * clearTimeout remove the timer
     * @param id number
     */
    public static clearTimeout(id: number) {
        const i = this.$timers.container.indexof(id);
        if (i >= 0) {
            this.$timers.remove(i);
        }
    }

    private static update() {
        const now = this.now();
        const dt = now - this.$lastUpdatedAt;
        this.$deltaTime = dt;
        this.$lastUpdatedAt = now;
        const scene = this.getRunningScene();
        if (scene) {
            if (dt > 0) {
                for (let i = 0; i < this.$tickers.length; i++) {
                    this.$tickers[i].call();
                }
                this.scheduleTimers(now);
                this.$actions.update(dt);
                scene.update();
            }
            if (scene.node && scene.camera) {
                this.$renderer.render(scene.node, scene.camera);
            }
        }
        if (this.$stats) {
            if (this.$renderer instanceof THREE.WebGLRenderer) {
                this.$lastShowDrawCalls = this.$lastShowDrawCalls || 0;
                if (this.$lastShowDrawCalls + 1 < now) {
                    this.$lastShowDrawCalls = now;
                    console.log("draw calls:", this.$renderer.info.render.calls);
                }
                this.$renderer.info.reset();
            }
            this.$stats.update();
        }
    }

    private static scheduleTimers(now: number) {
        while (this.$timers.size() > 0) {
            let next = this.$timers.container.get(0).next()
            if (next > now) {
                break;
            }
            let ticker = this.$timers.pop()
            if (!ticker.call()) {
                this.$timers.push(ticker);
            }
        }
    }

    /**
     * getRunningScene retrives current running scene
     * @returns Scene 
     */
    public static getRunningScene(): Scene {
        return this.$scenes[this.$scenes.length - 1];
    }

    /**
     * 切换场景，并在内存中替换之前最后一个场景
     * @param scene
     */
    public static runScene(scene: Scene) {
        const n = this.$scenes.length;
        if (n > 0) {
            this.$scenes.pop();
        }
        this.$scenes.push(scene);
    }
}