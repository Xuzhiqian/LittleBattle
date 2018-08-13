global.window = global.document = global;

var app = require("express")();
var server = require("http").Server(app);
var io = require("socket.io").listen(server);
var mysql = require("mysql");

//连接数据库
var connection = mysql.createConnection({
	host		: 'localhost',
	user 		: 'root',
	password	: '990212',
	database	: 'littlebattle'
});
connection.connect();


//响应请求
app.get('/', function (req, res) {
	res.sendFile('/index.html', {root: __dirname});
});

app.get('/*', function (req, res, next) {
	var file = req.params[0];
	res.sendFile(__dirname + '/' + file);
	
});


io.on("connection", function (socket) {
	
	socket.on('login',(user)=>{

		let sql = "SELECT password FROM main WHERE id='" + user.id + "';";
		connection.query(sql, function(error, results, fields){
			if (error) throw error;
			if (!results[0] && results[0].password === user.password) {
				socket.emit('accept');
				socket.user_id = user.id;
			}
			else
				socket.emit('wrong');
		});
	});

	socket.on('sign_up',(user)=>{

		let sql = "INSERT INTO main (id,password,num_kill,num_death,code) VALUES ('" +
				  user.id + "','" +
				  user.password + "'," +
				  "0," +
				  "0," +
				  "'');";

		connection.query(sql, function(error, results, fields){
			if (error) {
				socket.emit('dup');
				return;
			}
		});

		socket.user_id = user.id;
		socket.emit('accept', user.id);
	});
	
});

server.listen(4004, function () {
	console.log("listening on *:4004");
});
