var delta_degree=2 * Math.PI / 360 * 100,
	color_table = ['aqua', 'Aquamarine', 'Chartreuse', 'Coral', 'LightCyan', 'LightSlateBlue', 'RoyalBlue', 'Violet', 'VioletRed', 'Purple', 'orange'],

	lerp = function(a,b,k) {
		return a+k*(b-a);
	}		

Q.renderer = Q.GameObject.extend({
	init: function (enviroment,size,block_size,terrain) {
		this.anim_list = [];
		this.render_list = [];
		this.loading = true;
		this.map = enviroment.map;
		this.ctx = enviroment.ctx;
		this.terrain = terrain;
		this.set_canvas(size,block_size);
	},

	set_canvas: function(size,block_size) {
		this.width = size.width;
		this.height = size.height;
		this.block_width = block_size.width;
		this.block_height = block_size.height;
		this.map.width = size.width*2;
		this.map.height = size.height*2;
		this.map.style="width:"+this.width+"px;height:"+this.height+"px;";
		this.ctx.font = '13px "Futura';
		this.ctx.scale(2,2);
	},

	under_attack:function(pid) {
		this.add_animation('player','underatk',this.render_list[pid]);
	},
	
	add_animation: function(type,eff,entity) {
		var anim = {};
		if (eff=='underatk' || eff=='fadeout') {
			if (!entity.size) entity.size=player_size;
			if (!entity.alpha) entity.alpha=1;
			anim = {type:type,
					eff:eff,
					entity:entity,
					origin:{alpha:entity.alpha,
							size:entity.size}};

		}
		else return;
		anim.anim_destroyable = false;
		this.anim_list.push(anim);
	},

	render_background: function () {
		var ctx = this.ctx;

		ctx.save();
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgba(136,136,136,0.1)';
		
		var h = this.map.height;
		var w = this.map.width;
		var bh = this.block_height;
		var bw = this.block_width;
		
		for (var i = 0; i < h; i += bh) {	//绘制横线
			ctx.beginPath();
			ctx.moveTo(0, i);
			ctx.lineTo(w, i);
			ctx.stroke();
			
		}
		for (var i = 0; i < w; i += bw) {	//绘制竖线
			ctx.beginPath();
			ctx.moveTo(i, 0);
			ctx.lineTo(i, h);
			ctx.stroke();
		}
		ctx.closePath();

		ctx.fillStyle = 'rgb(136,136,136)';
		for (var i = 0; i < w; i += bw) {
			block_x = Math.floor(i / bw);
			for (var j = 0; j < h; j += bh) {
				block_y = Math.floor(j / bh);
			
				if (this.terrain[block_x]!=undefined) 
				if (this.terrain[block_x][block_y]!=undefined)
				if (this.terrain[block_x][block_y]==1) {
					ctx.fillRect(block_x*this.block_width,
								 block_y*this.block_height,
								 this.block_width+1,this.block_height+1);
				}
			}
		}
		ctx.restore();
	},
	
	render_weapon:function (weapon) {
		if (!weapon) return;
		var ctx = this.ctx;

		ctx.save();
		ctx.translate(weapon.pos.x, weapon.pos.y);
		var img = document.getElementById(weapon.id);
		ctx.drawImage(img,0,0,60,60);
		ctx.restore();
	},

	render_bullet: function (bullet) {
		if (!bullet) return;

		var ctx = this.ctx;
		var r = bullet.size;
		ctx.save();

		ctx.globalAlpha = bullet.alpha || 1;
		ctx.translate(bullet.pos.x, bullet.pos.y);
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, 2 * Math.PI);							//绘制圆形轮廓
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'white';
		ctx.stroke();
		
		ctx.fillStyle = color_table[bullet.color];

		ctx.fill();
		ctx.closePath();
		ctx.restore();
	},
	
	render_player: function (player) {
		if (!player) return;

		var ctx = this.ctx;
		var r = this.render_list[player.id]?(this.render_list[player.id].size || player_size):15;
		var pos = this.render_list[player.id]?(this.render_list[player.id].pos || player.pos):player.pos;
		var dir = this.render_list[player.id]?(this.render_list[player.id].dir || player.dir):player.dir;
		var health = this.render_list[player.id]?(this.render_list[player.id].health || player.health):player.health;

		ctx.save();

		ctx.globalAlpha = this.render_list[player.id]?(this.render_list[player.id].alpha || 1):1;

			//画布偏移，以玩家为中心
		ctx.translate(pos.x, pos.y);

			//绘制id
		ctx.fillStyle = 'white';
		ctx.fillText(player.id, -r + 3, -r - 6);

			//绘制血槽
		ctx.strokeStyle = 'white';
		ctx.lineWidth = 1;
		var blood = health.cur / health.max;
		ctx.fillStyle = blood<0.41?blood<0.21?'red':'yellow':'lightgreen';		
		ctx.fillRect(-r, r + 6, blood * 2 * r, 5);
		ctx.strokeRect(-r , r + 6, 2*r, 5);

			//绘制圆形轮廓
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, 2 * Math.PI);							
		ctx.lineWidth = 5;
		ctx.strokeStyle = 'white';
		ctx.stroke();
		if (player.color >= 0)									//内部填充
			ctx.fillStyle = color_table[player.color];

		ctx.fill();
		ctx.closePath();

		//炮口绘制
		ctx.beginPath();									
		ctx.arc(r * Math.cos(dir), r * Math.sin(dir), 5, 0, 2 * Math.PI);
		ctx.stroke();
		ctx.fillStyle = 'white';
		ctx.fill();
		ctx.closePath();
			
		ctx.restore();
	},

	render_animation: function (anim,dt) {
		if (!anim) return;
		if (anim.eff==='fadeout') {
			if (anim.type==='bullet') {
				anim.entity.alpha-=0.1;
				anim.entity.size+=0.2;
				if (anim.entity.alpha>0)
					this.client_render_bullet(anim.entity);
				else
					anim.anim_destroyable = true;
			}
		}
		if (anim.eff==='underatk') {
				anim.entity.alpha-=0.08;
				anim.entity.size+=0.2;
				if (anim.entity.alpha<0.25) {
					anim.entity.alpha = anim.origin.alpha;	//恢复到原始状态
					anim.entity.size = anim.origin.size;
					anim.anim_destroyable = true;
				}

		}
	},

	render: function (players,bullets,weapons,dt) {

		this.ctx.clearRect(0, 0, this.map.width, this.map.height);
		
		this.render_background();

		for (var index in this.anim_list) {
			if (!!this.anim_list[index]) {

				anim = this.anim_list[index];
				if (anim.anim_destroyable)
					delete this.anim_list[index];
				else 
					this.render_animation(anim,dt);
			}
		}

		for (var id in players)
			this.render_player(players[id]);

		for (var index in bullets)
			this.render_bullet(bullets[index]);
		
		for (var index in weapons)
			this.render_weapon(weapons[index]);
	}
});