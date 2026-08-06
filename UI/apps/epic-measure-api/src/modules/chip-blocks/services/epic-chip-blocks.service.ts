import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicChipBlockEntity,
    EpicGetAllChipBlocksQueryFilter,
    mapEpicKafkaMessageData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaChipBlocks,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicChipBlocksSvc } from '../models'


@Injectable()
export class EpicChipBlocksService implements OnModuleInit {

    constructor(
        @Inject(EpicChipBlocksSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: EpicGetAllChipBlocksQueryFilter): Observable<EpicChipBlockEntity[]> {
        const message = new SvtDbAgentKafkaChipBlocks.GetAllChipBlocksMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaChipBlocks.GetAllChipBlocksReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaChipBlocks.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
