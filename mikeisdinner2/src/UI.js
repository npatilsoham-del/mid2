import { State } from './GameState.js';

export class UIManager {
    constructor(gameApp) {
        this.app = gameApp;

        this.menuScreen      = document.getElementById('main-menu');
        this.hudScreen       = document.getElementById('hud');
        this.gameOverScreen  = document.getElementById('game-over');
        this.winScreen       = document.getElementById('win-screen');
        this.transitionScreen = document.getElementById('night-transition');

        this.tagUI       = document.getElementById('interaction-tag');
        this.tagName     = document.getElementById('interact-name');
        this.tagDesc     = document.getElementById('interact-desc');
        this.tagReq      = document.getElementById('interact-req');
        this.heldItemText = document.getElementById('held-item');
        this.nightDisplay = document.getElementById('night-display');
        this.hudMapName   = document.getElementById('hud-map-name');
        this.batteryFill  = document.getElementById('battery-fill');
        this.staminaFill  = document.getElementById('stamina-fill');
        this.pickupFlash  = document.getElementById('pickup-flash');
        this.nvgOverlay   = document.getElementById('nvg-overlay');

        this.bindEvents();
    }

    bindEvents() {
        // Map Selection Cards
        const groundsCard = document.getElementById('map-grounds');
        const sanatoriumCard = document.getElementById('map-sanatorium');

        if (groundsCard && sanatoriumCard) {
            groundsCard.addEventListener('click', () => {
                State.setLevel('grounds');
                groundsCard.classList.add('active-map');
                sanatoriumCard.classList.remove('active-map');
                this.app.audio.playPickupSound();
            });

            sanatoriumCard.addEventListener('click', () => {
                State.setLevel('sanatorium');
                sanatoriumCard.classList.add('active-map');
                groundsCard.classList.remove('active-map');
                this.app.audio.playPickupSound();
            });
        }

        // Difficulty Buttons
        document.querySelectorAll('.menu-options .btn').forEach(btn => {
            if (btn.id === 'btn-music') return;
            btn.addEventListener('click', e => {
                const diff = e.target.getAttribute('data-difficulty');
                if (diff) { 
                    State.setDifficulty(diff); 
                    this.startGame(); 
                }
            });
        });

        // BGM Switch
        const musicBtn = document.getElementById('btn-music');
        if (musicBtn) {
            musicBtn.addEventListener('click', () => {
                State.musicEnabled = !State.musicEnabled;
                musicBtn.innerText = `Music: ${State.musicEnabled ? 'ON' : 'OFF'}`;
                if (State.musicEnabled) this.app.audio.playBGM();
                else this.app.audio.stopBGM();
            });
        }

        // Restart and Back to Menu
        const restartBtn = document.getElementById('btn-restart');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                State.reset();
                this.showScreen(this.menuScreen);
                this.app.audio.playPickupSound();
            });
        }

        const menuBtn = document.getElementById('btn-menu');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                State.reset();
                this.showScreen(this.menuScreen);
                this.app.audio.playPickupSound();
            });
        }

        // Mobile joystick overlays and mobile triggers
        const interactBtn = document.getElementById('btn-interact');
        if (interactBtn) interactBtn.addEventListener('pointerdown', () => this.app.player?.interact());

        const dropBtn = document.getElementById('btn-drop');
        if (dropBtn) dropBtn.addEventListener('pointerdown', () => this.app.player?.throwBaitOrDrop());

        const flashBtn = document.getElementById('btn-flashlight');
        if (flashBtn) flashBtn.addEventListener('pointerdown', () => this.app.player?.toggleNightVision()); // Toggles NVG on mobile!

        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) jumpBtn.addEventListener('pointerdown', () => this.app.player?.jump());

        const sprintBtn = document.getElementById('btn-sprint');
        if (sprintBtn) {
            sprintBtn.addEventListener('pointerdown',  () => this.app.player?.setSprint(true));
            sprintBtn.addEventListener('pointerup',    () => this.app.player?.setSprint(false));
            sprintBtn.addEventListener('pointercancel',() => this.app.player?.setSprint(false));
        }
    }

    showScreen(screen) {
        [this.menuScreen, this.hudScreen, this.gameOverScreen, this.winScreen, this.transitionScreen]
            .forEach(s => { 
                if (s) {
                    s.classList.remove('active'); 
                    s.classList.add('hidden'); 
                }
            });
        if (screen) {
            screen.classList.remove('hidden');
            screen.classList.add('active');
        }
    }

    startGame() {
        State.status = 'playing';
        this.showScreen(this.hudScreen);
        this.updateHUD();

        if (this.app.audio.ctx.state === 'suspended') this.app.audio.ctx.resume();
        this.app.initGame();

        if (window.innerWidth > 768) document.body.requestPointerLock();
    }

    triggerGameOver() {
        State.status = 'gameover';
        this.app.audio.playDeathStinger();
        this.showScreen(this.gameOverScreen);
        document.exitPointerLock();
    }

    triggerWin() {
        State.status = 'win';
        this.app.audio.playWinStinger();
        this.showScreen(this.winScreen);
        document.exitPointerLock();
    }

    async triggerNightTransition() {
        if (!State.nextNight()) {
            this.triggerGameOver();
            return;
        }
        this.showScreen(this.transitionScreen);
        document.getElementById('transition-text').innerText = `Night ${State.night}`;
        document.exitPointerLock();

        await new Promise(r => setTimeout(r, 2600));

        this.showScreen(this.hudScreen);
        this.updateHUD();
        this.app.resetPositions();
        if (window.innerWidth > 768) document.body.requestPointerLock();
    }

    updateHUD() {
        this.nightDisplay.innerText = `Night ${State.night}`;
        this.hudMapName.innerText = State.levelSelected === 'grounds' ? "Sanatorium Grounds & Cabin" : "Main Haunted Sanatorium";
        this.heldItemText.innerText = State.heldItem ? State.heldItem.name : 'Nothing';
        if (this.app.player) {
            this.batteryFill.style.width = `${this.app.player.battery}%`;
            
            // Pulse standard bars if adrenaline shot is active!
            if (State.adrenalineActive) {
                this.staminaFill.classList.add('adrenaline-pulse');
                this.staminaFill.style.width = '100%';
            } else {
                this.staminaFill.classList.remove('adrenaline-pulse');
                this.staminaFill.style.width = `${this.app.player.stamina}%`;
            }
        }
    }

    toggleNVGOverlay(active) {
        if (this.nvgOverlay) {
            if (active) {
                this.nvgOverlay.classList.add('active');
            } else {
                this.nvgOverlay.classList.remove('active');
            }
        }
    }

    flashPickup() {
        if (!this.pickupFlash) return;
        this.pickupFlash.classList.remove('flash');
        void this.pickupFlash.offsetWidth; // force reflow
        this.pickupFlash.classList.add('flash');
    }

    showInteractionTag(name, desc, req = '') {
        this.tagUI.classList.remove('hidden');
        this.tagName.innerText = name;
        this.tagDesc.innerText = desc;
        this.tagReq.innerText  = req;
    }

    hideInteractionTag() {
        this.tagUI.classList.add('hidden');
    }
}
