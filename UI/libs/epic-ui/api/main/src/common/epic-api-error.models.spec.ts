import { HttpErrorResponse } from '@angular/common/http'

import { EPIC_API_DEFAULT_ERROR_MESSAGE, toEpicApiErrorMessage } from './epic-api-error.models'


describe('toEpicApiErrorMessage', () => {

    const response = (error: unknown, status = 400) => new HttpErrorResponse({ status, error })

    it('answers the message of the BFF, as the DB agent wrote it', () => {
        expect(toEpicApiErrorMessage(response({ statusCode: 400, message: 'The installation must keep one active Admin' })))
            .toBe('The installation must keep one active Admin')
    })

    it('joins the messages of the validation', () => {
        expect(toEpicApiErrorMessage(response({ statusCode: 400, message: ['password must be longer', 'role must be one of'] })))
            .toBe('password must be longer; role must be one of')
    })

    it('answers the fallback without a message: no answer, no body, not an HTTP error', () => {
        expect(toEpicApiErrorMessage(response(null, 0))).toBe(EPIC_API_DEFAULT_ERROR_MESSAGE)
        expect(toEpicApiErrorMessage(response({ statusCode: 500 }, 500))).toBe(EPIC_API_DEFAULT_ERROR_MESSAGE)
        expect(toEpicApiErrorMessage(new Error('boom'), 'Other text')).toBe('Other text')
    })

})
