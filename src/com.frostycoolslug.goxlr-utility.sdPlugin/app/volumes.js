const changeVolume = new Action('com.frostycoolslug.goxlr-utility.volume');


/// Activators
changeVolume.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let channel = ChannelNameReadable[payload.settings.channel];
    let volume = Math.round((payload.settings.volume / 100) * 255);

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.showAlert(context);
    } else {
        sendVolume(serial, channel, volume);
    }
});

/// Configuration
changeRouting.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
});

changeRouting.onWillAppear(({action, event, context, device, payload}) => {
    createBasicMonitor(context, payload.settings.serial);
});

changeRouting.onWillDisappear(({action, event, context, device, payload}) => {
    destroyBasicMontior(context);
});

/// IPC Commands
function sendVolume(serial, channel, value) {
    websocket.send_command(serial, {
        "SetVolume": [channel, value]
    }).then(() => console.log(`Changed Volume for ${channel} to ${value}`));
}
