const changeVolume = new Action('com.frostycoolslug.goxlr-utility.volume');


/// Activators
changeVolume.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let mix = payload.settings.mix;

    let volume = Math.round((payload.settings.volume / 100) * 255);

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.showAlert(context);
    } else {
        let submix_supported = status.mixers[serial].levels.submix_supported === true;
        let submix_enabled = (status.mixers[serial].levels.submix !== null);

        // If submixes aren't supported, or enabled, always default back to channel A..
        if (!submix_supported || !submix_enabled || mix === "A") {
            let channel = ChannelNameReadable[payload.settings.channel];
            console.log(channel);

            sendVolume(serial, channel, volume);
        } else {
            // Submixes are enabled, and we're configured as channel B
            let channel = ChannelNameReadable[payload.settings["sub-channel"]];
            console.log(channel);

            sendSubVolume(serial, channel, volume)
        }
    }
});

/// Configuration
changeVolume.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
});

changeVolume.onWillAppear(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
});

changeVolume.onWillDisappear(({action, event, context, device, payload}) => {
    destroyBasicMontior(context);
});

/// IPC Commands
function sendVolume(serial, channel, value) {
    websocket.send_command(serial, {
        "SetVolume": [channel, value]
    });
}

function sendSubVolume(serial, channel, value) {
    websocket.send_command(serial, {
        "SetSubMixVolume": [channel, value]
    });
}
