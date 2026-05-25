import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { State } from './GameState.js';

export class Level {
    constructor(app) {
        this.app = app;
        this.scene = app.scene;
        this.world = app.world;
        
        this.items = [];
        this.spawnPoints = [];
        this.ambientLight = app.ambientLight;

        // Custom materials
        this.wallMat  = new THREE.MeshStandardMaterial({ color: 0x2e2d33, roughness: 0.9 });
        this.floorMat = new THREE.MeshStandardMaterial({ color: 0x3d352b, roughness: 0.8 });
        this.woodMat  = new THREE.MeshStandardMaterial({ color: 0x472f1c, roughness: 0.85 });
        this.doorMat  = new THREE.MeshStandardMaterial({ color: 0x593a20, roughness: 0.75 });
        this.ceilMat  = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.95 });
        
        // Sanatorium specialized materials
        this.tileMat  = new THREE.MeshStandardMaterial({ color: 0x5c7069, roughness: 0.5 }); // Dirty hospital tiles
        this.metalMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.3, metalness: 0.8 });

        this.buildLevel();
    }

    // Helper to create visual and physical blocks
    box(pos, size, mat, stat=true, phys=true) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z), mat);
        mesh.position.copy(pos); 
        mesh.castShadow=true; 
        mesh.receiveShadow=true;
        this.scene.add(mesh);
        
        let body=null;
        if(phys){
            body=new CANNON.Body({mass:stat?0:5, material:this.app.defaultMaterial});
            body.addShape(new CANNON.Box(new CANNON.Vec3(size.x/2,size.y/2,size.z/2)));
            body.position.copy(pos); 
            this.world.addBody(body);
        }
        return {mesh,body};
    }

    buildLevel() {
        // High ambient light by default (almost like Granny Chapter 2!)
        this.updateAmbientLight();

        if (State.levelSelected === 'grounds') {
            this.buildGroundsMap();
        } else {
            this.buildSanatoriumMap();
        }
        this.spawnItems();
        this.spawnPets();
    }

    updateAmbientLight() {
        const cfg = State.getConfig();
        if (State.nvgEnabled) {
            // Night vision green tint!
            this.ambientLight.color.setHex(0x34d399); // Light green
            this.ambientLight.intensity = 1.3;
        } else {
            // High visibility ambient lighting (Granny style!)
            this.ambientLight.color.setHex(0xffffff);
            this.ambientLight.intensity = cfg.ambientLight + 0.45; // extremely visible!
        }
    }

    // ==========================================
    // MAP 1: GROUND & ABANDONED CABIN BUILDER
    // ==========================================
    buildGroundsMap() {
        const V3 = THREE.Vector3;
        
        // 3-floor Cabin
        this.buildCabinFloor(0); 
        this.buildCabinFloor(4); 
        this.buildCabinFloor(8);
        this.createSpiralStairs(new V3(-10, 0, -5), 4);
        this.createSpiralStairs(new V3(10, 4, -5), 4);

        // Cabin outer walls
        for (let i = 0; i < 3; i++) {
            const h = i * 4 + 2;
            if (i === 0) {
                // Front wall with doors
                this.box(new V3(-8, h, 15), new V3(14, 4, 1), this.wallMat); // left
                this.box(new V3(8, h, 15), new V3(14, 4, 1), this.wallMat);  // right
                this.box(new V3(0, 3.6, 15), new V3(2, 0.8, 1), this.wallMat); // above
                // Back wall with doors
                this.box(new V3(-8, h, -15), new V3(14, 4, 1), this.wallMat);
                this.box(new V3(8, h, -15), new V3(14, 4, 1), this.wallMat);
                this.box(new V3(0, 3.6, -15), new V3(2, 0.8, 1), this.wallMat);
            } else {
                this.box(new V3(0, h, 15), new V3(30, 4, 1), this.wallMat);
                this.box(new V3(0, h, -15), new V3(30, 4, 1), this.wallMat);
            }
            this.box(new V3(-15, h, 0), new V3(1, 4, 30), this.wallMat); // Left wall
            this.box(new V3(15, h, 0), new V3(1, 4, 30), this.wallMat);  // Right wall
        }
        this.box(new V3(0, 12, 0), new V3(30, 0.25, 30), this.ceilMat); // Roof ceiling
        
        // Build outdoor forest yards
        this.buildForestYards();
    }

    buildCabinFloor(y) {
        const V3 = THREE.Vector3;
        this.box(new V3(0, y - 0.5, 0), new V3(30, 1, 30), this.floorMat);
        
        if (y === 0) {
            // Living room dividers
            this.box(new V3(-5, y + 2, 0), new V3(20, 4, 1), this.wallMat);
            this.box(new V3(-5, y + 2, 7.5), new V3(1, 4, 16), this.wallMat);
            
            this.createDoor(new V3(0, y + 1.5, 15), "Locked Main Entrance", "Needs Rusty Key to Unlock", "inner_door_1");
            this.createDoor(new V3(0, y + 1.5, -15), "Backyard Door", "", "back_door");
            
            // Furniture
            this.createCloset(new V3(-12, y + 2, -12));
            this.createDrawer(new V3(-12, y + 1, 12));
            this.createCouch(new V3(5, y + 0.75, -5));
            this.createTV(new V3(5, y + 1, -12));
            
            this.spawnPoints.push(new V3(3, y + 0.5, 5), new V3(-3, y + 0.5, -8), new V3(12, y + 0.5, -5), new V3(-12, y + 0.5, -2));
        } else if (y === 4) {
            // Bedrooms
            this.box(new V3(0, y + 2, -5), new V3(15, 4, 1), this.wallMat);
            this.box(new V3(0, y + 2, 5), new V3(15, 4, 1), this.wallMat);
            this.createDoor(new V3(-5, y + 1.5, -5), "Bedroom Door", "Needs Rusty Key", "inner_door_2");
            
            this.createBed(new V3(-10, y + 0.5, -10));
            this.createCloset(new V3(10, y + 2, -12));
            this.createDrawer(new V3(-12, y + 1, 10));
            
            this.spawnPoints.push(new V3(5, y + 0.5, -10), new V3(-3, y + 0.5, 10), new V3(12, y + 0.5, 0), new V3(-5, y + 0.5, -12));
        } else if (y === 8) {
            // Attic Wards
            this.box(new V3(-5, y + 2, 0), new V3(1, 4, 20), this.wallMat);
            this.box(new V3(4, y + 2, -5), new V3(8, 4, 1), this.wallMat);
            this.createDoor(new V3(0, y + 1.5, -5), "Attic Locker", "Needs Keycard to bypass security", "inner_door_3");
            
            this.createBed(new V3(10, y + 0.5, 10));
            this.createDrawer(new V3(-10, y + 1, -10));
            
            this.spawnPoints.push(new V3(-8, y + 0.5, -8), new V3(0, y + 0.5, 10), new V3(12, y + 0.5, 12));
        }
    }

    buildForestYards() {
        const V3 = THREE.Vector3;
        const gMat = new THREE.MeshStandardMaterial({ color: 0x1f3418, roughness: 1 }); // Bright grass
        const fMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.95 }); // Wood fence
        const sMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.85 }); // Stone paths

        // Front yard lawn & high fences
        this.box(new V3(0, -0.6, 30), new V3(60, 1, 30), gMat);
        this.box(new V3(0, 2, 45), new V3(60, 4, 1), fMat);
        this.box(new V3(-30, 2, 30), new V3(1, 4, 30), fMat);
        this.box(new V3(30, 2, 30), new V3(1, 4, 30), fMat);

        // Path to the cabin door
        for(let z=18; z<44; z+=3.2) {
            this.box(new V3(0, -0.45, z), new V3(2.5, 0.2, 2.5), sMat);
        }

        // Pine trees in the yard
        this.makeTree(new V3(-10, 0, 28)); this.makeTree(new V3(10, 0, 28));
        this.makeTree(new V3(-22, 0, 36)); this.makeTree(new V3(22, 0, 36));

        // Backyard lawn & fences
        this.box(new V3(0, -0.6, -30), new V3(60, 1, 30), gMat);
        this.box(new V3(0, 2, -45), new V3(60, 4, 1), fMat);
        this.box(new V3(-30, 2, -30), new V3(1, 4, 30), fMat);
        this.box(new V3(30, 2, -30), new V3(1, 4, 30), fMat);
        this.makeTree(new V3(-14, 0, -28)); this.makeTree(new V3(14, 0, -28));
        this.makeTree(new V3(0, 0, -37));

        // Connecting side yards and outer fences
        this.box(new V3(-22.5, -0.6, 0), new V3(15, 1, 30), gMat);
        this.box(new V3(22.5, -0.6, 0), new V3(15, 1, 30), gMat);
        this.box(new V3(-30, 2, 0), new V3(1, 4, 30), fMat);
        this.box(new V3(30, 2, 0), new V3(1, 4, 30), fMat);

        // Escape Option A: Rescue Ambulance (Front Yard)
        this.createAmbulance(new V3(11, 0.9, 32));

        // Escape Option B: Radio SOS Tower (Backyard)
        this.createRadioTower(new V3(-18, 0, -36));

        // Spawn points in yard
        this.spawnPoints.push(new V3(-18, 0.5, -31)); // near radio tower
        this.spawnPoints.push(new V3(16, 0.5, 36));   // front yard corner
        this.spawnPoints.push(new V3(-24, 0.5, 20));  // left yard
    }

    // ==========================================
    // MAP 2: MAIN HAUNTED SANATORIUM BUILDER
    // ==========================================
    buildSanatoriumMap() {
        const V3 = THREE.Vector3;

        // Build 4 levels (Cellar, Floor 1, Floor 2, Floor 3)
        this.buildSanatoriumFloor(-4); // Cellar
        this.buildSanatoriumFloor(0);  // Floor 1
        this.buildSanatoriumFloor(4);  // Floor 2
        this.buildSanatoriumFloor(8);  // Floor 3

        // Spiral stairs linking all 4 levels recursively!
        this.createSpiralStairs(new V3(-10, -4, -5), 4);
        this.createSpiralStairs(new V3(10, 0, -5), 4);
        this.createSpiralStairs(new V3(-10, 4, -5), 4);

        // Outer brick walls of Sanatorium
        for (let i = -1; i < 3; i++) {
            const h = i * 4 + 2;
            this.box(new V3(0, h, 15), new V3(30, 4, 1), this.wallMat);  // Front
            this.box(new V3(0, h, -15), new V3(30, 4, 1), this.wallMat); // Back
            this.box(new V3(-15, h, 0), new V3(1, 4, 30), this.wallMat); // Left
            this.box(new V3(15, h, 0), new V3(1, 4, 30), this.wallMat);  // Right
        }
        this.box(new V3(0, 12, 0), new V3(30, 0.25, 30), this.ceilMat); // Roof

        // Outside grounds (Sanatorium courtyard)
        const gMat = new THREE.MeshStandardMaterial({ color: 0x1f3418, roughness: 1 });
        this.box(new V3(0, -0.6, 25), new V3(50, 1, 20), gMat);
        
        // Escape Route A: Ambulance in Courtyard
        this.createAmbulance(new V3(10, 0.9, 22));

        // Escape Route B: High Security Gate inside Sanatorium Floor 1
        this.createDoor(new V3(0, 1.5, 15), "Sanatorium Security Exit Gate", "Requires 7 Master Components", "escape_door");
    }

    buildSanatoriumFloor(y) {
        const V3 = THREE.Vector3;
        this.box(new V3(0, y - 0.5, 0), new V3(30, 1, 30), this.tileMat); // Green hospital tiles!

        if (y === -4) {
            // Dark Cellar - creepy dividers and boilers
            this.box(new V3(0, y + 2, 0), new V3(20, 4, 1), this.wallMat);
            this.box(new V3(0, y + 2, 5), new V3(1, 4, 10), this.wallMat);
            this.createDoor(new V3(-6, y + 1.5, 0), "Cellar Lockbox", "Needs Rusty Key", "inner_door_1");

            // Boilers
            this.box(new V3(8, y + 1.2, -10), new V3(2.5, 2.4, 2.5), this.metalMat);
            this.box(new V3(-8, y + 1.2, -10), new V3(2.5, 2.4, 2.5), this.metalMat);

            this.spawnPoints.push(new V3(5, y + 0.5, 8), new V3(-8, y + 0.5, 8), new V3(8, y + 0.5, -5));
        } else if (y === 0) {
            // Floor 1: Lobby & Reception Desk
            this.box(new V3(-5, y + 2, 5), new V3(1, 4, 16), this.wallMat);
            this.box(new V3(6, y + 1, 0), new V3(6, 2, 1.5), this.woodMat); // Desk

            this.createCloset(new V3(-12, y + 2, -10));
            this.createDrawer(new V3(12, y + 1, -12));

            this.spawnPoints.push(new V3(-10, y + 0.5, 10), new V3(8, y + 0.5, 5), new V3(-12, y + 0.5, -8));
        } else if (y === 4) {
            // Floor 2: Patient Wards
            this.box(new V3(0, y + 2, -5), new V3(18, 4, 1), this.wallMat);
            this.box(new V3(-9, y + 2, 2.5), new V3(1, 4, 14), this.wallMat);
            this.box(new V3(9, y + 2, 2.5), new V3(1, 4, 14), this.wallMat);
            this.createDoor(new V3(0, y + 1.5, -5), "Surgery Ward Door", "Needs Rusty Key", "inner_door_2");

            this.createBed(new V3(-11, y + 0.5, -10));
            this.createBed(new V3(11, y + 0.5, -10));
            this.createCloset(new V3(0, y + 2, 10));

            this.spawnPoints.push(new V3(-5, y + 0.5, -2), new V3(5, y + 0.5, 8), new V3(-12, y + 0.5, 8));
        } else if (y === 8) {
            // Floor 3: Lab & Security Deck
            this.box(new V3(0, y + 2, 5), new V3(20, 4, 1), this.wallMat);
            this.box(new V3(5, y + 2, -5), new V3(1, 4, 18), this.wallMat);
            this.createDoor(new V3(0, y + 1.5, 5), "Secret Laboratory", "Needs Keycard to override lock", "inner_door_3");

            // Cyber console
            this.box(new V3(-8, y + 1, -8), new V3(4, 1.8, 2), this.metalMat);
            this.createDrawer(new V3(10, y + 1, -10));

            this.spawnPoints.push(new V3(-12, y + 0.5, -6), new V3(0, y + 0.5, -10), new V3(12, y + 0.5, 10));
        }
    }

    // ==========================================
    // PROCEDURAL ASSETS CREATORS
    // ==========================================
    makeTree(pos) {
        const trunk = new THREE.MeshStandardMaterial({ color: 0x472f1c, roughness: 0.95 });
        const leaves = new THREE.MeshStandardMaterial({ color: 0x1f3c18, roughness: 1.0 }); // Bright leaves
        
        this.box(new THREE.Vector3(pos.x, pos.y + 1.6, pos.z), new THREE.Vector3(0.6, 3.2, 0.6), trunk);
        
        const foliageGeo = new THREE.ConeGeometry(2.5, 5.0, 5);
        const foliageMesh = new THREE.Mesh(foliageGeo, leaves);
        foliageMesh.position.set(pos.x, pos.y + 5.0, pos.z);
        foliageMesh.castShadow = true;
        this.scene.add(foliageMesh);
    }

    createSpiralStairs(centerPos, height) {
        const turns = 1.15; 
        const steps = 60, sh = height / (steps - 1); 
        const radius = 2.45, innerRadius = 0.06;
        
        this.box(
            new THREE.Vector3(centerPos.x, centerPos.y + height / 2, centerPos.z),
            new THREE.Vector3(innerRadius * 2, height, innerRadius * 2),
            this.woodMat, true, true
        );

        const startAngle = centerPos.x < 0 ? 0 : Math.PI;

        for (let i = 0; i < steps; i++) {
            const angle = startAngle + (i / (steps - 1)) * Math.PI * 2 * turns;
            const stepY = centerPos.y + i * sh;
            
            const stepWidth = radius - innerRadius; 
            const circ = (Math.PI * 2 * radius * turns) / steps;
            const stepDepth = circ * 2.6; 
            
            const dist = innerRadius + stepWidth / 2;
            const x = centerPos.x + Math.cos(angle) * dist;
            const z = centerPos.z + Math.sin(angle) * dist;

            const { mesh } = this.box(
                new THREE.Vector3(x, stepY, z),
                new THREE.Vector3(stepWidth, 0.22, stepDepth),
                this.woodMat, true, false
            );
            mesh.rotation.y = -angle;

            // Physics collision segment
            const pbody = new CANNON.Body({ mass: 0, material: this.app.defaultMaterial });
            pbody.addShape(new CANNON.Box(new CANNON.Vec3(stepWidth / 2, 0.05, stepDepth / 2)));
            pbody.position.copy(mesh.position);
            
            const dummy = new THREE.Object3D();
            dummy.rotation.order = "YXZ";
            dummy.rotation.y = -angle;
            dummy.rotation.x = -Math.atan2(height, Math.PI * 2 * turns * dist);
            pbody.quaternion.copy(dummy.quaternion);
            this.world.addBody(pbody);
        }
    }

    createBed(pos) {
        const sheetMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.85 }); // Clear white hospital beds!
        const { mesh } = this.box(pos, new THREE.Vector3(3.2, 0.9, 5.2), sheetMat);
        mesh.userData = { interactable: true, type: 'hideout', name: "Patient Bed", desc: "Crawl and hide under the hospital bed." };
        this.spawnPoints.push(new THREE.Vector3(pos.x, pos.y + 0.95, pos.z));
    }

    createCloset(pos) {
        const m = new THREE.MeshStandardMaterial({ color: 0x5a341a, roughness: 0.9 });
        const { mesh } = this.box(pos, new THREE.Vector3(2.2, 4.2, 2.2), m);
        mesh.userData = { interactable: true, type: 'hideout', name: "Wooden Locker", desc: "Hide inside the metal/wooden locker." };
        this.spawnPoints.push(new THREE.Vector3(pos.x, pos.y - 1.2, pos.z));
    }

    createDrawer(pos) {
        const m = new THREE.MeshStandardMaterial({ color: 0x472f1c, roughness: 0.8 });
        const { mesh } = this.box(pos, new THREE.Vector3(2.2, 2.2, 1.2), m);
        mesh.userData = { interactable: true, type: 'furniture', name: "Lobby Drawer", desc: "An old drawer. Search it." };
        this.spawnPoints.push(new THREE.Vector3(pos.x, pos.y + 1.25, pos.z));
    }

    createCouch(pos) {
        const couchColor = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.75 }); // Slate couch
        this.box(pos, new THREE.Vector3(4.2, 1.4, 2.2), couchColor);
        this.box(new THREE.Vector3(pos.x, pos.y + 0.9, pos.z - 0.95), new THREE.Vector3(4.2, 2.0, 0.5), couchColor);
        this.spawnPoints.push(new THREE.Vector3(pos.x, pos.y + 0.95, pos.z));
    }

    createTV(pos) {
        const standMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
        this.box(new THREE.Vector3(pos.x, pos.y - 0.5, pos.z), new THREE.Vector3(3.2, 1.0, 1.2), standMat);
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x065f46 }); // Glowing toxic green screen!
        this.box(pos, new THREE.Vector3(3.2, 2.2, 0.2), screenMat, true, false);
        const gl = new THREE.PointLight(0x10b981, 0.6, 9);
        gl.position.set(pos.x, pos.y, pos.z + 1.2);
        this.scene.add(gl);
    }

    createDoor(pos, name, req, id) {
        const { mesh, body } = this.box(pos, new THREE.Vector3(2.2, 3.2, 0.5), this.doorMat);
        const fMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, emissive: 0x3d0c02, emissiveIntensity: 0.6 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 0.5), fMat);
        frame.position.set(pos.x, pos.y + 1.74, pos.z);
        this.scene.add(frame);
        
        const doorLight = new THREE.PointLight(0xef4444, 0.45, 5);
        doorLight.position.set(pos.x, pos.y + 1.2, pos.z + 0.6);
        this.scene.add(doorLight);
        
        mesh.userData = { interactable: true, type: 'escape', name, req, id, body };
    }

    createAmbulance(pos) {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.8 }); // ambulance body
        const { mesh, body } = this.box(pos, new THREE.Vector3(4.2, 2.0, 7.5), bodyMat);

        // Ambulance red crosses & side shields
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
        this.box(new THREE.Vector3(pos.x, pos.y + 0.4, pos.z + 2.5), new THREE.Vector3(1.2, 1.2, 0.1), crossMat, true, false);
        
        // Windshield
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x374151, transparent: true, opacity: 0.5, metalness: 0.5 });
        const ws = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.1), glassMat);
        ws.position.set(pos.x, pos.y + 1.0, pos.z - 2.2); 
        ws.rotation.x = 0.35; 
        this.scene.add(ws);

        // Wheels
        const wMat = new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.9 });
        const wGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.75, 16); 
        wGeo.rotateZ(Math.PI/2);
        [[-2.3, -0.7, -2.4], [2.3, -0.7, -2.4], [-2.3, -0.7, 2.4], [2.3, -0.7, 2.4]].forEach(p => {
            const w = new THREE.Mesh(wGeo, wMat);
            w.position.set(pos.x + p[0], pos.y + p[1], pos.z + p[2]);
            this.scene.add(w);
        });

        // Siren Light on top
        const sirenMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 }); // Glowing blue siren!
        this.box(new THREE.Vector3(pos.x, pos.y + 1.15, pos.z), new THREE.Vector3(0.8, 0.35, 1.0), sirenMat, true, false);
        const sirenLight = new THREE.PointLight(0x3b82f6, 1.4, 15);
        sirenLight.position.set(pos.x, pos.y + 1.5, pos.z);
        this.scene.add(sirenLight);

        mesh.userData = {
            interactable: true,
            type: 'escape',
            name: "Rescue Ambulance",
            req: "Requires: Engine Battery, Syringe Kit, Gasoline Can, Vehicle Wheel, Steering Wheel, Ambulance Spark Plug, Car Keys",
            id: "escape_car",
            body
        };
    }

    createRadioTower(pos) {
        // Build a tall radio lattice tower procedurally!
        const towerGroup = new THREE.Group();
        const metal = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.9, roughness: 0.25 });
        
        // Base poles
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10, 8), metal);
        base.position.y = 5;
        towerGroup.add(base);
        
        // Lattice beams
        const beamGeo = new THREE.BoxGeometry(0.1, 0.1, 4.5);
        [1.8, 4.5, 7.2, 9.0].forEach(h => {
            const beam = new THREE.Mesh(beamGeo, metal);
            beam.position.y = h;
            beam.rotation.y = Math.PI / 4;
            towerGroup.add(beam);
        });

        // Glowing red beacon on top
        const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 10.15;
        towerGroup.add(beacon);

        const beaconLight = new THREE.PointLight(0xef4444, 2.0, 20);
        beaconLight.position.set(0, 10.15, 0);
        towerGroup.add(beaconLight);

        const posBody = new THREE.Vector3(pos.x, pos.y, pos.z);
        towerGroup.position.copy(posBody);
        this.scene.add(towerGroup);

        // Add physical box representation at base
        const physBody = new CANNON.Body({ mass: 0, material: this.app.defaultMaterial });
        physBody.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 5, 1.5)));
        physBody.position.set(pos.x, pos.y + 5, pos.z);
        this.world.addBody(physBody);

        // Tower Console
        const consoleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
        const { mesh } = this.box(new THREE.Vector3(pos.x + 2.2, pos.y + 1, pos.z), new THREE.Vector3(1.6, 1.8, 1.2), consoleMat);
        mesh.userData = {
            interactable: true,
            type: 'escape',
            name: "SOS Transmitter Station",
            req: "Requires: Master Transceiver, SOS Battery Pack, High Security Fuse, Satellite Dish, Antenna Cable, Generator Oil, Signal Keycode",
            id: "escape_door",
            body: physBody
        };
    }

    // ==========================================
    // ITEM GENERATORS & PROCEDURAL DESIGNS
    // ==========================================
    makeItemMesh(id) {
        const g = new THREE.Group();
        const gold   = new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0xd97706, emissiveIntensity: 0.3, roughness: 0.4 });
        const silver = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.25 });
        const rust   = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.95 });
        const blk    = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
        const green  = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x047857, emissiveIntensity: 0.45, roughness: 0.4 });
        const blue   = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.45, roughness: 0.4 });

        if (id === 'rusty_key' || id === 'car_keys') {
            const mat = id === 'rusty_key' ? rust : gold;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 16), mat);
            ring.rotation.x = Math.PI / 2; g.add(ring);
            
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), mat);
            shaft.position.y = -0.24; g.add(shaft);

            [0, -0.08, -0.16].forEach((dy, i) => {
                const t = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.02), mat);
                t.position.set(0.06, -0.12 + dy, 0); g.add(t);
            });
        } else if (id === 'car_battery' || id === 'battery_pack') {
            const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.2), blk); g.add(block);
            const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.21), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
            lbl.position.y = 0.05; g.add(lbl);
            [-0.08, 0.08].forEach(x => {
                const t = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 8), silver);
                t.position.set(x, 0.14, 0); g.add(t);
            });
        } else if (id === 'engine_part' || id === 'satellite_dish') {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.24), silver); g.add(b);
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.15, 8), gold);
            horn.position.y = 0.165; horn.rotation.x = Math.PI; g.add(horn);
        } else if (id === 'sec_card' || id === 'master_code') {
            const card = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.016), id === 'master_code' ? silver : blue); g.add(card);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.017), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
            stripe.position.y = 0.03; g.add(stripe);
        } else if (id === 'flashlight_battery' || id === 'master_fuse' || id === 'spark_plug') {
            const isFuse = id === 'master_fuse'; const isSpark = id === 'spark_plug';
            const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.22, 12), (isFuse || isSpark) ? blk : silver); g.add(cyl);
            const top = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), gold);
            top.position.y = 0.125; g.add(top);
            
            const lblColor = isFuse ? 0xef4444 : (isSpark ? 0xffffff : 0x10b981);
            const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.09, 12), new THREE.MeshStandardMaterial({ color: lblColor, emissive: lblColor, emissiveIntensity: 0.5 }));
            lbl.position.y = 0.02; g.add(lbl);
        } else if (id === 'gas_can' || id === 'generator_oil') {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.16), new THREE.MeshStandardMaterial({ color: id === 'gas_can' ? 0xef4444 : 0xf59e0b })); g.add(b);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), blk); cap.position.set(0.05, 0.17, 0); g.add(cap);
        } else if (id === 'car_wheel' || id === 'steering_wheel') {
            const w = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.06, 12, 24), blk); w.rotation.y = Math.PI / 2; g.add(w);
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), silver); hub.rotation.z = Math.PI / 2; g.add(hub);
        } else if (id === 'circuit_board' || id === 'transceiver') {
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.19), green); g.add(board);
            const chip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.07), blk); chip.position.set(0.05, 0.02, 0); g.add(chip);
        } else if (id === 'manual' || id === 'antenna') {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.25), new THREE.MeshStandardMaterial({ color: 0xf9fafb })); g.add(p);
            const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 0.05), new THREE.MeshStandardMaterial({ color: 0x3b82f6 })); lbl.position.set(0, 0.02, 0.06); g.add(lbl);
        } else if (id === 'security_cable' || id === 'override_switch') {
            const c = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 24), blk); g.add(c);
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), gold); p.position.y = 0.16; g.add(p);
        } 
        // ════════ Consumables ════════
        else if (id === 'adrenaline_shot') {
            // Syringe procedural mesh
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
            g.add(barrel);
            
            const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6), blk);
            plunger.position.y = 0.12; g.add(plunger);
            
            const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4), silver);
            needle.position.y = -0.15; g.add(needle);
            
            // Bright glowing green medicine fluid inside!
            const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.11, 8), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
            liquid.position.y = -0.03; g.add(liquid);
        } else if (id === 'sisters_teddy') {
            const fur = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.95 });
            const belly = new THREE.MeshStandardMaterial({ color: 0xd6a46f, roughness: 0.95 });
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), fur);
            body.scale.set(0.9, 1.15, 0.75); g.add(body);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), fur);
            head.position.y = 0.18; g.add(head);
            [-0.08, 0.08].forEach(x => {
                const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), fur);
                ear.position.set(x, 0.255, 0); g.add(ear);
                const arm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), fur);
                arm.position.set(x * 1.6, 0.03, 0); g.add(arm);
            });
            const patch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), belly);
            patch.scale.set(1, 1.2, 0.2); patch.position.set(0, -0.02, 0.085); g.add(patch);
        } else if (id === 'alarm_clock') {
            // Retro Alarm Clock with double bells
            const face = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 16), blk);
            face.rotation.x = Math.PI / 2; g.add(face);
            
            const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            glass.position.z = 0.036; glass.rotation.x = Math.PI / 2; g.add(glass);
            
            // Bells
            const bellGeo = new THREE.SphereGeometry(0.06, 8, 8);
            [[-0.1, 0.14], [0.1, 0.14]].forEach(bp => {
                const bell = new THREE.Mesh(bellGeo, silver);
                bell.position.set(bp[0], bp[1], 0); g.add(bell);
            });
        }

        return g;
    }

    spawnPets() {
        const spots = State.levelSelected === 'grounds'
            ? [new THREE.Vector3(-6, 0.7, -7), new THREE.Vector3(10, 0.7, 9)]
            : [new THREE.Vector3(-8, 1.0, 4), new THREE.Vector3(8, 5.0, 7)];
        spots.forEach((pos, index) => {
            const pet = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.9 });
            const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), mat);
            body.scale.set(1.45, 0.55, 0.75); pet.add(body);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat);
            head.position.set(0.18, 0.03, 0); pet.add(head);
            const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 6), mat);
            tail.rotation.z = Math.PI / 2.6; tail.position.set(-0.23, 0.04, 0); pet.add(tail);
            pet.position.copy(pos);
            pet.userData = { interactable: true, type: 'pet', name: `Monster Pet ${index + 1}`, desc: "It belongs to the monsters. Click to kill it and make them furious.", id: 'monster_pet' };
            pet.children.forEach(c => { if (c.isMesh) c.userData = pet.userData; });
            this.scene.add(pet);
        });
    }

    spawnItems() {
        const items = [
            // Ambulance Escape Requirements (7)
            { id: "car_battery", name: "Engine Battery" }, 
            { id: "car_keys", name: "Car Keys" }, 
            { id: "engine_part", name: "Syringe Kit" },
            { id: "spark_plug", name: "Ambulance Spark Plug" }, 
            { id: "gas_can", name: "Gasoline Can" }, 
            { id: "car_wheel", name: "Vehicle Wheel" }, 
            { id: "steering_wheel", name: "Steering Wheel" },

            // Radio SOS Escape Requirements (7)
            { id: "transceiver", name: "Master Transceiver" }, 
            { id: "battery_pack", name: "SOS Battery Pack" }, 
            { id: "master_fuse", name: "High Security Fuse" },
            { id: "satellite_dish", name: "Satellite Dish" }, 
            { id: "manual", name: "Antenna Cable" }, 
            { id: "generator_oil", name: "Generator Oil" }, 
            { id: "master_code", name: "Signal Keycode" },

            // Special keys (2)
            { id: "rusty_key", name: "Rusty Key" }, 
            { id: "sec_card", name: "Security Keycard" },

            // Consumables (4)
            { id: "flashlight_battery", name: "Flashlight Battery" }, 
            { id: "flashlight_battery", name: "Flashlight Battery" },
            { id: "adrenaline_shot", name: "Adrenaline Booster Shot" }, 
            { id: "alarm_clock", name: "Wind-up Alarm Clock" },
            { id: "sisters_teddy", name: "Sister's Teddy" }
        ];

        this.spawnPoints.sort(() => Math.random() - 0.5);

        items.forEach((item, i) => {
            if (i >= this.spawnPoints.length) return;
            const pos = this.spawnPoints[i].clone();
            const group = this.makeItemMesh(item.id);
            group.position.copy(pos);
            group.userData = { interactable: true, type: 'item', name: item.name, id: item.id, baseY: pos.y };
            group.castShadow = true;

            // Translucent glowing aura (easier to spot in dark corners)
            const gl = new THREE.PointLight(item.id.includes('adrenaline') ? 0x10b981 : 0xfbbf24, 0.75, 5);
            group.add(gl);

            group.children.forEach(c => { if (c.isMesh) c.userData = group.userData; });
            this.scene.add(group);
            this.items.push(group);
        });
    }

    removeItem(mesh) {
        let target = mesh;
        while (target.parent && !this.items.includes(target)) {
            target = target.parent;
        }
        this.scene.remove(target);
        this.items = this.items.filter(i => i !== target);
    }

    spawnDroppedItem(itemData, pos) {
        const mGeo = this.makeItemMesh(itemData.id);
        
        // Physics body for dropping
        const body = new CANNON.Body({ mass: 4, material: this.app.defaultMaterial });
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.2, 0.2, 0.2)));
        body.position.copy(pos);
        this.world.addBody(body);

        mGeo.position.copy(pos);
        mGeo.userData = { interactable: true, type: 'item', name: itemData.name, id: itemData.id, body };
        mGeo.children.forEach(c => { if(c.isMesh) c.userData = mGeo.userData; });

        this.scene.add(mGeo);
        this.items.push(mGeo);

        body.addEventListener("collide", e => {
            if (Math.abs(e.contact.getImpactVelocityAlongNormal()) > 1.8) {
                this.app.audio.playDropSound();
                this.app.alertMonsters?.(mGeo.position);
            }
        });
    }

    // Winding Alarm Clock Bait System
    spawnBaitClock(pos, force) {
        const clockGroup = this.makeItemMesh('alarm_clock');
        
        const body = new CANNON.Body({ mass: 3, material: this.app.defaultMaterial });
        body.addShape(new CANNON.Sphere(0.18));
        body.position.copy(pos);
        body.velocity.copy(force);
        this.world.addBody(body);

        clockGroup.position.copy(pos);
        clockGroup.userData = { interactable: false, type: 'bait', body };
        this.scene.add(clockGroup);

        let tickTimer = 0;
        let alarmActive = false;
        let clockTimer = 6.0; // 6 seconds total bait duration

        const updateClock = (dt) => {
            clockTimer -= dt;
            clockGroup.position.copy(body.position);
            clockGroup.quaternion.copy(body.quaternion);

            if (clockTimer <= 0) {
                // Done
                this.scene.remove(clockGroup);
                this.world.removeBody(body);
                this.app.renderer.setAnimationLoop(this.app.animate.bind(this));
                return;
            }

            // Ring alarm in final 4.5 seconds
            if (clockTimer < 4.5) {
                alarmActive = true;
            }

            if (!alarmActive) {
                tickTimer += dt;
                if (tickTimer >= 0.4) {
                    this.app.audio.playBaitTick();
                    tickTimer = 0;
                }
            } else {
                tickTimer += dt;
                if (tickTimer >= 0.18) {
                    this.app.audio.playAlarmRing();
                    this.app.alertMonsters?.(clockGroup.position);
                    tickTimer = 0;
                }
            }
        };

        // Hook into animation loop dynamically!
        const originalAnimate = this.app.animate.bind(this.app);
        this.app.animate = () => {
            const dt = Math.min(this.app.clock.getDelta(), 0.05);
            updateClock(dt);
            originalAnimate();
        };
    }

    tryOpenDoor(mesh) {
        let obj = mesh;
        while (obj && (!obj.userData || !obj.userData.id)) obj = obj.parent;
        const ud = obj ? obj.userData : {};
        const item = State.heldItem;
        const ui = this.app.ui;

        if (ud.id === "escape_door") {
            if (!this.doorItems) this.doorItems = new Set();
            const doorReqs = ["transceiver", "battery_pack", "master_fuse", "satellite_dish", "manual", "generator_oil", "master_code"];
            if (item && doorReqs.includes(item.id)) {
                this.doorItems.add(item.id);
                State.heldItem = null; ui.updateHUD();
                this.app.audio.playPickupSound();
                if (this.doorItems.size === 7) {
                    ui.showInteractionTag(ud.name, "Security Bypass Complete! Gate Unlocked.", "");
                    mesh.position.y -= 5; if (ud.body) ud.body.position.y -= 5; ud.interactable = false;
                } else {
                    ui.showInteractionTag(ud.name, `Mounted ${item.name}. ${7 - this.doorItems.size} more security parts required.`, "");
                }
            } else {
                ui.showInteractionTag(ud.name, `Locked Gate. (${this.doorItems ? this.doorItems.size : 0}/7 Components Mounted)`, ud.req);
            }
        } else if (ud.id === "escape_car") {
            if (!this.installedParts) this.installedParts = new Set();
            const carReqs = ["car_battery", "car_keys", "engine_part", "spark_plug", "gas_can", "car_wheel", "steering_wheel"];
            if (item && carReqs.includes(item.id)) {
                this.installedParts.add(item.id);
                State.heldItem = null; ui.updateHUD();
                this.app.audio.playPickupSound();
                if (this.installedParts.size === 7) {
                    ui.showInteractionTag(ud.name, "Ambulance fully restored! Click to escape.", "");
                    ud.id = "fixed_car"; ud.name = "Restored Ambulance";
                } else {
                    ui.showInteractionTag(ud.name, `Mounted ${item.name}. ${7 - this.installedParts.size} more parts required.`, "");
                }
            } else {
                const missing = 7 - (this.installedParts ? this.installedParts.size : 0);
                ui.showInteractionTag(ud.name, `Broken Vehicle. (${7 - missing}/7 parts mounted)`, ud.req);
            }
        } else if (ud.id === "fixed_car") {
            ui.triggerWin();
        } else if (ud.id && ud.id.startsWith("inner_door")) {
            const hasCorrectKey = item && (
                (ud.id === "inner_door_3" && item.id === "sec_card") ||
                ((ud.id === "inner_door_1" || ud.id === "inner_door_2") && item.id === "rusty_key")
            );

            if (hasCorrectKey) {
                ui.showInteractionTag(ud.name, "Unlocked and Opened!", "");
                mesh.position.y -= 5;
                if (ud.body) ud.body.position.y -= 5;
                ud.interactable = false; 
                State.heldItem = null; 
                ui.updateHUD();
                this.app.audio.playPickupSound();
            } else {
                ui.showInteractionTag(ud.name, "Locked Entrance.", ud.req);
            }
        } else if (ud.id === "back_door") {
            ui.showInteractionTag(ud.name, "Unlocked Backyard Door!", "");
            mesh.position.y -= 5;
            if (ud.body) ud.body.position.y -= 5;
            ud.interactable = false;
            this.app.audio.playPickupSound();
        }
    }

    update(dt) {
        const t = Date.now() * 0.001;
        this.items.forEach((grp, i) => {
            if (grp.userData && grp.userData.body) {
                // If dropped physically, sync from CANNON.js rigid body
                grp.position.copy(grp.userData.body.position);
                grp.quaternion.copy(grp.userData.body.quaternion);
            } else {
                // Otherwise spin and float procedurally
                grp.rotation.y += dt * 1.25;
                const by = grp.userData && grp.userData.baseY !== undefined ? grp.userData.baseY : grp.position.y;
                grp.position.y = by + Math.sin(t * 1.8 + i * 1.0) * 0.09;
            }
        });
    }
}
