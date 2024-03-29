const changeRouting = new Action('com.frostycoolslug.goxlr-utility.routing');
const routeMonitors = {};

/// Utility Behaviours
function routingExternalStateChange() {
    // We should never fully remove the route monitors, so that when the connection comes back we can reestablish them..
    for (let monitor of Object.keys(routeMonitors)) {
        routeMonitors[monitor].setState();
    }
}

/// Activators
changeRouting.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let input = InputDevice[payload.settings.input];
    let output = OutputDevice[payload.settings.output];
    let mode = payload.settings.mode;


    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Unable to Execute");
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else if (status === undefined || status.mixers[serial] === undefined) {
        console.warn("Mixer isn't present, unable to perform action")
        $SD.setState(context, payload.state);
        $SD.showAlert(context);
    } else {
        let currentValue = status.mixers[serial].router[input][output];
        let newValue = (mode === "toggle") ? !currentValue : (payload.settings.value === "enabled");

        if (newValue !== currentValue) {
            sendRoute(serial, input, output, newValue);
        } else {
            $SD.setState(context, newValue ? 0 : 1);
        }
    }
});

/// Configuration
changeRouting.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createRoutingMonitor(context, payload.settings);
});

changeRouting.onWillAppear(({action, event, context, device, payload}) => {
    createRoutingMonitor(context, payload.settings);
});

changeRouting.onWillDisappear(({action, event, context, device, payload}) => {
   routeMonitors[context].destroy();
   delete routeMonitors[context];
});

/// Monitors
function createRoutingMonitor(context, settings) {
    let serial = settings.serial;
    let input = InputDevice[settings.input];
    let output = OutputDevice[settings.output];

    if (routeMonitors[context] !== undefined) {
        if (!routeMonitors[context].equal(context, serial, input, output)) {
            routeMonitors[context].destroy();
            routeMonitors[context] = new RouteMonitor(context, settings.serial, input, output);
        }
    } else {
        routeMonitors[context] = new RouteMonitor(context, settings.serial, input, output);
    }
    routeMonitors[context].setState();
}

class RouteMonitor {
    // These are all arguably private, but because they're all used in the event scope, the event needs
    // access to them.
    context = undefined;
    serial = undefined;
    input = undefined;
    output = undefined;
    monitor = undefined;
    device = undefined;

    #event_handle = () => {};

    constructor(context, serial, input, output) {
        this.context = context;
        this.serial = serial;
        this.input = input;
        this.output = output;
        this.monitor = `/mixers/${serial}/router/${input}/${output}`;
        this.device = `/mixers/${serial}`

        let self = this;
        this.#event_handle = function(e) {
            self.#onEvent(self, e);
        }
        eventTarget.addEventListener("patch", this.#event_handle);
    }

    equal(context, serial, input, output) {
        return (context === this.context && serial === this.serial && input === this.input && output === this.output)
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
        let value = status.mixers[this.serial].router[this.input][this.output];
        let state = (value) ? 0 : 1;
        $SD.setImage(this.context);
        $SD.setState(this.context, state);
    }
}

/// IPC Commands
function sendRoute(serial, input, output, value) {
    websocket.send_command(serial, {
        "SetRouter": [input, output, value]
    });
}
