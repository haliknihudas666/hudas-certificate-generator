const { promises: fs, mkdirSync, existsSync, createReadStream, createWriteStream } = require('fs')

require('dotenv').config();
const { createTransport } = require('nodemailer');
const { registerFont, createCanvas, loadImage } = require('canvas');
const csv = require('csv-parser');
const inquirer = require('inquirer');

const extractedCSV = [];

let message;
let certInfo;
let emailInfo;

let certPrompts = [{
    type: "input",
    name: "csvFilePath",
    message: "Please enter the filepath of your csv",
},
{
    type: "input",
    name: "certFilePath",
    message: "Please enter the filepath of your png image cert",
},
];

let emailPrompts = [{
    type: "input",
    name: "emailSubject",
    message: "Please enter your email subject",
},
{
    type: "input",
    name: "messageFilePath",
    message: "Please enter the filepath of your email message txt file",
},
];

async function main() {
    certInfo = await inquirer.prompt(certPrompts);

    createReadStream(certInfo.csvFilePath)
        .pipe(csv())
        .on('data', (data) => extractedCSV.push(data));

    let answer = await inquirer.prompt({
        type: "list",
        name: "type",
        message: "Do you want to generate certificate locally or generate certificate and automatically send to their emails?",
        choices: ["Generate Locally", "Generate and send email automatically"]
    });

    if (answer.type === "Generate Locally") {
        for (var index in extractedCSV) {
            await createCert(capitalizeEachWord(extractedCSV[index].name), 'local')
        }
    } else {
        emailInfo = await inquirer.prompt(emailPrompts);
        sendEmail();
    }
}

main();

async function readMessageTxt() {
    let file = await fs.readFile(emailInfo.messageFilePath, 'utf8');
    message = file;
}

async function sendEmail() {
    await readMessageTxt();
    //Login your email
    let transporter = createTransport({
        //TODO Change this service if you need to. Check this docs https://nodemailer.com/smtp/well-known/
        service: "Outlook365",
        //TODO You can comment out the service above and use the below options for custom smtp server. Check this docs https://nodemailer.com/smtp/
        // host: "smtp.office365.com",
        // port: 587,
        // secure: false,
        // tls: { ciphers: 'SSLv3' }
        //TODO To change this go to .env
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS,
        },
    });

    //Send to receivers from csv file
    for (var index in extractedCSV) {
        try {
            await transporter.sendMail({
                //TODO Change this to sender name
                from: `"Nicolei Esperida" <${process.env.EMAIL}>`,
                to: extractedCSV[index].email,
                //TODO Change email subject
                subject: emailInfo.emailSubject,
                //This is our whole email body with greetings
                text: `Hello ${capitalizeEachWord(extractedCSV[index].name)},\n\n` + message,
                attachments: [
                    {
                        filename: `${capitalizeEachWord(extractedCSV[index].name)}.png`,
                        path: await createCert(capitalizeEachWord(extractedCSV[index].name), 'email'),
                    },
                    //TODO if you want to add more attachment other than the certificate you can check this docs https://nodemailer.com/message/attachments/
                ],
            });

            console.log(`Message sent to ${extractedCSV[index].email}`);
        } catch (error) {
            console.log(error);
            console.log(`Didn't send email to ${extractedCSV[index].email}`);
        }
    }
}

//This doesn't respect the roman numerals in name like 'II, III etc'
function capitalizeEachWord(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function createCert(name, type) {
    //TODO You may remove this if you dont need custom fonts and canvas will use its default font 'arial'
    registerFont('src/fonts/SegoePro-Regular.ttf', { family: 'Segoe Pro' })

    const certImage = await loadImage(certInfo.certFilePath);
    const canvas = createCanvas(certImage.width, certImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(certImage, 0, 0, canvas.width, canvas.height);

    //TODO Change font style to your needs.
    ctx.font = '100px "Segoe Pro"';
    ctx.fillStyle = '#0078D4';
    ctx.textAlign = 'left';
    //TODO Position your attendee name based on your template
    ctx.fillText(name, 110, 680);

    if (type === 'local') {
        createLocalCert(name, canvas)
    } else if (type === 'email') {
        //This returns a base64 encoded image
        return canvas.toDataURL();
    }
}

async function createLocalCert(name, canvas) {
    if (!existsSync(__dirname + '/cert/')) {
        mkdirSync(__dirname + '/cert/');
    }
    const out = createWriteStream(__dirname + `/cert/${name}.png`)
    const stream = canvas.createPNGStream()
    stream.pipe(out)
    out.on('finish', () => console.log(`Certificate of ${name} was created.`))
}