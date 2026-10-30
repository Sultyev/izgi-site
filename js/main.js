const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const burger=$('.burger'),nav=$('#nav');
if(burger&&nav){
  const isOpen=()=>nav.classList.contains('open');
  const setOpen=o=>{nav.classList.toggle('open',o);burger.setAttribute('aria-expanded',String(o))};
  burger.addEventListener('click',e=>{e.stopPropagation();setOpen(!isOpen())});
  document.addEventListener('click',e=>{if(isOpen()&&!nav.contains(e.target)&&!burger.contains(e.target))setOpen(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){setOpen(false);burger.focus()}});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
  const wide=matchMedia('(min-width:821px)');
  (wide.addEventListener?wide.addEventListener('change',e=>{if(e.matches)setOpen(false)}):0);
}
const topbar=$('.top');
if(topbar){const shade=()=>topbar.classList.toggle('scrolled',scrollY>8);
  addEventListener('scroll',shade,{passive:true});shade()}
const art=$('.art');
if(art&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
  art.addEventListener('pointermove',e=>{const r=art.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    $$('.b',art).forEach((g,i)=>g.style.transform=`translate(${x*(30+i*22)}px,${y*(30+i*22)}px)`)});
  art.addEventListener('pointerleave',()=>$$('.b',art).forEach(g=>g.style.transform=''));
}
if(art){
  const calm=matchMedia('(prefers-reduced-motion:reduce)').matches;
  $$('.orb',art).forEach(orb=>{
    const pop=()=>{
      if(orb.classList.contains('pop'))return;
      if(calm){orb.style.opacity='0';setTimeout(()=>orb.style.opacity='',240);return}
      orb.classList.remove('back');orb.classList.add('pop');
      const r=orb.getBoundingClientRect(),ar=art.getBoundingClientRect();
      const b=document.createElement('span');b.className='burst';
      b.style.left=(r.left-ar.left+r.width/2).toFixed(1)+'px';b.style.top=(r.top-ar.top+r.height/2).toFixed(1)+'px';
      b.style.setProperty('--c',orb.classList.contains('b')?'rgba(17,63,210,.88)':'rgba(1,160,156,.88)');
      for(let i=0;i<14;i++){
        const d=document.createElement('i'),ang=(i/14)*Math.PI*2+Math.random()*.6,dist=26+Math.random()*44;
        d.style.setProperty('--tx',(Math.cos(ang)*dist).toFixed(1)+'px');
        d.style.setProperty('--ty',(Math.sin(ang)*dist).toFixed(1)+'px');
        d.style.setProperty('--d',(Math.random()*.14).toFixed(2)+'s');
        const sz=4+Math.round(Math.random()*7);
        d.style.width=sz+'px';d.style.height=sz+'px';
        b.appendChild(d)}
      art.appendChild(b);
      setTimeout(()=>b.remove(),1150);
      setTimeout(()=>{orb.classList.remove('pop');orb.classList.add('back');
        setTimeout(()=>orb.classList.remove('back'),520)},540);
      if(navigator.vibrate)navigator.vibrate(18);
    };
    orb.addEventListener('click',pop);
    orb.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pop()}});
  });
}
function pick(id){$$('.panel').forEach(p=>p.hidden=p.id!==id)}
{const h=location.hash.slice(1);if($$('.panel').some(p=>p.id===h))pick(h)}
const hidePh=()=>$$('[data-i18n-hide-ph]').forEach(el=>{el.hidden=/^\s*\[.*\]\s*$/.test(el.textContent.trim())});
hidePh();
$$('[data-f]').forEach(b=>b.addEventListener('click',()=>{
  $$('[data-f]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on))});
  let shown=0;
  $$('[data-cat]').forEach(a=>{const vis=b.dataset.f==='all'||a.dataset.cat===b.dataset.f;a.hidden=!vis;if(vis)shown++});
  const empty=$('.empty');if(empty)empty.hidden=shown>0;
}));
const tr=k=>(window.t||(x=>x))(k);
const form=$('#form');
if(form){
  const nameIn=$('#f-name'),phoneIn=$('#f-phone'),done=$('#formdone'),mailLink=$('#formmail');
  const errName=$('#f-name-err'),errPhone=$('#f-phone-err');
  const ERR={name:()=>tr('form.err.name'),phone:()=>tr('form.err.phone')};
  const setErr=(input,errEl,key)=>{
    const bad=!!key;
    if(input)input.setAttribute('aria-invalid',String(bad));
    if(errEl){errEl.hidden=!bad;errEl.textContent=bad?ERR[key]():''}
  };
  const validate=()=>{
    let ok=true;
    if(!nameIn||nameIn.value.trim().length<2){setErr(nameIn,errName,'name');ok=false}else setErr(nameIn,errName,'');
    const digits=phoneIn?phoneIn.value.replace(/\D/g,''):'';
    if(digits.length<9){setErr(phoneIn,errPhone,'phone');ok=false}else setErr(phoneIn,errPhone,'');
    return ok;
  };
  const collect=()=>({name:nameIn.value.trim(),phone:phoneIn.value.trim(),grade:form.c?form.c.value:'',at:new Date().toISOString(),lang:document.documentElement.lang});
  const saveRequest=rec=>{try{
    const k='izgi.requests.v1',arr=JSON.parse(localStorage.getItem(k)||'[]');
    arr.unshift(rec);localStorage.setItem(k,JSON.stringify(arr.slice(0,200)));
  }catch(e){}};
  const mailHref=rec=>{
    const to=(tr('school.mail')||'info@izgi.kg').trim();
    const subject='Заявка на экскурсию — '+rec.name;
    const body=['Имя: '+rec.name,'Телефон: '+rec.phone,'Класс: '+rec.grade,'','Отправлено с сайта ИЗГИ'].join('\n');
    return 'mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  };
  [nameIn,phoneIn].forEach(inp=>inp&&inp.addEventListener('input',()=>{
    if(inp.getAttribute('aria-invalid')==='true')setErr(inp,inp===nameIn?errName:errPhone,'');
  }));
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!validate()){
      const bad=form.querySelector('[aria-invalid="true"]');if(bad)bad.focus();
      return;
    }
    const rec=collect();
    saveRequest(rec);
    if(mailLink)mailLink.href=mailHref(rec);
    if(done)done.hidden=false;
    form.reset();
    const el=document.createElement('div');el.className='toast';el.textContent=tr('form.success');
    document.body.append(el);setTimeout(()=>el.remove(),3500);
  });
  window.addEventListener('langchange',()=>{
    if(nameIn&&nameIn.getAttribute('aria-invalid')==='true')setErr(nameIn,errName,'form.err.name');
    if(phoneIn&&phoneIn.getAttribute('aria-invalid')==='true')setErr(phoneIn,errPhone,'form.err.phone');
  });
}
window.addEventListener('langchange',()=>{hidePh();$$('.toast').forEach(el=>el.textContent=tr('form.success'))});
if(matchMedia('(hover:hover)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches)
  $$('.card,.cta,.steps li,.panel').forEach(el=>{
    el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      el.style.setProperty('--mx',x*100+'%');el.style.setProperty('--my',y*100+'%');
      if(el.classList.contains('card')){el.style.setProperty('--rx',(.5-y)*6+'deg');el.style.setProperty('--ry',(x-.5)*8+'deg')}});
    el.addEventListener('pointerleave',()=>{el.style.removeProperty('--rx');el.style.removeProperty('--ry')})});
