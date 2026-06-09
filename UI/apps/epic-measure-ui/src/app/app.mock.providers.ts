import { Provider } from '@angular/core'
import {
    EpicAsicsApiClient,
    EpicAsicTestTypesApiClient,
    EpicChipsApiClient,
    EpicEnumsApiClient,
    EpicEquipmentApiClient,
    EpicEquipmentTypesApiClient,
    EpicSvtTestSetupConfigsApiClient,
    EpicSvtTestSetupsApiClient,
    EpicSvtTestTemplatesApiClient,
    EpicSvtTestTypeConfigsApiClient,
    EpicSvtTestTypesApiClient,
    EpicWafersApiClient,
    EpicWaferTestsApiClient,
    EpicWaferTypesApiClient,
    EpicWpMachinesApiClient,
    EpicWpProbeCardsApiClient,
    EpicWpProjectsApiClient,
} from 'epic-ui/api'
import {
    EpicAsicsApiClientMock,
    EpicChipsApiClientMock,
    EpicEnumsApiClientMock,
    EpicEquipmentApiClientMock,
    EpicEquipmentTypesApiClientMock,
    EpicSvtTestSetupConfigsApiClientMock,
    EpicSvtTestSetupsApiClientMock,
    EpicSvtTestTemplatesApiClientMock,
    EpicSvtTestTypeConfigsApiClientMock,
    EpicSvtTestTypesApiClientMock,
    EpicWafersApiClientMock,
    EpicWaferTypesApiClientMock,
    EpicWpMachinesApiClientMock,
    EpicWpProbeCardsApiClientMock,
    EpicWpProjectsApiClientMock,
} from 'epic-ui/api/__mock__'
import { EpicAsicTestTypesApiClientMock } from 'epic-ui/shared/asic-tests/__mock__'
import { EpicWaferTestsApiClientMock } from 'epic-ui/shared/wafer-tests/__mock__'


export function provideMockData(): Provider[] {
    return [
        {
            provide: EpicWafersApiClient,
            useClass: EpicWafersApiClientMock,
        },
        {
            provide: EpicAsicsApiClient,
            useClass: EpicAsicsApiClientMock,
        },
        {
            provide: EpicWaferTypesApiClient,
            useClass: EpicWaferTypesApiClientMock,
        },
        {
            provide: EpicAsicTestTypesApiClient,
            useClass: EpicAsicTestTypesApiClientMock,
        },
        {
            provide: EpicWaferTestsApiClient,
            useClass: EpicWaferTestsApiClientMock,
        },
        {
            provide: EpicWpMachinesApiClient,
            useClass: EpicWpMachinesApiClientMock,
        },
        {
            provide: EpicWpProbeCardsApiClient,
            useClass: EpicWpProbeCardsApiClientMock,
        },
        {
            provide: EpicWpProjectsApiClient,
            useClass: EpicWpProjectsApiClientMock,
        },
        {
            provide: EpicEnumsApiClient,
            useClass: EpicEnumsApiClientMock,
        },
        {
            provide: EpicChipsApiClient,
            useClass: EpicChipsApiClientMock,
        },
        {
            provide: EpicEquipmentTypesApiClient,
            useClass: EpicEquipmentTypesApiClientMock,
        },
        {
            provide: EpicEquipmentApiClient,
            useClass: EpicEquipmentApiClientMock,
        },
        {
            provide: EpicSvtTestSetupsApiClient,
            useClass: EpicSvtTestSetupsApiClientMock,
        },
        {
            provide: EpicSvtTestSetupConfigsApiClient,
            useClass: EpicSvtTestSetupConfigsApiClientMock,
        },
        {
            provide: EpicSvtTestTypesApiClient,
            useClass: EpicSvtTestTypesApiClientMock,
        },
        {
            provide: EpicSvtTestTypeConfigsApiClient,
            useClass: EpicSvtTestTypeConfigsApiClientMock,
        },
        {
            provide: EpicSvtTestTemplatesApiClient,
            useClass: EpicSvtTestTemplatesApiClientMock,
        },
    ]
}
