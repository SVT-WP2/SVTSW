import { Injectable } from '@angular/core'
import { webSocket, WebSocketSubject } from 'rxjs/webSocket'

import { EpicApi } from '../../common'
import { EpicIvMntWs } from '../models/websocket'


@Injectable({ providedIn: 'root' })
export class EpicIvMntWsFacade {

    createConnection(): WebSocketSubject<EpicIvMntWs.Message> {
        const url = `${EpicApi.WS_BASE_URL}/measurement/iv`
        return webSocket(url)
    }

}
