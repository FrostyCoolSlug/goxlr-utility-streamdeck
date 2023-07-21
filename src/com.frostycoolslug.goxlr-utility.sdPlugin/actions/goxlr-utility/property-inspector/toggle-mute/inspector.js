/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />

const websocket = new Websocket();
let pluginSettings;

/**
 * This is called once we've had our handoff from the setup code, ensuring everything is good!
 * setup will leave the websocket open for us, so we can do our thing.
 */
function runPlugin() {
    // Show the refresh button..
    document.querySelector("#refresh").classList.remove("hidden");

    // Populate the Mixers
    let mixers = [];
    for (let serial in device.mixers) {
        mixers.push(serial);
    }

    if (mixers.length === 0) {
        document.querySelector("#no-mixers").classList.remove("hidden");
        return;
    }

    let serialList = document.querySelector("#mixers");
    while (serialList.hasChildNodes()) {
        serialList.removeChild(serialList.firstChild);
    }

    // Populate the mixer input..
    for (let mixer of mixers) {
        let element = document.createElement("option");
        element.text = mixer;
        element.value = mixer;
        serialList.add(element);
    }

    serialList.disabled = false;
    if (mixers.length > 1) {
        document.querySelector("#mixer").classList.remove("hidden");
    }

    document.querySelector("#settings").classList.remove("hidden");

    // Set any 'Known' form values, default others.
    Utils.setFormValue(pluginSettings, document.querySelector("#mute-toggle-form"))

    // Get all the default filled fields and store them to settings.
    pluginSettings = Utils.getFormValue(document.querySelector("#mute-toggle-form"));
    $PI.setSettings(pluginSettings);

    // We're done, disconnect the websocket.
    websocket.disconnect();
}

document.querySelector("#mixers").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#mute-toggle-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#fader").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#mute-toggle-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#behaviour").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#mute-toggle-form"));
    $PI.setSettings(pluginSettings);
});
