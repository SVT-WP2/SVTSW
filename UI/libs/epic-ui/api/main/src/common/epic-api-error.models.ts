import { HttpErrorResponse } from '@angular/common/http'


/** The text of a failed request when the BFF gave none. */
export const EPIC_API_DEFAULT_ERROR_MESSAGE = 'The request failed. Try again later.'

/**
 * The text that a dialog shows for a failed request: the `message` of the BFF's error body (a refusal of the DB agent
 * arrives there with its own text; the messages of the validation are joined), otherwise `fallback`.
 */
export function toEpicApiErrorMessage(error: unknown, fallback: string = EPIC_API_DEFAULT_ERROR_MESSAGE): string {
    if (!(error instanceof HttpErrorResponse)) {
        return fallback
    }
    const message = (error.error as { message?: unknown } | null)?.message
    if (typeof message === 'string' && message) {
        return message
    }
    if (Array.isArray(message) && message.length && message.every((item) => typeof item === 'string')) {
        return message.join('; ')
    }
    return fallback
}
