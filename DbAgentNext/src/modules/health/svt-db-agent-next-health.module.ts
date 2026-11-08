import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import { SvtDbAgentNextKafkaModule } from '../kafka'

import { SvtDbAgentNextDatabaseHealthIndicator } from './svt-db-agent-next-database.health-indicator'
import { SvtDbAgentNextHealthController } from './svt-db-agent-next-health.controller'


@Module({
    imports: [TerminusModule, SvtDbAgentNextKafkaModule],
    controllers: [SvtDbAgentNextHealthController],
    providers: [SvtDbAgentNextDatabaseHealthIndicator],
})
export class SvtDbAgentNextHealthModule {
}
