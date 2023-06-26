// Load the needed icon images..
const WhiteIcon = getBase64("#img-white");
const GreyIcon = getBase64("#img-grey");
const RedIcon = getBase64("#img-red");

$SD.onConnected(({actionInfo, appInfo, connection, messageType, port, uuid}) => {
    console.log('Stream Deck connected!');
    $SD.getGlobalSettings();
});

$SD.onDidReceiveGlobalSettings((data => {
    console.log("Got Global Settings..");
    if (websocket.is_connected()) {
        console.log("Calling Disconnect..");
        websocket.disconnect();
    }

    let settings = data.payload.settings;
    console.log(JSON.stringify(settings));
    if (settings['address'] === undefined) {
        console.error("Address not defined, cannot perform action..");
        retryConnection();
        return;
    }

    websocket.set_address("ws://" + settings['address'] + "/api/websocket");
    websocket.onClose(() => {
        utilityOffline();
        retryConnection();
    })
    websocket.connect().then(() => websocket.send_daemon_command("GetStatus").then((response) => {
        console.log("Connected to the GoXLR Utility!")
        status = response.Status;
        utilityOnline();
        websocket.set_patch_method(patchStatus);
    }).catch(() => {
        console.error("Unable to get DaemonStatus");
        websocket.disconnect();
        retryConnection();
    })).catch(() => {
        console.error("Unable to connect to websocket.");
        retryConnection();
    });
}));

/// Utility
function utilityOffline() {
    console.log("Lost Connection to GoXLR Utility..");

    // Clear the Status Object...
    status = undefined;

    // Inform any active commands..
    routingExternalStateChange();
    profileExternalStateChange();
}

function utilityOnline() {
    console.log("Got Connection to the GoXLR Utility..");

    // Inform any active commands..
    routingExternalStateChange();
    profileExternalStateChange();
}

function retryConnection() {
    console.log("Retrying Connection..");
    // This attempts to reconnect to the utility every 100ms after the last failure.
    if (!websocket.is_connected()) {
        setTimeout(() => {
            $SD.getGlobalSettings()
        }, 1000);
    } else {
        console.log("Websocket Connected?");
    }
}

function patchStatus(patches) {
    if (status === undefined) {
        // This normally happens if the Util has *JUST* started up, and the websocket is present prior
        // to the first device being detected. GetStatus needs to happen first, and be stored prior to
        // handling any patches on it.
        return;
    }

    for (let patch of patches) {
        jsonpatch.applyOperation(status, patch, true, true, false);

        let event = new CustomEvent("patch");
        event.patch = patch;
        eventTarget.dispatchEvent(event);
    }
}

function getBase64(imgId) {
    let c = document.createElement('canvas');
    let img = document.querySelector(imgId);

    c.height = img.naturalHeight;
    c.width = img.naturalWidth;

    let context = c.getContext('2d');
    context.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL();
}
