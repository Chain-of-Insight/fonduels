const Web3 = require('web3');
const WEBSOCKET_WEB3_PROVIDER_MAINNET = "wss://mainnet.infura.io/ws/v3/a54117bd462643dab586eaa2fd426b6c";
const WEBSOCKET_WEB3_PROVIDER_RINKEBY = "wss://rinkeby.infura.io/ws/v3/a54117bd462643dab586eaa2fd426b6c";

const mainnetWizardsContract = '0x2f4bdafb22bd92aa7b7552d270376de8edccbc1e';

/**
 * Get a Mainnet instance of Web3 with websocket support
 * @return {Object} `websocketed web3 provider (mainnet)`
 */
const getWssWeb3Mainnet = async () => {
    const mainnetWebSocketWeb3 = new Web3(new Web3.providers.WebsocketProvider(WEBSOCKET_WEB3_PROVIDER_MAINNET));
    //console.log('Web3 (mainnet) =>', mainnetWebSocketWeb3);
    return mainnetWebSocketWeb3;
};

/**
 * Get a Rinkeby instance of Web3 with websocket support
 * @return {Object} `websocketed web3 provider (rinkeby)`
 */
const getWssWeb3Rinkeby = async () => {
    const rinkebyWebSocketWeb3 = new Web3(new Web3.providers.WebsocketProvider(WEBSOCKET_WEB3_PROVIDER_RINKEBY));
    //console.log('Web3 (rinkeby) =>', rinkebyWebSocketWeb3);
    return rinkebyWebSocketWeb3;
};

/**
 * Bootstraps in instance of ERC721 using the address of the Mainnet Wizards contract
 * E.g. allows for querying users wallet to check for Cheeze Wizards
 * @param {Object} `provider` : An instance of the mainnet provider as returned by `getWssWeb3Mainnet`
 */
const mainnetWizardsInstance = async () => {
    const provider = await getWssWeb3Mainnet();
    const erc721Abi = require('./contracts/wizards.presale.mainnet.json');
    //console.log('erc721Abi =>', erc721Abi);
    let abiInstance = new provider.eth.Contract(erc721Abi, mainnetWizardsContract);
    return abiInstance;
};

// Exports
module.exports = {
    mainnetWizardsContract: mainnetWizardsContract,
    getWssWeb3Mainnet: getWssWeb3Mainnet,
    getWssWeb3Rinkeby: getWssWeb3Rinkeby,
    mainnetWizardsInstance: mainnetWizardsInstance
};