
const PORT = 443;

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/auth.db');
const jwt = require('jsonwebtoken');
const password = require('./password.js');

const app = express();

app.use(express.static('public'));
app.set('view engine','ejs');

let ACCESS_TOKEN, REFRESH_TOKEN;
db.all('SELECT * FROM tokens',(err,res)=>{
    ACCESS_TOKEN = res.find(e=> e.tokenType=='access').token;
    REFRESH_TOKEN = res.find(e=> e.tokenType=='refresh').token;
});



app.get('/new',(req,res)=>{
    res.render('new')
})

app.get('/login',(req,res)=>{
    res.render('login')
})


app.use(express.json());
app.use(express.urlencoded());
app.get('/userExists',(req,res)=>{
    getUserByEmail(req.query.email).then((r)=>res.json({exists:true})).catch((err)=>res.json({exists:false}));
})

app.use(express.json());



app.post('/create',(req,res)=>{
    createNewUser({email:req.body.email, password:req.body.password, displayName:req.body.displayName}).then((r)=>{
        if (r.sucess) {
            console.log('User created')            
            res.redirect(301,'/login')
        }
    }).catch(e=>{
        console.error(e.error);
        res.write(e.error).end()
    })
})

app.post('/auth',(req,res)=>{
    let user = {email: req.body.email, password:req.body.password}
    validateUser(user).then(valid=>{
        if (valid) {
            let token = jwt.sign({user: user.email},ACCESS_TOKEN,{expiresIn: 60*60});
            let cookieOptions = {
                expires:new Date(Date.now()+60*60*100),
                httpOnly: true,
            }
            res.status(200).clearCookie('auth').cookie('auth',{token:token},cookieOptions).redirect(301,'/members')
        } else {
            res.status(403).end('Not authorized.')
        }

    }).catch(e=>console.log(e))
})

app.get('/members',verifyToken,(req,res)=>{
    if (req.valid) res.status(200).send(req.user).end(); else res.status(401).end()
})


app.listen(PORT,()=>{console.log(`Server running on port ${PORT}`)});

async function getUserByEmail(email) {
    let promise = new Promise((resolve,reject)=>{
        db.get('SELECT userId, email, password, salt, displayName FROM users WHERE email = "'+email+'"',(err, res)=>{
            //console.log(res)
            if (err) reject(err); else if (res==undefined) reject('Email not found'); else resolve(res);            
        })
    })
    return promise;
}

async function createNewUser(user) {
    let promise = new Promise((resolve,reject)=>{       
        db.get('SELECT nextUserId FROM nextUserId',(err,res)=>{
            let nextUserId = res.nextUserId;
            let hash = password.generatePassword(user.password);
            db.run('INSERT INTO users VALUES ($userId, $email, $password, $salt, $validated, $displayName, $admin)',{
                $userId: nextUserId,
                $email: user.email,
                $password: hash.hash,
                $salt: hash.salt,
                $validated: false,
                $displayName: user.displayName,
                $admin:false
            },(err,res)=>{
                if (err) {
                    if (err.errno==19) reject({sucess: false, error: 'Email already registered'}); else  reject({sucess: false, error: err});
                } else resolve({sucess: true, error: res});
            })
        }) 

    })
    return promise;
}

async function validateUser(user) {
    let promise = new Promise(async (resolve,reject)=>{
        let savedUser;
        getUserByEmail(user.email).then((res)=>{
            savedUser=res;
            resolve(password.validatePassword(user.password, savedUser.salt, savedUser.password));
        }).catch((err)=>reject(err));
        
    })
    return promise;
}

function verifyToken(req,res,next){
    let decodedCookie = decodeURIComponent( req.headers.cookie);
    let cookieObject = JSON.parse(decodedCookie.substring(decodedCookie.indexOf(':')+1))
    //    console.log(cookieObject);
    jwt.verify(cookieObject.token,ACCESS_TOKEN,(err,decoded)=>{
        if (err) {
            req.valid=false;
            req.user=undefined;
        } else {
            req.valid=true;
            req.user=decoded.user;
        }
    });
    next();
}


// getUserByEmail('ismail').then((res)=>console.log(res)).catch((err)=>console.error(err));
// createNewUser({email:'ismail.ataman@gmail.com', password:'te3294', displayName:'Ismail'}).then((r)=>console.log(r)).catch(e=>console.error(e))
// validateUser({email: 'ismail.ataman@gmail.com', password:'te3294'}).then(r=>console.log(r)).catch(e=>console.log(e))


// async function validateUser(user) {
//     let promise = new Promise((reseolve,reject)=>{

//     })
//     return promise;
// }