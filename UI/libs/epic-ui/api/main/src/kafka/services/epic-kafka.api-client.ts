import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicKafkaApiClient {

    protected readonly httpClient = inject(HttpClient)

    sendMessage(topicName: string, message: string): Observable<string> {
        const url = 'http://localhost:5270/api/kafka/send-message'
        return this.httpClient.post<string>(url, { topicName, message })
    }

}
