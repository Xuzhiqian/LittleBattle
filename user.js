var socket = io.connect();
    var core = {};

    var get_user = ()=>{
        var id = String($("#username-text").val());
        var pswd = String($("#password-text").val());
        var cp = String($("#confirm-text").val());
        if (id.length <= 0) return{};
        return {id:id,password:pswd,cp:cp};
    };

    socket.on('dup',()=>{
        alert('User already exists!');
    });

    socket.on('wrong',()=>{
        alert('Access Denied!');
    });

    socket.on('accept',()=>{
        window.location.href="game.html";
        
    });

    $("#loginBtn").click(()=>{
        var user = get_user();
        if (user.id!=undefined)
            socket.emit('login',user);
    });
    
    $("#signupBtn").click(()=>{
        var user = get_user();
        if (user.password !== user.cp) {
            alert('Inconsist password!');
            return;
        }
        if (user.id!=undefined)
            socket.emit('sign_up',user);
    });