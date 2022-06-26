
const PORT = process.env.PORT || 3146;
const UPLOAD_PATH = './data/'
const express = require('express');
const fileUpload = require('express-fileupload');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/auth.db');
const jwt = require('jsonwebtoken');
const password = require('./password.js');

const app = express();


app.set('view engine','ejs');

app.use(express.static('public'));
app.use(express.json());
// app.use(express.urlencoded());


app.get('/',(req,res)=>{
    res.redirect(302,'/members')
})

app.get('/new',(req,res)=>{
    res.render('new')
})

app.get('/logout',(req,res)=>{
    console.log('Logging out..')
    res.clearCookie('auth');
    res.render('logout')
})

app.get('/login',(req,res)=>{
    res.render('login')
})

app.get('/userExists',(req,res)=>{
    getUserByEmail(req.query.email).then(()=>res.json({exists:true})).catch(()=>res.json({exists:false}));
})


app.get('/members',verifyToken,(req,res)=>{
    if (!req.valid) { res.status(401).redirect(302,'/login'); return 0;}

    res.render('members', {user: req.user})

})

app.post('/create',(req,res)=>{
    let data=[];
    req.on('data',(chunk)=>{
        data.push(chunk)
    }).on('end',()=>{
        data = decodeURIComponent(data.concat().toString());
        data = data.split('&')
        for (let obj of data) {
            let eqPos = obj.indexOf('=');
            req.body[obj.substring(0,eqPos)]=obj.substring(eqPos+1);
        }
        createNewUser({email:req.body.email, password:req.body.password, displayName:req.body.displayName}).then((r)=>{
            if (r.sucess) {
                console.log('User created')            
                res.redirect(302,'/login')
            }
        }).catch(e=>{
            console.error(e.error);
            res.write(e.error).end()
        })
    });


})

app.post('/auth',(req,res)=>{    
    let data=[];
    req.on('data',(chunk)=>{
        data.push(chunk)
    }).on('end',()=>{
        data = decodeURIComponent(data.concat().toString());
        data = data.split('&')
        for (let obj of data) {
            let eqPos = obj.indexOf('=');
            req.body[obj.substring(0,eqPos)]=obj.substring(eqPos+1);
        }
        //console.log(req.body)
        let user = {email: req.body.email.toLowerCase(), password:req.body.password}

        validateUser(user).then(valid=>{
            if (valid) {
                let token = jwt.sign({user: user.email},ACCESS_TOKEN,{expiresIn: 60*60});
                let cookieOptions = {
                    expires:new Date(Date.now()+60*60*100),
                    httpOnly: true,
                }
                res.status(200).clearCookie('auth').cookie('auth',{token:token},cookieOptions).redirect(302,'/members')
            } else {
                res.status(403).end('Not authorized.')
            }
    
        }).catch(e=>console.log(e))
    })
})

app.use(fileUpload());
app.post('/upload',processUpload);


let ACCESS_TOKEN, REFRESH_TOKEN;
db.all('SELECT * FROM tokens',(err,res)=>{
    ACCESS_TOKEN = res.find(e=> e.tokenType=='access').token;
    REFRESH_TOKEN = res.find(e=> e.tokenType=='refresh').token;
    app.listen(PORT,()=>{console.log(`Server running on port ${PORT}`)});
});




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
    let decodedCookie = decodeURIComponent(req.headers.cookie);

    if (decodedCookie==undefined || decodedCookie=='undefined') {
        req.valid=false;
        req.user=undefined;
        next();
        return;
    }
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

async function processUpload(req, res, next) {
  
    if (req.files==undefined) { res.status(204).send('No file uploaded').end(); next(); return; }
    if (req.files.uploadFile==undefined) { res.status(204).send('No file uploaded').end(); next(); return; }

    let hostname =req.socket.remoteAddress.toString();
    hostname = hostname.substring(hostname.indexOf('f:')+2);
    let path = req.query.path;

    if (req.files.uploadFile.length==undefined) {
        let file = req.files.uploadFile;

        let saveAs = file.name;
        file.mv(UPLOAD_PATH+path+saveAs);
        // db.run('INSERT INTO uploadLog VALUES ($hostName, $fileName, $fileSize, $savedAs, $logDate)',{
        //     $hostName: hostname,
        //     $fileName: file.name,
        //     $fileSize: file.size,
        //     $savedAs: saveAs,
        //     $logDate: Date.now()
        // })
        res.status(200).send({status: 'success', files: 1, size: file.size})
        next();
        return;
    }
    
    let size=0;
    let count=1, saveAs;
    for (let file of req.files.uploadFile) {        
        size += file.size;    
        // saveAs = Date.now()+'_'+file.name
        saveAs = file.name;
        file.mv(UPLOAD_PATH+path+saveAs);
 
        db.run('INSERT INTO uploadLog VALUES ($hostName, $fileName, $fileSize, $savedAs, $logDate)',{
            $hostName: hostname,
            $fileName: file.name,
            $fileSize: file.size,
            $savedAs: saveAs,
            $logDate: Date.now()
        })
        res.write(`${count} / ${req.files.uploadFile.length} uploaded. [${Math.round(file.size/1024,1)}kB]\n\n`);
        count++;
    }
    res.write(`Success! Total ${req.files.uploadFile.length} files uploaded. [${Math.round(size/1024,1)}kB]\n\n`)
    res.end();
    // res.status(200).send({status: 'success', files: req.files.uploadFile.length, size: size})
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