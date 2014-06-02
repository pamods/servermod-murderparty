var murderParty = undefined;

(function() {
	console.log("loading murder party...");
	
	murderParty = (function() {
		var m_w = 1337; // I can't think of a proper random input that all clients know apart from the lobbyId, but the lobbyId may be wrong if PA Stats is not installed (is this still true?)
		var m_z = 987654321;
		var mask = 0xffffffff;
		
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
		
		var lastDeclaredPoints = 0;
		
		var storeState = function() {
			var x = {
				m_w: m_w,
				myArmyIndex: myArmyIndex,
				armyChangeTime: armyChangeTime,
				lastKiller: lastKiller,
				killer: killer,
				lastArmyTargetIndex: lastArmyTargetIndex,
				currentTargetArmyIndex: currentTargetArmyIndex,
				aliveArmies: aliveArmies,
				alive: alive,
				playing: playing,
				currentTargetName: currentTargetName(),
				currentPoints: currentPoints(),
				lastDeclaredPoints: lastDeclaredPoints
			};
			localStorage['info.nanodesu.murderPartyStore'] = encode(x);
		};
		
		var loadState = function() {
			var x = decode(localStorage['info.nanodesu.murderPartyStore']);
			m_w = x.m_w;
			myArmyIndex = x.myArmyIndex;
			armyChangeTime = x.armyChangeTime;
			lastKiller = x.lastKiller;
			killer = x.killer;
			lastArmyTargetIndex = x.lastArmyTargetIndex;
			currentTargetArmyIndex = x.currentTargetArmyIndex;
			aliveArmies = x.aliveArmies;
			alive = x.alive;
			playing = x.playing;
			currentTargetName(x.currentTargetName);
			lastDeclaredPoints = x.lastDeclaredPoints;
			currentPoints(x.currentPoints);
		};
		
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
		
		currentTargetName.subscribe(function(v) {
			if (v.length && v.length > 0) {
				showNotice(v);
			}
		});
		
		var sendChat = function(msg) {
			console.log("!!!!!!!!!!!!!!!!!!! func not set: sendChat !!!!!!!!!!!!!!!!!!!!!!!");
		};

		currentPoints.subscribe(function(v) {
			if (v !== lastDeclaredPoints) {
				sendChat("I now have "+v+" points");
				lastDeclaredPoints = v;
			}
		});
		
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
				if (attacker.id === myArmyIndex) {
					lastArmyTargetIndex = currentTargetArmyIndex;
					currentTargetArmyIndex = target.id;
					var targetText = "Annihilate "+target.name+"!"; 
					currentTargetName(targetText);
				}
				if (target.id === myArmyIndex) {
					lastKiller = killer;
					killer = attacker.id;
				}
			}
		};
		
		var spawnUnit = function(spec) {
			engine.call("unit.debug.setSpecId", spec);
			engine.call("magicpaste"); // hack in common js makes this call the actual paste. Prevents usage of the normal hotkeys if they are bound
		};
		
		var assignBonus = function() {
			sendChat("I witnessed the annihilation of my target!");
			currentPoints(currentPoints()+1);
			spawnUnit("/pa/units/murderParty/bonus.json");
			storeState();
		};
		
		var assignHalfBonus = function() {
			spawnUnit("/pa/units/murderParty/bonus_half.json");
			storeState();
		};
		
		var assignMalus = function() {
			sendChat("Ooops I witnessed the annihilation of an innocent!");
			currentPoints(currentPoints()-1);
			spawnUnit("/pa/units/murderParty/malus.json");
			storeState();
		};
		
		var gameEnded = false;
		
		return {
			setNewArmies: function(payload) {
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
				if (cntBefore !== aliveArmies.length && alive && playing && aliveArmies.length > 1) {
					reAssignTargets();
				} else if (aliveArmies.length < 2 && !gameEnded) {
					setTimeout(function() {
						// hack, should deal with this better somehow...
						sendChat("I got "+currentPoints() + " points!");
					}, 1000);
					gameEnded = true;
				}
				
				if (playing) {
					storeState();
				}
			},
			assignBonus: assignBonus,
			assignHalfBonus: assignHalfBonus,
			assignMalus: assignMalus,
			targetObservable: currentTargetName,
			checkKill: function(army_id) {
				if (army_id === currentTargetArmyIndex ||
						(army_id === lastArmyTargetIndex && new Date().getTime() - 5000 < armyChangeTime)) {
					assignBonus();
					showNotice("Well done!");
				} else if (army_id === killer ||
						(army_id === lastKiller && new Date().getTime() - 5000 < armyChangeTime)) {
					assignHalfBonus();
					showNotice("You witnessed the annihilation of your killer.");
				} else {
					assignMalus();
					showNotice("You witnessed the annihilation of an innocent. That's bad for you.");
				}
				storeState();
			},
			currentPointsTxt: ko.computed(function() {
				return "Score: " + currentPoints();
			}),
			setChatSender: function(func) {
				sendChat = func;
			},
			start: function() {
				playing = true;
				reAssignTargets();
				storeState();
			},
			recreate: function() {
				loadState();
			},
			showNotice: showNotice
		};
	}());
	
	$('body').append("<div data-bind='text: model.murderTarget' style='position: relative; top: 35px; font-size:20px;'></div>");
	$('body').append("<div data-bind='text: model.murderPoints' style='position: relative; top: 55px; font-size:20px;'></div>");
	
	model.murderTarget = murderParty.targetObservable;
	model.murderPoints = murderParty.currentPointsTxt;
	
	murderParty.setChatSender(function(msg) {
		model.send_message("chat_message", {message: msg});
	});
	
	var startedPlaying = false;
	var startedParty = false;
	var oldServerState = handlers.server_state;
	handlers.server_state = function(m) {
		oldServerState(m);
		switch(m.state) {
		case 'playing':
			startedPlaying = true;
			break;
		}
	};
    
	var oldTime = handlers.time;
	handlers.time = function(payload) {
		oldTime(payload);
		if (!startedParty && startedPlaying) {
			startedParty = true;
			if (payload.end_time === 0) {
				murderParty.start();
			} else {
				murderParty.recreate();
			}
		}
	};
	
	var oldWatchList = handlers.watch_list;
	handlers.watch_list = function(payload) {
		oldWatchList(payload);
		
		var lst = payload.list;
		for (var i = 0; i < lst.length; i++) {
			// this reacts to ANY kill on a commander that is visible :( so let's play "who witnesses kills"...
			if (lst[i].spec_id.indexOf("/pa/units/commanders/") === 0  && lst[i].watch_type === 7) {
				murderParty.checkKill(lst[i].army_id);
			}
		}
	};
	
	var oldArmyState = handlers.army_state;
	handlers.army_state = function(payload) {
		oldArmyState(payload);
		murderParty.setNewArmies(payload);
	};
}());