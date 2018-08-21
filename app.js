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
			if (results[0] && results[0].password === user.password) {
				socket.emit('accept',user.id);
				socket.user_id = user.id;
			}
			else
				socket.emit('wrong');
		});
	});

	socket.on('sign_up',(user)=>{


		let sql_query = "SELECT password FROM main WHERE id='" + user.id + "';";
		connection.query(sql_query, function(error, results, fields){
			if (error) throw error;
			if (results[0]!=undefined && results[0].password!=undefined)
				socket.emit('dup');
			else {
				let sql_insert = "INSERT INTO main (id,password,num_kill,num_death,code,score) VALUES ('" +
				  user.id + "','" +
				  user.password + "'," +
				  "0," +
				  "0," +
				  "'',1000);";
		
				connection.query(sql_insert, function(error, results, fields){
					if (error) throw error;
					socket.emit('accept', user.id);
				});
			}
		});

	});

	socket.on('get_repo', ()=>{

		let sql = "SELECT id, num_kill, num_death FROM main;";

		connection.query(sql, function(error, results, fields){
			if (error) throw error;
			socket.emit('recv_repo', results);
		});
	});

	socket.on('fetch_code', (id)=>{
		let sql = "SELECT code,score FROM main WHERE id = '" + id + "';";

		connection.query(sql, function(error, results, fields){
			if (error) throw error;
			if (results[0]!=undefined && results[0].code != undefined)
				socket.emit('recv_code', results[0]);
			else
				socket.emit('unauthorized');
		});
	});

	socket.on('fetch_all_code', ()=>{
		let sql = "SELECT id, code, score FROM main;";

		connection.query(sql, function(error, results, fields){
			if (error) throw error;
			socket.emit('recv_all_code',results);
		});
	});

	socket.on('fetch_init_code', (id)=>{
		let sql = "SELECT code,score FROM main WHERE id = '" + id + "';";

		connection.query(sql, function(error, results, fields){
			if (error) throw error;
			if (results[0]!=undefined && results[0].code != undefined)
				socket.emit('init_code', results[0]);
			else
				socket.emit('unauthorized');
		});
	});

	socket.on('update_code', (info)=>{
		info.code = info.code.replace(/\'/g,"\\'");
		info.code = info.code.replace(/\"/g,'\\"');
		let sql = "UPDATE main SET code = '" + info.code + "' WHERE id = '" + info.id + "';";

		connection.query(sql, function(error, results, fields){
			if (error) throw error;
		});
	});

	socket.on('update_data', (_stat)=>{

		let stat = [];
		for (let i=0; i < _stat.length; i++)
				if (_stat[i]!=undefined)
					stat[_stat[i][0]] = {
						kill : _stat[i][1],
						death : _stat[i][2],
						d_score : _stat[i][4]
					};

		let sql_fetch = "SELECT id, num_kill, num_death, score FROM main;";

		connection.query(sql_fetch, function(error, results){
		 	if (error) throw error;
			for (let i=0; i < results.length; i++)
				if (results[i]!=undefined && stat[results[i].id]!=undefined) {
					results[i].num_kill += stat[results[i].id].kill;
					results[i].num_death += stat[results[i].id].death;
					results[i].score = Math.max(1, results[i].score + stat[results[i].id].d_score);
				}
			for (let i = 0; i< results.length; i++)
			if (results[i]!=undefined) {
				let sql_update = "UPDATE main SET num_kill = " + results[i].num_kill + ", num_death = " + results[i].num_death + ", score = " +results[i].score + " WHERE id = '" + results[i].id + "';";
				
				connection.query(sql_update, function(error, results){
					if (error) throw error;
				});
			}
		});	
	});
	
});

server.listen(80, function () {
	console.log("listening on *:80");
});
