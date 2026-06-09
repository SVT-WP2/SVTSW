export enum EpicEnumName {
    asicFamilyType = 'asicFamilyType',
    engineeringRun = 'engineeringRun',
    foundryName = 'foundryName',
    waferTech = 'waferTech',
    waferMapOrientation = 'waferMapOrientation',
    wpGeneralLocation = 'wpGeneralLocation',
    wpConnectionType = 'wpConnectionType',
    wpVendor = 'wpVendor',
    wpSwType = 'wpSwType',
    waferInMachineStatus = 'waferInMachineStatus',
    asicQuality = 'asicQuality',
    pcVendor = 'pcVendor',
    pcName = 'pcName',
    pcModel = 'pcModel',
    pcLocation = 'pcLocation',
    pcType = 'pcType',
    dutType = 'dutType',
    blockType = 'blockType',
}

export type EpicEnumsCollection = Record<EpicEnumName, string[]>
