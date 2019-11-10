const EnigmaModel = require('enigma-js');
const Web3 = require('web3');

const getWeb3 = async () => {

  if (window.ethereum) {
    const provider = new Web3.providers.HttpProvider(
        "http://127.0.0.1:9545"
    );
    const web3 = new Web3(provider);
    return web3;
  }

  /*new Promise((resolve, reject) => {
    // Wait for loading completion to avoid race conditions with web3 injection timing.
    window.addEventListener("load", async () => {
      // Modern dapp browsers...
      if (window.ethereum) {
          const provider = new Web3.providers.HttpProvider(
              "http://127.0.0.1:9545"
          );
          const web3 = new Web3(provider);
          resolve(web3);
      }
      // Legacy dapp browsers...
      else if (window.web3) {
        // Use Mist/MetaMask's provider.
        const web3 = window.web3;
        console.log("Injected web3 detected.");
        resolve(web3);
      }
      // Fallback to localhost; use dev console port by default...
      else {
        const provider = new Web3.providers.HttpProvider(
          "http://127.0.0.1:9545"
        );
        const web3 = new Web3(provider);
        console.log("No web3 instance injected, using Local web3.");
        resolve(web3);
      }
    });
  });*/
}

const initEnigma = async () => {
    try {
        // Get network provider and web3 instance.
        const web3 = await getWeb3();

        console.log('web3 =>', web3);

        const EnigmaContract = require('../../../build/enigma_contracts/EnigmaSimulation.json');
        const EnigmaTokenContract = require('../../../build/enigma_contracts/EnigmaToken.json');

        console.log(EnigmaContract);
        
        const enigma = new EnigmaModel.Enigma(
            web3,
            EnigmaContract.networks['4447'].address,
            EnigmaTokenContract.networks['4447'].address,
            'http://localhost:3333', {
                gas: 4712388,
                gasPrice: 100000000000,
                from: (await web3.eth.getAccounts())[0],
            },
        );
        enigma.admin();
        enigma.setTaskKeyPair('cupcake');

        return enigma;
    } catch (error) {
        // Catch any errors for any of the above operations.
        console.log('Error initializing Enigma', error);
    }
};

module.exports = {
    initEnigma: initEnigma
}