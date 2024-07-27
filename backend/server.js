import jayson from 'jayson'
import fs from 'fs'

// Read from data.json file
function readData() {
    let data
    try {
        data = JSON.parse(fs.readFileSync('backend/data.json'))
    } catch (e) {
        data = {
            requests: [],
            content: {}
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
        acc[curr.email] ??= {key: [], email: curr.email, requestedAt: curr.requestedAt}
        acc[curr.email].key = Array.from(new Set([...acc[curr.email].key, ...curr.key]))
        if (acc[curr.email].requestedAt > curr.requestedAt) {
            acc[curr.email].requestedAt = curr.requestedAt
        }
        return acc
    }, {}))
    writeData(data)
}

function addToContent(key, content) {
    let data = readData()
    data.content[key] = content
    writeData(data)
}

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
        console.log(args)
        if (!args) {
            callback({code: 400, message: 'Arguments are required'})
            return
        }
        if (!args[0]) {
            callback({code: 400, message: 'Key is required'})
            return
        }
        if (!args[1]) {
            callback({code: 400, message: 'Email is required'})
            return
        }

        addToQueue({key: [args[0]], email: args[1], requestedAt: new Date()})
        callback(null, 'Request received')
    }
}

const server = new jayson.server(methods)

server.http().listen(3000, () => {
    console.log('JSON-RPC server started on http://localhost:3000')
})
