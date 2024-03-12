/**
 * If server is restarted, run these commands:
 * 
    ip6tables -I OUTPUT -p tcp -m tcp --dport 25 -j DROP
    iptables -t nat -I OUTPUT -o eth0 -p tcp -m tcp --dport 25 -j DNAT --to-destination 130.245.171.151:11587

 */

//ALSO, to start server as background task: systemctl start nodejs-warmup2 
//to stop, systemctl stop nodejs-warmup2
const redis = require('redis');
const express = require('express')
const session = require('express-session');
// let RedisStore = require('connect-redis');
const RedisStore = require("connect-redis").default;
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const fs = require('fs')

const Jimp = require("jimp");

require('dotenv').config();

const app = express()
const port = 80
const ipAddress = '0.0.0.0'
const path = require('path')
const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379
});
redisClient.connect();

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        maxAge: 3600000 
    }
}));


app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json())

app.use(function(req, res, next) {
    console.log("================DEBUGGING REQUESTS================")
    // console.log("___________IP ADDRESS___________");
    // console.log(req.ip);
    // console.log("___________HEADERS___________");
    // console.log(req.headers);
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
        return res.json({msg: "Request body doesn't have necessary information", status: "ERROR"})
    }
    if (userSetCombined.has(username) || userSetCombined.has(email)){
        return res.json({
            status: 'ERROR',
            message: "No duplicate user allowed"
        });
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

        return res.json({msg: 'User registered and email sent', status: "OK"})
    } catch (err) {
        console.error(err);
        return res.status(500).json({msg: 'Error sending email', status: "OK"})
    }    
})

app.get('/verify', (req, res) => {
    const { email, key } = req.query;
    console.log("verify: " + email + ", " + key);
    if(!email || !key){
        return res.status(400).json({msg: "Not enough parameters", status: "ERROR"})
    }

    if(!(unverifiedUsersKeys.has(email) && users.has(email))){
        return res.status(404).json({msg: "Email does not exist to be verified", status: "ERROR"})
    }

    let user = users.get(email)
    if(unverifiedUsersKeys.get(email) == key){
        users.set(email, { ...user, enabled: true })
        unverifiedUsersKeys.delete(email)
        return res.status(200).json({msg: "User has been verified!", status: "OK"})
    }

    return res.status(403).json({msg: "Key incorrect", status: "ERROR"})
})

app.post('/login', async(req, res) => {

    const { username, password } = req.body;
    if (!username || !password) {
        res.send({msg: "Not enough parameters", status: "ERROR"})
    }

    let authenticated = false;
    let emailFound;

    for (let [email, userDetails] of users.entries()) {
        console.log("username + password entered: " + userDetails.username + ", " + userDetails.password);
        if (userDetails.username === username && userDetails.password === password) {
            authenticated = true;
            emailFound = email;
            break;
        }
        else (
            console.log((userDetails.username && username) + ", " + (userDetails.password && password))
        )
    }
    console.log("Done checking");

    if (authenticated) {
        console.log("Login successful for:", username);
        req.session.user = {username: username, email: emailFound};
        res.send({status: "OK"});
    }
    else {
        console.log("Login failed for:", username);
        res.send({ msg: "User does not exist", status: "ERROR" }); 
    }
    console.log("Finished");
});

app.post('/logout', (req, res) => {
    if (req.session.user) {
        req.session.destroy(err => {
            if (err) {
                return res.json({msg: 'Error logging out', status: "ERROR"});
            }
            res.json({msg: 'Logged out successfully', status: "OK"});
        });
    }
    else {
        return res.json({msg: 'Error logging out', status: "ERROR"});
    }
});

app.get('/tiles/*', (req, res) => {

    if(!req.session.user || !req.session.user.username){
        return res.json({msg: "Image requires a cookie tax :(", status: "OK"})
    }

    var f = path.join('.',req.path);
    if (fs.existsSync(f)) {
      Jimp.read("."+req.path, (err, img) => {
        if (err) console.log(err);
	if (req.query.style == "bw") {
	  img = img.greyscale().getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
	      if (err) {
	        console.log("image get: ");
	        console.log(err);
	      }
          res.setHeader('Content-Type', 'image/jpeg');
	      res.send(buffer);
	    });
	} else {
	  img
	    .getBuffer(Jimp.MIME_JPEG, (err, buffer) => {
	      if (err) {
	        console.log("image get: ");
	        console.log(err);
	      }
          res.setHeader('Content-Type', 'image/jpeg');
	      res.send(buffer);
	    });
	}
      });
    }
})

app.get('/', (req, res) => {  

    if(!req.session.user || !req.session.user.username){
        return res.json({msg: "Please log in so we can give you cookie >,<", status: "OK"})
    }

    res.sendFile(path.join(__dirname, '/index.html'));
})

app.listen(port, ipAddress, () => {
    console.log(`App listening at http://localhost:${port}`)
});
