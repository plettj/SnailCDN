import express from 'express';
import fs from 'fs';
import { sendEmail, fetchEmails } from './email.js';
import crypto from 'crypto';
import path from 'path'
import cors from 'cors'
import { fileURLToPath } from 'url';

const FRONTEND_URL = `http://expitau.com/SnailCDN`
const DATA_PATH = 'data/data.json'
// Read from data.json file
function readData() {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
    } catch (e) {
        data = {
            requests: [],
            content: []
        };
        if (e.code === 'ENOENT') {
            writeData(data);
        }
    }
    return data;
}

function writeData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data));
}

function encodeBase64(input) {
    return Buffer.from(input).toString('base64');
}

function decodeBase64(input) {
    if (input == undefined) return undefined;
    return Buffer.from(input, 'base64').toString('utf-8');
}

function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function pollEmails() {
    console.log("Polling...");
    fetchEmails().then(emails => {
        let data = readData();
        data.content = emails.map((email) => {
            return {
                key: email.subject,
                content: email.body,
            };
        });
        writeData(data);
    });
}

function sendEmails() {
    console.log("Sending emails...");
    let data = readData();
    data.requests.forEach((request) => {
        // If the request was made under 7 days ago, don't send the email
        if (new Date(request.requestedAt).valueOf() + 7 * 24 * 60 * 60 * 1000 > new Date().valueOf()) return;


        console.log(request);
        let responseLinks = request.key.filter((key) => data.content.some(c => c.key == key)).map((key) => {
            return `${FRONTEND_URL}/?key=${sha256(key)}`;
        }).join('\n')
        let response = `Your SnailCDN content is ready! Here are your access links (only available 9am-5pm on business days):
${responseLinks}

Thank you for using SnailCDN!

Love and kisses,
SnailCDN xoxo <3
        `;
        console.log("Sending email to", request.email);
        sendEmail(request.email, "Your content is ready!", response);
    });
    data.requests = data.requests.filter((request) => new Date(request.requestedAt).valueOf() + 5 * 60 * 1000 > new Date().valueOf());
    writeData(data);
}

function normalizeEmail(email) {
    return email.replace(/^\s*/g, '').replace(/\s*$/g, '');
}

const app = express();
app.use(express.json()) 
app.use(cors());

app.get('/api/content', (req, res) => {
    console.log("API CONTENT")
    let data = readData();
    const query = req.query.q;
    let content = data.content
    if (query) {
        content = data.content.filter((c) => c.content.includes(query))
    }
    res.json(content.map(c => c.key));
});

app.post('/api/subscribe', (req, res) => {
    console.log(req.body)
    const { key, email } = req.body;
    if (!key) {
        res.status(400).json('Key is required');
        return;
    }
    if (!email) {
        res.status(400).json('Email is required');
        return;
    }

    let data = readData();
    data.requests.push({ key: [key], email: normalizeEmail(email), requestedAt: new Date() });

    // If there are multiple requests from the same email, combine them
    data.requests = Object.values(data.requests.reduce((acc, curr) => {
        acc[curr.email] ??= { key: [], email: curr.email, requestedAt: curr.requestedAt };
        acc[curr.email].key = Array.from(new Set([...acc[curr.email].key, ...curr.key]));
        if (acc[curr.email].requestedAt > curr.requestedAt) {
            acc[curr.email].requestedAt = curr.requestedAt;
        }
        return acc;
    }, {}));

    writeData(data);
    res.json('Request received');
});

app.get('/api/subscriptions', (req, res) => {
    const { email } = req.query;
    if (!email) {
        res.status(400).json('Email is required');
        return;
    }

    let data = readData();
    let requests = data.requests.filter((r) => r.email === normalizeEmail(email));
    if (requests.length === 0) {
        res.status(404).json('No requests found');
        return;
    }
    res.json(requests[0].key);
})

app.post('/api/upload', (req, res) => {
    const { key, content } = req.body;
    if (!key) {
        res.status(400).json('Key is required');
        return;
    }
    if (!content) {
        res.status(400).json('Content is required');
        return;
    }

    let data = readData();
    data.content = data.content.filter(c => c.key !== key);
    data.content.push({ key: key, content: encodeBase64(content) });
    writeData(data);
    res.json('Content uploaded');
});

app.get('/api/visit/:key', (req, res) => {
    const key = req.params.key;
    if (!key || key.length < 2) {
        res.status(400).json('Key is required');
        return;
    }

    let data = readData();
    let page = decodeBase64(data.content.filter((c) => sha256(c.key).startsWith(key))[0]?.content)
    if (!page) {
        res.status(404).json('Page not found');
        return;
    }

    // Get current time, see if is between 9am and 5pm on a business day
    const now = new Date();
    // if (now.getDay() == 0 || now.getDay() == 6 || now.getHours() < 9 || now.getHours() >= 17) {
    //     res.status(451).json("Sorry, you can only access this content between 9am and 5pm on business days");
    //     return
    // }

    res.json(page);
});

app.get('/api', (req, res) => {
    res.status(404).json('Not found');
});

app.get('/api/*', (req, res) => {
    res.status(404).json('Not found');
});

// Send all requests to the index.html
// app.get('*', (req, res) => {
//     res.sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '../frontend', 'index.html'));
// });

// setInterval(pollEmails, 30000);
setInterval(sendEmails, 10000);

app.listen(3000, () => {
    console.log('REST API server started on http://localhost:3000');
});
