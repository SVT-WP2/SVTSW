import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import { SvtDbAgentNextDatabaseHealthIndicator } from './svt-db-agent-next-database.health-indicator'
import { SvtDbAgentNextHealthController } from './svt-db-agent-next-health.controller'


@Module({
    imports: [TerminusModule],
    controllers: [SvtDbAgentNextHealthController],
    providers: [SvtDbAgentNextDatabaseHealthIndicator],
})
export class SvtDbAgentNextHealthModule {
}
