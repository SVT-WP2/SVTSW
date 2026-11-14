import { EntityCaseNamingStrategy, NamingStrategy } from '@mikro-orm/postgresql'


type IndexType = Parameters<NamingStrategy['indexName']>[2]

/**
 * `EntityCaseNamingStrategy` (property names are the column names, as the database's quoted camelCase
 * identifiers require) plus PostgreSQL's own constraint names: `<table>_pkey`, `<table>_<columns>_key`,
 * `<table>_<columns>_fkey`. The existing schema was created with those defaults, so with this strategy the
 * schema diff is empty without naming every constraint by hand. Indexes created with `CREATE INDEX`
 * (`<table>_<columns>_idx`) still need an explicit name.
 */
export class SvtDbNamingStrategy extends EntityCaseNamingStrategy {

    override indexName(tableName: string, columns: string[], type: IndexType): string {
        const table = tableName.includes('.') ? tableName.substring(tableName.indexOf('.') + 1) : tableName
        const joinedColumns = columns.map((column) => column.replace(/\./g, '_')).join('_')
        switch (type) {
            case 'foreign':
                return `${table}_${joinedColumns}_fkey`
            case 'unique':
                return `${table}_${joinedColumns}_key`
            default:
                return super.indexName(tableName, columns, type)
        }
    }

}
