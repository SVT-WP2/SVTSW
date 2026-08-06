export namespace EpicChipBlocksListQuery {

    /**
     * Mirrors the `GetAllChipBlocks` filter of the Kafka contract. Note there is no `serialNumber` filter —
     * narrowing a chip block list by serial number has to happen client side.
     */
    export type QueryFilter = {
        ids?: number[]
        chipId?: number | null
        blockTypes?: string[] | null
    }

}
