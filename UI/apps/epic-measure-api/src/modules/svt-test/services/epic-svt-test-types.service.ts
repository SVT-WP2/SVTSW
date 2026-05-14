import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicSvtTestTypeCreateEntity,
    EpicSvtTestTypeEntity,
    EpicSvtTestTypesGetAllParams,
    EpicSvtTestTypeUpdateEntity,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTestTypes,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestTypesService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: EpicSvtTestTypesGetAllParams): Observable<EpicSvtTestTypeEntity[]> {
        const message = new SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicSvtTestTypeCreateEntity): Observable<EpicSvtTestTypeEntity> {
        const message = new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    update(id: number, update: EpicSvtTestTypeUpdateEntity): Observable<EpicSvtTestTypeEntity> {
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

