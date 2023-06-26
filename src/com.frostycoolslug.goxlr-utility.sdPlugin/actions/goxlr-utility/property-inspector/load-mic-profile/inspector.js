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

    document.querySelector("#profile").classList.remove("hidden");
    let files = device.files.mic_profiles.sort(Intl.Collator().compare);
    let profiles = document.querySelector("#profiles");
    while (profiles.hasChildNodes()) {
        profiles.removeChild(profiles.firstChild);
    }

    if (files.length === 0) {
        let element = document.createElement("option");
        element.text = "No Profiles Found";
        element.value = "none";
        profiles.add(element);
    } else {
        for (let file of files) {
            let element = document.createElement("option");
            element.text = file;
            element.value = file;

            profiles.add(element);
        }
        profiles.disabled = false;
    }

    // Set any 'Known' form values, default others.
    Utils.setFormValue(pluginSettings, document.querySelector("#mic-profile-form"))

    // Get all the default filled fields and store them to settings.
    pluginSettings = Utils.getFormValue(document.querySelector("#mic-profile-form"));
    $PI.setSettings(pluginSettings);

    console.log(pluginSettings);

    // We're done, disconnect the websocket.
    websocket.disconnect();
}

document.querySelector("#profiles").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#mic-profile-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#mixers").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#mic-profile-form"));
    $PI.setSettings(pluginSettings);
});
