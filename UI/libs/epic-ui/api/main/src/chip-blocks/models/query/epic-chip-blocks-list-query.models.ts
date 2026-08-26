export namespace EpicChipBlocksListQuery {

    /**
     * Mirrors the `GetAllChipBlocks` filter of the Kafka contract.
     */
    export type QueryFilter = {
        ids?: number[]
        chipId?: number | null
        chipBlockTypes?: string[] | null
        serialNumber?: string | null
    }

}
