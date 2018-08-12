global.window = global.document = global;

var app = require("express")();
var server = require("http").Server(app);
var io = require("socket.io").listen(server);


app.get('/', function (req, res) {
	res.sendFile('/index.html', {root: __dirname});
});

app.get('/*', function (req, res, next) {
	var file = req.params[0];
	res.sendFile(__dirname + '/' + file);
	
});

users = [];

io.on("connection", function (socket) {
	
	socket.on('login',(user)=>{
		if (users[user.id]!=undefined && users[user.id].password === user.password){
			socket.emit('accept');
			socket.user_id = user.id;
		}
		else
			socket.emit('wrong');
	});

	socket.on('sign_up',(user)=>{
		if (users[user.id]!=undefined) {
			socket.emit('dup');
			return;
		}
		users[user.id] = {};
		users[user.id].password = user.password;
		socket.user_id = user.id;
		socket.emit('accept');
	});
	
});

server.listen(4004, function () {
	console.log("listening on *:4004");
});