const bells=$$('.bells li');
if(bells.length){
  const m=s=>{const[a,b]=s.split(':');return +a*60+ +b};
  const tick=()=>{const d=new Date(),n=d.getHours()*60+d.getMinutes(),wd=d.getDay()%6!==0;let cur=null;
    bells.forEach(l=>{const on=wd&&n>=m(l.dataset.s)&&n<m(l.dataset.e);l.classList.toggle('on',on);if(on)cur=l});
    const first=bells[0],last=bells[bells.length-1];
    const before=n<m(first.dataset.s);
    const next=wd&&!cur&&!before?(bells.find(l=>m(l.dataset.s)>n)||null):null;
    $('#now').textContent=!wd?tr('live.dayoff'):cur?cur.querySelector('b').textContent+' — '+tr('live.going'):before?tr('live.notstarted'):next?tr('live.next')+': '+next.querySelector('b').textContent:tr('live.finished');
    $('#left').textContent=!wd?tr('live.monday'):cur?tr('live.until')+': '+(m(cur.dataset.e)-n)+' '+tr('live.min'):before?tr('live.first')+' '+first.dataset.s:next?tr('live.untilstart')+': '+(m(next.dataset.s)-n)+' '+tr('live.min'):tr('live.last')+' '+last.dataset.e};
  const SCHED=(window.IZGI_DATA||{}).schedule;
  if(SCHED&&SCHED.length){
    const applySched=()=>{
      bells.forEach((li,i)=>{
        const it=SCHED[i];if(!it)return;
        if(it.s)li.dataset.s=it.s;
        if(it.e)li.dataset.e=it.e;
        const b=li.querySelector('b'),sp=li.querySelector('span:not(.dur)'),dur=li.querySelector('.dur');
        if(b&&it.name){if(it.name.indexOf('bell.')===0){b.dataset.i18n=it.name;b.textContent=tr(it.name)}else{b.removeAttribute('data-i18n');b.textContent=it.name}}
        if(sp)sp.textContent=(li.dataset.s||'')+' – '+(li.dataset.e||'');
        if(dur&&it.dur){if(it.dur.indexOf('bell.')===0){dur.dataset.i18n=it.dur;dur.textContent=tr(it.dur)}else{dur.removeAttribute('data-i18n');dur.textContent=it.dur}}
      });
      tick();
    };
    applySched();
    window.addEventListener('langchange',applySched);
  }
  tick();setInterval(tick,3e4);
  window.addEventListener('langchange',tick)}
