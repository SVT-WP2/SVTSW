// @vitest-environment node
import { generateChipBlocks } from './svt-db-chip-block-generation'


describe('generateChipBlocks', () => {

    it('names one block per block type as <blockType>_<chipSerialNumber>, in the given order', () => {
        expect(generateChipBlocks('AncMPW2-W1_0_0', ['AncMPW2_SLDO', 'AncMPW2_NVBG'])).toEqual([
            { blockType: 'AncMPW2_SLDO', serialNumber: 'AncMPW2_SLDO_AncMPW2-W1_0_0' },
            { blockType: 'AncMPW2_NVBG', serialNumber: 'AncMPW2_NVBG_AncMPW2-W1_0_0' },
        ])
    })

    it('yields nothing for a family type without block types', () => {
        expect(generateChipBlocks('C-1', [])).toEqual([])
    })

})
