import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicSvtTestTemplateCreateEntity,
    EpicSvtTestTemplateEntity,
    EpicSvtTestTemplatesGetAllParams,
    EpicSvtTestTemplateUpdateEntity,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTestTemplates,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestTemplatesService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: EpicSvtTestTemplatesGetAllParams): Observable<EpicSvtTestTemplateEntity[]> {
        const message = new SvtDbAgentKafkaSvtTestTemplates.GetAllSvtTestTemplatesMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTemplates.GetAllSvtTestTemplatesReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicSvtTestTemplateCreateEntity): Observable<EpicSvtTestTemplateEntity> {
        const message = new SvtDbAgentKafkaSvtTestTemplates.CreateSvtTestTemplateMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTemplates.CreateSvtTestTemplateReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    update(id: number, update: EpicSvtTestTemplateUpdateEntity): Observable<EpicSvtTestTemplateEntity> {
        const message = new SvtDbAgentKafkaSvtTestTemplates.UpdateSvtTestTemplateMessage({ id, update })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTemplates.UpdateSvtTestTemplateReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTestTemplates.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}

