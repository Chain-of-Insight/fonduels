/**
 * `duels.js` contains functionality to display and interact with a duel simulation. The simulation
 * can be carried out in different ways depending on how it is "invoked," as described below.
 *
 * **Note**:
 * If you're interested in testing this out, see `mockChallengeDuel.html` and `mockOfflineDuel.html`.
 *
 * Modes - there are currently two modes of operation. One is a `challenge` duel where two live
 * participants duel each other. `firebase` is used as a means of communicating wizard `forecasts`.
 * In this mode, each player submits their `forecast` and then waits for their opponent's `forecast`
 * from `firebase`, at which point the duel results are displayed. This mode is invoked if there are
 * no URL query params, and the following information is expected to be passed via `sessionStorage`:
 *
 * @param {string} mode should be either "challenge" or "offline" -- currently only `challenge` makes sense.
 * @param {string} ourWizardId should be the wizard ID of the wizard associated with the user
 * @param {string} opposingWizardId should be the wizard ID of the wizard to duel against
 * @param {object} duel is a config object that contains info about both wizards and the
 *                 duel setup.
 *
 * The other mode is an `offline` duel where a an arbitrary matchup can be simulated. This mode is
 * assumed if there are any URL query params. The params are:
 *
 * @param wiz1
 * @param wiz2
 */

'use strict';

const FIREBASE = require('./firebase');
const path = 'duel-simulations';
const duelsRef = FIREBASE.firebaseDb.ref(path);

// Config 
const config = require('./config');
const firebaseConfig = config.firebaseConfig;

window.jQuery = require('jquery');

Vue.config.devtools = false;
Vue.config.productionTip = false;

const randomTurn = () => { return Math.floor(Math.random() * 3) + 2; };
const randomTurns = () => {
    return [
        randomTurn(),
        randomTurn(),
        randomTurn(),
        randomTurn(),
        randomTurn(),
    ];
}

Vue.component('round-picker', {
    props: ['label'],
    data: () => ({
        value: 0,
    }),
    template: '#round-picker-template',
});

Vue.component('duel-status', {
    props: ['outcome', 'power', 'score'],
    template: '#duel-status-template',
});

const wizCard = Vue.component('wizard-card', {
    props: ['wizard', 'api'],
    template: "#wizard-card-template",
});

