

let messageArea;

window.addEventListener('load',()=>{
    messageArea = document.getElementById('messageArea');


    for (let el of document.getElementsByTagName('input')) {
        if (el.value.length>0 && el.nextElementSibling)  el.nextElementSibling.classList.add('filled');
        if (el.type!='submit') {
            el.addEventListener('change',function(){
   
                if (this.value.length==0) {
                    this.nextElementSibling.classList.remove('filled');
                } else {
                    this.nextElementSibling.classList.add('filled');}                    
            })

            el.addEventListener('focus',function(){
                if (this.nextElementSibling) this.nextElementSibling.style['transform']= 'translateX(-'+(this.nextElementSibling.offsetWidth+30)+'px)';
            })
        } 
            

    }
})
