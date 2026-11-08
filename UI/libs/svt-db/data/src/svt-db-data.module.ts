import { Module } from '@nestjs/common'

import { SvtDbAsicsRepository } from './asics'
import { SvtDbChipBlocksRepository, SvtDbChipsRepository } from './chips'
import { SvtDbEnumsService } from './enums'
import { SvtDbWaferTypesRepository } from './wafer-types'
import { SvtDbWafersRepository } from './wafers'


const PROVIDERS = [
    SvtDbEnumsService,
    SvtDbWaferTypesRepository,
    SvtDbWafersRepository,
    SvtDbAsicsRepository,
    SvtDbChipsRepository,
    SvtDbChipBlocksRepository,
]

/**
 * The repositories and services of the data layer, for the application's handler modules. Needs
 * `SvtDbOrmModule.forRoot` (global) for the `EntityManager`. Each slice appends its repository.
 */
@Module({
    providers: PROVIDERS,
    exports: PROVIDERS,
})
export class SvtDbDataModule {
}
