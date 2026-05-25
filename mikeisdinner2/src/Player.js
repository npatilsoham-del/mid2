import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { State } from './GameState.js';

export class Player {
    constructor(app) {
        this.app = app;
        this.camera = app.camera;
        this.scene = app.scene;
        this.world = app.world;
        this.ui = app.ui;

        this.height = 1.65;
        this.baseSpeed = 9.5;
        this.sprintSpeed = 16.5;
        this.speed = this.baseSpeed;
        this.isHidden = false;

        this.stamina = 100;
        this.battery = 100;
        this.isSprinting = false;
        this.bobTime = 0;
        this.isGrounded = false;
        
        this.canDoubleJump = false;
        this.lastJumpTime = 0;

        // Adrenaline speed boost state
        this.adrenalineTimer = 0;

        // Physics: Sphere body for movement
        const shape = new CANNON.Sphere(0.42);
        this.body = new CANNON.Body({
            mass: 5,
            material: app.defaultMaterial,
            position: new CANNON.Vec3(5, 0.85, -5),
            fixedRotation: true,
            linearDamping: 0.0 // manual X/Z dampening; free falling in Y
        });
        this.body.addShape(shape);
        this.world.addBody(this.body);

        // Flashlight (remains as a backup light)
        this.flashlight = new THREE.SpotLight(0xffffff, 2.2, 45, Math.PI / 6, 0.4, 1);
        this.camera.add(this.flashlight);
        this.scene.add(this.camera);
        this.flashlightOn = false; // Start with flashlight off (we have bright ambient light)

        // Raycaster for interactions
        this.raycaster = new THREE.Raycaster();
        this.downRay = new THREE.Raycaster();
        this.centerVec = new THREE.Vector2(0, 0);
        this.interactDistance = 3.2;
        this.hoveredObject = null;

        this.setupControls();
    }

    setupControls() {
        this.keys = { w: false, a: false, s: false, d: false,
                      arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
        this.pitch = 0;
        this.yaw = 0;

        window.addEventListener('keydown', e => this.onKey(e.key.toLowerCase(), true));
        window.addEventListener('keyup',   e => this.onKey(e.key.toLowerCase(), false));

        document.body.addEventListener('mousemove', e => {
            if (document.pointerLockElement === document.body && !this.isHidden && State.status === 'playing') {
                this.yaw   -= e.movementX * 0.0022;
                this.pitch -= e.movementY * 0.0022;
                this.pitch  = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.pitch));
            }
        });

        window.addEventListener('keydown', e => { if (e.key === 'Shift') this.setSprint(true); });
        window.addEventListener('keyup',   e => { if (e.key === 'Shift') this.setSprint(false); });

        document.body.addEventListener('mousedown', e => {
            if (document.pointerLockElement === document.body && State.status === 'playing') {
                if (e.button === 0) this.interact();
                if (e.button === 2) this.throwBaitOrDrop();
            }
        });

        window.addEventListener('keydown', e => {
            if (State.status !== 'playing') return;
            const k = e.key.toLowerCase();
            if (k === 'f')  this.toggleFlashlight();
            if (k === 'n')  this.toggleNightVision();
            if (k === 'q' || k === 'g')  this.throwBaitOrDrop();
            if (e.key === ' ' || k === 'j') { e.preventDefault(); this.jump(); }
        });

