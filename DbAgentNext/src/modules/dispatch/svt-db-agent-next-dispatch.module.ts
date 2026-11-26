import { Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'

import { SvtDbDataModule } from '../../db/data'

import { SvtDbAgentNextRequestDispatcher } from './svt-db-agent-next-request-dispatcher.service'


/** The dispatcher. It needs the data layer for one check of its own: the user of the header `svt_userId`. */
@Module({
    imports: [DiscoveryModule, SvtDbDataModule],
    providers: [SvtDbAgentNextRequestDispatcher],
    exports: [SvtDbAgentNextRequestDispatcher],
})
export class SvtDbAgentNextDispatchModule {
}
