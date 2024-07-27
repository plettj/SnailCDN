import jayson from 'jayson'
import fs from 'fs'
import { sendEmail, fetchEmails } from './email.js'

// Read from data.json file
function readData() {
    let data
    try {
        data = JSON.parse(fs.readFileSync('backend/data.json'))
    } catch (e) {
        data = {
            requests: [
                // {
                //     key: ['website1', 'website2'],
                //     email: 'requestee@gmail.com',
                //     requestedAt: '2024-07-25T00:00:00.000Z'
                // }
            ],
            content: [
                // {
                //     key: "website1",
                //     content: "This is the content of website1",
                // }
            ]
        }
        if (e.code === 'ENOENT') {
            writeData(data)
        }
    }
    return data
}

function writeData(data) {
    fs.writeFileSync('backend/data.json', JSON.stringify(data))
}

function addToQueue(request) {
    let data = readData()
    data.requests.push(request)

    data.requests = Object.values(data.requests.reduce((acc, curr) => {
        // If there are multiple requests from the same email, combine them
        acc[curr.email] ??= { key: [], email: curr.email, requestedAt: curr.requestedAt }
        acc[curr.email].key = Array.from(new Set([...acc[curr.email].key, ...curr.key]))
        if (acc[curr.email].requestedAt > curr.requestedAt) {
            acc[curr.email].requestedAt = curr.requestedAt
        }
        return acc
    }, {}))
    writeData(data)
}

function pollEmails() {
    console.log("Polling...")
    fetchEmails().then(emails => {
        let data = readData()
        data.content = emails.map((email) => {
            return {
                key: email.subject,
                content: email.body,
            }
        })
        writeData(data)
    })
}

function sendEmails() {
    console.log("Sending emails...")
    let data = readData()
    data.requests.forEach((request) => {
        // If the request was made under 5 minutes ago, don't send the email
        if (request.requestedAt + 5 * 60 * 1000 > new Date()) return

        console.log(request)
        let contents = data.content.filter((c) => request.key.includes(c.key))
        console.log("FOUND CONTENTS", contents)
        for (let content of contents) {
            console.log("Sending email to", request.email)
            sendEmail(request.email, "Your website is ready!", content.content)
        }
    })
    data.requests = data.requests.filter((request) => request.requestedAt + 5 * 60 * 1000 > new Date())
    writeData(data)
}

setInterval(pollEmails, 30000)
setInterval(sendEmails, 5000)

function normalizeEmail(email) {
    return email.replace(/^\s*/g, '').replace(/\s*$/g, '')
}

const methods = {
    browseContent: (args, callback) => {
        let data = readData()
        console.log(data)
        if (args && args[0]) {
            callback(null, data.content.filter((c) => c.content.includes(args[0])))
        } else {
            callback(null, data.content)
        }
    },
    addRequest: (args, callback) => {
        if (!args) {
            callback({ code: 400, message: 'Arguments are required' })
            return
        }
        if (!args[0]) {
            callback({ code: 400, message: 'Key is required' })
            return
        }
        if (!args[1]) {
            callback({ code: 400, message: 'Email is required' })
            return
        }

        addToQueue({ key: [args[0]], email: normalizeEmail(args[1]), requestedAt: new Date() })
        callback(null, 'Request received')
    }
}

const server = new jayson.server(methods)

server.http().listen(3000, () => {
    console.log('JSON-RPC server started on http://localhost:3000')
})
