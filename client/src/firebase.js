'use strict';

const config = require('./config');
const firebaseConfig = config.firebaseConfig;

// Initialize Firebase
const firebaseApp = firebase.initializeApp(firebaseConfig);
const firebaseDb = firebaseApp.database();

/**
 * Asynchronous Firebase Login (XXX: Twitter only)
 * @return {Boolean} : Returns `true` or `false` based login success
 */
const login = async function () {
    // Log the user in via Twitter
    let provider = new firebase.auth.TwitterAuthProvider();
    let response = null;

    // Online persistence
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function(error) {
        //console.log('Error authenticating user =>', error);
        response = false;
    });

    // Create login
    await firebase.auth().signInWithPopup(provider).catch(function(error) {
        //console.log('Error authenticating user =>', error);
        response = false;
    });

    // Response
    if (response !== false) {
        response = true;
    }
    
    return response;
};

/**
 * Logout from Firebase Twitter auth
 */
const logout = async function () {
    try {
        await firebase.auth().signOut();
    } catch (e) {
        //console.log('Error logging out user =>', e);
    } 
};

/**
 * Get current user and auth state (used to check if already logged in
 * when changing router states or refreshing the page)
 * @return {Mixed} : Returns a User `Object` when logged in or `Boolean` false if not logged in
 */
const getCurrentUser = async function () {
    let currentUser = await firebase.auth().currentUser;
    return currentUser;
};

/**
 * Listens for changes to applicatin Auth State and returns the Firebase User Object of the requesting User
 */
const listenForChatUser = async function () {
    let chatUser;
    // Auth changed listener
    await firebase.auth().onAuthStateChanged(async (user) => {
        // Once authenticated, instantiate Firechat with the logged in user
        if (user) {
            chatUser = user;
            //console.log('Auth state changed =>', chatUser);
        } else {
            chatUser = false;
        }
    });
    return chatUser;
};

/**
 * Initializes a Firechat session and joins the current user
 * @param {Object} user : An `Observable` Firebase User object returned by `listenForChatUser`
 * @param {Object} wizards : An `Array` of Wizards to be set on the requesting chat user
 * @see this.listenForChatUser
 */
const getChat = async function (user, wizards = [], wallet = null) {
    // Get a Firebase Database ref
    let chatRef = firebase.database().ref('firechat-general');

    // Create a Firechat instance
    let chat = new Firechat(chatRef);

    // Set the Firechat user
    let userRef;
    chat.setUser(user.uid, user.displayName, async (user) => {
        //console.log('New chat User =>', user);
        chat.userData = user;
        chat.userData.wizards = wizards;
        
        // Probably don't need this:
        //chat.resumeSession();

        // Update Firebase with wallet address
        let userName = user.name.toLowerCase();
        let userRef = firebaseDb.ref('firechat-general/user-names-online/' + userName);
        
        if (!wallet || !wizards) {
            return;
        }

        await userRef.update({
            wallet: wallet,
            wizards: wizards,
            id: user.id,
            isOnline: true
        });

        let onlineRef = firebaseDb.ref('firechat-general/user-names-online/' + userName + "/isOnline");
        onlineRef.onDisconnect().set(false);
        //onlineRef.onDisconnect().cancel()*/
    });

    // Listeners for chat events
    /*chat.on('room-invite', (invite) => {
        console.log('invite', invite);
    });
    chat.on('room-invite-response', (inviteResponse) => {
        console.log('inviteResponse', inviteResponse);
    });*/
    chat.on('room-enter', (roomEntered) => {
        //console.log('roomEntered', roomEntered);
    });
    chat.on('room-exit', (roomExited) => {
        //console.log('roomExited', roomExited);
    });
    chat.on('message-add', (message) => {
        //console.log('Message Received =>', message);
    });

    return chat;
};

/**
 * Gets a list of chat rooms enabled in Firebase / Firechat
 * @param {Object} : The target Firebase chat `Object` to be queried for rooms
 * @return {Object} : Returns an `Array` of currently available chat rooms
 */
const getRooms = async function (chat) {
    if (!chat) {
        return;
    }
    let rooms;
    await chat.getRoomList((roomArray) => {
        rooms = roomArray;
        //console.log('Chat Rooms =>', rooms);
    });
    return rooms;
};

/**
 * Creates a new chat channel
 * @param {Object} chat: The target Firebase chat `Object`
 * @param {String} roomName: The name of the room to be created
 * @param {String} type: The type of room to be created. Either 'public' or 'private'. 
 * @return {String} : Returns the ID of the created room
 */
const createRoom = async function (chat, roomName, type = 'private') {
    let room = '';
    if (!chat || !roomName || !type) {
        return;
    } else if (type !== 'private' && type !== 'public') {
        // Room type must be either 'private' or 'public'
        return;
    }
    await chat.createRoom(roomName, type, (roomId) => {
        room = roomId;
        //console.log('Created Room =>', room);
    });
    // Return ID of created room
    return room;
};

// Release Exports
module.exports = {
    firebaseApp: firebaseApp,
    firebaseDb: firebaseDb,
    firebaseInstance: firebase,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getChat: getChat,
    listenForChatUser: listenForChatUser,
    getRooms: getRooms,
    createRoom: createRoom
};