

var Q = Quisus();

var global_width,global_height;
var weapons = ['Vector','Micro_Uzi','AKM','Scar-L','M416','Groza','Kar-98K','AWM','S1897','S686','M249','Minigun','Pan'];
var tools = ['clone','heal','invisible','bounce','jet','gravity'];

var v_a=function (a, b) {
		return {x: a.x + b.x, y: a.y + b.y}
	},
	v_n=function (a, b) {
		return {x: a.x * b, y: a.y * b}
	},
	v_normal=function (a) {
		var s = v_mod(a);
		return {x:a.x/s,y:a.y/s};
	},
	v_mod=function(a) {
		return Math.sqrt(power2(a.x)+power2(a.y));
	},
	power2 = function (a) {
		return a * a;
	},
	dis = function (a, b) {
		return Math.sqrt(power2(a.x - b.x) + power2(a.y - b.y));
	},
	lerp = function(a,b,k) {
		if (k>1) return b;
		return a+(b-a)*k;
	},
	f_score = function(x) {
		return -142.8959*Math.exp(-0.3437*x)+121.3334;
	};



var player_size = 15;
var bullet_size = 5;
var pickCD = 1;
var prop_org = function(){
		return {
			size : 5,
			speed : 240,
			reload : 0.8,
			bias : 0.02,
			life : 4,
			damage : 10,
			bounce : false,
			recoil : 0,
			penetrate : false
		};
};
var prop_special = function(prop, cha) {
	if (!cha) return prop;
	let s = prop;
	if (cha === 'assassin') {
		s.size *= 1.5;
		s.speed *= 2;
		s.reload *= 1.5;
		s.bias /= 2;
		s.life += 2;
		s.damage *= 3;
		s.recoil *= 2;
		s.penetrate = true;
		s.ammo = Math.round(s.ammo / 2);
	}
	return s;
};

var hss_special = function(p) {
	let cha = p.auto.character;
	if (!cha) {
		p.health = {cur: max_health, max: max_health};
		p.speed = {x: {cur: 0, max: speed_max, acc: speed_acc}, y: {cur: 0, max: speed_max, acc: speed_acc}};
		p.size = 15;
	}
	if (cha === 'assassin') {
		p.health = {cur: max_health / 2, max: max_health / 2};
		p.speed = {x: {cur: 0, max: speed_max * 2, acc: speed_acc * 2}, y: {cur: 0, max: speed_max * 2, acc: speed_acc * 2}};
		p.size = 10;
	}
};

var speed_max = 120;
var speed_acc = 180;
var max_health = 300;
var newOp = function() {
	let op = [];
	for (let i=0;i<=5;i++)
		op.push({u:0,d:0,l:0,r:0});
	return op;
}

Q.Player = Q.GameObject.extend({
	init: function(pid) {
		this.id = pid;
		this.health = {cur: max_health, max: max_health};
		this.speed = {x: {cur: 0, max: speed_max, acc: speed_acc}, y: {cur: 0, max: speed_max, acc: speed_acc}};
		this.hit = [0,0,0,0];
		this.dir = 0;
		this.color = 0;
		this.prop = prop_org();
		this.alpha = 1;
		this.fireCD = 0;
		this.pickCD = 0;
		this.size = 15;
		this.auto = {};
	},

	isArmed: function() {
		return (typeof this.weapon === 'string' && this.weapon.length>0);
	}
	
});

Q.Auto_player = Q.GameObject.extend({
	init: function(proto) {

		this.opPerFrame = newOp();
		this.opFire = 0;
		this.opPick = 0;
		this.opSkill = 0;
		for (var event in proto)
			if (proto.hasOwnProperty(event))
				this[event] = proto[event];
	},

	fire: function() {
		this.opFire = 1;
	},

	pick: function() {
		this.opPick = 1;
	},

	moveUp: function(pri) {
		this.opPerFrame[pri || 0].u = 1;
	},

	moveDown: function(pri) {
		this.opPerFrame[pri || 0].d = 1;
	},

	moveLeft: function(pri) {
		this.opPerFrame[pri || 0].l = 1;
	},

	moveRight: function(pri) {
		this.opPerFrame[pri || 0].r = 1;
	},

	say: function(msg) {
		this.msg = msg.toString();
	},

	skill: function() {
		this.opSkill = 1;
	}
});

