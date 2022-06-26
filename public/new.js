
let messageArea;

window.addEventListener('load',()=>{
    messageArea = document.getElementById('messageArea');
    submit = document.getElementById('submit');
    submit.disabled=true;
    for (let el of document.getElementsByTagName('input')) {
        if (el.value.length>0 && el.nextElementSibling)  el.nextElementSibling.classList.add('filled');
        if (el.type!='submit') {
            el.addEventListener('change',function(){
                
                if (this.value.length==0) {
                    this.nextElementSibling.classList.remove('filled');
                } else {
                    validateForm();
                    this.nextElementSibling.classList.add('filled');}                    
            })

            el.addEventListener('focus',function(){
                if (this.nextElementSibling) this.nextElementSibling.style['transform']= 'translateX(-'+(this.nextElementSibling.offsetWidth+30)+'px)';
            })

            el.addEventListener('focusout',function(){
                if (this.nextElementSibling) this.nextElementSibling.style['transform']= 'translateX(0rem)';
                if (this.getAttribute('id')=='email' && this.value.length>3) {      
                    //console.log('checking '+this.value)              
                    let xhr = new XMLHttpRequest()
                    xhr.addEventListener('loadend',(e)=>{
                        let res = JSON.parse(xhr.response);
                        //console.log(res.exists)
                        if (res.exists) {
                            this.classList.add('emailInUse');
                            this.classList.remove('emailNotInUse');
                            messageArea.innerText = 'Email already in use.'

                        } else {
                            this.classList.add('emailNotInUse');
                            this.classList.remove('emailInUse');
                            if (messageArea.innerText=='Email already in use.') messageArea.innerText = '';
                        }
                    })
                    xhr.open('GET','/userExists?email='+this.value.toLowerCase());
                    xhr.send();
                }
            })
        }          
    }

})

function validateForm() {
    email = document.getElementById('email').value
    password = document.getElementById('password').value
    password2 = document.getElementById('password2').value
    displayName = document.getElementById('displayName').value

    if (email.length>3 && validateEmail(email) && password == password2 && password.length >= 6 && displayName.length>1) document.getElementById('submit').disabled=false; else document.getElementById('submit').disabled=true;
   
    let text='';
    if (email.length<3 || !validateEmail(email)) { text += 'Email provided is not a valid email address\n' } 
    if( password != password2 && password2.length>0) { text += 'Passwords provided do not match\n'} 
    if (password.length < 6 && password.length>0) {text += 'Password should be at least 6 charcaters long\n'} 
    // if (displayName.length<1) {text += 'Display name can not be left blank\n'}
    messageArea.innerText = text;
    
}

function validateEmail(email) {
    var emailFormat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return email.match(emailFormat);
}