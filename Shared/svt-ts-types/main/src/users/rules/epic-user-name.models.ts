/**
 * The name rule of the users: 1 to 100 characters after trimming. The DB agent checks it
 * (`DbAgentNext/docs/messages.md` §3.18); the forms of the SPA check it too.
 */
export const EPIC_USER_NAME_MAX_LENGTH = 100
