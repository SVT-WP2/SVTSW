import { AnyEntity, EntityName } from '@mikro-orm/core'
import { MikroOrmModule, MikroOrmModuleOptions } from '@mikro-orm/nestjs'
import { PostgreSqlDriver } from '@mikro-orm/postgresql'
import { DynamicModule, InjectionToken, Module, OptionalFactoryDependency, Provider } from '@nestjs/common'

import { SVT_DB_ORM_CONFIG, SvtDbOrmConfig } from './models'
import { SvtDbOrmConfigService } from './services'
import { buildSvtDbOrmOptions, SvtDbOrmEntities } from './svt-db-orm-options'


export type SvtDbOrmModuleOptions = {
    /** Produces the connection configuration, typically from the application's `ConfigService`. */
    useFactory: (...args: any[]) => SvtDbOrmConfig | Promise<SvtDbOrmConfig>
    inject?: (InjectionToken | OptionalFactoryDependency)[]
    /** The full entity list of the database (`SVT_DB_ENTITIES` from `../data`). */
    entities: SvtDbOrmEntities
}

/**
 * MikroORM for the SVT database, wrapped the way rentaly's `DatabaseModule` does it: the application
 * supplies the configuration through a factory, this module turns it into `MikroOrmModule.forRootAsync`.
 *
 * No request context middleware is registered (`registerRequestContext: false`): the agent has no HTTP
 * request per unit of work, so every Kafka handler opens its own context (`@CreateRequestContext()`).
 */
@Module({})
export class SvtDbOrmModule {

    static forRoot(options: SvtDbOrmModuleOptions): DynamicModule {
        const configProvider: Provider = {
            provide: SVT_DB_ORM_CONFIG,
            useFactory: options.useFactory,
            inject: options.inject ?? [],
        }

        return {
            module: SvtDbOrmModule,
            global: true,
            imports: [
                MikroOrmModule.forRootAsync({
                    providers: [configProvider, SvtDbOrmConfigService],
                    inject: [SvtDbOrmConfigService],
                    useFactory: (configService: SvtDbOrmConfigService): MikroOrmModuleOptions => ({
                        ...buildSvtDbOrmOptions(configService.getConfig(), options.entities),
                        registerRequestContext: false,
                    }),
                    // Required next to useFactory so the module can import the driver-specific EntityManager.
                    driver: PostgreSqlDriver,
                }),
            ],
            providers: [configProvider, SvtDbOrmConfigService],
            exports: [SvtDbOrmConfigService],
        }
    }

    /** Repositories of the given entities for a feature module (`@InjectRepository`). */
    static forFeature(entities: EntityName<AnyEntity>[]): DynamicModule {
        return MikroOrmModule.forFeature(entities)
    }

}
