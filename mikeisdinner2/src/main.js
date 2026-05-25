import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { UIManager } from './UI.js';
import { Player }    from './Player.js';
import { Level }     from './Level.js';
import { Monster }   from './Monster.js';
import { AudioSystem } from './AudioSystem.js';
import { State }     from './GameState.js';

class GameApp {
    constructor() {
        this.audio = new AudioSystem();
        this.ui    = new UIManager(this);
        this.clock = new THREE.Clock();

        this.initThree();
        this.initPhysics();

        this.isRunning      = false;
        this.jumpscareTimer = 0;
        this.nextJumpscareTime = 0;
        this.heartbeatTimer = 0;

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    initThree() {
        this.scene = new THREE.Scene();
        // Sleek dark sky backdrop (Clear, bright and visible as requested: Granny 2 style!)
        this.scene.background = new THREE.Color(0x0f0f15);
        this.scene.fog = new THREE.FogExp2(0x0f0f15, 0.015); // Slight volumetric fog for depth

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;z-index:1;';
        document.body.insertBefore(this.renderer.domElement, document.getElementById('game-ui'));

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65); // High ambient light!
        this.scene.add(this.ambientLight);

        // Directional moonlight for soft shadows
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.55);
        sunLight.position.set(20, 40, 20);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        this.scene.add(sunLight);
    }

    initPhysics() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -10.5, 0) });
        this.defaultMaterial = new CANNON.Material('default');
        const cm = new CANNON.ContactMaterial(this.defaultMaterial, this.defaultMaterial, {
            friction: 0.0,
            restitution: 0.0
        });
        this.world.addContactMaterial(cm);
        this.world.defaultContactMaterial = cm;
    }

    initGame() {
        // Clear old scene items if re-initializing
        if (this.level) {
            // Remove previous objects from Three.js scene
            this.level.items.forEach(item => this.scene.remove(item));
            
            // Re-create the physics world from scratch to prevent double collision bodies!
            this.initPhysics();
            
            this.scene = new THREE.Scene();
            this.initThree();
            
            this.level = null;
            this.player = null;
            this.monster = null;
            this.warden = null;
            this.monsters = [];
        }

        // Build Level, Player, and the two roaming threats.
        this.level   = new Level(this);
        this.player  = new Player(this);
        this.monster = new Monster(this, 'mike');
        this.warden  = new Monster(this, 'warden');
        this.monsters = [this.monster, this.warden];

        this.resetPositions();
        this.player.stamina = 100;
        this.player.battery = 100;
        this.player.isGrounded = false;
        this.player.canDoubleJump = false;
        this.player.updateFlashlight();

        this.scheduleNextJumpscare();
        this.audio.playBGM();

        this.isRunning = true;
        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    scheduleNextJumpscare() {
        const c = State.getConfig();
        // High frequency ambient jumpscares to scare the player randomly!
        this.nextJumpscareTime = c.jumpScareMin + Math.random() * (c.jumpScareMax - c.jumpScareMin);
        this.jumpscareTimer = 0;
    }

    triggerJumpscare() {
        if (State.difficulty === 'practice') return;
        this.audio.playJumpscareSound();
        const s = document.getElementById('jumpscare-screen');
        if (s) {
            s.classList.remove('hidden');
            s.classList.add('active');
            setTimeout(() => {
                s.classList.add('hidden');
                s.classList.remove('active');
                this.scheduleNextJumpscare();
            }, 600);
        }
    }

    resetPositions() {
        if (this.player) {
            // Spawn inside Cabin/Sanatorium lobby
            if (State.levelSelected === 'grounds') {
                this.player.body.position.set(5, 0.9, -5);
            } else {
                this.player.body.position.set(0, 0.9, -2); // Center of Sanatorium Floor 1
            }
            this.player.body.velocity.set(0, 0, 0);
            this.player.isHidden = false;
            this.player.body.type = CANNON.Body.DYNAMIC;
            this.player.yaw = 0;
            this.player.pitch = 0;
        }
        if (this.monsters) this.monsters.forEach(monster => monster?.reset());
    }

    alertMonsters(pos) {
        if (!this.monsters) return;
        this.monsters.forEach(monster => monster?.hearNoise(pos));
    }

    enrageMonsters(reason) {
        if (!this.monsters || State.difficulty === 'practice') return;
        this.monsters.forEach(monster => monster?.setRage(true));
        this.alertMonsters(this.player?.body?.position || new THREE.Vector3());
        this.ui.showInteractionTag("Red Eyes", reason, "Both monsters are hunting faster now.");
        setTimeout(() => this.ui.hideInteractionTag(), 2800);
    }

    animate() {
        if (!this.isRunning) return;
        const dt = Math.min(this.clock.getDelta(), 0.05);

        // Run Cannon.js physics steps
        this.world.step(1/60, dt, 3);

        // Update player, monster, and interactive item scripts
        if (this.player)  this.player.update(dt);

        const isPractice = State.difficulty === 'practice';
        if (this.monsters) {
            this.monsters.forEach(monster => {
                if (!monster) return;
                if (!isPractice) {
                    monster.update(dt);
                    monster.mesh.visible = true;
                } else {
                    monster.mesh.visible = false;
                }
            });
        }

        if (this.level) this.level.update(dt);

        if (State.status === 'playing') {
            // Ambient jumpscare timing
            this.jumpscareTimer += dt;
            if (this.jumpscareTimer >= this.nextJumpscareTime) {
                this.triggerJumpscare();
            }

            // Monster proximity audio (Heartbeat & Red Vignette)
            if (!isPractice && this.monsters && this.player) {
                const monDist = Math.min(...this.monsters.map(monster => this.player.camera.position.distanceTo(monster.mesh.position)));
                const maxDist = 20; // proximity threshold
                const intensity = Math.max(0, 1 - monDist / maxDist);

                // Vignette red overlay pulses based on monster closeness
                const vignette = document.getElementById('vignette-overlay');
                if (vignette) {
                    vignette.style.opacity = (intensity * 0.72).toFixed(3);
                }

                // Double thump heartbeats speed up as it draws near!
                if (intensity > 0.05) {
                    const beatInterval = 0.9 - intensity * 0.62;
                    this.heartbeatTimer += dt;
                    if (this.heartbeatTimer >= beatInterval) {
                        this.audio.playHeartbeat(intensity);
                        this.heartbeatTimer = 0;
                    }
                } else {
                    this.heartbeatTimer = 0;
                    if (vignette) vignette.style.opacity = '0';
                }
            }
        }

        // Render viewport camera
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialise Application
const app = new GameApp();
export { app };
