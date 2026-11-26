import { IncomingMessage } from 'node:http'

import { Server } from '@nestjs/microservices'
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { timer } from 'rxjs'

import { EpicAuthSessionService, EpicAuthSvc, EpicAuthUserCacheService } from '../auth'


@WebSocketGateway({ path: '/ws/iv-mnt' })
export class IvMntGateway implements OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    server: Server

    private wsClients: WebSocket[] = []

    constructor(
        private readonly session: EpicAuthSessionService,
        private readonly userCache: EpicAuthUserCacheService,
    ) {
    }

    @SubscribeMessage('message')
    handleMessage(client: any, payload: any): string {
        return 'Hello world!'
    }

    /**
     * The HTTP guard does not cover a WebSocket: the session cookie of the upgrade request is checked here, as
     * `EpicAuthGuard` checks it. A socket without a valid session of an active user is closed.
     */
    async handleConnection(client: WebSocket, request?: IncomingMessage): Promise<void> {
        const userId = this.session.verify(this.session.readTokenFromCookieHeader(request?.headers.cookie))
        const user = userId === null ? null : await this.userCache.getActiveUser(userId).catch(() => null)
        if (!user) {
            client.close(EpicAuthSvc.WS_CLOSE_UNAUTHORIZED, 'Unauthorized')
            return
        }
        this.wsClients.push(client)
        timer(10, 10)
            .subscribe(() => this.broadcast('eventName', { some: 'value' }))

    }

    handleDisconnect(client: WebSocket) {
        for (let i = 0; i < this.wsClients.length; i++) {
            if (this.wsClients[i] === client) {
                this.wsClients.splice(i, 1)
                break
            }
        }
        this.broadcast('disconnect', {})
    }

    private broadcast(event: string, data: unknown) {
        for (const c of this.wsClients) {
            c.send(JSON.stringify({ event, data: JSON.stringify(data) }))
        }
    }

}
