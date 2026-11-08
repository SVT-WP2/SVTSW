import { Module } from '@nestjs/common'
import { SvtDbDataModule } from 'svt-db/data'

import { SvtDbAgentNextAsicsHandlers } from './asics'
import { SvtDbAgentNextEnumsHandlers } from './enums'
import { SvtDbAgentNextWaferTypesHandlers } from './wafer-types'
import { SvtDbAgentNextWafersHandlers } from './wafers'


/**
 * One provider per domain, each marked with `@SvtDbAgentNextHandlers()`; the dispatcher discovers them.
 * Each slice adds a domain here, together with its e2e spec.
 */
@Module({
    imports: [SvtDbDataModule],
    providers: [
        SvtDbAgentNextEnumsHandlers,
        SvtDbAgentNextWaferTypesHandlers,
        SvtDbAgentNextWafersHandlers,
        SvtDbAgentNextAsicsHandlers,
    ],
})
export class SvtDbAgentNextHandlersModule {
}
