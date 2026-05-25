import * as THREE from 'three';
import { State } from './GameState.js';

export class Monster {
    constructor(app, variant = 'mike') {
        this.app    = app;
        this.scene  = app.scene;
        this.player = app.player;
        this.variant = variant;
        this.speedFactor = variant === 'warden' ? 0.82 : 1.0;

        this.mesh = new THREE.Group();

        // Procedural Gothic Monster Mesh
        // Body Capsule
        const bodyGeo = new THREE.CapsuleGeometry(0.55, 1.4, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: variant === 'warden' ? 0x101018 : 0x07070d, roughness: 0.98, metalness: 0.1 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.mesh.add(bodyMesh);

        // Head Sphere
        const headGeo = new THREE.SphereGeometry(0.4, 12, 12);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.9 });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.y = 1.0;
        this.mesh.add(this.head);

        // Glowing red/purple eyes
        const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
        this.normalEyeColor = variant === 'warden' ? 0x38bdf8 : 0xff0044;
        this.eyeMat = new THREE.MeshBasicMaterial({ color: this.normalEyeColor });
        [-0.18, 0.18].forEach(x => {
            const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
            eye.position.set(x, 0.1, -0.32);
            this.head.add(eye);
        });

        // Eye glow light
        this.eyeLight = new THREE.PointLight(this.normalEyeColor, 1.5, 7);
        this.eyeLight.position.set(0, 0.1, -0.32);
        this.head.add(this.eyeLight);

        // Gothic Long Limbs (Claws)
        const limbMat = new THREE.MeshStandardMaterial({ color: 0x030305, roughness: 1.0 });
        const limbGeo = new THREE.BoxGeometry(0.12, 1.3, 0.12);
        
        this.leftClaw = new THREE.Mesh(limbGeo, limbMat);
        this.leftClaw.position.set(-0.65, -0.2, 0);
        this.mesh.add(this.leftClaw);

        this.rightClaw = new THREE.Mesh(limbGeo, limbMat);
        this.rightClaw.position.set(0.65, -0.2, 0);
        this.mesh.add(this.rightClaw);

        if (variant === 'warden') {
            this.mesh.scale.set(0.82, 1.18, 0.82);
            this.mesh.position.set(-18, 1.2, 18);
        } else {
            this.mesh.position.set(12, 1.2, 12);
        }
        this.scene.add(this.mesh);

        this.aiState = 'patrol';
        this.targetPos = new THREE.Vector3();
        this.speed = State.getConfig().monsterSpeed * this.speedFactor * (this.isRaging ? 1.35 : 1);
        this.stepTimer = 0;
        this.animTimer = 0;
        this._catching = false;
        this.investigateWaitTimer = 0;
        this.isRaging = false;

        // Custom patrol waypoints for Map 1 (Grounds & Cabin)
        this.waypointsGrounds = [
            new THREE.Vector3(12, 1, 12),
            new THREE.Vector3(-12, 1, 12),
            new THREE.Vector3(-20, 1, -35), // Shed in backyard
            new THREE.Vector3(0, 1, -25),   // Backyard
            new THREE.Vector3(5, 1.2, -5),  // Cabin Floor 1
            new THREE.Vector3(-8, 5.2, -5), // Cabin Floor 2
            new THREE.Vector3(8, 9.2, 5)    // Cabin Floor 3
        ];

        // Custom patrol waypoints for Map 2 (Sanatorium facility)
        this.waypointsSanatorium = [
            new THREE.Vector3(0, 1.2, 0),      // Ground Central Corridor
            new THREE.Vector3(10, 1.2, 10),    // Ward Wing A
            new THREE.Vector3(-10, 1.2, 10),   // Ward Wing B
            new THREE.Vector3(-12, -2.8, -12), // Cellar Dark Room
            new THREE.Vector3(12, 5.2, 8),     // Level 2 Surgery
            new THREE.Vector3(-12, 9.2, -10),  // Level 3 Laboratory
            new THREE.Vector3(0, 9.2, 10)      // Level 3 Security Deck
        ];

        this.waypoints = this.waypointsGrounds;
        this.currentWaypoint = 0;
        this.targetPos.copy(this.waypoints[0]);

