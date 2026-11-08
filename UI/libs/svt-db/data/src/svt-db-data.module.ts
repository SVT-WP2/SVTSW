import { Module } from '@nestjs/common'

import { SvtDbAsicsRepository } from './asics'
import { SvtDbEnumsService } from './enums'
import { SvtDbWaferTypesRepository } from './wafer-types'
import { SvtDbWafersRepository } from './wafers'


const PROVIDERS = [
    SvtDbEnumsService,
    SvtDbWaferTypesRepository,
    SvtDbWafersRepository,
    SvtDbAsicsRepository,
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
