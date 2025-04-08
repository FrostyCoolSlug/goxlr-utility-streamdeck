const toggleMixAssignment = new Action('com.frostycoolslug.goxlr-utility.toggle-mix-assignment');
const mixAssignmentMonitors = {}

/// Utility Behaviours
function mixAssignmentExternalStateChange() {
    // We should never fully remove the mute monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(mixAssignmentMonitors)) {
        mixAssignmentMonitors[monitor].setDisplay();
    }
}

/// Activators
toggleMixAssignment.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting.. SD handles toggling the button state
    if (status.mixers[payload.settings.serial].levels.submix) {
        let serial = payload.settings.serial;
        let output = payload.settings.output;
        let newState = payload.state ? "A" : "B"

        sendMixToggle(serial, output, newState)
    }
});

/// Configuration
toggleMixAssignment.onDidReceiveSettings(({action, event, context, device, payload}) => {
    // update button state to match device
    let value = status.mixers[payload.settings.serial].levels.submix.outputs[payload.settings.output];
    let state = (value === "A") ? 0 : 1;
    $SD.setState(context, state)

    createToggleMixAssignment(context, payload.settings);
});

toggleMixAssignment.onWillAppear(({action, event, context, device, payload}) => {
    createToggleMixAssignment(context, payload.settings);
});

toggleMixAssignment.onWillDisappear(({action, event, context, device, payload}) => {
    mixAssignmentMonitors[context].destroy();
   delete mixAssignmentMonitors[context];
});

/// Monitors
function createToggleMixAssignment(context, settings) {
    let serial = settings.serial;
    let output = settings.output;

    if (mixAssignmentMonitors[context] !== undefined) {
        if (!mixAssignmentMonitors[context].equal(context, serial, output)) {
            mixAssignmentMonitors[context].destroy();
            mixAssignmentMonitors[context] = new ToggleMixAssignment(context, settings.serial, output);
        }
    } else {
        mixAssignmentMonitors[context] = new ToggleMixAssignment(context, settings.serial, output);
    }
    mixAssignmentMonitors[context].setDisplay();
}

class ToggleMixAssignment {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    output = undefined
    submixes = undefined;

    #event_handle = () => {};

    constructor(context, serial, output) {
        this.context = context;
        this.serial = serial;
        this.output = output;

        this.submixes = `/mixers/${serial}/levels/submix`;

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    destroy() {
        eventTarget.removeEventListener("patch", this.#event_handle);
    }

    #onEvent(self, event) {
        let patch = event.patch;
        if (patch.path.startsWith(self.submixes)) {
            let state = event.patch.value === "A" ? 0 : 1;
            $SD.setState(this.context, state);
            self.setDisplay();
        }
    }

    equal(context, serial, output) {
        return (context === this.context && serial === this.serial && output === this.output)
    }

    setDisplay() {
        if (status === undefined || status.mixers[this.serial] === undefined || !status.mixers[this.serial].levels.submix) {
            $SD.setImage(this.context, RedIcon);
            return;
        }
        let value = status.mixers[this.serial].levels.submix.outputs[this.output];
        let state = (value === "A") ? 0 : 1;

        let svg = `<svg height="100" width="100">`
        if (state) {
            svg += `<rect width="100" height="100" fill="#cc7224" />`
            svg += `<text fill="#fff" font-family="Monospace" font-size="60px" x="50" y="70" dominant-baseline="middle" text-anchor="middle">B</text>`
        } else {
            svg += `<rect width="100" height="100" fill="#59b1b6" />`
            svg += `<text fill="#fff" font-family="Monospace" font-size="60px" x="50" y="70" dominant-baseline="middle" text-anchor="middle">A</text>`
        }    
        svg += `</svg>`;
                   
        let image = "data:image/svg+xml;charset=utf8," + svg;
        $SD.setImage(this.context, image);
    }
}

/// IPC Commands
function sendMixToggle(serial, output, state) {
    websocket.send_command(serial, {
        "SetSubMixOutputMix": [output, state]
    });
}