        this.raycaster = new THREE.Raycaster();
    }

    reset() {
        if (this.variant === 'warden') this.mesh.position.set(-18, 1.2, 18);
        else this.mesh.position.set(12, 1.2, 12);
        this.aiState = 'patrol';
        this.speed = State.getConfig().monsterSpeed * this.speedFactor;
        this._catching = false;
        this.investigateWaitTimer = 0;
        this.setRage(false);
        
        // Select patrol path based on currently active map
        this.waypoints = State.levelSelected === 'grounds' ? this.waypointsGrounds : this.waypointsSanatorium;
        if (this.variant === 'warden') this.waypoints = [...this.waypoints].reverse();
        this.currentWaypoint = 0;
        this.targetPos.copy(this.waypoints[0]);
    }

    hearNoise(pos) {
        if (this._catching || State.difficulty === 'practice') return;

        // If in patrol/investigate state, go check out the noise immediately
        if (this.aiState !== 'chase') {
            this.aiState = 'investigate';
            this.targetPos.copy(pos);
            this.investigateWaitTimer = 0;
            this.speed = State.getConfig().monsterSpeed * this.speedFactor * (this.isRaging ? 1.35 : 1) * 1.45; // Move quickly to noise
        }
    }

    setRage(active) {
        this.isRaging = active;
        const color = active ? 0xff0000 : this.normalEyeColor;
        this.eyeMat.color.setHex(color);
        this.eyeLight.color.setHex(color);
        this.eyeLight.intensity = active ? 3.2 : 1.5;
    }

    losePlayerAndSearch() {
        if (this._catching) return;
        this.aiState = 'investigate';
        this.targetPos.copy(this.player.body.position);
        this.investigateWaitTimer = 0;
        this.speed = State.getConfig().monsterSpeed * this.speedFactor * (this.isRaging ? 1.35 : 1);
    }

    canSeePlayer() {
        if (this.player.isHidden || State.status !== 'playing' || State.difficulty === 'practice') return false;
        
        const eyePos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        const dir = new THREE.Vector3().subVectors(this.player.camera.position, eyePos);
        const dist = dir.length();
        
        if (dist > 32) return false; // Vision limit

        dir.normalize();
        this.raycaster.set(eyePos, dir);
        const hits = this.raycaster.intersectObjects(this.scene.children, true);
        for (const h of hits) {
            // Skip non-blocking visual parts
            if (h.object.userData && h.object.userData.type === 'item') continue;
            if (h.object.userData && h.object.userData.type === 'bait') continue;
            
            // If hits something closer than player, vision is blocked
            if (h.distance < dist - 0.15) {
                return false;
            }
        }
        return true;
    }

    catchPlayer() {
        if (this._catching) return;
        this._catching = true;

        // Visual Jumpscare overlay (Blood red caught flash)
        const flash = document.createElement('div');
        flash.style.cssText = `
            position:fixed;inset:0;background:rgba(220,38,38,0.78);
            z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;
            font-family:'Creepster',cursive;font-size:7rem;color:#fff;
            text-shadow:0 0 40px #ff0033;animation:caughtFlash 1.6s ease-out forwards;
        `;
        
        const textNode = document.createElement('div');
        textNode.innerText = 'YOU WERE DINNER';
        flash.appendChild(textNode);
        
        const subtext = document.createElement('div');
        subtext.style.cssText = "font-family:'Outfit',sans-serif;font-size:1.5rem;letter-spacing:4px;color:#fca5a5;margin-top:20px;";
        subtext.innerText = "Mike caught you.";
        flash.appendChild(subtext);

        document.body.appendChild(flash);

        // Add visual animation
        if (!document.getElementById('caughtStyle')) {
            const s = document.createElement('style');
            s.id = 'caughtStyle';
            s.textContent = '@keyframes caughtFlash{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.1)}}';
            document.head.appendChild(s);
        }

        this.app.audio.playJumpscareSound();
        document.exitPointerLock();

        setTimeout(() => {
            document.body.removeChild(flash);
            this.app.ui.triggerNightTransition();
        }, 1600);
    }

    update(dt) {
        if (State.status !== 'playing' || this._catching) return;

        // 1. Line-of-sight vision checks
        if (this.canSeePlayer()) {
            this.aiState = 'chase';
            this.targetPos.copy(this.player.body.position);
            this.speed = State.getConfig().monsterSpeed * this.speedFactor * (this.isRaging ? 1.5 : 1.35); // Sprint chasing!
        } else if (this.aiState === 'chase') {
            // If loses sight of player, head to their last known position to investigate
            this.losePlayerAndSearch();
        }

        // 2. Head shaking & claw swinging procedural animations
        this.animTimer += dt * this.speed * 1.5;
        this.head.rotation.y = Math.sin(this.animTimer * 1.2) * 0.2;
        this.head.rotation.z = Math.cos(this.animTimer * 0.8) * 0.1;
        this.leftClaw.rotation.x = Math.sin(this.animTimer) * 0.45;
        this.rightClaw.rotation.x = -Math.sin(this.animTimer) * 0.45;

        // 3. Movement execution
        const dir = new THREE.Vector3().subVectors(this.targetPos, this.mesh.position);
        
        // Face moving direction
        if (dir.lengthSq() > 0.1) {
            const angle = Math.atan2(dir.x, dir.z);
            this.mesh.rotation.y = angle + Math.PI;
        }

        dir.y = 0;
        const dist = dir.length();

        // Caught check: if player is within reach
        const pDist = this.mesh.position.distanceTo(this.player.body.position);
        if (pDist < 1.35 && !this.player.isHidden) {
            this.catchPlayer();
            return;
        }

        if (dist > 0.5) {
            dir.normalize();
            this.mesh.position.add(dir.multiplyScalar(this.speed * dt));

            // Floor snapping raycast (so it glides up and down stairs/platforms perfectly)
            this.raycaster.set(
                this.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
                new THREE.Vector3(0, -1, 0)
            );
            const floorHits = this.raycaster.intersectObjects(this.scene.children, false);
            if (floorHits.length > 0) {
                // Capsule height offset
                const tY = floorHits[0].point.y + 1.22;
                this.mesh.position.y += (tY - this.mesh.position.y) * 0.18;
            }

            // Monster footsteps: Louder and faster when chasing
            this.stepTimer += dt * this.speed;
            if (this.stepTimer > 2.8) {
                const d = this.mesh.position.distanceTo(this.player.body.position);
                this.app.audio.playFootstep(true, d);
                this.stepTimer = 0;
            }
        } else {
            // Target arrived
            if (this.aiState === 'patrol') {
                // Cycle to next waypoint in the patrol path
                this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
                this.targetPos.copy(this.waypoints[this.currentWaypoint]);
            } else if (this.aiState === 'investigate') {
                // Investigate noise: Look around at target position for 3.5 seconds
                this.investigateWaitTimer += dt;
                if (this.investigateWaitTimer >= 3.5) {
                    this.aiState = 'patrol';
                    this.speed = State.getConfig().monsterSpeed * this.speedFactor * (this.isRaging ? 1.35 : 1);
                    this.targetPos.copy(this.waypoints[this.currentWaypoint]);
                }
            } else if (this.aiState === 'chase') {
                this.catchPlayer();
            }
        }
    }
}
