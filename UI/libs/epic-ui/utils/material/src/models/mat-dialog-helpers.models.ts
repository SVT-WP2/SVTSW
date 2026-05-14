import { Type } from '@angular/core'
import {
    MatDialog,
    MatDialogConfig,
    MatDialogRef,
} from '@angular/material/dialog'
import { EpicRecord } from 'epic-ui/utils'


export namespace MatDialogHelpers {

    export enum DialogSize {
        Small = 'Small',
        Medium = 'Medium',
        Large = 'Large',
        FullScreen = 'FullScreen',
    }

    export function getDialogSizeConfig(dialogSize: DialogSize): Partial<MatDialogConfig> {
        switch (dialogSize) {
            case MatDialogHelpers.DialogSize.Small:
                return {
                    width: '568px',
                    maxWidth: '95vw',
                }
            case MatDialogHelpers.DialogSize.Medium:
                return {
                    width: '960px',
                    maxWidth: '95vw',
                }
            case MatDialogHelpers.DialogSize.Large:
                return {
                    width: '1344px',
                    maxWidth: '95vw',
                }
            case MatDialogHelpers.DialogSize.FullScreen:
                return {
                    width: '95vw',
                    maxWidth: '95vw',
                    height: '95vh',
                }
        }
    }

    export function getFullHeightConfig(dialogSize: DialogSize = DialogSize.Medium): MatDialogConfig {
        return {
            ...getDefaultConfig(dialogSize),
            height: '95vh',
        }
    }


    export function getDefaultConfig(dialogSize: DialogSize = DialogSize.Small): MatDialogConfig {
        return {
            closeOnNavigation: true,
            disableClose: true,
            autoFocus: false,
            ...getDialogSizeConfig(dialogSize),
        }
    }

    export function getDefaultFullScreenDialogConfig(): MatDialogConfig {
        return {
            ...getFullHeightConfig(DialogSize.Large),
        }
    }

    export function calculateDialogConfig<TData extends EpicRecord = EpicRecord>(
        data: TData,
        defaultConfig: MatDialogConfig = getDefaultConfig(),
        config?: MatDialogConfig<TData>,
    ): MatDialogConfig<TData> {

        let dialogConfig: any = {
            ...defaultConfig,
            data,
        }

        if (config) {
            dialogConfig = {
                ...dialogConfig,
                ...config,
            }
        }
        return dialogConfig as MatDialogConfig<TData>
    }

    export function openDialog<TComponent, TData extends EpicRecord = EpicRecord, TResult = any>(
        matDialog: MatDialog,
        componentType: Type<TComponent>,
        data: TData,
        defaultConfig: MatDialogConfig = getDefaultConfig(),
        config?: MatDialogConfig<TData>,
    ): MatDialogRef<TComponent, TResult> {

        const dialogConfig = calculateDialogConfig<TData>(
            data,
            { ...defaultConfig },
            config,
        )

        return matDialog.open(componentType, dialogConfig)
    }

}
