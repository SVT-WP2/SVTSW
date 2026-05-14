import { Injectable } from '@angular/core'
import { webSocket, WebSocketSubject } from 'rxjs/webSocket'


@Injectable({ providedIn: 'root' })
export class EpicKafkaWsFacade {

    createConnection<T = unknown>(): WebSocketSubject<T> {
        const url = 'ws://localhost:5270/ws/kafka'
        return webSocket(url)
    }

}
