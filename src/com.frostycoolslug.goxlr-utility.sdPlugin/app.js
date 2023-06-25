/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/stream-deck.js" />

const changeProfile = new Action('com.frostycoolslug.goxlr-utility.profile');
const changeRouting = new Action('com.frostycoolslug.goxlr-utility.routing');

const eventTarget = new EventTarget();
const routeMonitors = [];

const websocket = new Websocket();
let status = undefined;

function clearSettings() {
    // Clear the Status Object..
    status = undefined;

    // Clear any Route Monitors..
    while (routeMonitors.length > 0) {
        let monitor = routeMonitors.shift();
        monitor.destroy();
    }
}

$SD.onConnected(({actionInfo, appInfo, connection, messageType, port, uuid}) => {
    console.log('Stream Deck connected!');
    $SD.getGlobalSettings();
});

$SD.onDidReceiveGlobalSettings((data => {
    console.log("Got Global Settings..");
    if (websocket.is_connected()) {
        websocket.disconnect();
    }

    let settings = data.payload.settings;
    console.log(JSON.stringify(settings));
    if (settings['address'] === undefined) {
        console.error("Address not defined, cannot perform action..");
        return;
    }

    websocket.set_address("ws://" + settings['address'] + "/api/websocket");
    websocket.onClose(clearSettings)
    websocket.connect().then(() => websocket.send_daemon_command("GetStatus").then((response) => {
        console.log("Connected to the GoXLR Utility!")
        status = response.Status;
        websocket.set_patch_method(patchStatus);
    }).catch(() => {
        console.error("Unable to get DaemonStatus");
        websocket.disconnect();
    })).catch(() => {
        console.error("Unable to connect to websocket.");
    });
}));


changeProfile.onKeyUp(({action, context, device, event, payload}) => {
    // Grab the profile to load from the payload..
    let profile = payload.settings["profile"];
    let serial = payload.settings['serial'];
    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Attempting Reconnect and ignoring command.");
        $SD.getGlobalSettings();
    } else {
        loadProfile(serial, profile);
    }
});

changeRouting.onKeyUp(({action, context, device, event, payload}) => {
    // Toggle the Setting..
    let serial = payload.settings.serial;
    let input = InputDevice[payload.settings.input];
    let output = OutputDevice[payload.settings.output];

    if (!websocket.is_connected()) {
        console.warn("Not Connected to Utility, Attempting Reconnect and ignoring command.");
        $SD.getGlobalSettings();
    } else {
        let newValue = !status.mixers[serial].router[input][output];
        sendRoute(serial, input, output, newValue);
    }
});

changeRouting.onDidReceiveSettings(({action, event, context, device, payload}) => {
    createMonitor(context, payload.settings);
});

changeRouting.onWillAppear(({action, event, context, device, payload}) => {
    createMonitor(context, payload.settings);
});

function createMonitor(context, settings) {
    let input = InputDevice[settings.input];
    let output = OutputDevice[settings.output];

    if (status !== undefined) {
        if (routeMonitors[context] !== undefined) {
            routeMonitors[context].destroy();
        }
        routeMonitors[context] = new RouteMonitor(context, settings.serial, input, output);
        routeMonitors[context].setState();
    }
}

class RouteMonitor {
    #context = undefined;
    #serial = undefined;
    #input = undefined;
    #output = undefined;
    #monitor = undefined;

    constructor(context, serial, input, output) {
        this.#context = context;
        this.#serial = serial;
        this.#input = input;
        this.#output = output;
        this.#monitor = `/mixers/${serial}/router/${input}/${output}`;

        let self = this;
        eventTarget.addEventListener("patch", (e) => self.#onEvent(self, e));
    }

    destroy() {

        let self = this;
        eventTarget.removeEventListener("patch", (e) => self.#onEvent(self, e));
    }

    #onEvent(self, event) {
        let path = event.detail;
        if (path === this.#monitor) {
            this.setState();
        }
    }

    setState() {
        let value = status.mixers[this.#serial].router[this.#input][this.#output];
        $SD.setState(this.#context, (value) ? 0 : 1);
    }
}

function loadProfile(serial, name) {
    websocket.send_command(serial, {
        "LoadProfile": [name, true]
    }).then(() => console.log("Loaded Profile " + name));
}

function sendRoute(serial, input, output, value) {
    websocket.send_command(serial, {
        "SetRouter": [input, output, value]
    }).then(() => console.log(`Set Routing ${input} -> ${output} to ${value}`));
}

function patchStatus(patches) {
    for (let patch of patches) {
        jsonpatch.applyOperation(status, patch, true, true, false);
        eventTarget.dispatchEvent(new CustomEvent("patch", {detail: patch.path}));
    }
}
