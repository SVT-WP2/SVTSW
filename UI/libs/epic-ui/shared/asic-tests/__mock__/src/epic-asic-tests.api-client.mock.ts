import { EpicAsicTestType, EpicAsicTestTypesApiClient } from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'


export function getMockEpicAsicTestTypesList(): EpicAsicTestType[] {
    return [
        {
            id: 1,
            name: 'Contact Test',
        },
        {
            id: 2,
            name: 'Voltage Scan',
        },
        {
            id: 3,
            name: 'Threshold Scan',
        },
        {
            id: 4,
            name: 'Noise Scan',
        },
        {
            id: 5,
            name: 'Register Scan',
        },
    ]
}

export class EpicAsicTestTypesApiClientMock extends EpicAsicTestTypesApiClient {

    protected entitiesList = getMockEpicAsicTestTypesList()

    override fetchAll(): Observable<EpicAsicTestType[]> {
        return of(this.entitiesList)
            .pipe(
                delay(100),
            )
    }

}