Q.bullet = Q.GameObject.extend({
	init:function (p) {

		this.pos = {x: p.pos.x, y: p.pos.y};
		this.owner_id = p.id;
		this.alpha = 1;
		this.size = p.prop.size;

		this.speed = p.prop.speed;
		this.life = {cur: 0, max: p.prop.life};
		this.bounce = p.prop.bounce || p.bounce;
		this.damage = p.prop.damage;
		this.color = p.color;
		this.penetrate = p.prop.penetrate;
		if (p.prop.seek != undefined)
			this.seek = p.prop.seek;

		//弹道偏移
		let b = p.prop.bias;
		let start_dir = p.dir + Math.PI / 2 * (Math.random() * 2 * b - b);
		this.dir = {x: Math.cos(start_dir), y: Math.sin(start_dir)};
	},

	seek: function(target) {
		if (target==undefined) return false;
		let d = dis(this.pos,target);
		let b= {x:(target.x-bullet.pos.x)/d/8,y:(target.y-bullet.pos.y)/d/8};
		this.dir=v_normal(v_a(b,this.dir));
		return true;
	}
});

Q.weapon = Q.GameObject.extend({
	init : function (pos,id) {
		this.pos = {x:pos.x,y:pos.y};
		this.id = id;
	}
});

Q.tool = Q.GameObject.extend({
	init : function(pos, id) {
		this.id = id;
		this.pos = {x:pos.x, y:pos.y};
	}
});