/* Данные из админ-панели: дополнительные новости и участники команды */
const DATA=window.IZGI_DATA||{};
const curLang=()=>window.I18N&&window.I18N.lang||'ru';
const val=o=>{if(o==null)return '';if(typeof o==='string')return o;return o[curLang()]||o.ru||o.kg||o.en||''};
function renderNews(){
  const grid=document.querySelector('.grid.news');
  if(!grid)return;
  const none=!(DATA.news&&DATA.news.length);
  const nn=document.getElementById('newsNone');if(nn)nn.hidden=!none;
  const fl=document.querySelector('.filters');if(fl)fl.hidden=none;
  if(none)return;
  $$('.news-extra',grid).forEach(n=>n.remove());
  DATA.news.forEach(item=>{
    const art=document.createElement('article');
    art.className='card glass news-extra';art.dataset.cat=item.cat||'event';
    art.style.setProperty('--c',item.color||'#01a09c');
    const time=document.createElement('time');time.textContent=val(item.date);
    const h3=document.createElement('h3');h3.textContent=val(item.h3);
    const p=document.createElement('p');p.textContent=val(item.p);
    if(item.photo){const im=document.createElement('img');im.src=item.photo;im.alt='';im.loading='lazy';im.className='news-photo';art.appendChild(im)}art.append(time,h3,p);grid.appendChild(art);
  });
}
function renderTeam(){
  const grid=document.querySelector('main .grid');
  if(!grid||!document.querySelector('.ava')||!DATA.team||!DATA.team.length)return;
  $$('.team-extra',grid).forEach(n=>n.remove());
  DATA.team.forEach(m=>{
    const card=document.createElement('div');
    card.className='card glass team-extra';
    card.style.setProperty('--c',m.color||'#01a09c');
    const ava=document.createElement('span');ava.className='ava';ava.textContent=m.letter||'';if(m.photo){ava.style.backgroundImage='url("'+m.photo+'")';ava.classList.add('has-photo')}
    const h3=document.createElement('h3');h3.textContent=val(m.name);
    const st=document.createElement('strong');st.textContent=val(m.role);
    const p=document.createElement('p');p.textContent=val(m.desc);
    card.append(ava,h3,st,p);grid.appendChild(card);
  });
}
renderNews();renderTeam();
window.addEventListener('langchange',()=>{renderNews();renderTeam()});
