export const State = {
    difficulty: 'normal',
    night: 1,
    levelSelected: 'grounds', // 'grounds' or 'sanatorium'
    status: 'menu', // menu, playing, gameover, win
    heldItem: null,
    musicEnabled: true,
    nvgEnabled: false,
    adrenalineActive: false,

    // Config based on difficulty
    getConfig: () => {
        const configs = {
            practice: { 
                monsterSpeed: 0, 
                jumpScareMin: 180, 
                jumpScareMax: 300, 
                ambientLight: 1.0,  // Bright Granny style ambient
                batteryDrain: 0.15 
            },
            easy: { 
                monsterSpeed: 2.2, 
                jumpScareMin: 60, 
                jumpScareMax: 120, 
                ambientLight: 0.85, 
                batteryDrain: 0.25 
            },
            normal: { 
                monsterSpeed: 4.2, 
                jumpScareMin: 30, 
                jumpScareMax: 90, 
                ambientLight: 0.75, 
                batteryDrain: 0.45 
            },
            nightmare: { 
                monsterSpeed: 6.8, 
                jumpScareMin: 10, 
                jumpScareMax: 40, 
                ambientLight: 0.65, 
                batteryDrain: 0.85 
            }
        };
        return configs[State.difficulty];
    },

    setDifficulty: (diff) => {
        State.difficulty = diff;
    },

    setLevel: (level) => {
        State.levelSelected = level;
    },

    nextNight: () => {
        State.night++;
        if (State.night > 5) {
            State.status = 'gameover';
            return false; // Game over after Night 5
        }
        return true; // Proceed to next night
    },

    reset: () => {
        State.night = 1;
        State.status = 'menu';
        State.heldItem = null;
        State.nvgEnabled = false;
        State.adrenalineActive = false;
    }
};
