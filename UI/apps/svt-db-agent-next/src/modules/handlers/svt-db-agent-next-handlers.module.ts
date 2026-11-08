import { Module } from '@nestjs/common'
import { SvtDbDataModule } from 'svt-db/data'

import { SvtDbAgentNextAsicsHandlers } from './asics'
import { SvtDbAgentNextChipBlocksHandlers } from './chip-blocks'
import { SvtDbAgentNextChipsHandlers } from './chips'
import { SvtDbAgentNextEnumsHandlers } from './enums'
import { SvtDbAgentNextWaferTypesHandlers } from './wafer-types'
import { SvtDbAgentNextWafersHandlers } from './wafers'
import { SvtDbAgentNextWpMachinesHandlers } from './wp-machines'
import { SvtDbAgentNextWpProbeCardsHandlers } from './wp-probe-cards'
import { SvtDbAgentNextWpProjectsHandlers } from './wp-projects'


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
        SvtDbAgentNextChipsHandlers,
        SvtDbAgentNextChipBlocksHandlers,
        SvtDbAgentNextWpMachinesHandlers,
        SvtDbAgentNextWpProbeCardsHandlers,
        SvtDbAgentNextWpProjectsHandlers,
    ],
})
export class SvtDbAgentNextHandlersModule {
}
