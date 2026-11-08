import { toQueryNumberArray, toQueryStringArray } from './epic-query-array.transforms'


describe('toQueryStringArray', () => {

    it('leaves an absent member absent', () => {
        expect(toQueryStringArray(undefined)).toBeUndefined()
        expect(toQueryStringArray(null)).toBeUndefined()
    })

    it('takes one value, a repeated key, comma-separated values and drops empty tokens', () => {
        expect(toQueryStringArray('MOSAIX')).toEqual(['MOSAIX'])
        expect(toQueryStringArray(['MOSAIX', 'LAS'])).toEqual(['MOSAIX', 'LAS'])
        expect(toQueryStringArray('MOSAIX, LAS,')).toEqual(['MOSAIX', 'LAS'])
        expect(toQueryStringArray(['MOSAIX,LAS', 'AncMPW2'])).toEqual(['MOSAIX', 'LAS', 'AncMPW2'])
    })

    it('takes the object qs makes of more than 20 items, in index order', () => {
        const overflow: Record<string, string> = {}
        for (let index = 0; index < 25; index++) {
            overflow[String(index)] = `v${index}`
        }

        expect(toQueryStringArray(overflow)).toEqual(Array.from({ length: 25 }, (_, index) => `v${index}`))
        expect(toQueryStringArray({ 10: 'b', 2: 'a' })).toEqual(['a', 'b'])
    })

    it('keeps any other object a single (invalid) item for the validator', () => {
        expect(toQueryStringArray({ name: 'x' })).toEqual(['[object Object]'])
    })

})

describe('toQueryNumberArray', () => {

    it('converts every token, leaving NaN for the validator', () => {
        expect(toQueryNumberArray('1,2')).toEqual([1, 2])
        expect(toQueryNumberArray(['3', 'x'])).toEqual([3, NaN])
        expect(toQueryNumberArray({ 0: '1', 1: '2' })).toEqual([1, 2])
    })

})
