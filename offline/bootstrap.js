/* Standalone adapters only. Gameplay is provided by the original StartOffline. */
globalThis.SD_OFFLINE = true;
globalThis.SD_COMBAT = new URLSearchParams(location.search).get('mode') === 'combat';
globalThis.SD_ART_LAB = globalThis.SD_COMBAT && new URLSearchParams(location.search).get('art') === '1';
globalThis.SD_MOVEMENT = globalThis.SD_COMBAT && new URLSearchParams(location.search).get('movement') === '1';
globalThis.SD_PHYSICAL = globalThis.SD_COMBAT && new URLSearchParams(location.search).get('physical') === '1';
if (globalThis.SD_COMBAT)
localforage.config({name:globalThis.SD_PHYSICAL ? 'sd-physical-combat-lab' : globalThis.SD_ART_LAB ? 'sd-art-direction-lab' : globalThis.SD_MOVEMENT ? 'sd-movement-experimental' : 'sd-combat-experimental'});

// Keep the music interface used by settings, speech and the renderer, without
// distributing or loading optional tracks. Settings cannot turn music back on.
globalThis.sdMusic = {
	get enabled() { return false; },
	set enabled(value) {},
	situational_songs: [],
	current_song: null,
	is_still_playing_intro_song: false,
	init_classB() {},
	UpdateVolume() {},
	Stop() {},
	onKeyDown() {},
	SpeakStart() {},
	SpeakStop() {}
};

// Theatre entities remain registered, but their remote players are unavailable.
globalThis.twitch_player_div = document.getElementById('twitch_player_div');
globalThis.youtube_player_div = document.getElementById('youtube_player_div');
globalThis.SetPlayerVolume = () => {};
globalThis.RequireTwitchPlayerAndDo = () => {};
globalThis.RequireYoutubePlayerAndDo = () => {};

// Wait for the original settings UI and the persisted browser filesystem before
// exposing Play. This also prevents a quick click from racing IndexedDB loading.
const play = document.getElementById('offline_play');
play.disabled = true;
play.style.pointerEvents = 'none';
const ready = setInterval(async () => {
	if (!globalThis.sdWorld || !globalThis.GetPlayerSettings || !document.getElementById('entity'))
	return;
	clearInterval(ready);
	try {
		if (!await globalThis.sdOfflineStorageReady)
		throw new Error('browser storage unavailable or save data invalid');
		if (globalThis.SD_COMBAT)
		{
			await import('./combat/sandbox.js');
			if(globalThis.SD_MOVEMENT) await import('./movement/slide.js');
			if(globalThis.SD_ART_LAB) await import('./art-lab/presentation.js');
			if(globalThis.SD_PHYSICAL) await import('./combat/physical.js');
			play.textContent = 'Start combat sandbox';
			play.onclick = () => {
				const settings = GetPlayerSettings();
				for (let i=1;i<=4;i++) settings['entity'+i] = i===1;
				sdWorld.StartOffline(settings);
			};
		}
		else
		{
			const combat = document.createElement('menu_button');
			combat.textContent = 'Experimental combat sandbox';
			combat.onclick = () => { location.href = '?mode=combat'; };
			play.after(combat);
			const physical = document.createElement('menu_button');
			physical.textContent = 'Physical combat laboratory';
			physical.onclick = () => { location.href = '?mode=combat&movement=1&art=1&physical=1'; };
			combat.after(physical);
		}
		const music = document.getElementById('music');
		music.value = '2';
		music.closest('settings_line').style.display = 'none';
		// These counters are otherwise supplied by the multiplayer handshake.
		globalThis.players_online = 1;
		globalThis.players_playing = 1;
		play.disabled = false;
		play.style.pointerEvents = '';
		document.getElementById('server_status').textContent = 'Offline — ready';
	} catch (error) {
		document.getElementById('server_status').textContent = 'Could not load local save: ' + error.message;
	}
}, 50);
