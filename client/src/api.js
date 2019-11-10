'use strict';

// Dependencies
//require('dotenv').config({path: __dirname + '/.env'}); // <- Won't work in a browser extension
const request = require('request-promise');
const { parse, stringify } = require('svgson');
const config = require('./config');
const traitsData = require('./json/wizardTraits.json');

// Environment

// Utility Functions
const apiQuery = async (endpoint = null, method = 'GET', scheme = 'https://', mainnet = true) => {
    let options;
    // Nothing to do here...    
    if (!endpoint) {
        return false;
    }

    // Request options
    if (endpoint.indexOf('opensea') > -1 || endpoint.indexOf('cheezeofinsight') > -1) {
        options = {
            method: method,
            uri: (endpoint.indexOf('cheezeofinsight') > -1) ? endpoint : scheme + endpoint,
            // Headers
            headers: {
                'Content-Type': 'application/json'
            }
        };
    } else {
        let apiUrl = (mainnet == true) ? scheme + config.apiMainnetBaseUrl + '/' + endpoint : scheme + config.apiRinkebyBaseUrl + '/' + endpoint;
        options = {
            method: method,
            uri: apiUrl,
            // Headers
            headers: {
                'Content-Type': 'application/json',
                'x-api-token': config.apiToken,
                'x-email': config.apiUser
            }
        };
    }

    // Debug request options
    //console.log('req. options', options);

    // Make request
    let response;
    await request(options)
        .then((data) => {
            response = data;
        })
        .catch((err) => {
            //console.log('Encountered error', err);
            response = err.response.body;
        });

    if (endpoint.indexOf('cheezeofinsight') > -1) {
        if (response) {
            await parse(response).then(async (data) => {
                response = await JSON.stringify(data);
            });
        } else {
            response = null;
            return response;
        }
    }
    
    // Handle response
    response = JSON.parse(response);
    return response;
};


/**
 * Endpoint handler for CW GraphQL API
 */
const cwApiQuery = async (payload) => {
    if (!config.apiCheezeWizardsUrl) {
        return false;
    }

    let options = {
        method: 'POST',
        uri: config.apiCheezeWizardsUrl,
        headers: {
            'Content-Type': 'application/json'
        },
        body: payload,
        // Automatically stringifies the body to JSON
        json: true
    };

    let response;
    await request(options)
        .then((data) => {
            response = data;
        })
        .catch((err) => {
            //console.log('Encountered error', err);
            response = err.response.body;
        });

    return response;
};


/**
 * API Parsers & Getters
 * 
 * XXX TODO: Make this an exportable module? (atm it can still be require()'d)
 */

/**
 * Loads all Wizards from CW API (Mainnet)
 */
const getAllWizards = async (mainnet = true) => {
    let wizardsEndpoint = 'wizards',
        wizards;

    // Choose collection type (Mainnet / Rinkeby)
    if (mainnet) {
        wizards = await apiQuery(wizardsEndpoint);
    } else {
        wizards = await apiQuery(wizardsEndpoint, 'GET', 'https://', false);
    }

    // Return Wizards data
    return wizards;
};

/**
 * Gets a particular Wizard by its Wizard ID (Mainnet)
 * @param {Number} id : The ID of the target Wizard
 * @return {Object} : Returns a Wizard object, or returns an Error object if no Wizard with that ID exists
 */
const getWizardById = async (id = null, mainnet = true) => {
    // Nothing to do here...
    if (!id) {
        return false
    }

    let wizardsEndpoint = 'wizards/' + id,
        wizards;

    // Choose collection type (Mainnet / Rinkeby)
    if (mainnet) {
        wizards = await apiQuery(wizardsEndpoint);
    } else {
        wizards = await apiQuery(wizardsEndpoint, 'GET', 'https://', false);
    }

    return wizards;
};

/**
 * Gets a link to a particular Wizard's image (Mainnet only)
 * @param {Number} id : The ID of the target Wizard you are requesting an image link for
 * @param {Boolean} proxy `{default: false}` : If parsing SVG can set this parameter to `true` to get a proxied instance that side steps CORS problems
 * @return {String} image : Returns the string image URL of the wizard
 */
const getWizardImageUrlById = (id = null, proxy = false) => {
    /**
     * Determines if the image is storage endpoint will be the original contract or the more recently released one
     * @param {Number} id : The ID of the wizard to build an image endpoint for
     */
    function isContractTwo (id) {
        if (id > 100 && id < 214) {
            return true;
        } else if (id > 255 && id < 363) {
            return true;
        } else if (id > 1013 && id < 1224) {
            return true;
        } else {
            return false;
        }
    };

    let imageUrl,
        isWizardsContractTwo,
        contract;
    // Nothing to do here...
    if (!id) {
        return false;
    } else if (typeof id !== "number") {
        id = parseInt(id);
    }

    isWizardsContractTwo = isContractTwo(id);

    // Set image path
    if (proxy) {
        if (id > 5974 && id < 6134) {
            contract = config.mainnetImageContracts[2];
        } else if (id > 6134) {
            contract = config.mainnetImageContracts[3];
        } else {
            contract = (isWizardsContractTwo) ? config.mainnetImageContracts[1] : config.mainnetImageContracts[0];
        }
        imageUrl = config.proxyImageStorageUrl + '?id=' + id + '&contract=' + contract;
    } else {
        if (id > 5974 && id < 6134) {
            imageUrl = config.imageStorageUrlThree + id + '.svg';
        } else if (id > 6134) {
            imageUrl = config.imageStorageUrlFour + id + '.svg';
        } else {
            imageUrl = (isWizardsContractTwo) ? config.imageStorageUrlTwo + id + '.svg' : config.imageStorageUrl + id + '.svg';
        }
    }
    return imageUrl;
};

/**
 * Gets all traits from OpenSea API for a given Wizard ID (Mainnet)
 * @param {Number} id : The ID of the target Wizard
 * @return {Object} : Returns a Wizard traits object, or returns an OpenSea Error object / False if collection data does not exist
 */
