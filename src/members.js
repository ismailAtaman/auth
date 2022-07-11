
const express = require('express');
const router = express.Router();

router.use(express.static('public'));

// const sqlite3 = require('sqlite3').verbose();
// const db = new sqlite3.Database('./data/auth.db');
const jwt = require('jsonwebtoken');


router.use(verifyToken)


router.get('/',(req,res)=>{
    res.render('home', {user: req.user})
})

router.get('/home',(req,res)=>{
    res.render('home');
})

router.get('/news',(req,res)=>{
    res.render('news');
})

module.exports = router;

//////////////////////////////////////////////////////////

function verifyToken(req,res,next){
    let decodedCookie = decodeURIComponent(req.headers.cookie);
    if (decodedCookie==undefined || decodedCookie=='undefined') {
        req.valid=false;
        req.user=undefined;
        res.status(401).redirect(302,'/login'); 
        return;        
    }

    let cookieObject = JSON.parse(decodedCookie.substring(decodedCookie.indexOf(':')+1))
    // console.log(cookieObject);
    jwt.verify(cookieObject.token,process.env.ACCESS_TOKEN,(err,decoded)=>{
        if (err) {
            req.valid=false;
            req.user=undefined;
            res.status(401).redirect(302,'/login'); return 0;
        } else {
            req.valid=true;
            req.user=decoded.user;
            next();
        }
    });
}