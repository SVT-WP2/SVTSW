import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import { SvtDbAgentNextDispatchModule } from '../dispatch'

import { SvtDbAgentNextHeartbeatService } from './svt-db-agent-next-heartbeat.service'
import { SvtDbAgentNextKafkaBacklogService } from './svt-db-agent-next-kafka-backlog.service'
import { SvtDbAgentNextKafkaController } from './svt-db-agent-next-kafka.controller'
import { SvtDbAgentNextKafkaHealthIndicator } from './svt-db-agent-next-kafka.health-indicator'


/**
 * The Kafka transport: the request controller, the heartbeat, the backlog skip and the Kafka health indicator. The
 * microservice itself is connected by the bootstrap (`main.ts`), so importing this module without a broker,
 * as the e2e harness does, costs nothing.
 */
@Module({
    imports: [SvtDbAgentNextDispatchModule, TerminusModule],
    controllers: [SvtDbAgentNextKafkaController],
    providers: [SvtDbAgentNextHeartbeatService, SvtDbAgentNextKafkaBacklogService, SvtDbAgentNextKafkaHealthIndicator],
    exports: [SvtDbAgentNextHeartbeatService, SvtDbAgentNextKafkaBacklogService, SvtDbAgentNextKafkaHealthIndicator],
})
export class SvtDbAgentNextKafkaModule {
}