Q.core = Q.Evented.extend({
	init : function(enviroment,size,block_size,callback) {
		global_width = size.width;
		global_height = size.height;
		this.width = size.width;
		this.height = size.height;
		this.block_width = block_size.width;
		this.block_height = block_size.height;
		this.player_count = 0;
		this.clock = 100;
		delete this.gravity;
		delete this.gravity_immune_id;
		this.stat = [];
		this.timers = [];
		this.players = [];
		this.bullets = [];
		this.weapons = [];
		this.tools = [];
		this.terrain = [];
		this.genwpn={cur:0,max:300};
		this.gentool={cur:0,max:500};
		this.generate_terrain();
		this.renderer = new Q.renderer(enviroment,size,block_size,this.terrain);
		this.running = false;
		this.competing = false;
		this.finished = false;
		this.callback = callback;
		Q.pauseGame();
		Q.gameLoop(this.update.bind(this));
	},

	compute_score: function() {
		let n = 0;
		let total_score = 0;
		let winner = [];
		for (let id in this.stat)
			if (this.stat[id] && this.stat[id].score) {
				n++;
				total_score += this.stat[id].score;
				if (this.players[id] && this.players[id].health && this.players[id].health.cur > 0) {
					winner.push(this.players[id]);
				}
			}

		winner.sort((a, b)=>{
			if (a.health.cur < b.health.cur)
				return 1;
			else if (a.health.cur > b.health.cur)
				return -1;
			else if (this.stat[a.id].kill < this.stat[b.id])
				return 1;
			else if (this.stat[a.id].kill > this.stat[b.id])
				return -1;
			else if (this.stat[a.id].output < this.stat[b.id].output)
				return 1;
			else if (this.stat[a.id].output > this.stat[b.id].output)
				return -1;
			else
				return 0;
		});
		let winner_id = winner[0].id;

		for (let id in this.stat)
			if (this.stat[id] && this.stat[id].score) {
				let score0 = this.stat[id].score;
				let score1 = (total_score - score0)/(n-1);
				let k = this.stat[id].kill;
				let d = this.stat[id].death === 0 ? 1 : this.stat[id].death;
				let o = this.stat[id].output / max_health;

				if (id === winner_id)
					this.stat[id].d_score = Math.round(Math.max(0, f_score(score1/score0))*(k+o)/(d));
				else
					this.stat[id].d_score = Math.round(Math.min(0,-f_score(score0/score1))+10*(k+o)/d);
			}
	},

	gameover: function(fail_id) {
		this.finished = true;
		this.running = false;
		this.competing = false;
		this.clock = 100;
		if (fail_id!=undefined)
			this.callback(fail_id, true);
		else {
			this.compute_score();
			this.callback(this.stat);
		}
	},

	add_player: function (pid, code, score, silent, ghost) {
		
		let proto;
		let auto;
		let com_code = "()=>{" + code + "return tank;}";
		try {
			proto = eval(com_code)();
		}
		catch(err) {
			if (!silent)
				alert('WTTTF? What a shitty code!');
			return;
		}

		if (!this.players[pid]) this.player_count++;

		if (ghost && ghost===true) {
			let p = this.players[pid];
			while (p.ghost) p = p.ghost;
			p.ghost = new Q.Player(pid);
			let g = p.ghost;
			g.auto = new Q.Auto_player(proto);
			g.color = this.players[pid].color;
			g.health = {cur:p.health.cur,max:p.health.max};
			g.speed = {x: {cur: 0, max: p.speed.x.max, acc: p.speed.x.acc}, y: {cur: 0, max: p.speed.y.max, acc: p.speed.y.acc}};
			g.pos = {x:p.pos.x,y:p.pos.y};
			g.size = p.size;
			g.code = code;
			return;
		}
		this.players[pid] = new Q.Player(pid);
		this.players[pid].auto = new Q.Auto_player(proto);
		p = this.players[pid];

		p.prop = prop_special(prop_org(), p.auto.character);
		hss_special(p);
		p.color = Math.floor(Math.random()*11);
		p.pos = this.random_pos();
		p.code = code;
		this.stat[pid] = {
			kill : 0,
			death : 0,
			output : 0,
			score : score
		};
	},

	add_timer : function(callback, timeout) {
		this.timers.push({clock:timeout,callback:callback});
	},

	remove_player: function (pid) {
		delete this.players[pid].auto;
		delete this.players[pid];
		this.player_count--;
		if (this.player_count <= 1)
			this.gameover();
	},

	get_players: function() {
		let players = [];
		for (let id in this.players) 
			if (this.players[id] && this.players[id].id)
				players.push(id);

		return players;
	},

	move_u: function (p, dt) {
		p.speed.y.cur = Math.max(p.speed.y.cur - dt * p.speed.y.acc, -p.speed.y.max);
	},
	move_d: function (p, dt) {
		p.speed.y.cur = Math.min(p.speed.y.cur + dt * p.speed.y.acc, p.speed.y.max);
	},
	move_l: function (p, dt) {
		p.speed.x.cur = Math.max(p.speed.x.cur - dt * p.speed.x.acc, -p.speed.x.max);
	},
	move_r: function (p, dt) {
		p.speed.x.cur = Math.min(p.speed.x.cur + dt * p.speed.x.acc, p.speed.x.max);
	},
	
	check_hit_terrain: function(p) {
		if (p.hit[0]+p.hit[1]+p.hit[2]+p.hit[3] > 0)
			return {u:p.hit[0],d:p.hit[1],l:p.hit[2],r:p.hit[3]};
		else
			return null;
	},

	update_player_physics: function (p, dt, is_no_x, is_no_y, is_no_j) {
		let speed_limit = true;
		if (this.gravity && this.gravity_immune_id && this.gravity_immune_id !== p.id) {
			is_no_x = false;
			is_no_y = false;
			speed_limit = false;
			p.speed.x.cur += this.gravity.x.cur * dt * 5;
			p.speed.y.cur += this.gravity.y.cur * dt * 5;
		}

		//后坐力
		if (!is_no_j) {
			p.speed.x.cur -= Math.cos(p.dir) * p.prop.recoil * 10;
			p.speed.y.cur -= Math.sin(p.dir) * p.prop.recoil * 10;
			if (speed_limit) {
				p.speed.x.cur = Math.max(Math.min(p.speed.x.cur,p.speed.x.max),-p.speed.x.max);
				p.speed.y.cur = Math.max(Math.min(p.speed.y.cur,p.speed.y.max),-p.speed.y.max);
			}
		}
		else {
			//粘滞阻力
			if (is_no_x) {
			if (p.speed.x.cur > 0)
				p.speed.x.cur = Math.max(0, p.speed.x.cur - dt * p.speed.x.acc);
			else
				p.speed.x.cur = Math.min(0, p.speed.x.cur + dt * p.speed.x.acc);
			}
			if (is_no_y) {
			if (p.speed.y.cur > 0)
				p.speed.y.cur = Math.max(0, p.speed.y.cur - dt * p.speed.y.acc);
			else
				p.speed.y.cur = Math.min(0, p.speed.y.cur + dt * p.speed.y.acc);
			}
		}

		//地形碰撞检测
		p.hit = [0,0,0,0];
		check=[[0,-1],[0,1],[-1,0],[1,0]];

		for (let i=0;i<4;i++) {
			block_x = Math.floor((p.pos.x+check[i][0]*p.size) / this.block_width);
			block_y = Math.floor((p.pos.y+check[i][1]*p.size) / this.block_height);
			if (this.terrain[block_x]!=undefined)
			if (this.terrain[block_x][block_y]!=undefined)
			if (this.terrain[block_x][block_y]==1) {
				p.hit[i] = 1;
				if ((i===0 && p.speed.y.cur<0) || (i===1 && p.speed.y.cur>0)) p.speed.y.cur = 0;
				if ((i===2 && p.speed.x.cur<0) || (i===3 && p.speed.x.cur>0)) p.speed.x.cur = 0;
			}
		}

		p.pos.x = p.pos.x + p.speed.x.cur * dt;
		p.pos.y = p.pos.y + p.speed.y.cur * dt;

		//越界检测
		if (p.pos.x - p.size<= 0) {p.speed.x.cur=0; p.pos.x = p.size; p.hit[2]=1;}
		if (p.pos.y - p.size<= 0) {p.speed.y.cur=0; p.pos.y = p.size; p.hit[0]=1;}
		if (p.pos.x + p.size>= this.width) {p.speed.x.cur=0; p.pos.x = this.width - p.size; p.hit[3]=1;}
		if (p.pos.y + p.size>= this.height) {p.speed.y.cur=0; p.pos.y = this.height - p.size; p.hit[1]=1;}
	},
	
	update_bullet_physics:function (b,dt) {
		if (this.gravity) {
			let v_speed = v_a(v_n(b.dir, b.speed), {x:this.gravity.x.cur*dt*8,y:this.gravity.y.cur*dt*8});
			b.dir = v_normal(v_speed);
			b.speed = v_mod(v_speed);
		}
		b.pos = v_a(b.pos, v_n(b.dir, dt * b.speed));

		if (b.pos.x < 0 || b.pos.x > this.width)
			if (b.bounce==true)
				b.dir.x = -b.dir.x;
			else
				b.destroyable = true;
		if (b.pos.y < 0 || b.pos.y > this.height)
			if (b.bounce==true)
				b.dir.y = -b.dir.y;
			else
				b.destroyable = true;

		//地形反弹
		if (!b.penetrate) {
		b_check=[[b.dir.x>0?1:-1,0],[0,b.dir.y>0?1:-1]];
		for (let i=0;i<2;i++) {
			bblck_x = Math.floor((b.pos.x+b_check[i][0]*b.size) / this.block_width);
			bblck_y = Math.floor((b.pos.y+b_check[i][1]*b.size) / this.block_height);
			if (this.terrain[bblck_x]!=undefined)
				if (this.terrain[bblck_x][bblck_y]!=undefined)
					if (this.terrain[bblck_x][bblck_y]==1) {
						if (b.bounce==true) {
							if (i==0) b.dir.x = -b.dir.x;
							if (i==1) b.dir.y = -b.dir.y;
						}
						else {
							b.destroyable=true;
							break;
						}
					}
		}
		}

		b.life.cur += dt;
		if (b.life.cur >= b.life.max) b.destroyable=true;
	},

	check_terrain: function(pos) {
		let bx = Math.floor(pos.x/this.block_width);
		let by = Math.floor(pos.y/this.block_height);
		if (this.terrain[bx]!==undefined)
			if (this.terrain[bx][by]!==undefined)
				return this.terrain[bx][by]===1;
		return true;
	},
	

	random_pos : function() {
		let pos = {
			x: Math.floor(Math.random() * this.width),
			y: Math.floor(Math.random() * this.height)
		};
		while (this.check_terrain(pos)) {
			pos = {
				x: Math.floor(Math.random() * this.width),
				y: Math.floor(Math.random() * this.height)
			}
		}
		return pos;
	},
	
	generate_terrain: function() {
		let w = this.width / this.block_width;
		let h = this.height / this.block_height;

		this.terrain = [];

      	//地形周围单元计数
      	let count=function(t,x,y,f) {
      		let c=0;
      		for (let i=x-f;i<=x+f;i++)
        		for (let j=y-f;j<=y+f;j++)
          			if (t[i]!=undefined)
            			if (t[i][j]!=undefined)
              				if (t[i][j]==1)	c++;
      		return c;
    	};

    	//地形迭代
    	let evol = function(t,opt) {
    		for (let dd=0;dd<opt.d;dd++) {
    			let _terrain=[];
    			for (let i=-1;i<=w+1;i++) {
      				_terrain[i]=[];
      				for (let j=-1;j<=h+1;j++) {
        				if (count(t,i,j,opt.w)>=opt.s)
          					_terrain[i][j]=1;
        				else
          				_terrain[i][j]=0;
      				}
    			}
    			t=_terrain;
			}
			return t;
    	};

    	//地形参数
    	let main={p:0.471 , w:2, s:13 , d:25};

		//地形随机化
		this._terrain=[];
  		for (let i=-3;i<=w+3;i++) {
    		this._terrain[i]=[];
    		for (let j=-3;j<=h+3;j++) {
      			this._terrain[i][j]=Math.random()<main.p?1:0;
    		}
      	}

    	//主地形迭代
    	this.terrain = evol(this._terrain,main);
	},

	generate_weapon: function(_pos,_id) {
		let pos = _pos || this.random_pos();
		let id = _id || weapons[Math.floor(Math.random()*weapons.length)];
		let new_wpn = new Q.weapon(pos, id);
		this.weapons.push(new_wpn);
	},

	generate_tool: function(_pos, _id) {
		let pos = _pos || this.random_pos();
		let id = _id || tools[Math.floor(Math.random()*tools.length)];
		let new_tool = new Q.tool(pos, id);
		this.tools.push(new_tool);
	},

	new_bullet: function (player) {
		let new_bullet = new Q.bullet(player);
		this.bullets.push(new_bullet);
	},
	
	delete_bullet: function (index) {
		this.renderer.add_animation('bullet','fadeout',this.bullets[index]);
		delete this.bullets[index];
	},

	delete_weapon: function (index) {
		delete this.weapons[index];
	},

	delete_tool: function(index) {
		delete this.tools[index];
	},
	
	update_weapons:function() {
		this.genwpn.cur+=1;
		if (this.genwpn.cur>=this.genwpn.max) {
			this.generate_weapon();
			this.genwpn.cur=0;
		}
	},

	update_tools:function() {
		this.gentool.cur+=1;
		if (this.gentool.cur>=this.gentool.max) {
			this.generate_tool();
			this.gentool.cur=0;
		}
	},


	player_get_tool: function(p, tid) {

		if (tid === 'clone') {
			this.add_player(p.id, p.code, null,true, true);
		}
		if (tid === 'heal' && p.health) {
			p.health.cur = Math.min(p.health.cur + 200, p.health.max);
		}
		if (tid === 'invisible') {
			p.invisible = true;
			this.add_timer(()=>{delete p.invisible}, 10);
		}
		if (tid === 'bounce') {
			p.bounce = true;
			this.add_timer(()=>{delete p.bounce}, 15);
		}
		if (tid === 'jet') {
			p.speed.x.max = p.speed.x.max + speed_max;
			p.speed.y.max = p.speed.y.max + speed_max;
			p.speed.x.acc = p.speed.x.acc + speed_acc;
			p.speed.y.acc = p.speed.y.acc + speed_acc;

			this.add_timer(()=>{
				p.speed.x.max = p.speed.x.max - speed_max;
				p.speed.y.max = p.speed.y.max - speed_max;
				p.speed.x.acc = p.speed.x.acc - speed_acc;
				p.speed.y.acc = p.speed.y.acc - speed_acc;
			}, 15);
		}
		if (tid === 'gravity' && !this.gravity && !this.gravity_immune_id) {

			this.gravity_immune_id = p.id;
			this.gravity = p.speed;
			this.add_timer((()=>{
				delete this.gravity_immune_id;
				delete this.gravity;
			}).bind(this), 10);
		}

	},

	update_clocks: function(dt) {
		this.clock -= dt;
		let i = 0;
		while (i < this.timers.length) {
			let t = this.timers[i];
			t.clock -= dt;
			if (t.clock <= 0) {
				t.callback();
				this.timers.splice(i, 1);
			}
			else
				i++;
		}
	},

	update: function (dt) {
		if (this.running) {
			this.update_weapons();
			this.update_tools();
			this.update_players(dt);
			this.update_bullets(dt);
			this.update_clocks(dt);
			if (this.clock <= 0) {
				this.gameover();
				return;
			}
		}
		this.renderer.render(this.players,this.bullets,this.weapons,this.tools,this.clock,dt);
	},
	
	trigger_events: function(p, auto) {
		if (auto.onEvent)
			auto.onEvent();

		if (auto.onHitWall) {
			let dir = this.check_hit_terrain(p);
			if (dir)
				auto.onHitWall(dir);
		}

		if (auto.onWeaponSpotted) {
			let weapons = [];
			for (var id in this.weapons) {
				let w = this.weapons[id];
				if (w!=null && w.id) {
					weapons.push({
						id : w.id,
						pos : {
							x : w.pos.x,
							y : w.pos.y
						}
					});
				}
			}
			if (weapons.length>0)
				auto.onWeaponSpotted(weapons);
		}

		if (auto.onToolSpotted) {
			let tools = [];
			for (var id in this.tools) {
				let t = this.tools[id];
				if (t && t.id) {
					tools.push({
						id : t.id,
						pos : {
							x : t.pos.x,
							y : t.pos.y
						}
					});
				}
			}
			if (tools.length>0)
				auto.onToolSpotted(tools);
		}

		if (auto.onEnemySpotted) {
			let enemies = [];
			for (var id in this.players) {
				let q = this.players[id];

				if (id !== p.id && q.pos && q.speed && !q.invisible) {

					enemies.push({
						pos : {
							x : q.pos.x,
							y : q.pos.y
						},
						speed : {
							x : q.speed.x.cur,
							y : q.speed.y.cur
						},
						health : q.health.cur
					});
					while (q.ghost && q.ghost.pos && q.ghost.speed) {
						enemies.push({
						pos : {
							x : q.ghost.pos.x,
							y : q.ghost.pos.y
						},
						speed : {
							x : q.ghost.speed.x.cur,
							y : q.ghost.speed.y.cur
						},
						health : q.ghost.health.cur
						});
						q = q.ghost;
					}
				}
			}
			if (enemies.length > 0)
				auto.onEnemySpotted(enemies.sort(()=>{return 0.5-Math.random()}));
		}
	},

	execute_ops: function(a, p, dt) {
		let op = {u:0,l:0,d:0,r:0};
		for (let i=5;i>=0;i--) {
			let _op = a.opPerFrame[i];
			if (_op.u + _op.d + _op.l + _op.r > 0) {
				op = _op;
				break;
			}
		}
		if (op.u) this.move_u(p,dt);
		if (op.d) this.move_d(p,dt);
		if (op.l) this.move_l(p,dt);
		if (op.r) this.move_r(p,dt);

		if (a.opPick && p.pickCD <= 0) {
			this.player_use(p);
			p.pickCD = pickCD;
		}
		p.pickCD = Math.max(0, p.pickCD - dt);

		if (a.opFire && p.fireCD <= 0) {
			this.player_shoot(p);
			p.fireCD = p.prop.reload;
		}
		p.fireCD = Math.max(0, p.fireCD - dt);


		return op;
	},

	copy_context: function(p, a, dt) {
		a.x = p.pos.x;
		a.y = p.pos.y;
		a.health = p.health.cur;
		a.dir = p.dir;
		a.bullet_speed = p.prop.speed;
		a.dt = dt;
		a.speed = {x:p.speed.x.cur, y:p.speed.y.cur};
	},

	replace_context: function(p, a) {
		if (a.dir)
			p.dir = a.dir;
	},

	player_workflow:function(p, a, dt) {
		this.player_check_tools(p);
		this.copy_context(p, a, dt);
		try {
			this.trigger_events(p, a);	
		}
		catch (err) {
			this.gameover(p.id);
			return;
		}
		this.replace_context(p, a);

		let op = this.execute_ops(a, p, dt);
		this.update_player_physics(p, dt, (op.l===0 && op.r===0), (op.u===0 && op.d===0), a.opFire===0);
		a.opFire = 0;
		a.opPerFrame = newOp();
	},

	update_players: function(dt) {
		for (let id in this.players) 
			if (this.players[id]!=null) {
				let p = this.players[id];
				let a = p.auto;

				this.player_workflow(p, a, dt);
				while (p.ghost && p.ghost.auto) {
					this.player_workflow(p.ghost, p.ghost.auto, dt);
					p = p.ghost;
				}
			//TODO
			/*
			if (this.players[id].prop.seek===true) {
				this.players[id].prop.target = '#';
				for (let _id in this.players)
					if (_id!==id) {
						this.players[id].prop.target = _id;
						break;
					}
			}
			*/
		}
	},

	update_bullets: function(dt) {
		for (let index in this.bullets)
			if (!!this.bullets[index]) {
				let b = this.bullets[index];
				this.update_bullet_physics(b,dt);
				this.bullet_check_hit(index);
				if (b.seek===true && this.players[b.owner_id]!=undefined && this.players[b.owner_id].prop.target!=undefined)
					this.bullet_seek(b,this.players[this.players[b.owner_id].prop.target]);

				if (b.destroyable===true)
						this.delete_bullet(index);

			}
	},

	player_shoot: function(p) {
		if (p.isArmed()) {
			if (p.weapon==='Pan') {
				
				p.reflect = true;
				setTimeout(()=>{p.reflect=false},850);
				for (let id in this.players) {
					let q = this.players[id];
					if (id !== p.id)
						if (dis(p.pos,q.pos)<5*p.size)
							this.cause_damage_to_player(p.id,q,p.prop.damage);
				}
				return;
			}

			if (p.ammo>0)
				p.ammo-=1;
			else {
				p.weapon = '';
				p.ammo = 0;
				p.prop = prop_org();
			}
		}
		for (let i=0;i<(p.prop.bundle || 1);i++)
			this.new_bullet(p);
	},
	
	player_use: function (p) {
		for (let index in this.weapons) {
			let w = this.weapons[index];
			if (w)
				if (dis(p.pos,w.pos)<p.size+35) {
					p.weapon = w.id;
					p.prop = prop_special(Q.weapon_data[w.id](), p.auto.character);
					p.ammo = p.prop.ammo;
					this.delete_weapon(index);
					break;
				}
		}
	},

	player_check_tools: function(p) {
		for (let index in this.tools) {
			let t = this.tools[index];
			if (t)
				if (dis(p.pos,t.pos)<p.size+25) {
					this.player_get_tool(p, t.id);
					this.delete_tool(index);
				}
		}
	},

	bullet_check_hit_core: function(bullet, p) {
		if (p.id !== bullet.owner_id)
				if (dis(bullet.pos, p.pos) < bullet.size + p.size) {

					if (p.reflect===true) {

							let a = Math.atan(bullet.dir.y / bullet.dir.x);
							if (bullet.dir.x<0) a=a+Math.PI;
							let r = Math.atan((bullet.pos.y - p.pos.y)/(bullet.pos.x - p.pos.x));
							if (bullet.pos.x<p.pos.x) r=r+Math.PI;

							let new_dir = 2*r+Math.PI - a;
							bullet.dir = {x:Math.cos(new_dir),y:Math.sin(new_dir)};
							bullet.owner_id = p.id;
							/*
							if (this.players[id]!=undefined)
								this.players[id].prop.seek = bullet.seek;*/
							bullet.color = p.color;
							return false;

					}

					this.cause_damage_to_player(bullet.owner_id,p,bullet.damage);
					bullet.destroyable = true;
					return true;
				}
		return false;
	},

	bullet_check_hit: function (bindex) {
		let bullet = this.bullets[bindex];
		if (!bullet) return;
		for (let id in this.players) {
			let p = this.players[id];
			if (p) {
				let flag = this.bullet_check_hit_core(bullet, p);
				while (p.ghost && !flag) {
					flag = this.bullet_check_hit_core(bullet, p.ghost);
					p = p.ghost;
				}
				if (flag) return;
			}
		}
	},

	cause_damage_to_player: function (oid,p,dmg) {
		if (dmg===0) return;
		p.health.cur -=dmg;
		this.stat[oid].output += dmg;
		this.renderer.add_animation('player','underatk',p);
		if (p.health.cur <= 0) {
			if (this.stat[oid]) this.stat[oid].kill++;
			if (this.players[p.id].health.cur <= 0) {
				this.stat[p.id].death++;
				this.remove_player(p.id);
			}
			else {
				let f = this.players[p.id];
				let g = f.ghost;
				while (g.health.cur > 0 && g.ghost) {
					f = g;
					g = g.ghost;
				}
				if (g.health.cur <= 0)
					f.ghost = g.ghost;
			}
		}
	}
	
});


