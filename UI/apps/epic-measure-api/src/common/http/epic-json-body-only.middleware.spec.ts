// @vitest-environment node
import { Server } from 'node:http'
import { AddressInfo } from 'node:net'

import express from 'express'

import { EPIC_JSON_BODY_ONLY_MESSAGE, epicJsonBodyOnlyMiddleware } from './epic-json-body-only.middleware'


describe('epicJsonBodyOnlyMiddleware', () => {

    let server: Server
    let baseUrl: string
    const reached = vi.fn()

    beforeAll(async () => {
        const app = express()
        app.use(epicJsonBodyOnlyMiddleware)
        app.use(express.json())
        app.use(express.urlencoded({ extended: true }))
        app.all('/target', (request, response) => {
            reached(request.body)
            response.status(200).json({ ok: true })
        })
        server = app.listen(0, '127.0.0.1')
        await new Promise((resolve) => server.once('listening', resolve))
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterAll(() => new Promise((resolve) => server.close(resolve)))

    beforeEach(() => reached.mockClear())

    function send(method: string, body?: string, contentType?: string): Promise<Response> {
        return fetch(`${baseUrl}/target`, {
            method,
            headers: contentType ? { 'content-type': contentType } : {},
            body,
        })
    }

    it.each([
        ['application/x-www-form-urlencoded', 'login=evil&role=Admin&password=evil-password'],
        ['multipart/form-data; boundary=x', '--x\r\nContent-Disposition: form-data; name="login"\r\n\r\nevil\r\n--x--\r\n'],
        ['text/plain', '{"login":"evil","role":"Admin"}'],
    ])('answers 415 to a body of %s, before any route', async (contentType, body) => {
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            const response = await send(method, body, contentType)

            expect(response.status, method).toBe(415)
            expect(await response.json())
                .toEqual({ statusCode: 415, message: EPIC_JSON_BODY_ONLY_MESSAGE, error: 'Unsupported Media Type' })
        }
        expect(reached).not.toHaveBeenCalled()
    })

    it('answers 415 to a body without a Content-Type', async () => {
        const response = await fetch(`${baseUrl}/target`, { method: 'POST', body: new Uint8Array([123, 125]) })

        expect(response.status).toBe(415)
        expect(reached).not.toHaveBeenCalled()
    })

    it('lets a JSON body through, also with a charset', async () => {
        expect((await send('POST', '{"name":"x"}', 'application/json')).status).toBe(200)
        expect((await send('PATCH', '{"name":"x"}', 'application/json; charset=utf-8')).status).toBe(200)

        expect(reached).toHaveBeenNthCalledWith(1, { name: 'x' })
    })

    it('lets a request without a body through (the log-out), and every GET', async () => {
        expect((await send('POST')).status).toBe(200)
        expect((await send('GET')).status).toBe(200)
        expect((await send('POST', '', 'application/x-www-form-urlencoded')).status).toBe(200)

        expect(reached).toHaveBeenCalledTimes(3)
    })

})
