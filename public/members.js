
let uploadFile;

window.addEventListener('load',()=>{
    console.log('On load done.')
});

function upload() {
    let fileObject = document.getElementById('uploadFile')
    log.parentElement.style.display='block';
    let index=0;
    while (index<fileObject.files.length) {
        sendFile(fileObject.files[index],'/');
        index++;
    }
}

async function sendFile(file,path) {
    return new Promise((resolve,reject)=>{
        let formData = new FormData();
        let xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", ({loaded, total}) =>{if (loaded==total) resolve(true); progressUpdate(file.name,loaded,total)})
        xhr.upload.addEventListener("error",(error)=>{reject(error)})
        formData.set('uploadFile', file);
        xhr.open("POST", "/upload?path="+encodeURI(path));
        xhr.send(formData);       
    })
    
}

function progressUpdate(fileName,loaded,total) {
    let bar,text;
    let li = document.getElementById(fileName);
    if (li==null) {
        li=document.createElement('li');
        li.setAttribute('id',fileName);

        log.appendChild(li);

        bar = document.createElement('span');
        text = document.createElement('span');
        bar.classList.add('bar');
        li.appendChild(text);
        li.appendChild(bar);
        console.log(li);
    }
    bar = li.children[1];
    text = li.children[0]
    let completed = Math.floor(100 * loaded / total)
    let tKb=Math.floor(total/1024);
    bar.style.width = 10 * completed/100+'rem';
    text.innerText = fileName + ' : ['+tKb+']' + completed+'%';
    if (completed==100) {
        li.style = 'color: #AAA';
        setTimeout(()=>{
            log.removeChild(li); 
            li=undefined; 
            if (log.children.length==0) log.parentElement.style.display ='none';

        },1000);
    }
}