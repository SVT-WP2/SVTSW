// @vitest-environment node
import { parseUserIdHeader } from './svt-db-agent-next-request-headers'


describe('parseUserIdHeader', () => {

    it('reads a decimal string of a positive integer of the range of SvtUser.id', () => {
        expect(parseUserIdHeader('1')).toBe(1)
        expect(parseUserIdHeader('42')).toBe(42)
        expect(parseUserIdHeader('2147483647')).toBe(2147483647)
    })

    it('refuses every other value', () => {
        const refused = [
            '', '0', '-1', '+1', '1.5', '1e3', '0x1', ' 42', '42 ', '4 2', '042', '00', 'abc', '42abc', '١٢',
            '2147483648', '9999999999', '10000000000', '42\n', '4,2',
        ]
        for (const value of refused) {
            expect(parseUserIdHeader(value), JSON.stringify(value)).toBeUndefined()
        }
    })

})
