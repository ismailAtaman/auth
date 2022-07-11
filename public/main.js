let clientId;
let currentTemp, currentHum, currentAirQ;


window.addEventListener('load',()=>{
    console.log('Initializing..');

    currentTemp = document.getElementById('currentTemp');
    currentHum = document.getElementById('currentHum');
    currentAirQ = document.getElementById('currentAirQ');

    //// Subscribe to server events
    const serverEvents = new EventSource('/events');
    serverEvents.addEventListener('message',(event)=>{
        let data = JSON.parse(event.data);
        //console.log(data);
        if (data.event==undefined) return;
        let action;
        switch (data.event) {
            case 'register':
                clientId = data.clientId;
                setTimeout(()=>{
                    //// Request environment data        
                    let dataObject={device : 'purifier', command : 'getEnvData'};
                    postForm('/action',dataObject);
            
                    //// Request current weather data
                    dataObject={device : 'web', command : 'currentWeather'};
                    postForm('/action',dataObject);
                },100);
                break;
            case 'envDataUpdate':
                document.getElementById(data.payload.change).innerText = data.payload.value+data.payload.unit;
                break;
            case 'deviceUpdate':
                action = document.getElementsByClassName('action '+data.payload.device+' '+data.payload.command+' '+data.payload.params)[0];
                // console.log(action);
                action.disabled=false;
                action.children[0].style = 'height:5rem; filter: saturate(1);';  
                break;
            case 'lightsUpdate':                
                action = document.getElementsByClassName('action '+data.payload.command)[0];
                // console.log(action);
                action.disabled=false;
                action.children[0].style = 'height:5rem; filter: saturate(1);';  
                break;
            case 'currentWeather':
                // document.getElementById('weatherDesc').innerText =`${data.payload.weather.desc}. Humidity :  ${data.payload.weather.humidity}% - Current : ${data.payload.weather.temp}°C - Feels Like :  ${data.payload.weather.feelsLike}°C - Wind : ${data.payload.weather.wind.speed}km/h - Pressure : ${data.payload.weather.pressure}hPa`
                document.getElementById('weatherDesc').innerText =`Current Temp : ${data.payload.weather.temp}°C | Feels Like :  ${data.payload.weather.feelsLike}°C | Humidity :  ${data.payload.weather.humidity}% | Wind : ${data.payload.weather.wind.speed}km/h | Pressure : ${data.payload.weather.pressure}hPa`
                document.getElementById('weatherIcon').src = './icon/weather/'+data.payload.weather.icon.toUpperCase()+'.png';                
                break;
        }

        //console.log(data); 
    })

    //// Add event listeners to action buttons
    for (let action of document.getElementsByClassName('action')) {
        action.disabled=false;
        action.addEventListener('click',function(){
            if (this.disabled) return;
            this.disabled= true;
            this.children[0].style = 'height:5rem; filter: saturate(0.1);';    
            let dataObject={device : this.getAttribute('device'), command : this.getAttribute('command'), params : this.getAttribute('params') };
            postForm('/action',dataObject); 
        })
    }



})

//// POST  data to server for execution on devices
function postForm(url, object) {
    object.clientId=clientId;
    fetch(url, {
        method : "POST",
        body: encodeURIComponent(JSON.stringify(object)),
    })
}

function postFormEx(url, object) {
    fetch(url, {
        method : "POST",
        body: encodeURIComponent(JSON.stringify(object)),
    }).then(
        response => response.text() 
    ).then(
        html => console.log(html)
    );
}



