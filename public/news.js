
let clientId;
window.addEventListener('load',()=>{
    //// Subscribe to server events
    const serverEvents = new EventSource('/events');
    serverEvents.addEventListener('message',(event)=>{
        let data = JSON.parse(event.data);
        console.log(data);
        if (data.event==undefined) return;
        switch (data.event) {
            case 'register':
                clientId = data.clientId;
               
                for (let section of document.getElementsByClassName('section')) {
                    section.addEventListener('click',function(){
                        document.getElementById('news').innerText='Loading '+this.innerText+' news ...';
                        let section= this.getAttribute('section'); 
                        let sectionIndex = [...document.getElementsByClassName('section')].indexOf(this)
                        window.localStorage.setItem('activeSection',sectionIndex);
                        for (let s of document.getElementsByClassName('section')) s.classList.remove('active');
                        this.classList.add('active');
                        let dataObject={device:'server', command: 'getNews', section: section};
                        postForm('/action',dataObject); 

                    })
                }

                let sectionIndex = window.localStorage.getItem('activeSection')
                if (sectionIndex==undefined) sectionIndex=0;
                let click = new MouseEvent('click')
                document.getElementsByClassName('section')[sectionIndex].dispatchEvent(click);

                break;
            case 'getNews':
                if (data.clientId != clientId) return;
                const news = document.getElementById('news');      
                news.innerHTML='';
                // let lastOpenDate;
                // let lastOpen = window.localStorage.getItem('lastOpen');                   
                // if (lastOpen==undefined) {
                //     lastOpen = new Object();
                //     lastOpenDate = new Date();
                // } else {
                //     lastOpen = JSON.parse(lastOpen);  
                //     let section = document.getElementsByClassName('active')[0];
                //     lastOpen[section]? lastOpenDate = lastOpen[section] : lastOpenDate = new Date();
                // }
                

                for (let article of data.payload.articles) {
                    let div= document.createElement('div');
                    div.classList.add('new');
                    let subDiv= document.createElement('div');
                    subDiv.classList.add('subdiv');

                    let a = document.createElement('a');

                    let img = document.createElement('img');
                    let desc = document.createElement('span');
                    desc.classList.add('desc');

                    let published = document.createElement('span');
                    published.classList.add('datePublished')

                    if (article.thumbnail) img.src=article.thumbnail.renditions.original['240w']
                    if (article.urlToImage) img.src = article.urlToImage;
                    
                    if (article.canonical_url) a.href='https://www.reuters.com'+article.canonical_url;
                    if (article.url) a.href= article.url;

                    if (article.publishedAt) published.innerText=new Date(article.publishedAt);
                    if (article.published_time) published.innerText=new Date(article.published_time);

                    // let articleDate = new Date(published.innerText);                    
                    // console.log(`Last open : ${lastOpenDate} | Article : ${articleDate} | Comparison : ${articleDate>lastOpen}`)
                    // if (articleDate>lastOpenDate) div.classList.add('unread');
                    a.target='_blank';
                    a.innerText=article.title;
                    desc.innerText= article.description;                   

                    div.appendChild(a);
                    subDiv.appendChild(img);
                    subDiv.appendChild(desc);
                    div.appendChild(subDiv);
                    div.appendChild(published);
                    news.appendChild(div);
                }
                
                // lastOpen = window.localStorage.getItem('lastOpen');                   
                // lastOpen==undefined? lastOpen = new Object() : lastOpen = JSON.parse(lastOpen);              
                // let section = document.getElementsByClassName('active')[0].innerText;                                 
                // lastOpen[section]= new Date();
                // window.localStorage.setItem('lastOpen',JSON.stringify(lastOpen));
                break;
        }
    })


})


function postForm(url, object) {
    object.clientId=clientId;
    fetch(url, {
        method : "POST",
        body: encodeURIComponent(JSON.stringify(object)),
    })
}