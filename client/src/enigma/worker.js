const EnigmaModel = require('enigma-js');

/**
 * fn commit_to_duel( MoveSet1:Vec<u8>,
 *           MoveSet2:Vec<u8>,
 *           wizard1:U256,
 *           wizard2:U256,
 *           affinities:Vec<u8>,
 *           )
 * @param {Object} taskArgs : An array of params including: Move Set p1 (int), Move Set p2 (int), wizard id 1 (int), wizard id 2 (int), affinities (array)
 */
const duelCommitTask = async (taskArgs, enigma, account) => {
    let utils = EnigmaModel.utils,
        eeConstants = EnigmaModel.eeConstants,
        task;

    //Smart Contract "Sample.Sol" has been deployed at ETH address: 0x5b9b42d6e4B2e4Bf8d42Eba32D46918e10899B66
    const contractAddr = "0x5b9b42d6e4B2e4Bf8d42Eba32D46918e10899B66";

    /*
    let taskArgs = [
        [ourMoves, 'uint64[]'],
        [opponentMoves, 'uint64[]'],
        [this.ourWizardId, 'uint256'],
        [this.opposingWizardId, 'uint256'], 
        [affinities, 'uint64[]']
    ];
    */

    let taskFn = 'commit_to_duel(uint64[], uint64[], uint256, uint256, uint64[])';
    let taskGasLimit = 100000;
    let taskGasPx = utils.toGrains(1);

    // Let's go!
    task = await new Promise((resolve, reject) => {
        enigma.computeTask(taskFn, taskArgs, taskGasLimit, taskGasPx, account, contractAddr)
            .on(eeConstants.SEND_TASK_INPUT_RESULT, (result) => resolve(result))
            .on(eeConstants.ERROR, (error) => reject(error));
        });

    return task;
};

module.exports = {
    duelCommitTask: duelCommitTask
}