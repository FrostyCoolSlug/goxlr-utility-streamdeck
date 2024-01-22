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


    let banks = document.querySelector("#bank");
    while (banks.hasChildNodes()) {
        banks.removeChild(banks.firstChild);
    }

    // We need to populate the dropdown prior to loading the settings..
    for (let i = 1; i <= 6; i++) {
        let key = `Preset${i}`;
        let element = document.createElement("option");
        element.text = `${i}:`;
        element.value = `${key}`;

        banks.add(element);
    }

    // Set any 'Known' form values, default others.
    Utils.setFormValue(pluginSettings, document.querySelector("#load-bank-form"))

    // Load the Effect Banks and update the page..
    loadEffectBank();

    // Get all the default filled fields and store them to settings.
    pluginSettings = Utils.getFormValue(document.querySelector("#load-bank-form"));
    $PI.setSettings(pluginSettings);

    // We're done, disconnect the websocket.
    websocket.disconnect();
}

function loadEffectBank() {
    let selected = document.querySelector("#mixers").value;

    if (device.mixers[selected] === undefined) {
        // Don't do anything for now, this should fix itself.
        return;
    }

    if (device.mixers[selected].effects === null) {
        document.querySelector("#no-mini").classList.remove("hidden");
        document.querySelector("#settings").classList.add("hidden");
        return;
    } else {
        document.querySelector("#no-mini").classList.add("hidden");
        document.querySelector("#settings").classList.remove("hidden");
    }

    let presets = device.mixers[selected].effects.preset_names;
    for (let i = 0; i <= 5; i++) {
        let key = `Preset${i + 1}`;
        document.querySelector("#bank").childNodes[i].text = `${i + 1}: ${presets[key]}`;
    }
    document.querySelector("#bank").disabled = false;
}

document.querySelector("#mixers").addEventListener('change', (e) => {
    // Update the bank list...
    loadEffectBank();

    pluginSettings = Utils.getFormValue(document.querySelector("#load-bank-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#bank").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#load-bank-form"));
    $PI.setSettings(pluginSettings);
});
