import { ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { WsAdapter } from '@nestjs/platform-ws'
import * as bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'

import { epicJsonBodyOnlyMiddleware, epicRequestContextMiddleware } from '../common'


export const EPIC_MEASURE_API_GLOBAL_PREFIX = 'api'

/**
 * The HTTP side of the BFF as every caller sees it: the `/api` prefix, the `extended` query parser (`k[]=a`,
 * `k[a]=b`), JSON bodies only, the body limit, the cookies, the request context, the global `ValidationPipe` and the
 * WebSocket adapter. Shared by `main.ts` and the e2e harness (`test-e2e/utils/test-setup.ts`), so the suite runs the
 * configuration that ships. Call it before `app.init()`: the middlewares must be registered before NestJS's own body
 * parsers.
 */
export function configureEpicMeasureApiApp(app: NestExpressApplication): void {
    app.setGlobalPrefix(EPIC_MEASURE_API_GLOBAL_PREFIX)
    app.set('query parser', 'extended')

    // A body that is not JSON gets 415 before any parser: no url-encoded form reaches a route (cross-site forgery).
    app.use(epicJsonBodyOnlyMiddleware)
    // max post upload size
    app.use(bodyParser.json({ limit: '50mb' }))

    // The session cookie (EpicAuthGuard). The request context after the body parsers: see its middleware.
    app.use(cookieParser())
    app.use(epicRequestContextMiddleware)

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    )

    app.useWebSocketAdapter(new WsAdapter(app))
    app.enableCors()
}
