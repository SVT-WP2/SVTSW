import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import { SvtDbAgentNextHealthController } from './svt-db-agent-next-health.controller'


@Module({
    imports: [TerminusModule],
    controllers: [SvtDbAgentNextHealthController],
})
export class SvtDbAgentNextHealthModule {
}
