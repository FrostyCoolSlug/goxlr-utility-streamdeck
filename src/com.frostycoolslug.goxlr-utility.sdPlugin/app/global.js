// The Event Target for Patch Updates
const eventTarget = new EventTarget();

// The websocket for communciating with the Utility
const websocket = new Websocket();

// The current 'DaemonStatus'.
let status = undefined;
