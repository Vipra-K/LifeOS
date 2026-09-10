const W={deepWork:'Deep Work',github:'GitHub',leetcode:'LeetCode',habits:'Habits',upcoming:'Upcoming',tasks:'Today’s Tasks'};
let state={widgets:[],profiles:{},themeSettings:{backgroundMode:'time',customBackground:null},github:'',leetcode:''};
const $=s=>document.querySelector(s);

async function load(){
  const d=await chrome.storage.local.get(['widgets','profiles','themeSettings','integrations','calendarConnected']);
  state.widgets=d.widgets||['deepWork','github','habits','upcoming'];
  state.profiles=d.profiles||{};
  state.themeSettings=d.themeSettings||state.themeSettings;
  state.github=d.integrations?.github||'';
  state.leetcode=d.integrations?.leetcode||'';
  render();
  if(d.calendarConnected)$('#calendar').textContent='Connected ✓';
}

function render(){
  $('#widgets').innerHTML=Object.entries(W).map(([id,n])=>`<label class="choice"><input type="checkbox" data-widget="${id}" ${state.widgets.includes(id)?'checked':''}><span>${n}</span></label>`).join('');
  $('#profiles').innerHTML=Object.values(state.profiles).map(p=>`<div class="profile"><b>${p.icon||'•'} ${p.name}</b><input data-profile="${p.id}" value="${p.sites.join(', ')}"><button class="secondary" data-delete="${p.id}">Delete</button></div>`).join('');
  $('#github').value=state.github;
  $('#leetcode').value=state.leetcode;
  const bg=document.querySelector(`input[name=bg][value="${state.themeSettings.backgroundMode}"]`);
  if(bg)bg.checked=true;
  if(state.themeSettings.customBackground)$('#preview').style.backgroundImage=`url(${state.themeSettings.customBackground})`;
}

$('#save').onclick=async()=>{
  const saveButton=$('#save');
  try{
    state.widgets=[...document.querySelectorAll('[data-widget]:checked')].map(x=>x.dataset.widget);
    document.querySelectorAll('[data-profile]').forEach(x=>{
      if(state.profiles[x.dataset.profile])state.profiles[x.dataset.profile].sites=x.value.split(',').map(v=>v.trim()).filter(Boolean);
    });
    state.themeSettings.backgroundMode=document.querySelector('input[name=bg]:checked')?.value||'time';
    state.github=$('#github').value.trim().replace(/^@/,'');
    state.leetcode=$('#leetcode').value.trim().replace(/^@/,'');

    await chrome.storage.local.set({
      widgets:state.widgets,
      profiles:state.profiles,
      themeSettings:state.themeSettings,
      integrations:{github:state.github,leetcode:state.leetcode}
    });

    saveButton.textContent='Saved ✓';
    setTimeout(()=>saveButton.textContent='Save changes',1200);

    try{await chrome.runtime.sendMessage({type:'SYNC_RULES'});}catch(e){console.warn('Focus rules sync failed:',e);}
  }catch(e){
    console.error('Failed to save settings:',e);
    saveButton.textContent='Save failed';
    setTimeout(()=>saveButton.textContent='Save changes',1600);
  }
};

$('#addProfile').onclick=()=>{
  const id=`custom-${Date.now()}`;
  state.profiles[id]={id,name:'Custom Focus',icon:'✦',sites:['chatgpt.com','google.com']};
  render();
};

document.addEventListener('click',e=>{
  const id=e.target.dataset.delete;
  if(id){delete state.profiles[id];render();}
});

$('#image').onchange=e=>{
  const f=e.target.files[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{
    state.themeSettings.customBackground=reader.result;
    state.themeSettings.backgroundMode='custom';
    $('input[value=custom]').checked=true;
    $('#preview').style.backgroundImage=`url(${reader.result})`;
  };
  reader.readAsDataURL(f);
};

function showCalendarError(message){
  const text=String(message||'Unknown error');
  console.error('Google Calendar connection failed:',text);
  alert(`Google Calendar connection failed.\n\n${text}`);
}

$('#calendar').onclick=async()=>{
  const button=$('#calendar');
  const originalText=button.textContent;
  button.disabled=true;
  button.classList.add('loading');
  button.innerHTML='<span class="spinner" aria-hidden="true"></span><span>Connecting…</span>';

  try{
    if(!chrome.identity?.getAuthToken){
      throw new Error('Chrome identity API is unavailable. Make sure the extension has the "identity" permission and reload it from chrome://extensions.');
    }

    let token;
    try{
      token=await chrome.identity.getAuthToken({interactive:true});
    }catch(e){
      const code=e?.message||e?.error||e?.code||'OAuth token request failed';
      throw new Error(`OAuth token request failed: ${code}`);
    }

    if(!token?.token)throw new Error('Chrome returned no OAuth access token. Check the oauth2.client_id and scopes in manifest.json, then reload the extension.');

    const r=await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin='+encodeURIComponent(new Date().toISOString()),{headers:{Authorization:'Bearer '+token.token}});
    if(!r.ok){
      let detail='';
      try{const body=await r.json();detail=body?.error?.message||body?.error_description||'';}catch{}
      throw new Error(`Calendar API returned HTTP ${r.status}${detail?`: ${detail}`:''}`);
    }

    const j=await r.json();
    await chrome.storage.local.set({calendarEvents:j.items||[],calendarConnected:true});
    button.classList.remove('loading');
    button.textContent='Connected ✓';
  }catch(e){
    button.disabled=false;
    button.classList.remove('loading');
    button.textContent=originalText;
    showCalendarError(e?.message||String(e));
  }
};

load();