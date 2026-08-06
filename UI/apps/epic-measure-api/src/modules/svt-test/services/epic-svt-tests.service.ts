import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicSvtTestCreateEntity,
    EpicSvtTestEntity,
    EpicSvtTestResolvedEntity,
    EpicSvtTestsGetAllParams,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    resolveEpicSvtTestStatus,
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTests,
} from 'epic/entities'
import { map, Observable } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestsService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: EpicSvtTestsGetAllParams): Observable<EpicSvtTestResolvedEntity[]> {
        const message = new SvtDbAgentKafkaSvtTests.GetAllSvtTestsMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTests.GetAllSvtTestsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
                map(items => items.map(item => this.resolveEntity(item))),
            )
    }

    create(createRequest: EpicSvtTestCreateEntity): Observable<EpicSvtTestResolvedEntity> {
        const message = new SvtDbAgentKafkaSvtTests.CreateSvtTestMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTests.CreateSvtTestReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
                map(entity => this.resolveEntity(entity)),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    /**
     * The DB agent only knows the physical `testResultStatus`. The synthetic `status` is resolved here, on the
     * BFF — this is the seam where, later, the live processing state of other services gets folded in.
     */
    protected resolveEntity(entity: EpicSvtTestEntity): EpicSvtTestResolvedEntity {
        return {
            ...entity,
            status: resolveEpicSvtTestStatus(entity.testResultStatus),
        }
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTests.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}

