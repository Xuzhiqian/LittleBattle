

var Q = Quisus();

var global_width,global_height;
var weapons = ['Micro_Uzi','AKM','Scar-L','M416','Kar-98K','AWM','S1897','S686','M249','Minigun','Pan'];
var v_a=function (a, b) {
		return {x: a.x + b.x, y: a.y + b.y}
	},
	v_n=function (a, b) {
		return {x: a.x * b, y: a.y * b}
	},
	v_normal=function (a) {
		var s = Math.sqrt(power2(a.x)+power2(a.y));
		return {x:a.x/s,y:a.y/s};
	}
	power2 = function (a) {
		return a * a;
	},
	dis = function (a, b) {
		return Math.sqrt(power2(a.x - b.x) + power2(a.y - b.y));
	},
	lerp = function(a,b,k) {
		if (k>1) return b;
		return a+(b-a)*k;
	};



var player_size = 15;
var bullet_size = 5;
var prop_org = {
	speed : 240,
	reload : 0.6,
	bias : 0.02,
	life : 4,
	damage : 20,
	bounce : false,
	recoil : 0,
	penetrate : false
};
var newOp = function() {
	let op = [];
	for (let i=0;i<=5;i++)
		op.push({u:0,d:0,l:0,r:0});
	return op;
}

Q.Player = Q.GameObject.extend({
	init: function(pid) {
		this.id = pid;
		this.pos = {
			x: Math.floor(Math.random() * global_width),
			y: Math.floor(Math.random() * global_height)
		};
		this.health = {cur: 100, max: 100};
		this.speed = {x: {cur: 0, max: 120, acc: 180}, y: {cur: 0, max: 120, acc: 180}};
		this.hit = [0,0,0,0];
		this.dir = 0;
		this.color = 0;
		this.prop = prop_org;
		this.alpha = 1;
		this.fireCD = 0;
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
		for (var event in proto)
			if (proto.hasOwnProperty(event))
				this[event] = proto[event];
	},

	fire: function() {
		this.opFire = 1;
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
	}
});

