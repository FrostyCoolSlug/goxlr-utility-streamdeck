const toggleMicMute = new Action('com.frostycoolslug.goxlr-utility.toggle-mic-mute');
const micMuteMonitors = {};

/// Utility Behaviours
function micMuteToggleExternalStateChange() {
    // We should never fully remove the mute monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(micMuteMonitors)) {
        micMuteMonitors[monitor].setState();
    }
}

/// Activators
toggleMicMute.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let behaviour = payload.settings.behaviour;

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        let current = status.mixers[serial].cough_button.state;
        let newValue = "Unmuted";

        // If the channel is already unmuted, execute behaviour, otherwise unmute.
        if (current === "Unmuted") {
            newValue = behaviour;
        }

        sendMicMute(serial, newValue);
    }
});

/// Configuration
toggleMicMute.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createMicMuteMonitor(context, payload.settings);
});

toggleMicMute.onWillAppear(({action, event, context, device, payload}) => {
    createMicMuteMonitor(context, payload.settings);
});

toggleMicMute.onWillDisappear(({action, event, context, device, payload}) => {
    micMuteMonitors[context].destroy();
   delete micMuteMonitors[context];
});

/// Monitors
function createMicMuteMonitor(context, settings) {
    let serial = settings.serial;
    let behaviour = settings.behaviour;

    if (micMuteMonitors[context] !== undefined) {
        if (!micMuteMonitors[context].equal(context, serial, behaviour)) {
            micMuteMonitors[context].destroy();
            micMuteMonitors[context] = new MicMuteMonitor(context, settings.serial, behaviour);
        }
    } else {
        micMuteMonitors[context] = new MicMuteMonitor(context, settings.serial, behaviour);
    }
    micMuteMonitors[context].setState();
}

class MicMuteMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    behaviour = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, behaviour) {
        this.context = context;
        this.serial = serial;
        this.behaviour = behaviour;

        // status.mixers[serial].cough_button.state;

        this.monitor = `/mixers/${serial}/cough_button/state`;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, behaviour) {
        return (context === this.context && serial === this.serial && behaviour === this.behaviour)
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
        let value = status.mixers[this.serial].cough_button.state;
        let state = (value === "Unmuted") ? 1 : 0;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}

/// IPC Commands
function sendMicMute(serial, state) {
    websocket.send_command(serial, {
        "SetCoughMuteState": state
    });
}
