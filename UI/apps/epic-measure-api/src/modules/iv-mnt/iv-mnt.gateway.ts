import { Server } from '@nestjs/microservices'
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { timer } from 'rxjs'


@WebSocketGateway({ path: '/ws/iv-mnt' })
export class IvMntGateway implements OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    server: Server
    
    private wsClients: WebSocket[] = []

    @SubscribeMessage('message')
    handleMessage(client: any, payload: any): string {
        return 'Hello world!'
    }

    handleConnection(client: WebSocket) {
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