Q.bullet = Q.GameObject.extend({
	init:function (p) {

		this.pos = {x: p.pos.x, y: p.pos.y};
		this.owner_id = p.id;
		this.alpha = 1;
		this.size = 5;

		this.speed = p.prop.speed;
		this.life = {cur: 0, max: p.prop.life};
		this.bounce = p.prop.bounce;
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
	init : function (pos,id,ammo) {
		this.pos = {x:pos.x,y:pos.y};
		this.id = id;
		this.ammo = ammo;
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
		this.clock = 60;
		this.stat = [];
		this.players = [];
		this.bullets = [];
		this.weapons = [];
		this.terrain = [];
		this.genwpn={cur:0,max:2400};
		this.generate_terrain();
		this.renderer = new Q.renderer(enviroment,size,block_size,this.terrain);
		this.running = false;
		this.competing = false;
		this.finished = false;
		this.callback = callback;
		Q.gameLoop(this.update.bind(this));
	},

	gameover: function(fail_id) {
		this.finished = true;
		this.running = false;
		this.clock = 60;
		if (fail_id!=undefined)
			this.callback(fail_id, true);
		else
			this.callback(this.stat);
	},

	add_player: function (pid, code, silent) {
		
		let proto;
		let auto;
		code = "()=>{" + code + "return tank;}";
		try {
			proto = eval(code)();
		}
		catch(err) {
			if (!silent)
				alert('WTTTF? What a shitty code!');
			return;
		}

		if (!this.players[pid]) this.player_count++;
		this.players[pid] = new Q.Player(pid);
		this.players[pid].auto = new Q.Auto_player(proto);

		p = this.players[pid];
		p.color = Math.floor(Math.random()*11);
		this.stat[pid] = {
			kill : 0,
			death : 0
		};

		//防止出生地落在地形上
		while (this.check_terrain(p.pos)===true)
			p.pos = this.random_pos();
	},

	remove_player: function (pid) {
		delete this.players[pid].auto;
		delete this.players[pid];
		this.player_count--;
		if (this.player_count <= 1)
			this.gameover();
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
		
		//后坐力
		if (!is_no_j) {
			p.speed.x.cur -= Math.cos(p.dir) * p.prop.recoil * 20;
			p.speed.y.cur -= Math.sin(p.dir) * p.prop.recoil * 20;
			p.speed.x.cur = Math.max(Math.min(p.speed.x.cur,p.speed.x.max),-p.speed.x.max);
			p.speed.y.cur = Math.max(Math.min(p.speed.y.cur,p.speed.y.max),-p.speed.y.max);
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
		return {
			x: Math.floor(Math.random() * this.width),
			y: Math.floor(Math.random() * this.height)
		};
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

	generate_weapon: function(_pos,_id,_ammo) {
		if (_ammo!=undefined && _ammo<=0) return;
		let pos = _pos || this.random_pos();
		if (this.check_terrain(pos)==true) return;
		let id = _id || weapons[Math.floor(Math.random()*weapons.length)];

		let new_wpn = new Q.weapon(pos, id, Q.weapon_ammo[id]);
		this.weapons.push(new_wpn);
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
	
	update_weapons:function() {
		this.genwpn.cur+=1;
		if (this.genwpn.cur>=this.genwpn.max) {
			this.generate_weapon();
			this.genwpn.cur=0;
			this.genwpn.max+=600;
		}
	},

	update: function (dt) {
		if (this.running) {
			this.update_weapons();
			this.update_players(dt);
			this.update_bullets(dt);
			this.clock -= dt;
			if (this.clock <= 0) {
				this.gameover();
				return;
			}
		}
		this.renderer.render(this.players,this.bullets,this.weapons,this.clock,dt);
	},
	
	trigger_events: function(p, auto) {
		if (auto.onEvent)
			auto.onEvent();

		if (auto.onHitWall) {
			let dir = this.check_hit_terrain(p);
			if (dir)
				auto.onHitWall(dir);
		}

		if (auto.onEnemySpotted) {
			let enemies = [];
			for (var id in this.players) {
				let q = this.players[id];

				if (id !== p.id && q.pos && q.speed)
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
			}
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

		if (a.opFire && p.fireCD <= 0) {
			this.player_shoot(p.id);
			p.fireCD = p.prop.reload;
		}
		p.fireCD = Math.max(0, p.fireCD - dt);

		return op;
	},

	copy_context: function(p, a) {
		a.x = p.pos.x;
		a.y = p.pos.y;
		a.health = p.health.cur;
		a.dir = p.dir;
		a.speed = {x:p.speed.x.cur, y:p.speed.y.cur};
	},

	replace_context: function(p, a) {
		if (a.dir)
			p.dir = a.dir;
	},

	update_players: function(dt) {
		for (let id in this.players) 
			if (this.players[id]!=null) {
				let p = this.players[id];
				let a = p.auto;

				this.copy_context(p, a);
				try {
					this.trigger_events(p, a);	
				}
				catch (err) {
					this.gameover(id);
					return;
				}
				this.replace_context(p, a);

				let op = this.execute_ops(a, p, dt);
				this.update_player_physics(p, dt, (op.l===0 && op.r===0), (op.u===0 && op.d===0), a.opFire===0);
				a.opFire = 0;
				a.opPerFrame = newOp();
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

	player_shoot: function(pid) {
		let p = this.players[pid];
		if (p.isArmed()) {
			if (p.weapon==='Pan') {
				
				p.reflect = true;
				setTimeout(()=>{p.reflect=false},850);
				for (let id in this.players) {
					let q = this.players[id];
					if (id !== pid)
						if (dis(p.pos,q.pos)<5*p.size)
							this.cause_damage_to_player(pid,id,p.prop.damage);
				}
				return;
			}

			if (p.ammo>0)
				this.players[pid].ammo-=1;
			else {
				this.players[pid].weapon = '';
				this.players[pid].ammo = 0;
				this.players[pid].prop = prop_org;
			}
		}
		for (let i=0;i<(p.prop.bundle || 1);i++)
			this.new_bullet(this.players[pid]);
	},
	
	player_use: function (pid) {
		let p = this.players[pid];

		for (let index in this.weapons) {
			let w = this.weapons[index];
			if (!!w)
				if (dis(p.pos,w.pos)<p.size+35) {
					this.weapon = w.id;
					this.ammo = w.ammo;
					this.prop = Q.weapon_data[w.id];
					this.delete_weapon(index);
					break;
				}
		}
	},

	bullet_check_hit: function (bindex) {
		let bullet = this.bullets[bindex];
		for (let id in this.players) {
			let p = this.players[id];
			if (id != bullet.owner_id)
				if (dis(bullet.pos, p.pos) < bullet.size + p.size) {

					if (p.reflect===true) {

							let a = Math.atan(bullet.dir.y / bullet.dir.x);
							if (bullet.dir.x<0) a=a+Math.PI;
							let r = Math.atan((bullet.pos.y - p.pos.y)/(bullet.pos.x - p.pos.x));
							if (bullet.pos.x<p.pos.x) r=r+Math.PI;

							let new_dir = 2*r+Math.PI - a;
							bullet.dir = {x:Math.cos(new_dir),y:Math.sin(new_dir)};
							bullet.owner_id = id;
							if (this.players[id]!=undefined)
								this.players[id].prop.seek = bullet.seek;
							bullet.color = p.color;
							continue;

					}

					this.cause_damage_to_player(bullet.owner_id,id,bullet.damage);
					bullet.destroyable = true;
					break;
				}
		}

		if (bullet.destroyable === true) return;
	},

	cause_damage_to_player: function (oid,pid,dmg) {
		if (dmg===0) return;
		let p = this.players[pid];
		p.health.cur -=dmg;
		if (p.health.cur <= 0) {
			this.stat[oid].kill++;
			this.stat[pid].death++;
			this.remove_player(pid);
		}
	}
	
});


Q.weapon_data = [];
Q.weapon_ammo = [];

Q.weapon_data['Micro_Uzi']={
			speed : 280,
			reload : 0.1,
			bias : 0.05,
			life : 7,
			damage : 4,
			recoil : 1,
			size : 2,
			penetrate : false,
			bounce : false
		};
Q.weapon_ammo['Micro_Uzi']=90;

//突击步枪
Q.weapon_data['AKM']={
			speed : 300,
			reload : 0.25,
			bias : 0.15,
			life : 8,
			damage : 25,
			recoil : 5,
			sight : 1,
			penetrate : false,
			bounce : false
		};
Q.weapon_ammo['AKM']=30;

Q.weapon_data['Scar-L']={
			speed : 310,
			reload : 0.23,
			bias : 0.08,
			life : 6,
			damage : 12,
			recoil : 1.5,
			penetrate : false,
			bounce : false
		};
Q.weapon_ammo['Scar-L']=40;

Q.weapon_data['M416']={
			speed : 330,
			reload : 0.26,
			bias : 0.08,
			life : 6,
			damage : 10,
			recoil : 1.5,
			penetrate : false,
			bounce : false
		};
Q.weapon_ammo['M416']=40;

//狙击步枪
Q.weapon_data['Kar-98K']={
			speed : 600,
			reload : 1.2,
			bias : 0.04,
			life : 12,
			damage : 50,
			recoil : 12,
			size : 3,
			penetrate : true,
			bounce : false
		};
Q.weapon_ammo['Kar-98K']=15;

Q.weapon_data['AWM']={
			speed : 600,
			reload : 2.5,
			bias : 0.01,
			life : 13,
			damage : 80,
			recoil : 5,
			size : 2.5,
			penetrate : true,
			bounce : false
		};
Q.weapon_ammo['AWM']=10;


//霰弹枪
Q.weapon_data['S1897']={
			speed : 600,
			reload : 0.8,
			bias : 0.2,
			life : 4,
			damage : 15,
			recoil : 45,
			size : 4,
			penetrate : false,
			bounce : false,
			bundle : 5
		};
Q.weapon_ammo['S1897']=10;

Q.weapon_data['S686']={
			speed : 620,
			reload : 2,
			bias : 0.3,
			life : 3,
			damage : 32,
			recoil : 50,
			size : 5,
			penetrate : false,
			bounce : false,
			bundle : 6
		};
Q.weapon_ammo['S686']=8;

//轻机枪
Q.weapon_data['M249']={
			speed : 380,
			reload : 0.12,
			bias : 0.05,
			life : 12,
			damage : 10,
			recoil : 1,
			size : 4,
			penetrate : false,
			bounce : false
		};
Q.weapon_ammo['M249']=100;

Q.weapon_data['Minigun']={
			speed : 400,
			reload : 0.11,
			bias : 0.04,
			life : 10,
			damage : 8,
			recoil : 2,
			penetrate : false,
			bounce : false
		};
Q.weapon_ammo['Minigun']=100;

Q.weapon_data['Pan']={
			reload : 1,
			damage : 35,
			recoil : 0,
		};
Q.weapon_ammo['Pan']=0;


Q.weapon_data['Seeker']={
			reload : 3,
			speed : 380,
			bias : 0,
			life : 45,
			damage : 50,
			recoil : 40,
			size : 6,
			penetrate : false,
			bounce : false,
			seek : true
		};
Q.weapon_ammo['Seeker']=5;
