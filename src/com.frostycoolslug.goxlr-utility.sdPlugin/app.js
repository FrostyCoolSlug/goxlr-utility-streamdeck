// Load the needed icon images..
const RedIcon = getBase64("#img-red");

$SD.onConnected(({actionInfo, appInfo, connection, messageType, port, uuid}) => {
    $SD.getGlobalSettings();
});

$SD.onDidReceiveGlobalSettings((data => {
    if (websocket.is_connected()) {
        websocket.disconnect();
    }

    let settings = data.payload.settings;
    if (settings['address'] === undefined) {
        retryConnection();
        return;
    }

    websocket.set_address("ws://" + settings['address'] + "/api/websocket");
    websocket.onClose(() => {
        utilityOffline();
        retryConnection();
    })
    websocket.connect().then(() => websocket.send_daemon_command("GetStatus").then((response) => {
        status = response.Status;
        utilityOnline();
        websocket.set_patch_method(patchStatus);
    }).catch((e) => {
        console.log(e);
        websocket.disconnect();
        retryConnection();
    })).catch(() => {
        retryConnection();
    });
}));

/// Utility
function utilityOffline() {
    // Clear the Status Object...
    status = undefined;

    // Inform any active commands..
    routingExternalStateChange();
    muteToggleExternalStateChange();
    fxToggleExternalStateChange();
    fxBankExternalStateChange();
    profileExternalStateChange();
    volumeMonitorExternalStateChange();
    encoderVolumeMonitorExternalStateChange();
    basicExternalStateChange();
}

function utilityOnline() {
    // Inform any active commands..
    routingExternalStateChange();
    muteToggleExternalStateChange();
    fxToggleExternalStateChange();
    fxBankExternalStateChange();
    profileExternalStateChange();
    volumeMonitorExternalStateChange();
    encoderVolumeMonitorExternalStateChange();
    basicExternalStateChange();
}

function retryConnection() {
    // This attempts to reconnect to the utility every 100ms after the last failure.
    if (!websocket.is_connected()) {
        setTimeout(() => {
            $SD.getGlobalSettings()
        }, 1000);
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
