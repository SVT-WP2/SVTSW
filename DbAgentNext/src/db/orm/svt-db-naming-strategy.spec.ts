// @vitest-environment node
import { SvtDbNamingStrategy } from './svt-db-naming-strategy'


describe('SvtDbNamingStrategy', () => {

    const strategy = new SvtDbNamingStrategy()

    it('keeps property names as column names and class names as table names', () => {
        expect(strategy.propertyToColumnName('waferTypeId')).toBe('waferTypeId')
        expect(strategy.classToTableName('SvtDbWaferTypeEntity')).toBe('SvtDbWaferTypeEntity')
    })

    it('names constraints the way PostgreSQL does by default', () => {
        expect(strategy.indexName('WaferType', ['id'], 'primary')).toBe('WaferType_pkey')
        expect(strategy.indexName('WaferType', ['name'], 'unique')).toBe('WaferType_name_key')
        expect(strategy.indexName('WaferTypeMap', ['waferTypeId'], 'foreign')).toBe('WaferTypeMap_waferTypeId_fkey')
        expect(strategy.indexName('AsicFamilyTypeBlockList', ['asicFamilyType', 'blockType'], 'primary'))
            .toBe('AsicFamilyTypeBlockList_pkey')
        expect(strategy.indexName('main.WaferType', ['name', 'foundry'], 'unique')).toBe('WaferType_name_foundry_key')
    })

    it('leaves plain indexes and sequences to the default naming', () => {
        expect(strategy.indexName('Wafer', ['waferTypeId'], 'index')).toBe('Wafer_waferTypeId_index')
        expect(strategy.indexName('Wafer', ['id'], 'sequence')).toBe('Wafer_id_seq')
    })

})
