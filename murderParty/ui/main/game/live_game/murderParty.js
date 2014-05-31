var murderParty = undefined;

(function() {
	console.log("loading murder party...");
	murderParty = (function() {
		var m_w = 1337;
		var m_z = 987654321;
		var mask = 0xffffffff;
		function random() {
		    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
		    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
		    var result = ((m_z << 16) + m_w) & mask;
		    result /= 4294967296;
		    return result + 0.5;
		}
		function shuffle(array) {
		    var counter = array.length, temp, index;
		    while (counter > 0) {
		        index = Math.floor(random() * counter);
		        counter--;
		        temp = array[counter];
		        array[counter] = array[index];
		        array[index] = temp;
		    }
		    return array;
		}
		
		var showNotice = function(note) {
			var randomId = "RND"+Math.floor(Math.random() * 90000000);
			$('body').append("<center class='ignoreMouse'><div id="+randomId+" class='ignoreMouse' style='font-size:90px;'>"+note+"</div></center>");
			
			window.setTimeout(function() {
				$('#'+randomId).remove();
			}, 10000);
		};
		
		var myArmyIndex = -1;
		
		var armyChangeTime = 0;
		
		var lastKiller = -1;
		var killer = -1;
		
		var lastArmyTargetIndex = -1;
		var currentTargetArmyIndex = -1;
		
		var aliveArmies = [];
		var alive = true;
		var playing = false;
		
		var currentTargetName = ko.observable("");
		var currentPoints = ko.observable(0);
		
		var sendChat = function(msg) {
			console.log("!!!!!!!!!!!!!!!!!!! func not set: sendChat !!!!!!!!!!!!!!!!!!!!!!!");
		};
		
		var reAssignTargets = function() {
			armyChangeTime = new Date().getTime();
			var cpArmies = [];
			for (var i = 0; i < aliveArmies.length; i++) {
				cpArmies.push(aliveArmies[i]);
			}
			shuffle(cpArmies);
			for (var i = 0; i < cpArmies.length; i++) {
				var attacker = cpArmies[i];
				var targetIndex = i+1;
				if (targetIndex === cpArmies.length) {
					targetIndex = 0;
				}
				var target = cpArmies[targetIndex];
				console.log(attacker.name + " should kill "+target.name);
				if (attacker.id === myArmyIndex) {
					lastArmyTargetIndex = currentTargetArmyIndex;
					currentTargetArmyIndex = target.id;
					var targetText = "Kill "+target.name+"!"; 
					currentTargetName(targetText);
					showNotice(targetText);
				}
				if (target.id === myArmyIndex) {
					lastKiller = killer;
					killer = attacker.id;
				}
			}
		};

		var spawnUnit = function(spec) {
			engine.call("unit.debug.setSpecId", spec);
			api.unit.debug.paste();
		};		
		
		var assignBonus = function() {
			console.log("spawn bonus magic!");
			currentPoints(currentPoints()+1);
			sendChat("I killed my target! My score is now "+currentPoints());
			spawnUnit("/pa/units/murderParty/bonus.json");
		};
		
		var assignHalfBonus = function() {
			console.log("spawn half bonus");
			spawnUnit("/pa/units/murderParty/bonus_half.json");
		};
		
		var assignMalus = function() {
			console.log("spawn malus magic");
			currentPoints(currentPoints()-1);
			sendChat("Ooops I killed the wrong person! My score is now "+currentPoints());
			spawnUnit("/pa/units/murderParty/malus.json");
		};
		
		return {
			setNewArmies: function(payload) {
				console.log("set new armies!");
				console.log(payload);
				armyChangeTime = new Date().getTime();
				
				var cntBefore = aliveArmies.length;
				aliveArmies = [];
				for (var i = 0; i < payload.length; i++) {
					if (!payload[i].defeated) {
						aliveArmies.push({
							id: payload[i].id,
							name: payload[i].name
						});
					}
					if (payload[i].stateToPlayer === "self") {
						myArmyIndex = payload[i].id;
						if (payload[i].defeated) {
							alive = false;
						}
					}
				}
				if (cntBefore !== aliveArmies.length && alive && playing) {
					reAssignTargets();
				}
			},
			watchKills: function(payload) {
				var lst = payload.list;
				for (var i = 0; i < lst.length; i++) {
					// this reacts to ANY kill on a commander that is visible :(
					if (lst[i].spec_id.indexOf("/pa/units/commanders/") === 0  && lst[i].watch_type === 7) {
						if (lst[i].army_id === currentTargetArmyIndex ||
								(lst[i].army_id === lastArmyTargetIndex && new Date().getTime() - 5000 < armyChangeTime)) {
							assignBonus();
							showNotice("Well done!");
						} else if (lst[i].army_id === killer ||
								(lst[i].army_id === lastKiller && new Date().getTime() - 5000 < armyChangeTime)) {
							assignHalfBonus();
							showNotice("You got rid of your killer.");
						} else {
							assignMalus();
							showNotice("You killed the wrong player. That's bad for you.")
						}
					}
				}
			},
			targetObservable: currentTargetName,
			currentPointsTxt: ko.computed(function() {
				return "Score: " + currentPoints();
			}),
			setChatSender: function(func) {
				sendChat = func;
			},
			start: function() {
				playing = true;
				reAssignTargets();
			}
		};
	}());
	
	$('body').append("<div data-bind='text: model.murderTarget' style='position: relative; top: 35px; font-size:20px;'></div>");
	$('body').append("<div data-bind='text: model.murderPoints' style='position: relative; top: 55px; font-size:20px;'></div>");
	
	model.murderTarget = murderParty.targetObservable;
	model.murderPoints = murderParty.currentPointsTxt;
	
	murderParty.setChatSender(function(msg) {
		model.send_message("chat_message", {message: msg});
	});
	
	var oldServerState = handlers.server_state;
	handlers.server_state = function(m) {
		oldServerState(m);
		switch(m.state) {
		case 'playing':
			murderParty.start();
			break;
		}
	};
		
	var oldWatchList = handlers.watch_list;
	handlers.watch_list = function(payload) {
		oldWatchList(payload);
		murderParty.watchKills(payload);
	};
	
	var oldArmyState = handlers.army_state;
	handlers.army_state = function(payload) {
		oldArmyState(payload);
		murderParty.setNewArmies(payload);
	};
}());