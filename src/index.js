
const PORT = process.env.PORT || 3146;
const UPLOAD_PATH = './data/'
const express = require('express');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/auth.db');
const smarthomeDB = new sqlite3.Database('./smarthome.db');
const jwt = require('jsonwebtoken');
const password = require('./password.js');

const members = require('./members')
const app = express();

const STORE_DATA = 'data/store.data';

let clients=[];


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

app.use('/members', members)


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

app.get('/events',eventsHandler);

app.post('/action',processAction);


app.get('/exchange',(req,res)=>{ 
    smarthomeDB.get('SELECT * FROM currentRate',(err,result)=>{        
        let rates = result;
        db.get('SELECT * FROM exchangeRateChange',(err,result)=>{
            let change = result;
            let ret = new Object();
            ret.rates= rates;
            ret.change = change;  
            res.status(200).json(ret).end();
        })

    })
 });

// app.use(fileUpload());
// app.post('/upload',processUpload);


let ACCESS_TOKEN, REFRESH_TOKEN;
db.all('SELECT * FROM tokens',(err,res)=>{
    ACCESS_TOKEN = res.find(e=> e.tokenType=='access').token;
    REFRESH_TOKEN = res.find(e=> e.tokenType=='refresh').token;
    process.env.ACCESS_TOKEN= ACCESS_TOKEN;
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

////////// Server Side Events Handling and Dispatch //////////



function eventsHandler(req, res, next) {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache'
    };

    if (!res.headersSent) res.writeHead(200,headers);

 
    const clientId = Date.now();
    const newClient = {
        clientId: clientId,
        res
    };
  
    let eventData = {event:'register', clientId: clientId};
    res.write("data: "+JSON.stringify(eventData)+'\n\n');
    clients.push(newClient);  
    req.on('close', () => {
        //console.log(`${clientId} connection closed.`);
        clients = clients.filter(client => client.clientid !== clientId);
    });    
    next();
}

function dispatchClientEvent(eventData) {
    let client = clients.find(e=>e.clientId==eventData.clientId);
    if (client!=undefined) { 
        client.res.write("data: "+JSON.stringify(eventData)+'\n\n'); 
    } else {
        for (let client of clients) { client.response.write("data: "+JSON.stringify(eventData)+'\n\n'); }
    }
}   

async function processAction(request, response, next) {
    let body=[];
    let message; 
    request.on('data',(chunk)=>{body.push(chunk);}).on('end',async ()=>{
        
        body = Buffer.concat(body).toString();
        message= JSON.parse(decodeURIComponent(body));
        // response.send(`Command received. Device : ${message.device}, Command : ${message.command}`)
        
        if (message.device == 'web') {
            if (message.command=='currentWeather') {
                getCurrentWeather().then((weather)=>{
                    let eventData = {event: 'currentWeather', payload : {}};
                    eventData.payload.weather = weather;
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                })               
            }
            if (message.command=='forecastWeather') {
                getWeatherForecast().then((weather)=>{
                    let eventData = {event: 'forecastWeather', payload : {}};
                    eventData.payload.weather = weather;
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                })
            }
        }

        if (message.device == 'hub') {
            if (message.command=='startActivity'){                      
                hub[message.command](message.params);                
                console.log('Hub command executed. Command : '+message.command+' Params : '+message.params )
            } 

            if (message.command=='sendCommand') {
                let param1=message.params.substring(0,message.params.indexOf('-'));
                let param2=message.params.substring(message.params.indexOf('-')+1);
                hub[message.command](param1,param2);
                console.log('Hub command executed. Command : '+message.command+' Params : '+param1, param2 );

                let eventData = {event: 'deviceUpdate', payload : {device: 'hub', command : message.command, params :message.params}}
                eventData.clientId = message.clientId;
                dispatchClientEvent(eventData);
            }
        }

        if (message.device == 'hue') {
            lightAction = (message.command == 'lightsOn'); 
            let dev = devices.find(e=> e.id===message.device);
            for (let light of dev.deviceList) {
                hue.setLight(light.id,lightAction).then(state=>{ 
                    if (state) {
                        let eventData = {event: 'lightsUpdate', payload : {command : message.command}}
                        eventData.clientId = message.clientId;
                        dispatchClientEvent(eventData);
                    }
                });
            }
        }

        if (message.device == 'purifier') {
            if (message.command == 'getEnvData') {
                const data = `data: {}\n\n`;
                smarthomeDB.get('SELECT * FROM latestEnv',(err,result)=>{
                    if (err) return;
                    //console.log(result);
                    let hum = result.hum;
                    let temp = result.temp;
                    let airQ = result.airQ;
                    now = getDate();

                    let eventData = {event: 'envDataUpdate', payload : {change: 'currentHum', value :hum, unit:' %', time: now.timeString}}
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                
                    eventData = {event: 'envDataUpdate', payload : {change: 'currentTemp', value :temp, unit: '°C', time: now.timeString}}
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                
                    eventData = {event: 'envDataUpdate', payload : {change: 'currentAirQ', value :airQ,  unit: ' ', time: now.timeString}}
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                })
            }
        }

        if (message.device== 'all') {
            if (message.command == 'getStatus') {
                
            }
        }

        if (message.device=='server') {
            if (message.command == 'getData') {                
                // let SQLQuery = (message.scope='day')?  "SELECT * FROM envData "+message.whereClause : "SELECT * FROM avgDaily "+message.whereClause ;
                let SQLQuery = "SELECT * FROM envData "+message.whereClause;
                // console.log(SQLQuery);
                db.all(SQLQuery,(err,data)=>{
                    let eventData = {event: 'serverData', action: message.action, payload : data}
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                })
            }

            if (message.command == 'runQuery') {                
                let SQLQuery = message.SQLQuery;
                //console.log(SQLQuery)
                db.all(SQLQuery,(err,data)=>{
                    let eventData = {event: 'serverData', action: message.action, payload : data}
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                })
            }

            if (message.command == 'getFolder') {
                let folder = getDirectFoldersAndFiles(message.payload.folder);
                let eventData = {event: 'getFolder', payload : {folder: folder}}
                eventData.clientId = message.clientId;
                dispatchClientEvent(eventData);
            }

            if (message.command == 'createFolder') {
                if (!fs.existsSync(UPLOAD_PATH+message.payload.parentFolder+message.payload.folder)) fs.mkdirSync(UPLOAD_PATH+message.payload.parentFolder+message.payload.folder);
                let eventData = {event: 'createFolder', payload : {created: true}}
                eventData.clientId = message.clientId;
                dispatchClientEvent(eventData);
            }

            if (message.command =='getNews') {
                // console.log('getNews Request');
                if (message.section=='tr') {
                    const articles = await getNewsHeadlines(message.section);
                    let eventData = {event: 'getNews', payload : {articles: articles}}
                    eventData.clientId = message.clientId;
                    dispatchClientEvent(eventData);
                    return;
                }

                const articles = await getReutersArticles(message.section);
                let eventData = {event: 'getNews', payload : {articles: articles}}
                eventData.clientId = message.clientId;
                dispatchClientEvent(eventData);
            }
        }
    })
    response.end();
    next();
}


async function sendHTTPRequest(options, headers, data) {
    const http = require("https");
    return new Promise((resolve,_reject)=>{
        let dat=undefined;
        if (data!=undefined) { 
            dat = JSON.stringify(data);
            options.headers = {
                'Content-Type': 'text/plain;charset=UTF-8',
                'Content-Length': dat.length }
        }
        const req = http.request(options, response);
        req.setHeader('User-Agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0');       
        if (headers!=undefined) {
            for (let header of headers) {
                req.setHeader(header.name,header.value)
            }
        }
        if (dat!= undefined) req.write(dat);
        
        function response(res){
            let body=[];
            res.on('data',(chunk)=>{ body.push(chunk)}).on('end', ()=>{body = Buffer.concat(body).toString(); resolve(body);  });                     
        }
        req.end();        
    })
}

async function getReutersArticles(section) {    
    if (section==undefined) section='world';
    return new Promise(async (resolve,_reject)=>{
        let options = {
            host: 'www.reuters.com',
            port: 443,
            path: '/pf/api/v3/content/fetch/articles-by-section-alias-or-id-v1/?query=%7B%22called_from_a_component%22%3Atrue,%22fetch_type%22%3A%22section%22,%22section_id%22%3A%22%2F'+section+'%2F%22,%22size%22%3A20,%22sophi_page%22%3A%22%22,%22sophi_widget%22%3A%22%22,%22website%22%3A%22reuters%22%7D&d=100&_website=reuters',
            method: 'GET',
        };
        const news  = await sendHTTPRequest(options,undefined);
        resolve(JSON.parse(news.toString()).result.articles) ;
    })
}

async function getNewsHeadlines(language) {    
    if (language==undefined) language='en';
    return new Promise(async (resolve,_reject)=>{
        let options = {
            host: 'newsapi.org',
            port: 443,
            path: '/v2/top-headlines?language='+language+'&apiKey=8c7adb4f0c214330b796f027610e5eb4',
            method: 'GET',
        };
        const news  = await sendHTTPRequest(options,undefined);
        resolve(JSON.parse(news.toString()).articles) ;  
    })
}


async function getCurrentWeather() {
    let promise = new Promise ((resolve, reject)=>{
        const dataArray = loadFromFile(STORE_DATA);
        //// If data is older than 30min  refresh from web
        let lastWeather = dataArray.filter(e=> e.data =='weather').sort((a,b)=>{return (b.time-a.time)})[0];
        //console.log(newestLog);
        if (lastWeather!=undefined && ((Date.now()-lastWeather.time)/1000)<1800) {
            resolve(lastWeather.payload);
            return;
        }

        https = require('https');
        const weatherCurrent = {
            hostname: 'api.openweathermap.org',
            port: 443,
            path: '/data/2.5/weather?lat=25.076397664492344&lon=55.14301426227528&appid=36aed9a09e79e8a77621dd05efa307a4',
            method: 'GET',
        };

        const req = https.request(weatherCurrent,res=>{
            if (res.statusCode==200) {
                res.on('data', d => { 
                    ret= JSON.parse(d); 
                    req.end(); 
                    let weather = { desc: capitalize(ret.weather[0].description),
                                    icon: ret.weather[0].icon,
                                    temp: Math.round(ret.main.temp -273.15,2), 
                                    tempMin: Math.round(ret.main.temp_min-273.15,2),
                                    tempMax: Math.round(ret.main.temp_max-273.15,2),
                                    feelsLike : Math.round(ret.main.feels_like-273.15,2),
                                    humidity: ret.main.humidity,
                                    pressure : ret.main.pressure,
                                    wind : ret.wind,
                                    visibility : ret.visibility, 
                                    city: ret.name
                                    }
                    //console.log(weather);
                    resolve(weather);
                    let storeData = { data: 'weather', time : Date.now() }
                    storeData.payload = weather
                    saveToFile(storeData,STORE_DATA);
                    // smarthomeDB.run('INSERT INTO weatherData VALUES($time, $desc, $icon, $temp, $tempMin, $tempMax, $feelsLike, $humidity, $pressure, $windSpeed, $windDeg, $windGust, $visibility, $city)',
                    // {
                    //     $time: Date.now(),
                    //     $desc: weather.desc,
                    //     $icon: weather.icon,
                    //     $temp: weather.temp,
                    //     $tempMin: weather.tempMin,
                    //     $tempMax: weather.tempMax,
                    //     $feelsLike: weather.feelsLike, 
                    //     $humidity: weather.humidity, 
                    //     $pressure: weather.pressure,
                    //     $windSpeed: weather.wind.speed,
                    //     $windDeg: weather.wind.deg,
                    //     $windGust: weather.wind.gust,
                    //     $visibility: weather.visibility,
                    //     $city: weather.city
                    // })
                    req.end();
                 })
            }
        })

        req.on('error',error =>{
            console.error(error);
            reject(error);
        })
        
        req.end();
        https = undefined;
    })
    
    return promise;
}

async function getWeatherForecast() {
    return promise = new Promise((resolve,reject)=>{
    const weatherForecast = {
        hostname: 'api.openweathermap.org',
        port: 443,
        path: '/data/2.5/forecast?lat=25.076397664492344&lon=55.14301426227528&appid=36aed9a09e79e8a77621dd05efa307a4',
        method: 'GET',
    };
    
    https = require('https');
    const req = https.request(weatherForecast,response);

    function response(res){
        if (res.statusCode==200) {
            res.on('data', d => { 
                ret= JSON.parse(d); 
                resolve(ret) 
            })
        }
    }

    req.on('error',error =>{
        console.error(error);
        reject(error);
    })
    
    req.end();
    })
    
}


function saveToFile(data, file) {
    fs.appendFile(file, JSON.stringify(data)+'\n', err => {
        if (err) {
            console.error('Can not write to file.');
            console.error(err);
            return 1;
        }
    })
    return 0;
}

function loadFromFile(file) {
    if (!fs.existsSync(file)) return [];
    let dataArray = fs.readFileSync(file,'utf8').split('\n');
    dataArray.splice(dataArray.length-1,1);
    let retArray = [];
    for (let dataLine of dataArray) retArray.push(JSON.parse(dataLine));
    return retArray;    
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

function  capitalize(text) {    
    return text[0].toUpperCase() + text.substring(1);
}

// getUserByEmail('ismail').then((res)=>console.log(res)).catch((err)=>console.error(err));
// createNewUser({email:'ismail.ataman@gmail.com', password:'te3294', displayName:'Ismail'}).then((r)=>console.log(r)).catch(e=>console.error(e))
// validateUser({email: 'ismail.ataman@gmail.com', password:'te3294'}).then(r=>console.log(r)).catch(e=>console.log(e))


// async function validateUser(user) {
//     let promise = new Promise((reseolve,reject)=>{

//     })
//     return promise;
// }