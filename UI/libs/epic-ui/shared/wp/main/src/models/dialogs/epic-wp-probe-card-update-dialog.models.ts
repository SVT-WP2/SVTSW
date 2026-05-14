import { EpicWpProbeCardUpdateForm } from '../forms'

import Form = EpicWpProbeCardUpdateForm


export namespace EpicWpProbeCardUpdateDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
        isClone?: boolean
    }

}
