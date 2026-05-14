import { EpicAsic, EpicAsicCreate } from 'epic-ui/api'
import { EpicEnumsMock } from 'epic-ui/api/__mock__'
import { EpicAsicsStoreFacade } from 'epic-ui/shared/asics'
import { delay, Observable, of } from 'rxjs'


export namespace EpicAsicsStoreMock {

    export function getAsicsList(): EpicAsic[] {
        return [
            {
                id: 1,
                serialNumber: 'asic-1',
                waferId: 1,
                waferSerialNumber: 'Serial No. 1',
                familyType: 'Ancillary',
                waferMapPosition: '1_1',
                quality: EpicEnumsMock.getEnumsCollection().asicQuality[0],
            },
            {
                id: 2,
                serialNumber: 'asic-2',
                waferId: 1,
                waferSerialNumber: 'Serial No. 1',
                familyType: 'Ancillary',
                waferMapPosition: '1_2',
                quality: EpicEnumsMock.getEnumsCollection().asicQuality[0],
            },
            {
                id: 3,
                serialNumber: 'asic-3',
                waferId: 2,
                waferSerialNumber: 'Serial No. 2',
                familyType: 'Ancillary',
                waferMapPosition: '2_1',
                quality: EpicEnumsMock.getEnumsCollection().asicQuality[0],
            },
            {
                id: 4,
                serialNumber: 'asic-4',
                waferId: 2,
                waferSerialNumber: 'Serial No. 2',
                familyType: 'Ancillary',
                waferMapPosition: '2_2',
                quality: EpicEnumsMock.getEnumsCollection().asicQuality[0],
            },
        ]
    }


    export class EpicAsicsStoreFacadeMock extends EpicAsicsStoreFacade {

        protected asicsList = getAsicsList()

        protected override fetchAllAsicsList(waferId?: number): Observable<EpicAsic[]> {
            return of(waferId ? this.asicsList.filter(item => item.waferId === waferId) : this.asicsList)
                .pipe(
                    delay(500),
                )
        }

        protected override processDeleteOne(asicId: number): Observable<EpicAsic> {
            const refWafer = getAsicsList().find(item => item.id === asicId)!
            this.asicsList = this.asicsList.filter(item => item.id !== asicId)
            return of(refWafer)
                .pipe(
                    delay(500),
                )
        }

        protected override fetchOneAsic(asicId: number): Observable<EpicAsic | undefined> {
            const refWafer = this.asicsList.find(item => item.id === asicId)
            return of(refWafer)
                .pipe(
                    delay(500),
                )
        }

        protected override processCreate(createRequest: EpicAsicCreate): Observable<EpicAsic> {
            const newEntity: EpicAsic = {
                ...createRequest,
                id: this.asicsList.length ? this.asicsList[this.asicsList.length - 1].id + 1 : 1,
                waferSerialNumber: `Serial No. ${createRequest.waferId}`,
            }
            this.asicsList.push(newEntity)
            return of(newEntity)
                .pipe(
                    delay(500),
                )
        }

    }

}
