import { FormControl } from '@angular/forms'


export class EpicSelectFormControl<TValue = string, TEnumValue = TValue> extends FormControl<TValue | null> {

    selectOptions: TEnumValue[] = []

}
