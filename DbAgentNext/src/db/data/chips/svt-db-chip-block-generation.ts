export type SvtDbGeneratedChipBlock = {
    blockType: string
    serialNumber: string
}

/**
 * The blocks of a new chip: one per block type listed for the chip's ASIC family type in
 * `AsicFamilyTypeBlockList`, serial number `<blockType>_<chipSerialNumber>`.
 *
 * This is the rule of the C++ `createChip` (`DbAgent/docs/05-request-handlers.md` §5), which never ran there
 * (Q-H5), and the three hand-made dev rows use a different name (`SLDO_AncMPW2-W1_0_0`, family prefix
 * stripped). No naming is defined yet (Q6, `docs/01-behaviour-decisions.md` §3), so the generation stays
 * behind `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS`.
 */
export function generateChipBlocks(chipSerialNumber: string, blockTypes: readonly string[]): SvtDbGeneratedChipBlock[] {
    return blockTypes.map((blockType) => ({ blockType, serialNumber: `${blockType}_${chipSerialNumber}` }))
}
