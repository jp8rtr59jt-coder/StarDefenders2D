/* Launcher-only startup adapter. Use the existing ready button and StartOffline. */
(() => {
 if(!(globalThis.SD_COMBAT&&globalThis.SD_MOVEMENT&&globalThis.SD_ART_LAB&&globalThis.SD_PHYSICAL))return;
 const timer=setInterval(() => {
  if(globalThis.sdWorld?.is_singleplayer){clearInterval(timer);return;}
  const button=document.getElementById('offline_play');
  if(globalThis.SD_COMBAT&&globalThis.SD_MOVEMENT&&globalThis.SD_ART_LAB&&globalThis.SD_PHYSICAL&&
     button&&!button.disabled&&document.getElementById('server_status')?.textContent==='Offline — ready'){
   clearInterval(timer);button.click();
  }
 },50);
})();
