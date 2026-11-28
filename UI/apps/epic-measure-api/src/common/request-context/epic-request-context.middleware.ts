import { EpicRequestContext } from './epic-request-context.models'


/**
 * Express middleware: runs the rest of the request in a new `EpicRequestContext`. Register it after the body
 * parsers. A body parser calls `next()` from a stream event, outside the context of the middleware before it.
 */
export function epicRequestContextMiddleware(request: unknown, response: unknown, next: () => void): void {
    EpicRequestContext.run(next)
}
