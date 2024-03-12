/**
 * If server is restarted, run these commands:
 * 
    ip6tables -I OUTPUT -p tcp -m tcp --dport 25 -j DROP
    iptables -t nat -I OUTPUT -o eth0 -p tcp -m tcp --dport 25 -j DNAT --to-destination 130.245.171.151:11587

 */

//ALSO, to start server as background task: systemctl start nodejs-warmup2 
//to stop, systemctl stop nodejs-warmup2

const express = require('express')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const fs = require('fs')
//const redis = require('redis');
//const RedisStore = require('connect-redis')(session);
const session = require('express-session');

require('dotenv').config();

const app = express()
const port = 81
const ipAddress = '0.0.0.0'
const path = require('path')

const Jimp = require("jimp");

//const redisClient = redis.createClient({
//    host: '209.151.154.214',
//    port: 6379
//});
 
/*app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        maxAge: 3600000 
    }
}));*/

app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

app.use(function(req, res, next) {
    console.log("================DEBUGGING REQUESTS================")
    console.log("___________QUERY___________")
    console.log(req.query)
    console.log("___________BODY___________")
    console.log(req.body)
    console.log("==================================================")
    res.setHeader("X-CSE356", process.env.HEADER)
    next()
});

const transporter = nodemailer.createTransport({
    // host: `${process.env.HOST}`,
    host: "localhost",
    port: 25,
    secure: false, 
    tls: {
        rejectUnauthorized: false
    }
});

const users = new Map()
const unverifiedUsersKeys = new Map()
const userSetCombined = new Set() //this is to ensure that no two users can have same username or email

app.post('/adduser', async (req, res) => {
    let {username, password, email} = req.body

    if(!username || !password || !email){
        return res.status(400).send("Request body doesn't have necessary information ")
    }
    if (userSetCombined.has(username) || userSetCombined.has(email)){
        return res.status(400).send("No duplicate user allowed")
    }

    const encodedEmail = encodeURIComponent(email)
    let key = "some_super_random_and_totally_secret_key"
    let verificationLink = `http://${process.env.HOST}/verify?email=${encodedEmail}&key=${key}`

    const mailOptions = {
        from: 'Hello World <test@cse356.compas.cs.stonybrook.edu.com>',
        to: email, // Recipient's email
        subject: 'Registration Confirmation',
        text: `Hello ${username}. You email has been created and requires activation. please click this link: ${verificationLink} to activate your email. If this was not done by you, you can safely ignore this email. `,
    };

    try {
        const response = await transporter.sendMail(mailOptions)
        console.log(response)

        userSetCombined.add(username)
        userSetCombined.add(email)
        users.set(email, {password, username, enabled: false})
        unverifiedUsersKeys.set(email, key)

        return res.send('User registered and email sent')
    } catch (err) {
        console.error(err);
        return res.status(500).send('Error sending email')
    }    
})

app.get('/verify', (req, res) => {
    const { email, key } = req.query;

    if(!email || !key){
        return res.status(400).send("Not enough parameters")
    }

    if(!(unverifiedUsersKeys.has(email) && users.has(email))){
        return res.status(400).send("Email does not exist to be verified")
    }

    let user = users.get(email)
    if(unverifiedUsersKeys.get(email) == key){
        users.set(email, { ...user, enabled: true })
        return res.send("User has been verified!")
    }

    return res.send("Key incorrect")
})

app.post('/login', async(req, res) => {
    const { username, password } = req.body;
    if (!username | !password) {
        return res.status(400).send("Not enough parameters")
    }

    let authenticated = false;
    let emailFound;

    for (let [email, userDetails] of users.entries()) {
        //if (userDetails.username === )
    }
});

app.get('/tiles/*', (req, res) => {
    var f = path.join('.',req.path);
    if (fs.existsSync(f)) {
      Jimp.read("."+req.path, (err, img) => {
        if (err) console.log(err);
	if (req.query.style == "bw") {
	  img = img.greyscale();
	}
        img
          .getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
            res.send(buffer);
            //console.log(buffer);
          });
      });
    }

})

//Actually, I don't think this method is needed because we don't need the page to be navigable. it just has to be able to respond to responses 
app.get('/', (req, res) => {
    let loggedIn = true; //this should be updated later

    if(!loggedIn){
        return res.send("Please log in!")
    }

    /*
      const html = `
        <div id = "wp2">
            
        </div>

        <input type="radio" id="color" name="color">
        <label for="color">Color</label><br>
        <input type="radio" id="bw" name="bw">
        <label for="bw">Black and White</label><br>
    `
    */
    res.sendFile(path.join(__dirname, '/index.html'));
})

app.listen(port, ipAddress, () => {
    console.log(`App listening at http://localhost:${port}`)
});
