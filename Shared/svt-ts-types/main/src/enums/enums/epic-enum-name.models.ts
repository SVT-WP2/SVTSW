/**
 * The enumerations the DB agent serves through `GET /api/enums`. Their *values* are data (configured in the DB),
 * which is why entity fields that hold one are typed `string` and only documented as "enum value of …".
 */
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