        this.initMobileControls();
    }

    initMobileControls() {
        if (window.innerWidth > 768) return;
        setTimeout(() => {
            const lz = document.getElementById('joystick-zone-left');
            const rz = document.getElementById('joystick-zone-right');
            if (!lz || !rz || !window.nipplejs) return;

            this.moveDir = { x: 0, y: 0 };
            this.moveJoystick = nipplejs.create({ zone: lz, mode: 'dynamic', color: 'rgba(255,255,255,0.4)' });
            this.moveJoystick.on('move', (e, d) => {
                this.moveDir.x = Math.cos(d.angle.radian) * d.distance / 50;
                this.moveDir.y = Math.sin(d.angle.radian) * d.distance / 50;
            });
            this.moveJoystick.on('end', () => { this.moveDir = { x: 0, y: 0 }; });

            this.lookJoystick = nipplejs.create({ zone: rz, mode: 'dynamic', color: 'rgba(239,68,68,0.4)' });
            this.lookJoystick.on('move', (e, d) => {
                this.yaw   -= Math.cos(d.angle.radian) * d.distance * 0.0028;
                this.pitch += Math.sin(d.angle.radian) * d.distance * 0.0028;
                this.pitch  = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.pitch));
            });
        }, 150);
    }

    onKey(key, isDown) {
        if (this.keys.hasOwnProperty(key)) this.keys[key] = isDown;
    }

    setSprint(v) { this.isSprinting = v; }

    toggleFlashlight() {
        this.flashlightOn = !this.flashlightOn;
        this.updateFlashlight();
    }

    updateFlashlight() {
        if (this.flashlightOn && this.battery > 0) {
            this.flashlight.intensity = 2.2 * (this.battery / 100);
        } else {
            this.flashlight.intensity = 0;
            this.flashlightOn = false;
        }
    }

    toggleNightVision() {
        if (this.battery <= 0 && !State.nvgEnabled) {
            this.ui.showInteractionTag("Battery Dead", "Needs Flashlight Battery to use NVG.", "");
            setTimeout(() => this.ui.hideInteractionTag(), 2000);
            return;
        }
        State.nvgEnabled = !State.nvgEnabled;
        this.ui.toggleNVGOverlay(State.nvgEnabled);
        
        // Dynamically adjust ambient lighting in Level to match the green NVG filter
        if (this.app.level) {
            this.app.level.updateAmbientLight();
        }
    }

    jump() {
        if (this.isHidden || State.status !== 'playing') return;
        const now = performance.now();
        if (this.isGrounded) {
            this.body.velocity.y = 8.5;
            this.isGrounded = false;
            this.canDoubleJump = true;
            this.lastJumpTime = now;
        } else if (this.canDoubleJump && (now - this.lastJumpTime < 600)) {
            this.body.velocity.y = 10.5;
            this.canDoubleJump = false;
        }

        // Jumping makes footstep noise that both threats can hear.
        this.app.alertMonsters?.(this.body.position);
    }

    interact() {
        // If holding an Adrenaline Shot, use it immediately on left-click
        if (State.heldItem && State.heldItem.id === 'adrenaline_shot') {
            this.useAdrenaline();
            return;
        }

        if (!this.hoveredObject || !this.hoveredObject.userData || !this.hoveredObject.userData.interactable) return;
        const obj = this.hoveredObject.userData;
        if (obj.type === 'item')                          this.pickupItem(this.hoveredObject);
        else if (obj.type === 'pet')                       this.killMonsterPet(this.hoveredObject);
        else if (obj.type === 'hideout')                  this.toggleHide(this.hoveredObject);
        else if (obj.type === 'door' || obj.type === 'escape') this.app.level.tryOpenDoor(this.hoveredObject);
    }

    killMonsterPet(mesh) {
        let target = mesh;
        while (target.parent && target.parent.type !== 'Scene') target = target.parent;
        target.visible = false;
        target.userData.interactable = false;
        target.traverse(child => {
            if (child.userData) child.userData.interactable = false;
        });
        this.app.audio.playDropSound();
        this.app.enrageMonsters?.("You killed one of their pets.");
    }

    useAdrenaline() {
        State.heldItem = null;
        State.adrenalineActive = true;
        this.adrenalineTimer = 8.0; // 8 seconds of hyper speed
        this.stamina = 100;
        this.app.audio.playAdrenalineSound();
        this.ui.updateHUD();
        this.ui.showInteractionTag("Adrenaline Rush!", "Stamina restored + Speed boosted!", "");
        setTimeout(() => this.ui.hideInteractionTag(), 2500);
    }

    throwBaitOrDrop() {
        if (!State.heldItem) return;

        // If holding an Alarm Clock, throw it as bait!
        if (State.heldItem.id === 'alarm_clock') {
            const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0));
            const pos = this.camera.position.clone().add(dir.clone().multiplyScalar(1.5));
            const force = dir.clone().multiplyScalar(12);

            this.app.level.spawnBaitClock(pos, force);
            State.heldItem = null;
            this.ui.updateHUD();
            return;
        }

        // Otherwise, drop normal item
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0));
        const pos = this.camera.position.clone().add(dir.multiplyScalar(1.5));
        this.app.level.spawnDroppedItem(State.heldItem, pos);
        State.heldItem = null;
        this.ui.updateHUD();
    }

    pickupItem(mesh) {
        const itemData = mesh.userData;

        // Recharge batteries instantly
        if (itemData.id === 'flashlight_battery') {
            this.battery = Math.min(100, this.battery + 50);
            this.updateFlashlight();
            this.ui.updateHUD();
            this.app.level.removeItem(mesh);
            this.hoveredObject = null;
            this.app.audio.playPickupSound();
            this.ui.flashPickup();
            this.ui.showInteractionTag("Battery Recharged", "+50% Power", "");
            setTimeout(() => this.ui.hideInteractionTag(), 2000);
            return;
        }

        if (State.heldItem) {
            this.ui.showInteractionTag("Hands Full", "Use or drop your current item first.", "");
            setTimeout(() => this.ui.hideInteractionTag(), 2000);
            return;
        }

        State.heldItem = { name: itemData.name, id: itemData.id };
        this.ui.updateHUD();
        this.app.level.removeItem(mesh);
        this.hoveredObject = null;
        this.ui.hideInteractionTag();
        this.app.audio.playPickupSound();
        this.ui.flashPickup();

        if (itemData.id === 'sisters_teddy') {
            this.app.enrageMonsters?.("You picked up the sister's teddy.");
        }
    }

    toggleHide(hideoutMesh) {
        this.isHidden = !this.isHidden;
        if (this.isHidden) {
            this.camera.position.copy(hideoutMesh.position);
            this.camera.position.y += 1.0;
            this.body.type = CANNON.Body.STATIC;
            this.app.monsters?.forEach(monster => {
                if (monster.aiState === 'chase') monster.losePlayerAndSearch();
            });
        } else {
            this.body.type = CANNON.Body.DYNAMIC;
        }
    }

    checkGrounded() {
        this.downRay.set(
            new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z),
            new THREE.Vector3(0, -1, 0)
        );
        const hits = this.downRay.intersectObjects(this.scene.children, true);
        for (const h of hits) {
            if (h.object.userData.type === 'item') continue;
            if (h.distance < 0.58) { // sphere radius 0.42 + tiny buffer
                return true;
            }
            break;
        }
        return false;
    }

    update(dt) {
        if (State.status !== 'playing' || this.isHidden) return;

        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

        const fwd   = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
        const moveVec = new THREE.Vector3();

        if (this.keys.w || this.keys.arrowup)    moveVec.add(fwd);
        if (this.keys.s || this.keys.arrowdown)  moveVec.sub(fwd);
        if (this.keys.a || this.keys.arrowleft)  moveVec.sub(right);
        if (this.keys.d || this.keys.arrowright) moveVec.add(right);

        if (this.moveDir && (this.moveDir.x || this.moveDir.y)) {
            moveVec.add(fwd.clone().multiplyScalar(this.moveDir.y));
            moveVec.add(right.clone().multiplyScalar(this.moveDir.x));
        }

        // Battery drainage (Night Vision drains 3x faster!)
        const drainMultiplier = State.nvgEnabled ? 3.0 : 1.0;
        if (this.flashlightOn || State.nvgEnabled) {
            this.battery -= State.getConfig().batteryDrain * drainMultiplier * dt;
            if (this.battery <= 0) {
                this.battery = 0;
                this.flashlightOn = false;
                if (State.nvgEnabled) this.toggleNightVision();
            }
            this.updateFlashlight();
            this.ui.updateHUD();
        }

        // Adrenaline speed boost timer
        let currentBaseSpeed = this.baseSpeed;
        let currentSprintSpeed = this.sprintSpeed;
        
        if (State.adrenalineActive) {
            this.adrenalineTimer -= dt;
            currentBaseSpeed = this.baseSpeed * 1.5;
            currentSprintSpeed = this.sprintSpeed * 1.5;
            if (this.adrenalineTimer <= 0) {
                State.adrenalineActive = false;
                this.adrenalineTimer = 0;
            }
        }

        // Sprint & stamina management
        const moving = moveVec.lengthSq() > 0;
        if (this.isSprinting && this.stamina > 0 && moving) {
            this.speed = currentSprintSpeed;
            // Adrenaline prevents stamina depletion!
            if (!State.adrenalineActive) {
                this.stamina -= 16 * dt;
            }
            if (this.stamina < 0) this.stamina = 0;
        } else {
            this.speed = currentBaseSpeed;
            const staminaRegen = State.adrenalineActive ? 40 : 6;
            this.stamina = Math.min(100, this.stamina + staminaRegen * dt);
        }
        this.ui.updateHUD();

        // Noise tracking: sprinting makes noise
        if (moving && this.isSprinting) this.app.alertMonsters?.(this.body.position);

        this.isGrounded = this.checkGrounded();

        if (moving) {
            moveVec.normalize().multiplyScalar(this.speed);
            this.body.velocity.x = moveVec.x;
            this.body.velocity.z = moveVec.z;

            // Stair Ground Snapping (Granny style movement)
            const bpos = this.body.position;
            this.downRay.set(
                new THREE.Vector3(bpos.x, bpos.y, bpos.z),
                new THREE.Vector3(0, -1, 0)
            );
            const floorHits = this.downRay.intersectObjects(this.scene.children, true);
            for (const h of floorHits) {
                if (h.object.userData && h.object.userData.type === 'item') continue;
                const groundY  = h.point.y;
                const targetBodyY = groundY + 0.44;
                const delta = targetBodyY - bpos.y;
                
                if (delta < -0.1 && delta > -0.85 && this.isGrounded && this.body.velocity.y <= 0.0) {
                    this.body.position.y += delta * 0.35; // snap down firmly
                }
                break;
            }

            // View bob & footsteps
            const stepSpeed = this.speed >= this.sprintSpeed ? 16.5 : 9.5;
            const oldBob = this.bobTime;
            this.bobTime += dt * stepSpeed;
            if (Math.sign(Math.sin(oldBob)) !== Math.sign(Math.sin(this.bobTime))) {
                this.app.audio.playFootstep(false, 0, this.speed >= this.sprintSpeed);
            }
        } else {
            this.bobTime = 0;
            this.body.velocity.x = 0;
            this.body.velocity.z = 0;
        }

        // Camera positioning with smooth bobbing
        const bobOffset = Math.sin(this.bobTime) * 0.045;
        this.camera.position.copy(this.body.position);
        this.camera.position.y += this.height + bobOffset;

        // Flashlight aiming
        const tgt = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
        this.flashlight.target.position.copy(this.camera.position).add(tgt);
        this.flashlight.target.updateMatrixWorld();

        // Interaction Raycasting
        this.raycaster.setFromCamera(this.centerVec, this.camera);
        const hits = this.raycaster.intersectObjects(this.scene.children, true);

        let found = false;
        for (const h of hits) {
            if (h.distance > this.interactDistance) break;
            if (!h.object.userData || !h.object.userData.interactable) continue;
            this.hoveredObject = h.object;

            let reqText = h.object.userData.req || "";
            if (h.object.userData.id === "escape_door" && this.app.level.doorItems) {
                reqText = `Locks installed: (${this.app.level.doorItems.size}/7) \nNeeds key components.`;
            } else if (h.object.userData.id === "escape_car" && this.app.level.installedParts) {
                reqText = `Parts installed: (${this.app.level.installedParts.size}/7) \nNeeds mechanical parts.`;
            }

            this.ui.showInteractionTag(
                h.object.userData.name || "Object",
                h.object.userData.desc  || "",
                reqText
            );
            found = true;
            break;
        }
        if (!found) {
            this.hoveredObject = null;
            this.ui.hideInteractionTag();
        }
    }
}
