import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { EpicApiEnumsCollection, mapEpicKafkaMessageData, SvtDbAgentKafka, SvtDbAgentKafkaEnums } from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicEnumsSvc } from '../models'

// TODO: process reply errors
@Injectable()
export class EpicEnumsService implements OnModuleInit {

    constructor(
        @Inject(EpicEnumsSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(enumNames?: string[]): Observable<Partial<EpicApiEnumsCollection>> {
        const message = new SvtDbAgentKafkaEnums.GetAllEnumsMessage({ filter: { enumNames: enumNames ?? [] } })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaEnums.GetAllEnumsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaEnums.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
