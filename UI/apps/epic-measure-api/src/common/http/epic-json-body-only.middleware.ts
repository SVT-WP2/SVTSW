import { HttpStatus } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'


/** The methods whose body the BFF reads. */
const BODY_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const EPIC_JSON_BODY_ONLY_MESSAGE = 'The body of a request must be JSON (Content-Type: application/json).'

/** True when the request carries a body: a `Content-Length` above 0, or a chunked body. */
function hasBody(request: Request): boolean {
    const length = request.headers['content-length']
    return request.headers['transfer-encoding'] !== undefined || (length !== undefined && Number(length) > 0)
}

/**
 * Express middleware: a `POST`, `PUT`, `PATCH` or `DELETE` with a body that is not `application/json` gets `415` at
 * once, before the body parsers, the guard and any Kafka request. The SPA sends JSON only.
 *
 * It is the protection against a cross-site request forgery from a page of the same site (another port of the host
 * counts: the dev UI shares the host of prod), next to the `SameSite=Strict` cookie: a plain HTML form can send only
 * `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`, and a script of another origin cannot
 * send JSON with the cookie without a CORS preflight, which the BFF does not allow with credentials (ticket 396).
 * A request without a body (the log-out) passes.
 */
export function epicJsonBodyOnlyMiddleware(request: Request, response: Response, next: NextFunction): void {
    if (BODY_METHODS.has(request.method) && hasBody(request) && !request.is('application/json')) {
        response.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
            statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            message: EPIC_JSON_BODY_ONLY_MESSAGE,
            error: 'Unsupported Media Type',
        })
        return
    }
    next()
}