const getWizardTraitsById = async (id = null) => {
    let traits = {};
    traits.rarities = [];
    // Nothing to do here...
    if (!id) {
        return false;
    }

    // Fetch data
    let wizardSvgUrl = getWizardImageUrlById(id, true);
    let wizardSvg = await apiQuery(wizardSvgUrl);

    if (!traitsData.collection || !wizardSvg) {
        return false;
    } else if (!traitsData.collection.traits) {
        return false;
    } else {
        wizardSvg = wizardSvg.children;

        let traitsCollection = traitsData.collection.traits;
        //console.log(traitsCollection);

        for (let trait in traitsCollection) {
            //console.log('trait key =>', trait);
            
            // Affinity rarity stats (all affiinities)
            if (trait == 'affinity_type') {
                traits.affinityStats = traitsCollection[trait];
            }
            // Backneck (All Wizards have this)
            if (trait == 'backneck') {
                traits.rarities.push({ backneck: "Iridescence", rarity: false });
            }
            // Boots (All Wizards have this)
            if (trait == 'boots') {
                traits.rarities.push({ boots: "Booties", rarity: false });
            }
            // Cape
            if (trait == 'cape') {
                /*
                "cape":{  
                    "cape01":0,
                    "cape01_sorctier1":0,
                    "[cape 01 tier 1]":1, -> 1
                    "cape02_eviltier7":0,
                    "[cape 02 tier 7]":13, -> 225
                    "cape03_eviltier7":0,
                    "[cape 03 tier 7]":14, -> 223
                    "cape04_eviltier7":0,
                    "[cape 04 tier 7]":13, -> 226 <- this is the same cape as: [cape 03 tier 7]
                    "Doctor Hoo":2584, -> 3505
                    "Doctor Juggles":734, -> 1654
                    "Doctor Weird":778, -> 1316
                    "Spellraiser":786 -> 1614
                },
                */
                
                // DEBUG:
                //console.log('Cape =>', traitsCollection[trait]);
                //console.log(wizardSvg);

                for (let i = 0; i < wizardSvg.length; i++) {
                    let svgElement = wizardSvg[i];
                    let capeFound = false;
                    if (svgElement.attributes) {
                        if (svgElement.attributes.hasOwnProperty('id')) {
                            if (svgElement.attributes.id == 'cape') {
                                let capeChildren = svgElement.children;
                                if (!capeChildren) {
                                    break;
                                }

                                // Debug:
                                //console.log('capeChildren =>', capeChildren);
                                
                                for (let j = 0; j < capeChildren.length; j++) {
                                    let capeElement = capeChildren[j].children;
                                    //console.log(capeElement);
                                    if (capeElement) {
                                        if (capeElement.length) {
                                            for (let k = 0; k < capeElement.length; k++) {
                                                let capeDepth = capeElement[k];
                                                //console.log(capeDepth);
                                                // Now get cape :x
                                                if (capeDepth.hasOwnProperty('value')) {
                                                    if (capeDepth.value.indexOf('cape') > -1) {
                                                        let capeType = capeDepth.value;
                                                        capeFound = true;
                                                        switch(capeType) {
                                                            // "Doctor Hoo"
                                                            case 'cape01':
                                                                traits.rarities.push({cape: "Doctor Hoo", rarity: traitsCollection[trait]['Doctor Hoo']});
                                                                break;
                                                            // "Doctor Weird"
                                                            case 'cape02':
                                                                traits.rarities.push({cape: "Doctor Weird", rarity: traitsCollection[trait]['Doctor Weird']});
                                                                break;
                                                            // "Doctor Juggles"
                                                            case 'cape03':
                                                                traits.rarities.push({cape: "Doctor Juggles", rarity: traitsCollection[trait]['Doctor Juggles']});
                                                                break;
                                                            // "Spellraiser"
                                                            case 'cape04':
                                                                traits.rarities.push({cape: "Spellraiser", rarity: traitsCollection[trait]['Spellraiser']});
                                                                break;
                                                            case 'cape02_eviltier7':
                                                                traits.rarities.push({cape: "Molding Thaumaturge", rarity: traitsCollection[trait]['[cape 02 tier 7]'], extraRare: "Mold Wizard"});
                                                                break;
                                                            case 'cape04_eviltier7':
                                                                traits.rarities.push({cape: "Moldy Undetaker", rarity: (traitsCollection[trait]['[cape 04 tier 7]'] + traitsCollection[trait]['[cape 03 tier 7]']), extraRare: "Mold Wizard"});
                                                                break;
                                                            // "Big Cheese" / "[cape 01 tier 1]"
                                                            case 'cape01_sorctier1':
                                                                traits.rarities.push({cape: "Tier 1 Sorceror", rarity: traitsCollection[trait]['[cape 01 tier 1]'], extraRare: "Big Cheese"});
                                                                break;
                                                            //default:
                                                                //console.log('Unknown cape =>', capeType);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if (capeFound)
                                        break;
                                }
                            }
                        }

                    }
                    if (capeFound)
                        break;
                }
            }
            // Expression
            if (trait == 'expression') {
                /*
                "expression":{  
                    "Big Cheeze":1, -> 1
                    "Bummed":11, -> 7
                    "Cheezestruck":644, -> 1255
                    "Chillax":655, -> 3505
                    "Chuckle":91, -> 1684
                    "Cock-a-hoop":7, -> 25
                    "Concentrate":91, -> 1280
                    "Dastardly":76, -> 1316
                    "Dazes Ringwise":0,
                    "Drool":105, -> 1252
                    "Evil":66, -> 1614
                    "Fearless":92, -> 1244
                    "Ferocious":13, -> 8
                    "FOMO":77, -> 1602
                    "FUD":93, -> 1257
                    "Golly":102, -> 1242
                    "head01exp01":0,
                    "[head 08 exp t1 01]":2, -> 243
                    "head08exp_t1_01":0,
                    "[head 08 exp t1 02]":1, -> 229
                    "head08exp_t1_02":0,
                    "[head 08 exp t1 03]":2, -> 240
                    "head08exp_t1_03":0,
                    "[head 08 exp t1 04]":6, -> 220
                    "head08exp_t1_04":0,
                    "Highroller":98, -> 1258
                    "Irked":9, -> 22
                    "Kiss":93, -> 1274
                    "Komrade Cain":69, -> 1261
                    "Lost and Afraid":89, -> 1654
                    "Manga":93, -> 1248
                    "Not impressed":90, -> 1249
                    "Otaku":76, -> 1251
                    "Rage":88, -> 1247
                    "Reed Spacer":105, -> 1349
                    "Resolute":14, -> 5
                    "Say What?":655, -> 1254
                    "Scowl":5, -> 35
                    "Sheepish":82, -> 1243
                    "Sly":10, -> 4
                    "Smiley":81, -> 1250
                    "Smirk":87, -> 1263
                    "Stubborn":95, -> 1270
                    "Teethgrind":101, -> 1442
                    "Unhappy":101, -> 1253
                    "Whistler":8, -> 2
                    "Wily":11, -> 3
                    "YAY!":616 -> 1259
                },*/

                if (id == 1) {
                    traits.rarities.push({ expression: "Big Cheeze", rarity: 1, extraRare: "Big Cheeze" });
                } else {
                    for (let i = 0; i < wizardSvg.length; i++) {
                        let svgElement = wizardSvg[i];
                        let expressionFound = false;
                        if (svgElement.attributes) {
                            if (svgElement.attributes.hasOwnProperty('id')) {
                                if (svgElement.attributes.id == 'expression') {
                                    let expChildren = svgElement.children;
                                    if (!expChildren) {
                                        break;
                                    }
                                    //console.log('expChildren', expChildren);
                                    for (let j = 0; j < expChildren.length; j++) {
                                        let expChildElement = expChildren[j];
                                        if (expChildElement.hasOwnProperty('name')) {
                                            if (expChildElement.name == 'title') {
                                                let expTitleChildren = expChildElement.children;
                                                if (!expTitleChildren) {
                                                    break;
                                                }
                                                for (let k = 0; k < expTitleChildren.length; k++) {
                                                    let titleElement = expTitleChildren[k];
                                                    if (titleElement) {
                                                        expressionFound = true;
                                                        let foundExp = (titleElement.hasOwnProperty('value')) ? titleElement.value : false;
                                                        if (!foundExp) {
                                                            break;
                                                        }
                                                        switch (foundExp) {
                                                            // "Cheezestruck"
                                                            case 'head01exp01':
                                                                traits.rarities.push({expression: "Cheezestruck", rarity: traitsCollection[trait]['Cheezestruck']});
                                                                break;
                                                            // "YAY!"
                                                            case 'head01exp02':
                                                                traits.rarities.push({expression: "YAY!", rarity: traitsCollection[trait]['YAY!']});
                                                                break;
                                                            // "Say What?"
                                                            case 'head01exp03':
                                                                traits.rarities.push({expression: "Say What?", rarity: traitsCollection[trait]['Say What?']});
                                                                break;
                                                            // "Chillax"
                                                            case 'head01exp04':
                                                                traits.rarities.push({expression: "Chillax", rarity: traitsCollection[trait]['Chillax']});
                                                                break;
                                                            // "Otaku"
                                                            case 'head02exp01':
                                                                traits.rarities.push({expression: "Otaku", rarity: traitsCollection[trait]['Otaku']});
                                                                break;
                                                            // "Kiss"
                                                            case 'head02exp02':
                                                                traits.rarities.push({expression: "Kiss", rarity: traitsCollection[trait]['Kiss']});
                                                                break;
                                                            // "Manga"
                                                            case 'head02exp03':
                                                                traits.rarities.push({expression: "Manga", rarity: traitsCollection[trait]['Manga']});
                                                                break;
                                                            // "Smiley"
                                                            case 'head02exp04':
                                                                traits.rarities.push({expression: "Smiley", rarity: traitsCollection[trait]['Smiley']});
                                                                break;
                                                            // "Fearless"
                                                            case 'head02exp05':
                                                                traits.rarities.push({expression: "Fearless", rarity: traitsCollection[trait]['Fearless']});
                                                                break;
                                                            // "Concentrate"
                                                            case 'head02exp06':
                                                                traits.rarities.push({expression: "Concentrate", rarity: traitsCollection[trait]['Concentrate']});
                                                                break;
                                                            // "Drool"
                                                            case 'head02exp07':
                                                                traits.rarities.push({expression: "Drool", rarity: traitsCollection[trait]['Drool']});
                                                                break;
                                                            // "Unhappy"
                                                            case 'head02exp08':
                                                                traits.rarities.push({expression: "Unhappy", rarity: traitsCollection[trait]['Unhappy']});
                                                                break;
                                                            // "Smirk"
                                                            case 'head03exp01':
                                                                traits.rarities.push({expression: "Smirk", rarity: traitsCollection[trait]['Smirk']});
                                                                break;
                                                            // "Rage"
                                                            case 'head03exp02':
                                                                traits.rarities.push({expression: "Rage", rarity: traitsCollection[trait]['Rage']});
                                                                break;
                                                            // "Stubborn"
                                                            case 'head03exp03':
                                                                traits.rarities.push({expression: "Stubborn", rarity: traitsCollection[trait]['Stubborn']});
                                                                break;
                                                            // "Dastardly"
                                                            case 'head03exp04':
                                                                traits.rarities.push({expression: "Dastardly", rarity: traitsCollection[trait]['Dastardly']});
                                                                break;
                                                            // "Lost and Afraid"
                                                            case 'head03exp05':
                                                                traits.rarities.push({expression: "Lost and Afraid", rarity: traitsCollection[trait]['Lost and Afraid']});
                                                                break;
                                                            // "Sheepish"
                                                            case 'head03exp06':
                                                                traits.rarities.push({expression: "Sheepish", rarity: traitsCollection[trait]['Sheepish']});
                                                                break;
                                                            // "Not impressed"
                                                            case 'head03exp07':
                                                                traits.rarities.push({expression: "Not impressed", rarity: traitsCollection[trait]['Not impressed']});
                                                                break;
                                                            // "Evil"
                                                            case 'head03exp08':
                                                                traits.rarities.push({expression: "Evil", rarity: traitsCollection[trait]['Evil']});
                                                                break;
                                                            // "Golly"
                                                            case 'head04exp01':
                                                                traits.rarities.push({expression: "Golly", rarity: traitsCollection[trait]['Golly']});
                                                                break;
                                                            // "FUD"
                                                            case 'head04exp02':
                                                                traits.rarities.push({expression: "FUD", rarity: traitsCollection[trait]['FUD']});
                                                                break;
                                                            // "Reed Spacer"
                                                            case 'head04exp03':
                                                                traits.rarities.push({expression: "Reed Spacer", rarity: traitsCollection[trait]['Reed Spacer']});
                                                                break;
                                                            // "Komrade Cain"
                                                            case 'head04exp04':
                                                                traits.rarities.push({expression: "Komrade Cain", rarity: traitsCollection[trait]['Komrade Cain']});
                                                                break;
                                                            // "Teethgrind"
                                                            case 'head04exp05':
                                                                traits.rarities.push({expression: "Teethgrind", rarity: traitsCollection[trait]['Teethgrind']});
                                                                break;
                                                            // "Chuckle"
                                                            case 'head04exp06':
                                                                traits.rarities.push({expression: "Chuckle", rarity: traitsCollection[trait]['Chuckle']});
                                                                break;
                                                            // "Highroller"
                                                            case 'head04exp07':
                                                                traits.rarities.push({expression: "Highroller", rarity: traitsCollection[trait]['Highroller']});
                                                                break;
                                                            // "FOMO"
                                                            case 'head04exp08':
                                                                traits.rarities.push({expression: "FOMO", rarity: traitsCollection[trait]['FOMO']});
                                                                break;
                                                            // "Resolute"
                                                            case 'head05exp01':
                                                                traits.rarities.push({expression: "Resolute", rarity: traitsCollection[trait]['Resolute']});
                                                                break;
                                                            // "Ferocious"
                                                            case 'head05exp02':
                                                                traits.rarities.push({expression: "Ferocious", rarity: traitsCollection[trait]['Ferocious']});
                                                                break;
                                                            // "Scowl"
                                                            case 'head05exp03':
                                                                traits.rarities.push({expression: "Scowl", rarity: traitsCollection[trait]['Scowl']});
                                                                break;
                                                            // "Sly"
                                                            case 'head05exp04':
                                                                traits.rarities.push({expression: "Sly", rarity: traitsCollection[trait]['Sly']});
                                                                break;
                                                            // "Bummed"
                                                            case 'head05exp05':
                                                                traits.rarities.push({expression: "Bummed", rarity: traitsCollection[trait]['Bummed']});
                                                                break;
                                                            // "Cock-a-hoop"
                                                            case 'head05exp06':
                                                                traits.rarities.push({expression: "Cock-a-hoop", rarity: traitsCollection[trait]['Cock-a-hoop']});
                                                                break;
                                                            // "Whistler"
                                                            case 'head05exp07':
                                                                traits.rarities.push({expression: "Whistler", rarity: traitsCollection[trait]['Whistler']});
                                                                break;
                                                            // "Wily"
                                                            case 'head05exp08':
                                                                traits.rarities.push({expression: "Wily", rarity: traitsCollection[trait]['Wily']});
                                                                break;
                                                            // "Irked"
                                                            case 'head05exp09':
                                                                traits.rarities.push({expression: "Irked", rarity: traitsCollection[trait]['Irked']});
                                                                break;

                                                            /**
                                                             * Extra rare Wizards ^_^
                                                             */
                                                            // "Unpleasantly Surprised" / "[head 08 exp t1 01]"
                                                            case 'head08exp_t1_01':
                                                                traits.rarities.push({expression: "Unleasantly Surprised", rarity: traitsCollection[trait]['[head 08 exp t1 01]'], extraRare: "Mold Wizard"});
                                                                break;
                                                            // "Pleasantly Surprised" / "[head 08 exp t1 02]"
                                                            case 'head08exp_t1_02':
                                                                traits.rarities.push({expression: "Pleasantly Surprised", rarity: traitsCollection[trait]['[head 08 exp t1 02]'], extraRare: "Mold Wizard"});
                                                                break;
                                                            // "Villainous" / "[head 08 exp t1 03]"
                                                            case 'head08exp_t1_03':
                                                                traits.rarities.push({expression: "Villainous", rarity: traitsCollection[trait]['[head 08 exp t1 03]'], extraRare: "Mold Wizard"});
                                                                break;
                                                            // "Blissful" / "[head 08 exp t1 04]"
                                                            case 'head08exp_t1_04':
                                                                traits.rarities.push({expression: "Blissful", rarity: traitsCollection[trait]['[head 08 exp t1 04]'], extraRare: "Mold Wizard"});
                                                                break;
                                                            //default:
                                                                //console.log('Unknown expression =>', foundExp);
                                                        }
                                                    } else {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (expressionFound)
                            break;
                    }
                }
            }
            // Face
            if (trait == 'face') {
                /*
                "face":{  
                    "Appenzeller":88, -> 45
                    "Baby":661, -> 1614
                    "Emmentaler":723, -> 1260
                    "head07":0,
                    "head09":0,
                    "[head 09]":9, -> 215
                    "head10":0,
                    "[head 10]":12, -> 214
                    "head11":0,
                    "[head 11]":9, -> 246
                    "head16":0,
                    "[head 16]":1, -> 1
                    "Pawface":71, -> 5974
                    "Raclette":0, 
                    "Tilsiter":727 -> 1257
                },
                */
                for (let i = 0; i < wizardSvg.length; i++) {
                    let svgElement = wizardSvg[i];
                    let faceFound = false;
                    if (svgElement.attributes) {
                        if (svgElement.attributes.hasOwnProperty('id')) {
                            if (svgElement.attributes.id == 'face') {
                                let faceChildren = svgElement.children;
                                if (!faceChildren) {
                                    break;
                                }
                                ///console.log('faceChildren', faceChildren);
                                for (let j = 0; j < faceChildren.length; j++) {
                                    let faceChildElement = faceChildren[j];
                                    //console.log('faceChildElement =>', faceChildElement);
                                    if (faceChildElement.hasOwnProperty('name')) {
                                        if (faceChildElement.name == 'title') {
                                            let faceTitleChildren = faceChildElement.children;
                                            if (!faceTitleChildren) {
                                                break;
                                            }
                                            for (let k = 0; k < faceTitleChildren.length; k++) {
                                                let titleElement = faceTitleChildren[k];
                                                if (titleElement) {
                                                    faceFound = true;
                                                    let foundFace = (titleElement.hasOwnProperty('value')) ? titleElement.value : false;
                                                    if (!foundFace) {
                                                        break;
                                                    }
                                                    switch (foundFace) {
                                                        // "Emmentaler"
                                                        case 'head02':
                                                            traits.rarities.push({head: "Emmentaler", rarity: traitsCollection[trait]['Emmentaler']});
                                                            break;
                                                        // "Baby"
                                                        case 'head03':
                                                            traits.rarities.push({head: "Baby", rarity: traitsCollection[trait]['Baby']});
                                                            break;
                                                        // "Appenzeller"
                                                        case 'head05':
                                                            traits.rarities.push({head: "Appenzeller", rarity: traitsCollection[trait]['Appenzeller']});
                                                            break;
                                                        // "Pawface" / head07
                                                        case 'head07':
                                                            traits.rarities.push({head: "Pawface", rarity: traitsCollection[trait]['Pawface']});
                                                            break;

                                                        /**
                                                         * Extra Rare Wizards ^_^
                                                         */

                                                        // "Blue Emmentaler" / "[head 09]"
                                                        case 'head09':
                                                            traits.rarities.push({head: "Blue Emmentaler", rarity: traitsCollection[trait]['[head 09]'], extraRare: 'Mold Wizard'});
                                                            break;
                                                        // "Blue Baby" / "[head 10]"
                                                        case 'head10':
                                                            traits.rarities.push({head: "Blue Baby", rarity: traitsCollection[trait]['[head 10]'], extraRare: 'Mold Wizard'});
                                                            break;
                                                        // "Blue Tilsiter" / "[head 11]"
                                                        case 'head11':
                                                            traits.rarities.push({head: "Blue Tilsiter", rarity: traitsCollection[trait]['[head 11]'], extraRare: 'Mold Wizard'});
                                                            break;
                                                        // "Big Cheeez" / "[head 16]"
                                                        case 'head16':
                                                            traits.rarities.push({head: "Cheeze Gummy", rarity: traitsCollection[trait]['[head 11]'], extraRare: 'Big Cheeze'});
                                                            break;
                                                        //default:
                                                            //console.log('Unknown face =>', foundFace);
                                                    }
                                                } else {
                                                    break;
                                                }
                                                if (faceFound)
                                                    break;
                                            }
                                        }
                                    }
                                    if (faceFound)
                                        break;
                                }
                            }
                        }
                    }
                }
            }
            // Hat
            if (trait == 'hat') {
                /*
                "hat":{  
                    "Arcane Hat":40, -> 5
                    "Bard's Hat":4, -> 100
                    "Belty Hat":9, -> 1822
                    "Bent Hat":579, -> 1601
                    "Cheezey Hat":578, -> 1614
                    "Decent Hat":373, -> 10
                    "Dunce Hat":0,
                    "Fancy Hat":382, -> 1603
                    "hat10":0,
                    "hat17":0,
                    "hat18":0,
                    "hat26":0,
                    "[hat 26]":1, -> 1
                    "Jester's Hat":116, -> 4
                    "Mages Hat":17, -> 2
                    "[mold mag hat 18]":41, -> 233
                    "Mystical Hat":54, -> 1405
                    "Nice Hat":100, -> 2493
                    "Old Pointy":728, -> 1600
                    "Silly Hat":518, -> 1604
                    "Sleepy Hat":489, -> 19
                    "The Hat's Meow":351, -> 1606
                    "Witch's Hat":159, -> 12
                    "Worn Hat":343 -> 1607
                },
                */
                for (let i = 0; i < wizardSvg.length; i++) {
                    let svgElement = wizardSvg[i];
                    let hatFound = false;
                    if (svgElement.attributes) {
                        if (svgElement.attributes.hasOwnProperty('id')) {
                            if (svgElement.attributes.id == 'hat') {
                                let hatChildren = svgElement.children;
                                if (!hatChildren) {
                                    break;
                                }
                                ///console.log('hatChildren', hatChildren);
                                for (let j = 0; j < hatChildren.length; j++) {
                                    let hatChildElement = hatChildren[j];
                                    //console.log('hatChildElement =>', hatChildElement);
                                    if (hatChildElement.hasOwnProperty('name')) {
                                        if (hatChildElement.name == 'title') {
                                            let hatTitleChildren = hatChildElement.children;
                                            if (!hatTitleChildren) {
                                                break;
                                            }
                                            for (let k = 0; k < hatTitleChildren.length; k++) {
                                                let titleElement = hatTitleChildren[k];
                                                if (titleElement) {
                                                    hatFound = true;
                                                    let foundHat = (titleElement.hasOwnProperty('value')) ? titleElement.value : false;
                                                    if (!foundHat) {
                                                        break;
                                                    }
                                                    switch (foundHat) {
                                                        // "Old Pointy"
                                                        case 'hat01':
                                                            traits.rarities.push({hat: "Old Pointy", rarity: traitsCollection[trait]['Old Pointy']});
                                                            break;
                                                        // "Witch's Hat"
                                                        case 'hat02':
                                                            traits.rarities.push({hat: "Witch's Hat", rarity: traitsCollection[trait]["Witch's Hat"]});
                                                            break;
                                                        // "Worn Hat"
                                                        case 'hat03':
                                                            traits.rarities.push({hat: "Worn Hat", rarity: traitsCollection[trait]['Worn Hat']});
                                                            break;
                                                        // "Belty Hat"
                                                        case 'hat04':
                                                            traits.rarities.push({hat: "Belty Hat", rarity: traitsCollection[trait]['Belty Hat']});
                                                            break;
                                                        // "Silly Hat"
                                                        case 'hat05':
                                                            traits.rarities.push({hat: "Silly Hat", rarity: traitsCollection[trait]['Silly Hat']});
                                                            break;
                                                        // "Cheezey Hat"
                                                        case 'hat06':
                                                            traits.rarities.push({hat: "Cheezey Hat", rarity: traitsCollection[trait]['Cheezey Hat']});
                                                            break;
                                                        // "Bard's Hat"
                                                        case 'hat07':
                                                            traits.rarities.push({hat: "Bard's Hat", rarity: traitsCollection[trait]["Bard's Hat"]});
                                                            break;
                                                        // "Arcane Hat"
                                                        case 'hat08':
                                                            traits.rarities.push({hat: "Arcane Hat", rarity: traitsCollection[trait]['Arcane Hat']});
                                                            break;
                                                        // "Jester's Hat"
                                                        case 'hat09':
                                                            traits.rarities.push({hat: "Jester's Hat", rarity: traitsCollection[trait]["Jester's Hat"]});
                                                            break;
                                                        // "Decent Hat"
                                                        case 'hat10':
                                                            traits.rarities.push({hat: "Decent Hat", rarity: traitsCollection[trait]['Decent Hat']});
                                                            break;
                                                        // "Fancy Hat"
                                                        case 'hat11':
                                                            traits.rarities.push({hat: "Fancy Hat", rarity: traitsCollection[trait]['Fancy Hat']});
                                                            break;
                                                        // "Mage's Hat"
                                                        case 'hat12':
                                                            traits.rarities.push({hat: "Mage's Hat", rarity: traitsCollection[trait]['Mages Hat']});
                                                            break;
                                                        // "Nice Hat"
                                                        case 'hat13':
                                                            traits.rarities.push({hat: "Nice Hat", rarity: traitsCollection[trait]['Nice Hat']});
                                                            break;
                                                        // "Sleepy Hat"
                                                        case 'hat14':
                                                            traits.rarities.push({hat: "Sleepy Hat", rarity: traitsCollection[trait]['Sleepy Hat']});
                                                            break;
                                                        // "Bent Hat"
                                                        case 'hat15':
                                                            traits.rarities.push({hat: "Bent Hat", rarity: traitsCollection[trait]['Bent Hat']});
                                                            break;
                                                        // "Mystical Hat"
                                                        case 'hat16':
                                                            traits.rarities.push({hat: "Mystical Hat", rarity: traitsCollection[trait]['Mystical Hat']});
                                                            break;
                                                        // "The Hat's Meow"
                                                        case 'hat17':
                                                            traits.rarities.push({hat: "The Hat's Meow", rarity: traitsCollection[trait]["The Hat's Meow"]});
                                                            break;

                                                        /**
                                                         * Extra Rare Wizards
                                                         */

                                                        // "Magical Companion Hat" / "[hat 26]"
                                                        case 'hat26':
                                                            traits.rarities.push({hat: "Magical Companion Hat", rarity: traitsCollection[trait]['[hat 26]'], extraRare: "Big Cheeze"});
                                                            break;
                                                        // "[mold mag hat 18]"
                                                        case 'hat18':
                                                            traits.rarities.push({hat: "Magic Mold Hat - Style 18", rarity: traitsCollection[trait]['[mold mag hat 18]'], extraRare: "Mold Wizard"});
                                                            break;
                                                        //default:
                                                            //console.log('Unknown hat =>', foundHat);
                                                    }
                                                } else {
                                                    break;
                                                }
                                                if (hatFound)
                                                    break;
                                            }
                                        }
                                    }
                                    if (hatFound)
                                        break;
                                }
                            }
                        }
                    }
                }
            }
            // Left hand: back
            if (trait == 'left-hand-back') {
                /*
                "left-hand-back":{  
                    "[left hand back]":126, -> 214 ("Evil Vice Grip")
                    "left-hand-back":11,
                    "Lhandback-01":0,
                    "Vice Grip":4745 -> 31
                },
                */
                for (let i = 0; i < wizardSvg.length; i++) {
                    let svgElement = wizardSvg[i];
                    let handFound = false;
                    if (svgElement.attributes) {
                        if (svgElement.attributes.hasOwnProperty('id')) {
                            if (svgElement.attributes.id == 'left-hand-back') {
                                let handChildren = svgElement.children;
                                if (!handChildren) {
                                    break;
                                }
                                ///console.log('handChildren', handChildren);
                                for (let j = 0; j < handChildren.length; j++) {
                                    let handChildElement = handChildren[j];
                                    //console.log('handChildElement =>', handChildElement);
                                    if (handChildElement.hasOwnProperty('name')) {
                                        if (handChildElement.name == 'title') {
                                            let handTitleChildren = handChildElement.children;
                                            if (!handTitleChildren) {
                                                break;
                                            }
                                            for (let k = 0; k < handTitleChildren.length; k++) {
                                                let titleElement = handTitleChildren[k];
                                                if (titleElement) {
                                                    handFound = true;
                                                    let foundHand = (titleElement.hasOwnProperty('value')) ? titleElement.value : false;
                                                    if (!foundHand) {
                                                        break;
                                                    }
                                                    switch (foundHand) {
                                                        // "[left hand back]"
                                                        case 'left-hand-back':
                                                            traits.rarities.push({leftHandBack: "Alternate Vice Grip", rarity: (traitsCollection[trait]['[left hand back]'] + traitsCollection[trait]['left-hand-back'])});
                                                            break;
                                                        // "Vice Grip"
                                                        case 'Lhandback-01':
                                                            traits.rarities.push({leftHandBack: "Vice Grip", rarity: traitsCollection[trait]['Vice Grip']});
                                                            break;
                                                        //default:
                                                            //console.log('Unknown hand =>', foundHand);
                                                    }
                                                } else {
                                                    break;
                                                }
                                                if (handFound)
                                                    break;
                                            }
                                        }
                                    }
                                    if (handFound)
                                        break;
                                }
                            }
                        }
                    }
                }
            }
            // Left hand: front (All Wizards have this)
            if (trait == 'left-hand-front') {
                traits.rarities.push({ leftHhandFront: "Vice Grip" });
            }
            // Legs
            if (trait == 'legs') {
                // XXX TODO
                /*
                "legs":{  
                    "Attention":4842, -> 1614
                    "legs01":0,
                    "legs02":0,
                    "[legs 02]":40 -> 214 ("Skinny Legs")
                },
                */
                for (let i = 0; i < wizardSvg.length; i++) {
                    let svgElement = wizardSvg[i];
                    let legsFound = false;
                    if (svgElement.attributes) {
                        if (svgElement.attributes.hasOwnProperty('id')) {
                            if (svgElement.attributes.id == 'legs') {
                                let legsChildren = svgElement.children;
                                if (!legsChildren) {
                                    break;
                                }
                                ///console.log('legsChildren', legsChildren);
                                for (let j = 0; j < legsChildren.length; j++) {
                                    let legsChildElement = legsChildren[j];
                                    //console.log('legsChildElement =>', legsChildElement);
                                    if (legsChildElement.hasOwnProperty('name')) {
                                        if (legsChildElement.name == 'title') {
                                            let legsTitleChildren = legsChildElement.children;
                                            if (!legsTitleChildren) {
                                                break;
                                            }
                                            for (let k = 0; k < legsTitleChildren.length; k++) {
                                                let titleElement = legsTitleChildren[k];
                                                if (titleElement) {
                                                    legsFound = true;
                                                    let foundLegs = (titleElement.hasOwnProperty('value')) ? titleElement.value : false;
                                                    if (!foundLegs) {
                                                        break;
                                                    }
                                                    switch (foundLegs) {
                                                        // "Attention"
                                                        case 'legs01':
                                                            traits.rarities.push({legs: "Attention", rarity: traitsCollection[trait]['Attention']});
                                                            break;
                                                        // "Skinny Legs" / [legs 02]
                                                        case 'legs02':
                                                            traits.rarities.push({legs: "Skinny Legs", rarity: traitsCollection[trait]['[legs 02]'], extraRare: "Mold Wizard"});
                                                            break;
                                                        //default:
                                                            //console.log('Unknown legs =>', foundLegs);
                                                    }
                                                } else {
                                                    break;
                                                }
                                                if (legsFound)
                                                    break;
                                            }
                                        }
                                    }
                                    if (legsFound)
                                        break;
                                }
                            }
                        }
                    }
                }
            }
            
            // Property (All Wizards with affinity !== "unset" or "neutral")
            if (trait == 'property') {
                traits.affinityStats.totalWizardsHavingAffinity = traitsCollection[trait].elemental;
            }
            // Right hand (All Wizards have this)
            if (trait == 'right-hand') {
                traits.rarities.push({ rightHandFront: "Arthur's Fist" });
            }
            // Wand
            if (trait == 'wand') {
                /*
                wand: {
                    "Curly Wand":1413,
                    "Druidic Wand":715, -> 1614
                    "Lhand01-wand03":0,
                    "Moo Stick":15, -> 100
                    "Orb wand":234, -> 1602
                    "Pointy Wand":2148, -> 1601
                    "Sauron wand":313, -> 5
                    "wand07":1, -> ??S
                    "wand08":0,
                    "[wand 08]":42, -> 233
                    "wand15":0,
                    "[wand 15]":1 -> 1
                }
                */
                for (let i = 0; i < wizardSvg.length; i++) {
                    let svgElement = wizardSvg[i];
                    let wandFound = false;
                    if (svgElement.attributes) {
                        if (svgElement.attributes.hasOwnProperty('id')) {
                            if (svgElement.attributes.id == 'wand') {
                                let wandChildren = svgElement.children;
                                if (!wandChildren) {
                                    break;
                                }
                                ///console.log('wandChildren', wandChildren);
                                for (let j = 0; j < wandChildren.length; j++) {
                                    let wandChildElement = wandChildren[j];
                                    //console.log('wandChildElement =>', wandChildElement);
                                    if (wandChildElement.hasOwnProperty('name')) {
                                        if (wandChildElement.name == 'title') {
                                            let wandTitleChildren = wandChildElement.children;
                                            if (!wandTitleChildren) {
                                                break;
                                            }
                                            for (let k = 0; k < wandTitleChildren.length; k++) {
                                                let titleElement = wandTitleChildren[k];
                                                if (titleElement) {
                                                    wandFound = true;
                                                    let foundWand = (titleElement.hasOwnProperty('value')) ? titleElement.value : false;
                                                    if (!foundWand) {
                                                        break;
                                                    }
                                                    switch (foundWand) {
                                                        // "Curly Wand"
                                                        case 'Lhand01-wand01':
                                                            traits.rarities.push({wand: "Curly Wand", rarity: traitsCollection[trait]['Curly Wand']});
                                                            break;
                                                        // "Moo Stick"
                                                        case 'Lhand01-wand02':
                                                            traits.rarities.push({wand: "Moo Stick", rarity: traitsCollection[trait]['Moo Stick']});
                                                            break;
                                                        // "Pointy Wand"
                                                        case 'Lhand01-wand03':
                                                            traits.rarities.push({wand: "Pointy Wand", rarity: traitsCollection[trait]['Pointy Wand']});
                                                            break;
                                                        // "Druidic Wand"
                                                        case 'Lhand01-wand04':
                                                            traits.rarities.push({wand: "Druidic Wand", rarity: traitsCollection[trait]['Druidic Wand']});
                                                            break;
                                                        // "Sauron wand"
                                                        case 'Lhand01-wand06':
                                                            traits.rarities.push({wand: "Sauron Wand", rarity: traitsCollection[trait]['Sauron wand']});
                                                            break;
                                                        // "Orb wand"
                                                        case 'wand05':
                                                            traits.rarities.push({wand: "Orb Wand", rarity: traitsCollection[trait]['Orb wand']});
                                                            break;

                                                        /**
                                                         * Extra Rare Wizards
                                                         */

                                                        // "Unholy Cheeze Fork"
                                                        case 'wand08':
                                                            traits.rarities.push({wand: "Unholy Cheeze Fork", rarity: traitsCollection[trait]['[wand 08]'], extraRare: "Mold Wizard"});
                                                            break;
                                                        // "Epic Scepter" / "[wand 15]"
                                                        case 'wand15':
                                                            traits.rarities.push({wand: "Epic Scepter", rarity: traitsCollection[trait]['[wand 15]'], extraRare: "Big Cheeze"});
                                                            break;

                                                        //default:
                                                            //console.log('Unknown wand =>', foundWand);
                                                    }
                                                } else {
                                                    break;
                                                }
                                                if (wandFound)
                                                    break;
                                            }
                                        }
                                    }
                                    if (wandFound)
                                        break;
                                }
                            }
                        }
                    }
                
                }
            }
        }
            
    }

    if (traitsData.collection.traits) {
        //console.log('traits =>', traitsData.collection.traits);
        //console.log(JSON.stringify(wizardSvg));
        // Parse traits
        return traits;
    } else {
        return false;
    }
}

/**
 * Loads all Duels from CW API (Mainnet)
 */
const getAllDuels = async (mainnet = true) => {
    let duelsEndpoint = 'duels',
        duels;

    // Choose collection type (Mainnet / Rinkeby)
    if (mainnet) {
        duels = await apiQuery(duelsEndpoint);
    } else {
        duels = await apiQuery(duelsEndpoint, 'GET', 'https://', false);
    }

    return duels;
};

/**
 * Gets a particular Duel by its Duel ID (Mainnet)
 * @param {Number} id : The ID of the target Duel
 * @return {Object} : Returns a Duel object, or returns an Error object if no duel with that ID exists
 */
const getDuelById = async (id = null, mainnet = true) => {
    // Nothing to do here...
    if (!id) {
        return false;
    }

    let duelsEndpoint = 'duels/' + id,
        duels;

    if (mainnet) {
        duels = await apiQuery(duelsEndpoint);
    } else {
        duels = await apiQuery(duelsEndpoint, 'GET', 'https://', false);
    }

    duels.id = id;
    return duels;
};

/**
 * Gets all Duels for a particular Wizard by Wizard ID (Mainnet)
 * @param {Number} id : The ID of the target Wizard to query for Duel data
 * @return {Object} : Returns a Duel object, or returns an Error object if no duel with that Wizard ID exists. Example:
 * 
 * {
 *   duels: [{duel 1}, {duel 2}],
 * }
 */
const getDuelsByWizardId = async (id = null, mainnet = true) => {
    // Nothing to do here...
    if (!id) {
        return false;
    } else {
        id = parseInt(id);
    }

    let duelsEndpoint = 'duels/?wizardIds=' + id + '&excludeInProgress=true',
        duels;

    if (mainnet) {
        duels = await apiQuery(duelsEndpoint);
    } else {
        duels = await apiQuery(duelsEndpoint, 'GET', 'https://', false);
    }

    /*
    affinity1: 3
    affinity2: 3
    endBlock: 8790074
    endPower1: "879183481938903"
    endPower2: "682714692572648"
    id: "0xf39bfb7f7b546d5abd45dd7d8d9295b58480f0974a68fc4585df5a952a090da2"
    isAscensionBattle: false
    
    moveResults: Array(5)
        0: {p1: 4, p2: 4, winner: "tie"}
        1: {p1: 4, p2: 4, winner: "tie"}
        2: {p1: 4, p2: 3, winner: "p1"}
        3: {p1: 4, p2: 3, winner: "p1"}
        4: {p1: 4, p2: 4, winner: "tie"}

    moveSet1: "0x0404040404000000000000000000000000000000000000000000000000000000"
    moveSet2: "0x0404030304000000000000000000000000000000000000000000000000000000"
    startBlock: 8790045
    startPower1: "356553613831567"
    startPower2: "1205344560679984"
    timedOut: false
    timeoutBlock: 8790448
    wizard1DidWin: true
    wizard1Gain: 522629868107336
    wizard1Id: "3683"
    wizard1SvgUrl: "https://storage.googleapis.com/cheeze-wizards-production/original/0xec2203e38116f09e21bc27443e063b623b01345a/3683.svg"
    wizard2DidWin: false
    wizard2Gain: -522629868107336
    wizard2Id: "5261"
    wizard2SvgUrl: "https://storage.googleapis.com/cheeze-wizards-production/original/0xec2203e38116f09e21bc27443e063b623b01345a/5261.svg"
    */

    // Ensure requested Wizard is assigned to `wizard1`
    // this keeps the the wizard on the left pane side
    // of duel history in our UI
    if (duels.hasOwnProperty('duels')) {
        if (duels.duels) {
            if (duels.duels.length) {
                for (let i = 0; i < duels.duels.length; i++) {
                    if (duels.duels[i].wizard2Id) {
                        if (id == parseInt(duels.duels[i].wizard2Id)) {
                            // References
                            let duel = duels.duels[i];
                            let affinity1 = duel.affinity1;
                            let affinity2 = duel.affinity2;
                            let endPower1 = duel.endPower1;
                            let endPower2 = duel.endPower2;
                            let moveSet1 = duel.moveSet1;
                            let moveSet2 = duel.moveSet2;
                            let startPower1 = duel.startPower1;
                            let startPower2 = duel.startPower2;
                            let wizard1Id = duel.wizard1Id;
                            let wizard2Id = duel.wizard2Id;

                            // Now flip the stats
                            duels.duels[i].affinity1 = affinity2;
                            duels.duels[i].affinity2 = affinity1;
                            duels.duels[i].endPower1 = endPower2;
                            duels.duels[i].endPower2 = endPower1;
                            duels.duels[i].moveSet1 = moveSet2;
                            duels.duels[i].moveSet2 = moveSet1;
                            duels.duels[i].startPower1 = startPower2;
                            duels.duels[i].startPower2 = startPower1;
                            duels.duels[i].wizard1Id = wizard2Id;
                            duels.duels[i].wizard2Id = wizard1Id;
                        }
                    }
                }
            }
        }
    }

    // duels.wizards = [id]; // TODO: why was this here?
    //console.log('duels =>', duels);
    return duels;
};

/**
 * Gets all Duels 2 Wizards by their Wizard IDs (Mainnet)
 * @param {Number} wizard_A : The ID of the target Wizard to query for Duel data
 * @param {Number} wizard_B : The ID of the second target Wizard to query for Duel data
 * @return {Object} : Returns a Duel object, or returns an Error object if no duel with that Wizard ID exists
 */
const getDuelsBetweenWizards = async (wizard_A = null, wizard_B = null, mainnet = true) => {
    // Nothing to do here...
    if (!wizard_A || !wizard_B) {
        return false;
    }

    let duelsEndpoint = 'duels/?wizardIds=' + wizard_A + ',' + wizard_B,
        duels;

    if (mainnet) {
        duels = await apiQuery(duelsEndpoint);
    } else {
        duels = await apiQuery(duelsEndpoint, 'GET', 'https://', false);
    }

    duels.wizards = [wizard_A, wizard_B];
    return duels;
};

/**
 * Gets info on the tournament
 */
const getTournamentInfo = async () => {
    let data;
    data = await cwApiQuery({
        "operationName": "CurrentTournamentQuery",
        "variables": {},
        "query": `query CurrentTournamentQuery {
            currentTournament {
                address
                tournamentWindow: window
                phase
                blueMoldPower: blueWallPower
                nextBlueMoldPower: nextBlueWallPower
                isPaused
                calendarWindows {
                    tournamentWindow
                    start
                    windowStartBlock
                }
                fightWindows {
                    start
                    durationMin
                    windowStartBlock
                    window
                }
            }
        }`
    });

    if (data.data && data.data.currentTournament) {
        return data.data.currentTournament;
    }
};

// Tests
let construct = async () => {
    /*// Load all of the summoned Wizards
    let allWizards = await getAllWizards();
    console.log('Wizards =>', allWizards);

    // Load a particular Wizard
    let wizard = 1614;
    let drewsWizard = await getWizardById(wizard);
    // Add the wizard's image url
    let drewsWizardImage = getWizardImageUrlById(wizard);
    drewsWizard.image = drewsWizardImage;
    console.log('Wizard =>', drewsWizard);

    // Load all duels
    let allDuels = await getAllDuels();
    console.log('Duels =>', allDuels);

    // Load a particular Duel by its ID
    let duel = 1;
    let hypotheticalDuel = await getDuelById(duel);
    console.log('Duel =>', hypotheticalDuel);

    // Load all Duels for a particular Wizard
    let drewsWizardDuels = await getDuelsByWizardId(wizard);
    console.log('Wizard #' + wizard + ' Duels =>', drewsWizardDuels);

    // Load Duel history of matches between 2 particular Wizards
    let wizard2 = 1;
    let duelsBetweenWizards = await getDuelsBetweenWizards(wizard, wizard2);
    console.log('Duels between Wizard #' + wizard + ' and Wizard #1' + ' =>', duelsBetweenWizards);
    */
    
    // Load Traits of a given Wizard by its ID
    //let wizard = 5974;
    //let traits = await getWizardTraitsById(wizard);
    //console.log('Traits =>', traits);
};

// Debug:
//construct();

module.exports = {
    getAllWizards: getAllWizards,
    getWizardById: getWizardById,
    getWizardImageUrlById: getWizardImageUrlById,
    getAllDuels: getAllDuels,
    getDuelById: getDuelById,
    getDuelsByWizardId: getDuelsByWizardId,
    getDuelsBetweenWizards: getDuelsBetweenWizards,
    getWizardTraitsById: getWizardTraitsById,
    getTournamentInfo: getTournamentInfo
}
