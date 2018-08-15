

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
	bias : 0.1,
	life : 4,
	damage : 20,
	bounce : false,
	recoil : 0,
	penetrate : false
};

Q.Player = Q.GameObject.extend({
	init: function(pid) {
		this.id = pid;
		this.pos = {
			x: Math.floor(Math.random() * global_width),
			y: Math.floor(Math.random() * global_height)
		};
		this.health = {cur: 100, max: 100};
		this.speed = {x: {cur: 0, max: 120, acc: 180}, y: {cur: 0, max: 120, acc: 180}};
		this.dir = 0;
		this.color = 0;
		this.prop = prop_org;
		this.alpha = 1;
		this.fireCD = 0;
		this.size = 15;

		this.opPerFrame = {u:0,d:0,l:0,r:0,f:0,j:0};
	},

	isArmed: function() {
		return (typeof this.weapon === 'string' && this.weapon.length>0);
	},

	fire: function() {
		this.opPerFrame.f = 1;
	},

	moveUp: function() {
		this.opPerFrame.u = 1;
	},

	moveDown: function() {
		this.opPerFrame.d = 1;
	},

	moveLeft: function() {
		this.opPerFrame.l = 1;
	},

	moveRight: function() {
		this.opPerFrame.r = 1;
	},
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
	},
});

Q.weapon = Q.GameObject.extend({
	init : function (pos,id,ammo) {
		this.pos = {x:pos.x,y:pos.y};
		this.id = id;
		this.ammo = ammo;
	}
});

