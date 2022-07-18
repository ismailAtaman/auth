
const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const smarthomeDB = new sqlite3.Database('./smarthome.db');

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

router.get('/data',(req,res)=>{
    now = getDate()
    let sqlQuery = 'SELECT MAX(temp) maxTemp, MAX(hum) maxHum, MAX(airQ) maxAirQ FROM envData WHERE year = '+now.year+' AND month = '+parseInt(now.month).toString()+ ' AND ((day = '+(parseInt(now.day)-1).toString()+' AND time > "'+now.timeString+'") OR (day = '+now.day+' AND time < "'+now.timeString+'"))';
    // console.log(sqlQuery)

    let stats = {maxTempToday:0, maxHumToday:0, maxAirQToday:0}
    smarthomeDB.get(sqlQuery,(err,data)=>{
        if (err!=null)  { 
            console.log(err) 
        } else { 
            stats.maxTempToday = data.maxTemp;
            stats.maxHumToday = data.maxHum;
            stats.maxAirQToday = data.maxAirQ;        }
       
        smarthomeDB.get('SELECT * FROM maxTempAlltime',(err,data)=>{
            if (err!=null)  { 
                console.log(err) 
            } else { 
                stats.maxTemp = data.maxTemp;
                stats.maxHum = data.maxHum;
                stats.maxAir = data.maxAirQ;
            }

            smarthomeDB.get('SELECT * FROM dateMaxTemp',(err,data)=>{
                stats.dateMaxTemp = pad(data.day,2,'0')+'/'+pad(data.month,2,'0')+'/'+data.year+' '+data.time;
            
                smarthomeDB.get('SELECT * FROM dateMaxHum',(err,data)=>{
                    stats.dateMaxHum = pad(data.day,2,'0')+'/'+pad(data.month,2,'0')+'/'+data.year+' '+data.time;

                    //console.log(stats);
                    res.render('data', { stats: stats});
                })
            })
            
        })
    })   
})

router.post('/data',(req,res)=>{
    let data=[];
    req.on('data',(chunk)=>{
        data.push(chunk)
    }).on('end',()=>{
        try {
            data = JSON.parse(decodeURIComponent(data.concat().toString().replace(' ',' ').trim()));
        }   
        catch (e) {
            console.error("Invalid data\n",data);
            res.status(400).end();
            return;
        }

        // console.log("Command: " , data.command);       
        switch (data.command) {
            case 'maxRowId':                
                smarthomeDB.all('SELECT * FROM maxRowId',(err,result)=>{
                    let message = {command:data.command,payload:result}
                    res.status(200).send(message);
                    res.end();
                })
                break;
            case 'data':
                // console.log("SQL Data received");
                // console.log("Table : ",data.table);
                // console.log(Object.keys(data.payload[0]));
                //console.log("Payload length : ",data.payload.length)

                if (data.payload.length==0) break;

                let SQLQuery= 'INSERT INTO '+data.table+' VALUES('
                for (let col of Object.keys(data.payload[0])) {
                    SQLQuery +='$'+col+', ';
                }
                SQLQuery=SQLQuery.substring(0,SQLQuery.length-2)+')';
                console.log(SQLQuery);
                for (let rec of data.payload) {                   
                    const mutRec = Object.fromEntries(
                        Object.entries(rec).map(([key, value]) =>                           
                          [`$${key}`, value]
                        )
                    )             
                    smarthomeDB.run(SQLQuery,mutRec,(err)=>{
                        console.log("SQL Query Execution Error");
                        console.error(err);
                    })
                }                
                res.status(200);       
                res.end();
                break;
        }
    })


})

module.exports = router;

//////////////////////////////////////////////////////////

function verifyToken(req,res,next){
    let decodedCookie = decodeURIComponent(req.headers.cookie);
    //console.log("Cookie : ",decodedCookie);
    if (decodedCookie==undefined || decodedCookie=='undefined') {
        req.valid=false;
        req.user=undefined;
        res.status(401).redirect(302,'/login'); 
        return;        
    }

    let cookieObject = JSON.parse(decodedCookie.substring(decodedCookie.indexOf(':')+1))
    //console.log(cookieObject);
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

function getDate() {
    let now = new Date();
    let ret=new Object();

    ret.day = pad(now.getDate(),2,'0');
    ret.month = pad(now.getMonth()+1,2,'0');
    ret.year = now.getFullYear();
    ret.dateString = now.toDateString(ret.day + '/' +ret.month + '/' + ret.year);
    ret.hour = now.getHours();
    ret.min = now.getMinutes();
    ret.sec = now.getSeconds();
    ret.timeOffset = now.getTimezoneOffset();
    ret.time = now.getTime();
    ret.timeString = pad(ret.hour,2,'0')+':'+pad(ret.min,2,'0')+':'+pad(ret.sec,2,'0');
    
    return ret;
}

function pad(text,length,pad) {
    return (length>text.toString().length)? pad.repeat(length-text.toString().length) + text : text;
}

