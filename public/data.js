
let cTemp, cHum, cAirQ;

window.addEventListener('load',()=>{
    //// Get object DOM references


    const serverEvents = new EventSource('/events');
    serverEvents.addEventListener('message',(event)=>{
        let data = JSON.parse(event.data);
        console.log(data);
        if (data.event==undefined) return;
        switch (data.event) {
            case 'register':
                clientId = data.clientId;
                requestTableData();
                break;
            case 'serverData': 
                if (data.payload==undefined) return;

                if (data.action=='graph') {
                    let xVals=[],temp=[],hum=[],airQ=[];
                    for (let dataPoint of data.payload) {
                        xVals.push(dataPoint.time);
                        temp.push(dataPoint.temp)
                        hum.push(dataPoint.hum);
                        airQ.push(dataPoint.airQ);
                    }
                    let graphContainer = document.getElementById('graphContainer');
                    graphContainer.innerHTML='';
                    graphContainer.innerHTML='<canvas id="cTemp"></canvas> <canvas id="cHum"> </canvas><canvas id="cAirQ"></canvas>';
                    cTemp = document.getElementById('cTemp');
                    cHum = document.getElementById('cHum');
                    cAirQ = document.getElementById('cAirQ');
                    createCharts(xVals,temp,hum,airQ);
                }

                if (data.action=='table') {
                    dataTable = document.getElementById('dataTable');
                    dataTable.innerHTML='';
                    let dataDiv = document.createElement('div');
                    dataDiv.style= 'display: grid; grid-template-columns: repeat(4,1fr); text-decoration: underline'
                    dataDiv.innerHTML= '<span>Time</span><span>Avg. Temp (C)</span><span>Avg Hum (%)</span><span>Avg AirQ (#)</span>';
                    dataTable.appendChild(dataDiv);
                    for (let dataPoint of data.payload) {
                        // console.log(dataPoint)
                        let dataDiv = document.createElement('div');
                        dataDiv.style= 'display: grid; grid-template-columns: repeat(4,1fr)'
                        dataDiv.innerHTML= '<span>'+dataPoint.time+'</span><span>'+dataPoint.avgTemp+'</span><span>'+dataPoint.avgHum+'</span><span>'+dataPoint.avgAirQ+'</span>';
                        dataTable.appendChild(dataDiv);
                    }
                }

                break;
        }
        
    });

    for (let button of document.getElementsByClassName('dataOptionsButton')) {
        button.addEventListener('click',()=>requestData(button));
    }



})

function requestTableData() {
    now = getDate();
    let query = 'SELECT * FROM avgHourly WHERE year = '+now.year+' AND month = '+now.month+' AND day = '+now.day
    let dataObject={device : 'server', command : 'runQuery', SQLQuery: query};
    dataObject.action ='table'
    console.log(dataObject);
    postForm('/action',dataObject);
}

function requestData(obj) {
    for (let b of document.getElementsByClassName('dataOptionsButton')) b.classList.remove('selected');
    obj.classList.add('selected');

    let action = obj.getAttribute('action');
    let now = getDate(); 
    let whereClause =' WHERE ', scope;
    switch (action) {
        case 'thisDay':
            whereClause += 'year = '+now.year+' AND month = '+now.month+' AND day = '+now.day;
            scope='day';
            break;
        case 'thisWeek':
            whereClause += 'year = '+now.year+' AND yearWeek =  strftime("%W",date("now"))';
            scope='week';
            break;
        case 'thisMonth':
            whereClause += 'year = '+now.year+' AND month = '+now.month;
            scope='month';
            break;
        case 'thisYear':
            whereClause += 'year = '+now.year;
            scope='year';
            break;
    }

    let dataObject={device : 'server', command : 'getData', whereClause: whereClause, scope: scope};
    dataObject.action ='graph'
    postForm('/action',dataObject);
}

function createCharts(xVals,temp, hum, airQ) {
    cTemp.style.display = ' block';
    cHum.style.display = ' block';
    cAirQ.style.display = ' block';
    const tempChart = new Chart(cTemp,{
        type: 'line',
        data: {
            labels : xVals,
            datasets :[{
                label: 'Temperature C',
                data : temp,
                fill: true,
                borderColor: 'hsl(5, 40%, 40%)',
                tension: 0.2,
            }]
        },    
    })

    const humChart = new Chart(cHum,{
        type: 'line',
        data: {
            labels : xVals,
            datasets :[{
                label: 'Humidty %',
                data : hum,
                fill: true,
                borderColor: 'hsl(205, 40%, 40%)',
                tension: 0.2,
            }]
        }    
    })

    const airQChart = new Chart(cAirQ,{
        type: 'line',
        data: {
            labels : xVals,
            datasets :[{
                label: 'Air Quality',
                data : airQ,
                fill: true,
                borderColor: 'hsl(175, 40%, 40%)',
                tension: 0.5,
            }]
        },
        options:{
            responsive: true,
            scales : {
                y: {min: 0}
            }

        }    
    })
}


function postForm(url, object) {
    object.clientId=clientId;
    fetch(url, {
        method : "POST",
        body: encodeURIComponent(JSON.stringify(object)),
    })
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
