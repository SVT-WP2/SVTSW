import { EpicChipCreateWithFileForm } from '../../forms'

import Form = EpicChipCreateWithFileForm


export namespace EpicChipCreateWithFileDialog {

    export type Data = {
        formData?: Partial<Form.FormData>
    }

}
