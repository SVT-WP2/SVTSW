import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { Observable } from 'rxjs'
import { EpicWaferType, EpicWaferTypeCreateRequest, EpicWaferTypeMap } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWaferTypes } from 'svt-ts-types/kafka'

import { EpicWafersSvc } from '../models'


@Injectable()
export class EpicWaferTypesService implements OnModuleInit {

    constructor(
        @Inject(EpicWafersSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(): Observable<EpicWaferType[]> {
        const message = new SvtDbAgentKafkaWaferTypes.GetAllWaferTypesMessage()
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWaferTypes.GetAllWaferTypesReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicWaferTypeCreateRequest): Observable<EpicWaferType> {
        const message = new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWaferTypes.CreateWaferTypeReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    getWaferTypeMap(waferTypeId: number): Observable<EpicWaferTypeMap> {
        const message = new SvtDbAgentKafkaWaferTypes.GetWaferTypeMapMessage({ waferTypeId })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWaferTypes.GetWaferTypeMapReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit(): void {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaWaferTypes.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