Q.weapon_data = [];
Q.weapon_data['Vector']=function(){ return {
			size : 3,
			speed : 360,
			reload : 0.05,
			bias : 0.03,
			life : 7,
			damage : 4,
			recoil : 0,
			size : 1.5,
			penetrate : false,
			bounce : false,
			ammo : 80
		}};
Q.weapon_data['Micro_Uzi']=function(){ return {
			size : 2,
			speed : 280,
			reload : 0.02,
			bias : 0.5,
			life : 7,
			damage : 3,
			recoil : 0.1,
			size : 2,
			penetrate : false,
			bounce : false,
			ammo : 200
		}};
//突击步枪
Q.weapon_data['AKM']=function(){ return {
			size : 6,
			speed : 300,
			reload : 0.2,
			bias : 0.1,
			life : 8,
			damage : 25,
			recoil : 0.5,
			sight : 1,
			penetrate : false,
			bounce : false,
			ammo : 30
		}};
Q.weapon_data['Scar-L']=function(){ return {
			size : 5,
			speed : 310,
			reload : 0.23,
			bias : 0.03,
			life : 6,
			damage : 20,
			recoil : 0.3,
			penetrate : false,
			bounce : false,
			ammo : 30
		}};
Q.weapon_data['M416']=function(){ return {
			size : 5,
			speed : 330,
			reload : 0.26,
			bias : 0.05,
			life : 6,
			damage : 18,
			recoil : 0.2,
			penetrate : false,
			bounce : false,
			ammo : 30
		}};
