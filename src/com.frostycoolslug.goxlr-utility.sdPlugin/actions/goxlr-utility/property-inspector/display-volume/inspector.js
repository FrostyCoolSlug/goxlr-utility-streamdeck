/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />

const websocket = new Websocket();
let pluginSettings;

$PI.onConnected((jsn) => {
    const form = document.querySelector('#display-volume-form');
    const {actionInfo, appInfo, connection, messageType, port, uuid} = jsn;
    const {payload, context} = actionInfo;
    const {settings} = payload;
    Utils.setFormValue(settings, form);
});

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
    Utils.setFormValue(pluginSettings, document.querySelector("#display-volume-form"))

    loadSettings();

    // Get all the default filled fields and store them to settings.
    pluginSettings = Utils.getFormValue(document.querySelector("#display-volume-form"));
    $PI.setSettings(pluginSettings);

    // We're done, disconnect the websocket.
    websocket.disconnect();
}

function loadSettings() {
    let current_mixer = document.querySelector("#mixers").value;

    if (device.mixers[current_mixer] === undefined) {
        // Do nothing, we'll get called when the mixer updates.
        return;
    }

    let submix_supported = device.mixers[current_mixer].levels.submix_supported === true;
    let submix_enabled = (device.mixers[current_mixer].levels.submix !== null);

    document.querySelector("#tabs").classList.remove("hidden");
    document.querySelector("#tab1").classList.remove("hidden");

    if (submix_supported && submix_enabled) {
        document.querySelector("#submix").classList.remove("hidden");

        let mix = document.querySelector("#mix").value;
        if (mix === "A") {
            document.querySelector("#mix-a").classList.remove("hidden");
        } else {
            document.querySelector("#mix-b").classList.remove("hidden");
        }
    } else {
        // Force the Mix value to A
        document.querySelector("#mix").value = "A";
        document.querySelector("#mix-a").classList.remove("hidden");
    }
}

document.querySelector("#mixers").addEventListener('change', (e) => {
    loadSettings();

    pluginSettings = Utils.getFormValue(document.querySelector("#display-volume-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#channel").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#display-volume-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#sub-channel").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#display-volume-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#mix").addEventListener('change', (e) => {
    if (e.target.value === "A") {
        document.querySelector("#mix-a").classList.remove("hidden");
        document.querySelector("#mix-b").classList.add("hidden");
    } else {
        document.querySelector("#mix-a").classList.add("hidden");
        document.querySelector("#mix-b").classList.remove("hidden");
    }

    pluginSettings = Utils.getFormValue(document.querySelector("#display-volume-form"));
    $PI.setSettings(pluginSettings);
});

document.querySelector("#hide_name").addEventListener('change', (e) => {
    pluginSettings = Utils.getFormValue(document.querySelector("#display-volume-form"));
    $PI.setSettings(pluginSettings);
});

function activateTabs(activeTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    let activeTabEl = null;
    allTabs.forEach((el, i) => {
        el.onclick = () => clickTab(el);
        if(el.dataset?.target === activeTab) {
            activeTabEl = el;
        }
    });
    if(activeTabEl) {
        clickTab(activeTabEl);
    } else if(allTabs.length) {
        clickTab(allTabs[0]);
    }
}

function clickTab(clickedTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    allTabs.forEach((el, i) => el.classList.remove('selected'));
    clickedTab.classList.add('selected');
    activeTab = clickedTab.dataset?.target;
    allTabs.forEach((el, i) => {
        if(el.dataset.target) {
            const t = document.querySelector(el.dataset.target);
            if(t) {
                t.style.display = el == clickedTab ? 'block' : 'none';
            }
        }
    });
}

activateTabs();