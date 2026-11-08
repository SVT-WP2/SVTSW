import { Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'

import { SvtDbAgentNextRequestDispatcher } from './svt-db-agent-next-request-dispatcher.service'


@Module({
    imports: [DiscoveryModule],
    providers: [SvtDbAgentNextRequestDispatcher],
    exports: [SvtDbAgentNextRequestDispatcher],
})
export class SvtDbAgentNextDispatchModule {
}
