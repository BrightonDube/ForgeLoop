// This file is deprecated. 
// The application has been refactored to use a Full-Stack architecture.
// See `server/agent.ts` and `server/api.ts` for the new logic.

export const simulation = {
    subscribe: () => () => {},
    start: () => console.warn("Use server API instead"),
    stop: () => console.warn("Use server API instead")
};