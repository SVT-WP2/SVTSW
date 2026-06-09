import { Injectable } from '@nestjs/common'
import { EpicWpProbeCardEntity } from 'epic/entities'
import { delay, Observable, of } from 'rxjs'


@Injectable()
export class EpicDbAgentWpProbeCardsService {

    protected entities: EpicWpProbeCardEntity[] = [
        {
            id: 1,
            name: 'Probe Card #1',
            serialNumber: '123-123',
            vendor: 'Vendor Name',
            model: 'Model #1',
            location: 'CERN',
            arriveDate: '2025-05-01',
            type: 'Type #1',
            vendorCleaningInterval: 20,
        },
        {
            id: 2,
            name: 'Probe Card #2',
            serialNumber: '321-321',
            vendor: 'Vendor Name',
            model: 'Model #2',
            location: 'CERN',
            arriveDate: '2025-02-01',
            type: 'Type #2',
            vendorCleaningInterval: 20,
        },
    ]

    getAll(filter?: { ids?: number[] }): Observable<EpicWpProbeCardEntity[]> {
        const result = filter?.ids
            ? this.entities.filter(item => filter.ids.includes(item.id))
            : [...this.entities]
        return of(result)
            .pipe(
                delay(50),
            )
    }

}
