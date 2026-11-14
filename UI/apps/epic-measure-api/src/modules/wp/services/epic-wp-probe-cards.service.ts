import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { Observable } from 'rxjs'
import { EpicWpProbeCard } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWpProbeCards } from 'svt-ts-types/kafka'

import { EpicWpSvc } from '../models'


@Injectable()
export class EpicWpProbeCardsService implements OnModuleInit {

    constructor(
        @Inject(EpicWpSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicWpProbeCard[]> {
        const message = new SvtDbAgentKafkaWpProbeCards.GetAllWpProbeCardsMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpProbeCards.GetAllWpProbeCardsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }


    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaWpProbeCards.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
