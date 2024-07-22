const muteToggle = new Action('com.frostycoolslug.goxlr-utility.toggle-mute');
const muteMonitors = {};
let longPress = null;

/// Utility Behaviours
function muteToggleExternalStateChange() {
    // We should never fully remove the mute monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(muteMonitors)) {
        muteMonitors[monitor].setState();
    }
}

muteToggle.onKeyDown(({action, event, context, device, payload}) => {
    if (payload.settings.mode!=="set") {
        let longPressDelay = 500; // default value
        let faderMuteStatus = null;
        if (status !== undefined && status.mixers[payload.settings.serial] !== undefined) {
            longPressDelay = status.mixers[payload.settings.serial].settings.mute_hold_duration;
            faderMuteStatus = status.mixers[payload.settings.serial].fader_status[payload.settings.fader].mute_state;
        }

        longPress = setTimeout(() => {
            if (faderMuteStatus === "Unmuted") {
                doMute(context, payload, true);
            }
            longPress = null;
        }, longPressDelay);
    }
});

/// Activators
muteToggle.onKeyUp(({action, event, context, device, payload}) => {
    if (payload.settings.mode == "set" || longPress !== null) {
        clearTimeout(longPress);
        doMute(context, payload);
    } else {
        muteMonitors[context].setState();
    }
});

/// Configuration
muteToggle.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createMuteMonitor(context, payload.settings);
});

muteToggle.onWillAppear(({action, event, context, device, payload}) => {
    createMuteMonitor(context, payload.settings);
});

muteToggle.onWillDisappear(({action, event, context, device, payload}) => {
   muteMonitors[context].destroy();
   delete muteMonitors[context];
});

function doMute(context, payload, actionHold = false) {
    let serial = payload.settings.serial;
    let fader = payload.settings.fader;
    let mode = payload.settings.mode;
    let behaviour = payload.settings.behaviour;

    // Toggle the Setting..
    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        console.log(mode);
        if (mode === "set") {
            let current = status.mixers[serial].fader_status[fader].mute_state;
            let newValue = payload.settings.set_behaviour;
            console.log(`Current: ${current} -> ${newValue}`);

            if (newValue !== current) {
                sendMute(serial, fader, newValue);
            } else {
                // Forcibly update the icon if we're not changing the setting.
                $SD.setState(context, (current === "Unmuted") ? 1 : 0)
            }
        } else {
            let newValue = "";
            if (actionHold) {
                newValue = "MutedToAll";
            } else {
                let current = status.mixers[serial].fader_status[fader].mute_state;
                newValue = "Unmuted";

                // If the channel is already unmuted, execute behaviour, otherwise unmute.
                if (current === "Unmuted") {
                    newValue = behaviour;
                }
            }
            sendMute(serial, fader, newValue);
        }
    }
}

/// Monitors
function createMuteMonitor(context, settings) {
    let serial = settings.serial;

    let fader = settings.fader;
    let behaviour = settings.behaviour;

    if (muteMonitors[context] !== undefined) {
        if (!muteMonitors[context].equal(context, serial, fader, behaviour)) {
            muteMonitors[context].destroy();
            muteMonitors[context] = new MuteMonitor(context, settings.serial, fader, behaviour);
        }
    } else {
        muteMonitors[context] = new MuteMonitor(context, settings.serial, fader, behaviour);
    }
    muteMonitors[context].setState();
}

class MuteMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    fader = undefined;
    behaviour = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, fader, behaviour) {
        this.context = context;
        this.serial = serial;
        this.fader = fader;
        this.behaviour = behaviour;

        // status.mixers[serial].fader_status[fader].mute_state;

        this.monitor = `/mixers/${serial}/fader_status/${fader}/mute_state`;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, fader, behaviour) {
        return (context === this.context && serial === this.serial && fader === this.fader && behaviour === this.behaviour)
    }

    destroy() {
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        if (patch.path === self.device || patch.path === self.monitor) {
            self.setState();
        }
    }

    setState() {
        if (status === undefined || status.mixers[this.serial] === undefined) {
            $SD.setImage(this.context, RedIcon);
            return;
        }
        let value = status.mixers[this.serial].fader_status[this.fader].mute_state;
        let state = (value === "Unmuted") ? 1 : 0;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}

/// IPC Commands
function sendMute(serial, fader, type) {
    websocket.send_command(serial, {
        "SetFaderMuteState": [fader, type]
    });
}
