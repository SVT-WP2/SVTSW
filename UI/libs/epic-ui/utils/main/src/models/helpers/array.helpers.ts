import * as fromCdkDragAndDrop from '@angular/cdk/drag-drop'
import { isNil } from 'lodash-es'


export namespace ArrayHelpers {

    export function upsertArrayItem<T>(
        arr: T[],
        newItem: T,
        index?: number): T[] {

        if (index === undefined) {
            return [...arr, newItem]
        }

        return arr
            .map((item, currentIndex) => {
                if (currentIndex === index) {
                    return newItem
                }
                return item
            })

    }

    /** @returns A new array instance with applied modifications **/
    export function moveItemInArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
        const newValuesOrder = [...arr]
        fromCdkDragAndDrop.moveItemInArray<T>(newValuesOrder, fromIndex, toIndex)
        return newValuesOrder
    }

    export function toArrayValue<T = unknown>(value: T | T[] | null, isArray = false): T[] {
        const isEmptyValue = isNil(value)

        if (isEmptyValue) {
            return []
        }

        return isArray ? value as T[] : [value as T]
    }

}
