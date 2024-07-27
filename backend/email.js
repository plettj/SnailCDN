// Stores in process.env
import 'dotenv/config'

// Email dependencies
import nodemailer from 'nodemailer'
import Imap from 'imap'
import { simpleParser } from 'mailparser'
import fs from 'fs'

function sendEmail(subject, body) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'snailcdn@gmail.com',
            pass: process.env.GMAIL_APP_PASSWORD
        }
    })

    const mailOptions = {
        from: 'snailcdn@expitau.com',
        to: 'expitau@gmail.com',
        subject: subject,
        text: body
    }

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

async function fetchEmails() {
    const imap = new Imap({
        user: 'snailcdn@gmail.com',
        password: process.env.GMAIL_APP_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });

    return new Promise((resolve, reject) => {
        let emails = {}
        imap.once('ready', function () {
            imap.openBox('INBOX', true, function (err, box) {
                if (err) throw err;

                const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };

                imap.search([['SINCE', 'Jul 25, 2024']], function (err, results) {
                    if (err) throw err;

                    const f = imap.fetch(results, fetchOptions);

                    f.on('message', function (msg, seqno) {
                        let email = {}
                        msg.on('body', function (stream, info) {
                            var buffer = '';
                            stream.on('data', function (chunk) {
                                buffer += chunk.toString('utf8');
                            });
                            stream.once('end', function () {
                                if (info.which == "HEADER") {
                                    let headers = Imap.parseHeader(buffer)
                                    if (headers.subject && headers.subject[0]) {
                                        email.subject = headers.subject[0]
                                    }
                                    if (headers.from && headers.from[0]) {
                                        email.from = headers.from[0]
                                    }
                                }
                                if (info.which == "TEXT") {
                                    email.body = buffer
                                }
                            });
                            emails[seqno] = email
                        });
                        // msg.once('attributes', function (attrs) {
                        //     console.log('Attributes: %s', attrs);
                        // });
                        msg.once('end', function () {
                        });
                    });
                    f.once('error', function (err) {
                        reject(err);
                    });
                    f.once('end', function () {
                        resolve(Object.values(emails))
                        imap.end();
                    });
                });
            });
        });

        imap.connect();
    })
}



// sendEmail('Hello', 'Hello World')
// fetchEmails().then(emails => {
//     emails.forEach(email => {
//         console.log("-------------------------------------------------------------")
//         console.log(email.from)
//         console.log(email.subject)
//         console.log(email.body)
//     })
// })