Q.weapon_data['Groza']=function(){ return {
			size :6,
			speed : 330,
			reload : 0.3,
			bias : 1,
			life : 6,
			damage : 10,
			recoil : 0.2,
			penetrate : false,
			bounce : false,
			bundle : 36,
			ammo : 12
		}};
//狙击步枪
Q.weapon_data['Kar-98K']=function(){ return {
			size : 8,
			speed : 900,
			reload : 1.2,
			bias : 0.02,
			life : 12,
			damage : 80,
			recoil : 4,
			size : 3,
			penetrate : true,
			bounce : false,
			ammo : 10
		}};
Q.weapon_data['AWM']=function(){ return {
			size : 10,
			speed : 1000,
			reload : 2.5,
			bias : 0,
			life : 13,
			damage : 200,
			recoil : 20,
			size : 2.5,
			penetrate : true,
			bounce : false,
			ammo : 7
		}};
//霰弹枪
Q.weapon_data['S1897']=function(){ return {
			size : 3,
			speed : 600,
			reload : 0.8,
			bias : 0.2,
			life : 4,
			damage : 20,
			recoil : 5,
			size : 4,
			penetrate : false,
			bounce : false,
			bundle : 8,
			ammo : 10
		}};
Q.weapon_data['S686']=function(){ return {
			size : 2.8,
			speed : 720,
			reload : 2.2,
			bias : 0.3,
			life : 3,
			damage : 32,
			recoil : 15,
			size : 5,
			penetrate : false,
			bounce : false,
			bundle : 15,
			ammo : 8
		}};
//轻机枪
Q.weapon_data['M249']=function(){ return {
			size : 4,
			speed : 380,
			reload : 0.12,
			bias : 0.05,
			life : 12,
			damage : 8,
			recoil : 0.2,
			size : 4,
			penetrate : false,
			bounce : false,
			ammo : 80
		}};
Q.weapon_data['Minigun']=function(){ return {
			size : 5,
			speed : 400,
			reload : 0.07,
			bias : 0.04,
			life : 10,
			damage : 8,
			recoil : 0.15,
			penetrate : false,
			bounce : false,
			ammo : 120
		}};
Q.weapon_data['Pan']=function(){return {
			reload : 1,
			damage : 35,
			recoil : 0,
			ammo : 0
		}};