Q.core = Q.Evented.extend({
	init : function(enviroment,size,block_size) {
		global_width = size.width;
		global_height = size.height;
		this.width = size.width;
		this.height = size.height;
		this.block_width = block_size.width;
		this.block_height = block_size.height;
		this.player_count = 0;
		this.clock = 120;
		this.players = [];
		this.bullets = [];
		this.weapons = [];
		this.terrain = [];
		this.genwpn={cur:0,max:2400};
		this.generate_terrain();
		this.renderer = new Q.renderer(enviroment,size,block_size,this.terrain);
		this.running = false;
		this.competing = false;
		Q.gameLoop(this.update.bind(this));
	},

	add_player: function (pid, code) {
		let origin = new Q.Player(pid);
		this.players[pid] = eval(code)();
		for (var property in origin)
			this.players[pid][property] = origin[property];	

		p = this.players[pid];
		p.color = Math.floor(Math.random()*11);
		this.player_count++;

		//防止出生地落在地形上
		while (this.check_terrain(p.pos)===true)
			p.pos = this.random_pos();
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
		check=[[p.speed.x.cur>0?1:-1,0],[0,p.speed.y.cur>0?1:-1]];
		speed = p.speed.x.cur*p.speed.x.cur+p.speed.y.cur*p.speed.y.cur;
		check.push([p.speed.x.cur/speed,p.speed.y.cur/speed]);

		for (let i=0;i<3;i++) {
			block_x = Math.floor((p.pos.x+check[i][0]*p.size) / this.block_width);
			block_y = Math.floor((p.pos.y+check[i][1]*p.size) / this.block_height);
			if (this.terrain[block_x]!=undefined)
			if (this.terrain[block_x][block_y]!=undefined)
			if (this.terrain[block_x][block_y]==1) {
				if (Math.abs(check[i][0])>0.01) p.speed.x.cur = 0;
				if (Math.abs(check[i][1])>0.01) p.speed.y.cur = 0;
			}
		}

		p.pos.x = p.pos.x + p.speed.x.cur * dt;
		p.pos.y = p.pos.y + p.speed.y.cur * dt;

		//越界检测
		if (p.pos.x < 0) p.pos.x = 0;
		if (p.pos.y < 0) p.pos.y = 0;
		if (p.pos.x > this.width) p.pos.x = this.width;
		if (p.pos.y > this.height) p.pos.y = this.height;
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

	
	/*
	process_inputs: function (p, inputs, dt) {

		for (let i = 0; i < inputs.kb.length; i++) {
			switch (inputs.kb[i]) {
				case 'w':
					this.move_u(p, dt);
					break;
				case 's':
					this.move_d(p, dt);
					break;
				case 'a':
					this.move_l(p, dt);
					break;
				case 'd':
					this.move_r(p, dt);
					break;
			}
		}
		this.update_player_physics(p, dt, (inputs.kb.indexOf('a') < 0 && inputs.kb.indexOf('d') < 0),
			(inputs.kb.indexOf('w') < 0 && inputs.kb.indexOf('s') < 0), inputs.kb.indexOf('j') < 0);
		
		if (inputs.ms!=undefined)
			p.dir = inputs.ms;
	},*/

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
	
	//随机地形生成器，由主地形和分支地形构成，
	//主地形生成较大的类陆地形，分支地形生成零散的岛屿地形，最终两者合并。
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
    	let main={p:0.465 , w:2, s:13 , d:25};
    	let isle={p:0.397 , w:1, s:5  , d:20};

		//地形随机化
		this.main_terrain=[];
		this.isle_terrain=[];
  		for (let i=-3;i<=w+3;i++) {
    		this.main_terrain[i]=[];
    		this.isle_terrain[i]=[];
    		for (let j=-3;j<=h+3;j++) {
      			this.main_terrain[i][j]=Math.random()<main.p?1:0;
      			this.isle_terrain[i][j]=Math.random()<isle.p?1:0;
    		}
      	}

    	//主地形迭代
    	this.main_terrain = evol(this.main_terrain,main);

		//分支地形迭代
		this.isle_terrain = evol(this.isle_terrain,isle);

		//地形融合
		for (let i=-1;i<=w+1;i++) {
			this.terrain[i]=[];
			for (let j=-1;j<=h+1;j++)
				this.terrain[i][j]=this.main_terrain[i][j] || this.isle_terrain[i][j];
		}
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
			this.genwpn.max+=10;
		}
	},

	update: function (dt) {
		if (this.running) {
			this.update_weapons();
			this.update_players(dt);
			this.update_bullets(dt);
			this.clock -= dt;
		}
		this.renderer.render(this.players,this.bullets,this.weapons,this.clock,dt);
	},
	
	update_players: function(dt) {
		for (let id in this.players) 
			if (this.players[id]!=null) {
				let p = this.players[id];
				if (p.onEvent)
					p.onEvent();

				if (p.opPerFrame.u) this.move_u(p,dt);
				if (p.opPerFrame.d) this.move_d(p,dt);
				if (p.opPerFrame.l) this.move_l(p,dt);
				if (p.opPerFrame.r) this.move_r(p,dt);

				if (p.opPerFrame.f && !p.fireCD) {
					this.player_shoot(p.id);
					p.fireCD = 1;
					setTimeout( ()=>{p.fireCD = 0}, p.prop.reload*1000);
				}

				this.update_player_physics(p, dt, !p.opPerFrame.l && !p.opPerFrame.r, !p.opPerFrame.u && !p.opPerFrame.d, !p.opPerFrame.f);
			
				p.opPerFrame.u = 0;
				p.opPerFrame.d = 0;
				p.opPerFrame.l = 0;
				p.opPerFrame.r = 0;
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

		for (let index in this.boxes) {
			let b = this.boxes[index];
			if (dis(bullet.pos, b.pos) < bullet.size + b.size) {
				this.cause_damage_to_box(bullet.owner_id,index,bullet.damage);
				bullet.destroyable = true;
				break;
			}
		}
	},

	cause_damage_to_player: function (oid,pid,dmg) {
		if (dmg===0) return;
		let p = this.players[pid];
		p.health.cur -=dmg;
		if (p.health.cur <= 0)
			this.remove_player(pid);
	},
	
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
