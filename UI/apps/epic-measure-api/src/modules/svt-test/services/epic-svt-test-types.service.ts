import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { EpicSvtTestType, EpicSvtTestTypeCreateRequest, EpicSvtTestTypesListQuery, EpicSvtTestTypeUpdateRequest } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestTypes } from 'epic-api-types/kafka'
import { Observable } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestTypesService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: EpicSvtTestTypesListQuery): Observable<EpicSvtTestType[]> {
        const message = new SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicSvtTestTypeCreateRequest): Observable<EpicSvtTestType> {
        const message = new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    update(id: number, update: EpicSvtTestTypeUpdateRequest): Observable<EpicSvtTestType> {
        const message = new SvtDbAgentKafkaSvtTestTypes.UpdateSvtTestTypeMessage({ id, update })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypes.UpdateSvtTestTypeReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTestTypes.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}