// Create application
let duelsVm = new Vue({
    el: '#duels',
    data: () => ({
        // Dependencies
        Provider: require('./providers'),
        Enigma: require('./enigma/enigmaInit'),
        enigma: null,
        api: require('./api'),
        duelUtils: require('./duels'),
        wizardUtils: require('./wizards'),
        DuelSim: require('./DuelLib.js'),
        // Web3
        web3Providers: {
            rinkeby: null,
            mainnet: null
        },
        isWeb3Enabled: null,
        wallets: {
            rinkeby: null,
            mainnet: null
        },
        contracts: {
            rinkeby: {},
            mainnet: {}
        },
        tokens: {
            rinkeby: {
                wizards: []
            },
            mainnet: {
                wizards: []
            }
        },
        firebase: FIREBASE,
        // Duel
        mode: null,
        duel: null,
        ourWizard: null,
        ourWizardId: null,
        opposingWizard: null,
        opposingWizardId: null,
        duelResults: null,
        ourMoves: [],
        ourMovesSubmitted: false,
        opponentMoves: [],
        opponentMovesReceived: false,
        firebaseDuels: [],
        // UI
        isBgAnimated: false,
        // Navigation
        wizards: null
    }),
    firebase: {
        // TODO: subscribe to "duel-simulations/"+ duelId
        firebaseDuels: duelsRef,
    },
    mounted: async function () {
        // Animate Cheeze Melt
        setTimeout(() => {
            this.isBgAnimated = true;
            setTimeout(() => {
                jQuery('document').ready(function () {
                    jQuery('#markets').removeClass('hidden');
                });
            }, 0);
        }, 0);

        this.enigma = await this.Enigma.initEnigma();

        console.log('this.enigma =>', this.enigma);

        // prior to any 'await' call, we need to determine whether we are in
        // offline mode or not
        this.mode = (this.isOfflineMode() ? 'offline' : 'challenge');
        //console.log("early detection of mode: "+ this.mode);

        const duelParams = await this.readConfig();
        //console.log("duelParams => ", duelParams);

        // this.mode = duelParams.mode;
        if (this.mode !== duelParams.mode) {
            //console.log(`WARNING: detected mode (${this.mode}) != duelParams.mode (${duelParams.mode})!!`);
        }

        this.ourWizardId = duelParams.ourWizardId;
        this.opposingWizardId = duelParams.opposingWizardId;
        this.duel = duelParams.duel;

        // determine which wizard is which
        if (this.duel.wizardChallenged.id === this.ourWizardId) {
            //console.log("We're the challenged wizard");
            this.opposingWizard = this.duel.wizardChallenging;
            this.ourWizard = this.duel.wizardChallenged;
        } else {
            //console.log("We're the challenging wizard");
            this.opposingWizard = this.duel.wizardChallenged;
            this.ourWizard = this.duel.wizardChallenging;
        }

        // Web3 Instances
        this.web3Providers.mainnet = await this.Provider.getWssWeb3Mainnet();
        this.web3Providers.rinkeby = await this.Provider.getWssWeb3Rinkeby();

        // Wallet Instance
        let accounts;
        if (window.hasOwnProperty('ethereum')) {
            this.isWeb3Enabled = true;
            accounts = await window.ethereum.enable();
            if (accounts[0]) {
                // Wallets
                this.wallets.rinkeby = false;
                this.wallets.mainnet = accounts[0];
                console.log('Accounts =>', this.wallets);
                
                // ERC721 Instances
                this.contracts.mainnet.wizards = await this.Provider.mainnetWizardsInstance();
                //console.log('ERC721 Contract', this.contracts.mainnet.wizards);
            }
        } else {
            this.isWeb3Enabled = false;
        }

        // now that we've mounted and our async code has finished, replace our wizard placeholders

        const wizCard1VM = new wizCard({
            propsData: {
                wizard: this.ourWizard,
                api: this.api,
            },
        }).$mount('#wiz1-placeholder');

        const wizCard2VM = new wizCard({
            propsData: {
                wizard: this.opposingWizard,
                api: this.api,
            },
        }).$mount('#wiz2-placeholder');

    },
    watch: {
        async firebaseDuels(value) {

            // TODO: we should not even connec to firebase in (mode == "offline")
            if (this.mode === "offline") {
                //console.log("Ignoring firebaseDuels update");
                return;
            }

            //console.log("firebaseDuels change => ", value);

            // 'duel-simulations' is an array of all active duels; we need to loop through each to find ours
            let thisDuel = null;
            for (const duel of value) {
                if (duel && duel['.key'] && duel['.key'] === this.duel.roomId) {
                    //console.log("Found our duel => ", duel);
                    thisDuel = duel;
                    break;
                }
            }

            if (! thisDuel) {
                //console.log("Did not find our duel");
                return;
            }

            if (! thisDuel.moves) {
                //console.log("No moves yet");
                return;
            }

            const ourMoves = thisDuel.moves[this.ourWizardId];
            const opponentMoves = thisDuel.moves[this.opposingWizardId];

            if (opponentMoves) {
                //console.log("Setting opponentMoves", opponentMoves);
                this.opponentMoves = opponentMoves;
                this.opponentMovesReceived = true;
            }

            if (! this.duelResults && this.opponentMovesReceived && this.ourMovesSubmitted) {
                await this.processDuelSimulation(this.ourMoves, this.opponentMoves);
            }
        },
        ourMoves(value) {
            //console.log("our moves updated => ", value);
            this.processOfflineSimulation(this.ourMoves, this.opponentMoves);
        },
        opponentMoves(value) {
            //console.log("opponent moves updated => ", value);
            this.processOfflineSimulation(this.ourMoves, this.opponentMoves);
        },
    },
    methods: {
        // Menu Nav
        goHome: function () {
            return window.location.href = "/";
        },
        goPlay: async function () {
            // Fetch random wizards
            if (!this.wizards) {
                await this.getAllWizards();
            }
            let wizardA = this.wizards[Math.floor(Math.random() * this.wizards.length)];
            let wizardB = this.wizards[Math.floor(Math.random() * this.wizards.length)];
            // Return a random duel
            return window.location.href = "/duels/?wiz1=" + wizardA.id + "&wiz2=" + wizardB.id;
        },
        getAllWizards: async function () {
            // Get Wizards
            let wizardsQuery = await this.api.getAllWizards();
            // Sort Wizards
            this.wizards = wizardsQuery.wizards.sort(this.wizardUtils.sortByPowerLevel);
            //console.log('All wizards', this.wizards);
        },
        /**
         * @param {Object} ourMoves: An array of turn commitments (enums) for our wizard
         * @param {Object} opponentMoves: An array of turn commitments (enums) from our opponent
         * @return {Object} : object[0] = power transfer, object[1] = sum of move scores
         * 
         * Example response:
         * 
         * $ node TestDuel.js
         * Resolved Duel => Result { '0': '2', '1': '100', __length__: 2 }
         */
        processDuelSimulation: async function(ourMoves, opponentMoves) {
            // Only call, when valid args are present
            if (!ourMoves || !opponentMoves || !this.duel ||
                    (!this.opponentMovesReceived && this.mode === 'challeng')) {
                /*console.log("processDuelSimulation(): preconditions not met => ",
                    {
                        ourMoves,
                        opponentMoves,
                        duel: this.duel,
                        opponentMovesReceived: this.opponentMovesReceived
                    });*/
                throw new Error("processDuelSimulation(): preconditions not met (see console)");
            }

            // even more pedantic... 
            if (! this.ourWizardId || ! this.ourWizard || ! this.opposingWizardId || ! this.opposingWizard) {
                /*console.log("processDuelSimulation(): don't have correct wizard ids, how did we even get here? => ",
                    {
                        ourWizardId: this.ourWizardId,
                        ourWizard: this.ourWizard,
                        opposingWizardId: this.opposingWizardId,
                        opposingWizard: this.opposingWizard,
                    });*/
                throw new Error("processDuelSimulation(): incorrect wizard(s) in duel config");
            }

            // Instance of Providers
            let rinkeby = this.web3Providers.rinkeby;

            // Process Duel resolution
            let result = await this.DuelSim.SimulateDuel(
                ourMoves,
                opponentMoves,
                this.ourWizard.power,
                this.opposingWizard.power,
                this.ourWizard.affinity,
                this.opposingWizard.affinity,
                rinkeby
            );

            // Debug
            //console.log('Resolved Duel =>', result);

            const power = Math.round(parseInt(result[0]) / 1000000000000);
            const score = parseInt(result[1]);
            const outcome = (power > 0 ? "WIN" : (power == 0 ? "TIE" : "LOSS"));

            this.duelResults = {
                power: power,
                score: score,
                outcome: outcome,
            };

            //console.log("Compiled duel results:", this.duelResults);
            this.clearSessionStorage();
        },

        /**
         * calls processDuelSimulation() if all moves (ours and opponent's) are
         * selected. Only works in (mode == 'offline').
         */
        processOfflineSimulation: async function(ourMoves, opponentMoves) {
            if (this.mode !== 'offline') {
                return;
            }

            const isValid = (move) => {
                return (move > 1 && move < 5);
            };
            if (isValid(ourMoves[0])
                && isValid(ourMoves[1])
                && isValid(ourMoves[2])
                && isValid(ourMoves[3])
                && isValid(ourMoves[4])

                && isValid(opponentMoves[0])
                && isValid(opponentMoves[1])
                && isValid(opponentMoves[2])
                && isValid(opponentMoves[3])
                && isValid(opponentMoves[4])) {

                await this.processDuelSimulation(ourMoves, opponentMoves);
            }
        },

        /**
         * Submit random moves for opponent
         */
        async submitRandomOpponentForecast() {

            // submit fake turns for opponent
            await duelsRef
                    .child(this.duel.roomId)
                    .child("moves")
                    .child(this.opposingWizardId)
                    .set(randomTurns());
        },

        /**
         * Clear opponent's forecast
         */
        async clearOpponentMoves() {

            await duelsRef
                    .child(this.duel.roomId)
                    .child("moves")
                    .child(this.opposingWizardId)
                    .remove();
        },

        /**
         * Submit turn
         */
        async submitTurn() {

            if (!(this.ourMoves[0] && this.ourMoves[1] && this.ourMoves[2] && this.ourMoves[3] && this.ourMoves[4])) {
                //console.log("Error: not all turns are set");
                return;
            }

            if (this.ourMovesSubmitted) {
                //console.log("Error: can't submit our turns more than once");
                return;
            }
            this.ourMovesSubmitted = true;

            /* uncomment to push an empty object to 'duel-simulations', e.g. to clean up
            await duelsRef
                    .child(this.duel.roomId)
                    .set({});
            */

            const moves = {};
            moves[this.ourWizardId] = this.ourMoves;

            // post duel config
            // TODO: don't want both parties posting this
            //       also, probably not the ideal time to post it
            await duelsRef
                    .child(this.duel.roomId)
                    .child("duelConfig")
                    .set(this.duel);

            // post moves object
            await duelsRef
                    .child(this.duel.roomId)
                    .child("moves")
                    .update(moves);
        },

        /**
         * Reads in variables from query params. If any are found, this implicitly sets us
         * to "offline" mode where the user can freely select the moves of either opponent.
         */
        async readQueryParamsConfig() {
            var urlParams = new URLSearchParams(window.location.search);

            const ourWizardId = urlParams.get("wiz1");
            const opposingWizardId = urlParams.get("wiz2");

            if (ourWizardId && opposingWizardId) {
                const ourWizard = await this.api.getWizardById(ourWizardId);
                const opposingWizard = await this.api.getWizardById(opposingWizardId);

                if (! ourWizard) throw new Error(`ourWizardId (${ourWizardId}) not found`);
                if (! opposingWizard) throw new Error(`opposingWizardId (${opposingWizardId}) not found`);

                // we need to add in a couple things to the data provided by the API
                ourWizard.specialPower = this.getHumanReadableAffinity(ourWizard.affinity);
                opposingWizard.specialPower = this.getHumanReadableAffinity(opposingWizard.affinity);



                return {
                    mode: "offline",
                    ourWizardId,
                    opposingWizardId,
                    duel: {
                        wizardChallenged: opposingWizard,
                        wizardChallenging: ourWizard,
                    },
                };

            } else if (ourWizardId || opposingWizardId) {
                throw new Error("If ourWizardId is set, opposingWizardId must be set (and vise-versa)");
            }

            return null;
        },

        /**
         * Reads in variables from sessionStorage, optionally deleting them.
         *
         * See the documentation at the top of this file (duels.js) for more info on
         * what data is stored in sessionStorage.
         *
         * This also validates the input from sessionStorage, throwing an instance of
         * Error on invalid input.
         *
         * @return {object} an object with the sessionStorage variables filled out
         */
        async readSessionStorageConfig() {

            const mode = sessionStorage.getItem("mode");
            const ourWizardId = sessionStorage.getItem("ourWizardId");
            const opposingWizardId = sessionStorage.getItem("opposingWizardId");
            const duel = JSON.parse(sessionStorage.getItem('duel'));

            if (! mode) throw new Error("duels.js requires 'mode' in sessionStorage");
            if (! ourWizardId || ourWizardId === "undefined") throw new Error("duels.js requires 'ourWizardId' in sessionStorage");
            if (! opposingWizardId || opposingWizardId === "undefined") throw new Error("duels.js requires 'opposingWizardId' in sessionStorage");
            if (! duel) throw new Error("duels.js requires 'duel' in sessionStorage");

            return {
                mode,
                ourWizardId,
                opposingWizardId,
                duel,
            };
        },

        /**
         * Reads either URL query params or sessionStorage as config (preferring URL query params
         * over sessionStorage)
         */
        async readConfig() {
            let config = await this.readQueryParamsConfig();
            if (! config) {
                config = await this.readSessionStorageConfig();
            }
            return config;
        },

        /**
         * Clears sessionStorage
         */
        clearSessionStorage() {
            sessionStorage.removeItem("mode");
            sessionStorage.removeItem("ourWizardId");
            sessionStorage.removeItem("opposingWizardId");
            sessionStorage.removeItem("duel");
        },

        /**
         * Detects (in non-async way) whether we are in `offline` mode or not.
         * We assume offline mode to be true if there are `wiz1` or `wiz2` params.
         */
        isOfflineMode() {
            var urlParams = new URLSearchParams(window.location.search);

            const ourWizardId = urlParams.get("wiz1");
            const opposingWizardId = urlParams.get("wiz2");

            return (ourWizardId || opposingWizardId);
        },

        /**
         * calculate human-readable affinity name given an affinity index
         *
         * TODO: this is done elsewhere; DRY
         */
        getHumanReadableAffinity(affinityIndex) {
            switch (affinityIndex) {
                case 0: return "Unset";
                case 1: return "Neutral";
                case 2: return "Fire";
                case 3: return "Water";
                case 4: return "Wind";
            }
            return "";
        },
    }
});
