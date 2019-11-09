'use strict';

const config = require('./config');
const wizardUtils = require('./wizards');
const Constants = require('./constants');
const api = require('./api')

const { AffinityIndexes, AffinityRelationships } = Constants;

/*
 * Example duel JSON from Alchemy API:
{
    "id":"0x18d53c42aff5ef1a6603f79c26e4c43fe50c6a270025a94df96332d699e39155",
    "wizard1Id":"1151",
    "wizard2Id":"1149",
    "affinity1":4,
    "affinity2":3,
    "startPower1":"71099841732970",
    "startPower2":"71284821480208",
    "endPower1":"142384663213178",
    "endPower2":"0",
    "moveSet1":"0x0404040404000000000000000000000000000000000000000000000000000000",
    "moveSet2":"0x0303030303000000000000000000000000000000000000000000000000000000",
    "startBlock":4943216,
    "endBlock":4943221,
    "timeoutBlock":4943666,
    "timedOut":false,
    "isAscensionBattle":false
}
*/

/**
 * Given a 'duel' object from the API, this will
 * create an object ready for display by the UI
 */
const addDuelDisplayData = (duel) => {
    const duelDisplayObj = {...duel};

    duelDisplayObj.wizard1SvgUrl = api.getWizardImageUrlById(duel.wizard1Id);
    duelDisplayObj.wizard2SvgUrl = api.getWizardImageUrlById(duel.wizard2Id);

    // calculate gain or loss
    const gain1 = (duel.endPower1 - duel.startPower1);
    const gain2 = (duel.endPower2 - duel.startPower2);
    duelDisplayObj.wizard1Gain = gain1;
    duelDisplayObj.wizard2Gain = gain2;

    duelDisplayObj.wizard1DidWin = (gain1 >= 0);
    duelDisplayObj.wizard2DidWin = (gain2 >= 0);

    duelDisplayObj.moveResults = getMovesetResults(duel.moveSet1, duel.moveSet2);

    return duelDisplayObj;
}

/**
 * Given an array of duel objects, returns an array of the same objects
 * with display data added (see addDuelDisplayData())
 */
const addDuelDisplayDataArray = (arr) => {
    const displayArray = [];

    for (const duel of arr) {
        displayArray.push(addDuelDisplayData(duel));
    }

    return displayArray;
};

/**
 * Utility to convert a "moveset" into an array of integers.
 *
 * A moveset is a series of moves (forecast spells, in Cheeze Wizards parlance)
 * crammed into a hex string, like so:
 *
 * "0x0203040302000000000000000000000000000000000000000000000000000000"
 *
 * In this case, the spells cast are [2, 3, 4, 3, 2]
 */
const convertMovesetToIntArray = (moveset) => {
    if (! moveset || typeof(moveset) !== 'string') {
        //console.log('no moveset or not string', [moveset, typeof moveset]);
        return [];
    }

    const arr = [];
    for (let i=0; i<5; i++) {
        const index = 2 + (i*2);
        const str = moveset.substring(index, index+2);
        arr[i] = parseInt(str);
    }

    return arr;
}

/**
 * Convert two "moves" (identified by ints) into an object describing
 * the match.
 *
 * @param move1: the affinity-index of p1's move
 * @param move2: the affinity-index of p2's move
 *
 * The object returned has the structure:
 *
 * const results = {
 *     p1 = <affinity index of player 1's move>
 *     p2 = <affinity index of player 2's move>
 *     winner = <"tie", "p1, or "p2">
 * };
 */
const getMoveResults = (move1, move2) => {
    const results = {};
    results.p1 = move1;
    results.p2 = move2;

    // indices correspond to:
    if (move1 == move2) {
        results.winner = "tie";
    } else if (move1 == Constants.AffinityIndexes.FIRE) {
        if (move2 == Constants.AffinityIndexes.WIND) results.winner = "p1";
        if (move2 == Constants.AffinityIndexes.WATER) results.winner = "p2";
    } else if (move1 == Constants.AffinityIndexes.WIND) {
        if (move2 == Constants.AffinityIndexes.WATER) results.winner = "p1";
        if (move2 == Constants.AffinityIndexes.FIRE) results.winner = "p2";
    } else if (move1 == Constants.AffinityIndexes.WATER) {
        if (move2 == Constants.AffinityIndexes.FIRE) results.winner = "p1";
        if (move2 == Constants.AffinityIndexes.WIND) results.winner = "p2";
    }

    return results;
}

/**
 * Returns an array of "move" objects (see getMoveResults()).
 *
 * @param moveset1 should be a hex-represented moveset (see convertMovesetToIntArray())
 * @param moveset2 should be a hex-represented moveset (see convertMovesetToIntArray())
 */
const getMovesetResults = (moveset1, moveset2) => {
    //console.log('getMovesetResults', [moveset1, moveset2]);
    const moves1 = convertMovesetToIntArray(moveset1);
    const moves2 = convertMovesetToIntArray(moveset2);

    const arr = [];
    for (let i=0; i<5; i++) {
        arr[i] = getMoveResults(moves1[i], moves2[i]);
    }

    return arr;
}

/**
 * Calculate the affinity relationship between a move and an
 * opponent's affinity.
 *
 * @param move is the move's affinity
 * @param opponent is the oponnent's affinity
 */
const calculateAffinityRelationship = (move, opponent) => {
    if (opponent == AffinityIndexes.NEUTRAL || move == opponent) {
        return AffinityRelationships.EQUAL;
    } else if (move == AffinityIndexes.FIRE) {
        if (opponent == AffinityIndexes.WIND) return AffinityRelationships.ADVANTAGED;
        if (opponent == AffinityIndexes.WATER) return AffinityRelationships.DISADVANTAGED;
    } else if (move == AffinityIndexes.WIND) {
        if (opponent == AffinityIndexes.WATER) return AffinityRelationships.ADVANTAGED;
        if (opponent == AffinityIndexes.FIRE) return AffinityRelationships.DISADVANTAGED;
    } else if (move == AffinityIndexes.WATER) {
        if (opponent == AffinityIndexes.FIRE) return AffinityRelationships.ADVANTAGED;
        if (opponent == AffinityIndexes.WIND) return AffinityRelationships.DISADVANTAGED;
    } else {
        return "UNKNOWN"; // should only happen with bad input?
    }
}

module.exports = {
    addDuelDisplayData,
    addDuelDisplayDataArray,
    convertMovesetToIntArray,
    getMovesetResults,
    getMoveResults,
    calculateAffinityRelationship,
};

