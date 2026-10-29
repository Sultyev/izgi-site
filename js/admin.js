/* Админ-панель ИЗГИ: редактирование текстов, расписания, новостей и команды.
   Правки хранятся в localStorage (ключ izgi.content.v1) и сразу применяются
   на всех страницах сайта. Для «общих» правок есть публикация файла
   js/content-data.js — его скачивает кнопка «Опубликовать файл». */
(function(){
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const auth=window.StaffAuth;
  if(!auth){document.body.hidden=false;return}
  const me=auth.requireRole('director');
  if(!me)return;
  document.body.hidden=false;
  const initials=String(me.name||'').trim().split(/\s+/).slice(0,2).map(p=>p.charAt(0)).join('').toUpperCase()||'Д';
  if($('#dirAvatar')){$('#dirAvatar').textContent=initials;$('#dirAvatar').dataset.uid=me.id;$('#dirAvatar').dataset.edit='1'}
  if($('#dirName'))$('#dirName').textContent=me.name;
  if($('#dirRole'))$('#dirRole').textContent=auth.levelLabel(me);
  if($('#btnLogout'))$('#btnLogout').addEventListener('click',()=>{auth.logout(true);location.replace('index.html')});
  const DICT=(window.I18N&&window.I18N.dict)||{};
  const LANGS=['ru','kg','en'];
  const KEY='izgi.content.v1';
  const store={
    load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');return d&&typeof d==='object'?d:{}}catch(e){return {}}},
    save(d){try{localStorage.setItem(KEY,JSON.stringify(d));return true}catch(e){return false}},
    clear(){try{localStorage.removeItem(KEY)}catch(e){}}
  };
  const PUB=window.IZGI_PUB||{};
  let LOC=store.load();
  LOC.text=LOC.text||{};LANGS.forEach(l=>LOC.text[l]=LOC.text[l]||{});

  /* Расписание по умолчанию — копия вёрстки schedule.html */
  const DEFAULT_SCHED=[
    {s:'08:45',e:'09:25',name:'bell.1',dur:'bell.dur.40'},
    {s:'09:30',e:'10:10',name:'bell.2',dur:'bell.dur.40'},
    {s:'10:15',e:'10:55',name:'bell.3',dur:'bell.dur.40'},
    {s:'11:00',e:'11:40',name:'bell.4',dur:'bell.dur.40'},
    {s:'11:45',e:'12:25',name:'bell.5',dur:'bell.dur.40'},
    {s:'12:25',e:'12:55',name:'bell.lunch',dur:'bell.dur.30'},
    {s:'12:55',e:'13:10',name:'bell.walk',dur:'bell.dur.15'},
    {s:'13:10',e:'13:50',name:'bell.6',dur:'bell.dur.40'},
    {s:'13:55',e:'14:35',name:'bell.clubs',dur:'bell.dur.40'},
    {s:'14:35',e:'14:50',name:'bell.snack',dur:'bell.dur.15'},
    {s:'14:50',e:'15:30',name:'bell.clubsDrama',dur:'bell.dur.40'},
    {s:'15:35',e:'16:30',name:'bell.drama',dur:'bell.dur.55'}
  ];
  const BELL_KEYS=['bell.1','bell.2','bell.3','bell.4','bell.5','bell.6','bell.lunch','bell.walk','bell.clubs','bell.snack','bell.clubsDrama','bell.drama'];
  const DUR_KEYS=['bell.dur.40','bell.dur.30','bell.dur.15','bell.dur.55'];

  const GROUPS=[
    {id:'index',name:'Главная',re:/^(hero|card|life|cta)\./},
    {id:'about',name:'О школе',re:/^(about|fact|p[1-4])\./},
    {id:'education',name:'Обучение',re:/^(edu|chip)\./},
    {id:'team',name:'Команда',re:/^team\./},
    {id:'schedule',name:'Расписание',re:/^(sched|bell|live)\./},
    {id:'news',name:'Новости',re:/^(news|filter)|^date$/},
    {id:'contacts',name:'Контакты',re:/^(cont|step|faq)\./},
    {id:'common',name:'Общее: меню, футер, мета',re:/^(nav|brand|burger|lang|footer|title|meta|orb|form|school)\./}
  ];
  const groupOf=k=>{const g=GROUPS.find(x=>x.re.test(k));return g?g.id:'common'};
  const KEYS=Object.keys(DICT.ru||{});

  /* ---------- вспомогательные ---------- */
  const def=(lang,key)=>(DICT[lang]&&DICT[lang][key])??(DICT.ru[key]??'');
  const pubText=(lang,key)=>(PUB.text&&PUB.text[lang]&&PUB.text[lang][key]!==undefined)?PUB.text[lang][key]:null;
  const effText=(lang,key)=>LOC.text[lang][key]!==undefined?LOC.text[lang][key]:(pubText(lang,key)!==null?pubText(lang,key):def(lang,key));
  const isChanged=(lang,key)=>effText(lang,key)!==def(lang,key);
  const changedCount=lang=>KEYS.filter(k=>isChanged(lang,k)).length;
  const allChanged=()=>LANGS.reduce((n,l)=>n+changedCount(l),0);

  let saveTimer=null;
  let refreshPreview=()=>{};
  const persist=(note)=>{
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{store.save(LOC);if(note)say(note);refreshPreview()},200);
  };
  const saveNow=(note)=>{clearTimeout(saveTimer);store.save(LOC);say(note||'Сохранено');refreshPreview()};
  function say(msg){
    const st=$('#status');if(st)st.textContent=msg;
    const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);
    setTimeout(()=>t.remove(),2600);
  }
  const setText=(lang,key,val)=>{
    const d=def(lang,key);
    if(val===d)delete LOC.text[lang][key];else LOC.text[lang][key]=val;
    persist('Сохранено');
  };

  /* ---------- вкладки ---------- */
  $$('#tabs button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab,true)));
  addEventListener('hashchange',()=>{
    const name=(location.hash||'').replace(/^#/,'');
    if($$('#tabs button').some(b=>b.dataset.tab===name))showTab(name,false);
  });

  /* ---------- редактор текстов ---------- */
  const sel=$('#tGroup');
  GROUPS.forEach(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=g.name;sel.appendChild(o)});
  const oAll=document.createElement('option');oAll.value='';oAll.textContent='Все разделы';sel.insertBefore(oAll,sel.firstChild);
  sel.selectedIndex=0; /* при вставке опции выделение сдвигается — возвращаем «Все разделы» */

  const search=$('#tSearch'),langSel=$('#tLang'),changedBox=$('#tChanged'),rowsBox=$('#tRows'),countBox=$('#tCount');

  function filtered(){
    const q=search.value.trim().toLowerCase(),g=sel.value,lang=langSel.value;
    return KEYS.filter(k=>{
      if(g&&groupOf(k)!==g)return false;
      if(changedBox.checked&&!isChanged(lang,k))return false;
      if(!q)return true;
      return k.toLowerCase().includes(q)||def(lang,k).toLowerCase().includes(q)||def('ru',k).toLowerCase().includes(q);
    });
  }
  function renderText(){
    const lang=langSel.value,list=filtered();
    rowsBox.innerHTML='';
    if(!list.length){rowsBox.innerHTML='<div class="empty">Ничего не найдено</div>';}
    list.forEach(key=>{
      const val=effText(lang,key),ch=isChanged(lang,key);
      const row=document.createElement('div');
      row.className='row'+(ch?' changed':'');
      row.dataset.key=key;
      const info=document.createElement('div');
      info.className='key';
      const title=document.createElement('b');
      title.textContent=(def('ru',key)||key).slice(0,60);
      const code=document.createElement('code');code.textContent=key;
      info.append(title,code);
      const ta=document.createElement('textarea');
      ta.className='ta';ta.value=val;ta.rows=2;ta.spellcheck=false;
      const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,220)+'px'};
      ta.addEventListener('input',()=>{setText(lang,key,ta.value);row.classList.toggle('changed',isChanged(lang,key));grow();updateCount()});
      setTimeout(grow,0);
      const acts=document.createElement('div');
      acts.className='actions';
      const tag=document.createElement('span');tag.className='tag';tag.textContent=ch?'изменено':'—';
      const btn=document.createElement('button');btn.type='button';btn.className='btn sm ghost';btn.textContent='↺';btn.title='Вернуть исходный текст';
      btn.addEventListener('click',()=>{delete LOC.text[lang][key];persist('Сохранено');renderText();updateCount()});
      acts.append(tag,btn);
      row.append(info,ta,acts);
      rowsBox.appendChild(row);
    });
    updateCount();
  }
  function updateCount(){
    const lang=langSel.value;
    countBox.textContent=`изменено: ${changedCount(lang)} ${lang.toUpperCase()} · всего ${allChanged()}`;
  }
  [search,langSel,changedBox].forEach(el=>el.addEventListener('input',renderText));
  sel.addEventListener('change',renderText);

  /* ---------- контакты (быстрые поля) ---------- */
  const CONTACT_KEYS=['school.phone','school.mail','footer.addr','footer.tagline','cont.find.addr','cont.find.tel','cont.find.mail','cont.find.hours','form.success'];
  const cRows=$('#cRows');
  function renderContacts(){
    cRows.innerHTML='';
    CONTACT_KEYS.forEach(key=>{
      const row=document.createElement('div');
      row.className='row';
      const info=document.createElement('div');info.className='key';
      const b=document.createElement('b');b.textContent=(def('ru',key)||key);
      const c=document.createElement('code');c.textContent=key;
      info.append(b,c);
      const box=document.createElement('div');
      box.style.display='grid';box.style.gap='8px';box.style.gridTemplateColumns='repeat(auto-fit,minmax(180px,1fr))';
      LANGS.forEach(lang=>{
        const wrap=document.createElement('div');
        const lbl=document.createElement('span');lbl.className='lbl';lbl.textContent=lang.toUpperCase();
        const inp=document.createElement('input');inp.className='inp';inp.value=effText(lang,key);
        inp.addEventListener('input',()=>{setText(lang,key,inp.value);row.classList.toggle('changed',LANGS.some(x=>isChanged(x,key)))});
        wrap.append(lbl,inp);box.appendChild(wrap);
      });
      row.append(info,box);
      cRows.appendChild(row);
    });
  }

  /* ---------- расписание ---------- */
  const schedBox=$('#schedRows');
  const sched=()=>LOC.schedule&&LOC.schedule.length?LOC.schedule:(PUB.schedule&&PUB.schedule.length?PUB.schedule:DEFAULT_SCHED);
  const schedChanged=()=>!!(LOC.schedule&&LOC.schedule.length);
  function renderSched(){
    schedBox.innerHTML='';
    sched().forEach((it,i)=>{
      const row=document.createElement('div');row.className='tr';
      const name=document.createElement('select');
      BELL_KEYS.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=(def('ru',k)||k);name.appendChild(o)});
      if(it.name&&BELL_KEYS.indexOf(it.name)<0){const o=document.createElement('option');o.value=it.name;o.textContent=it.name;name.appendChild(o)}
      name.value=it.name||BELL_KEYS[0];
      const custom=document.createElement('input');custom.placeholder='свой текст';custom.value=(it.name&&it.name.indexOf('bell.')===0)?'':it.name||'';
      const st=document.createElement('input');st.type='time';st.value=it.s||'';
      const en=document.createElement('input');en.type='time';en.value=it.e||'';
      const dur=document.createElement('select');
      DUR_KEYS.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=(def('ru',k)||k);dur.appendChild(o)});
      if(it.dur&&DUR_KEYS.indexOf(it.dur)<0){const o=document.createElement('option');o.value=it.dur;o.textContent=it.dur;dur.appendChild(o)}
      dur.value=it.dur||DUR_KEYS[0];
      const durCustom=document.createElement('input');durCustom.placeholder='свой текст';durCustom.value=(it.dur&&it.dur.indexOf('bell.')===0)?'':it.dur||'';
      const cell=document.createElement('div');cell.style.display='grid';cell.style.gap='4px';cell.append(name,custom);
      const durCell=document.createElement('div');durCell.style.display='grid';durCell.style.gap='4px';durCell.append(dur,durCustom);
      const del=document.createElement('button');del.type='button';del.className='btn sm danger';del.textContent='✕';
      const upd=()=>{
        LOC.schedule=LOC.schedule||[];
        const arr=LOC.schedule.length?LOC.schedule:sched().map(x=>({...x}));
        const cur=arr[i]||{name:BELL_KEYS[0],dur:DUR_KEYS[0]};
        cur.name=custom.value.trim()||name.value;
        cur.dur=durCustom.value.trim()||dur.value;
        cur.s=st.value;cur.e=en.value;
        arr[i]=cur;LOC.schedule=arr;persist('Сохранено');
      };
      [name,custom,st,en,dur,durCustom].forEach(el=>el.addEventListener('change',upd));
      del.addEventListener('click',()=>{
        const arr=(LOC.schedule&&LOC.schedule.length?LOC.schedule:sched().map(x=>({...x})));
        arr.splice(i,1);LOC.schedule=arr;persist('Сохранено');renderSched();
      });
      row.append(cell,st,en,durCell,del);
      schedBox.appendChild(row);
    });
  }
  $('#schedAdd').addEventListener('click',()=>{
    const arr=(LOC.schedule&&LOC.schedule.length?LOC.schedule:sched().map(x=>({...x})));
    arr.push({s:'',e:'',name:BELL_KEYS[0],dur:DUR_KEYS[0]});
    LOC.schedule=arr;persist('Сохранено');renderSched();
  });
  $('#schedReset').addEventListener('click',()=>{delete LOC.schedule;persist('Сохранено');renderSched();say('Расписание вернулось к вёрстке')});

  /* ---------- новости ---------- */
  const newsList=$('#newsList');
  function photoCtl(it,again,max,sq,key,arr){
    const w=document.createElement('div');w.className='photo-ctl';
    if(it.photo){const im=new Image();im.src=it.photo;im.alt='';im.className='ph-thumb';w.appendChild(im)}
    const own=()=>{if(!(LOC[key]&&LOC[key].length))LOC[key]=arr};
    const b=document.createElement('button');b.type='button';b.className='btn sm';b.textContent=it.photo?'Заменить фото':'Добавить фото';
    b.addEventListener('click',async()=>{try{const u=await IZGI_AVATAR.pick(max,sq,.74);own();it.photo=u;persist('Фото сохранено');again()}catch(e){e&&say(String(e))}});
    w.appendChild(b);
    if(it.photo){const d=document.createElement('button');d.type='button';d.className='btn sm ghost';d.textContent='Убрать фото';d.addEventListener('click',()=>{own();delete it.photo;persist('Сохранено');again()});w.appendChild(d)}
    return w}
  function renderNewsList(){
    newsList.innerHTML='';
    const arr=(LOC.news&&LOC.news.length?LOC.news:(PUB.news||[]));
    if(!arr.length){newsList.innerHTML='<div class="empty">Добавленных новостей пока нет</div>';return}
    arr.forEach((it,i)=>{
      const c=document.createElement('div');c.className='card';
      const meta=document.createElement('div');meta.className='meta';meta.textContent=(it.cat==='notice'?'объявление':'событие')+(it.date?' · '+it.date:'');
      const h=document.createElement('h3');h.textContent=it.h3&&(it.h3.ru||it.h3.kg||it.h3.en)||'';
      const p=document.createElement('p');p.textContent=it.p&&(it.p.ru||it.p.kg||it.p.en)||'';
      const del=document.createElement('button');del.type='button';del.className='btn sm danger';del.textContent='Удалить';
      del.addEventListener('click',()=>{LOC.news=arr.filter((x,j)=>j!==i);persist('Сохранено');renderNewsList()});
      c.append(meta,h,p,photoCtl(it,renderNewsList,1000,false,'news',arr),del);newsList.appendChild(c);
    });
  }
  
  const pickNew=(btn,prev,key,max,sq)=>btn.addEventListener('change',()=>{const f=btn.files&&btn.files[0];if(!f)return;IZGI_AVATAR.fit(f,max,sq,.74).then(u=>{window[key]=u;prev.src=u;prev.hidden=false},e=>say(String(e)))});
  pickNew($('#nPhoto'),$('#nPhotoPrev'),'_nPhoto',1000,false);pickNew($('#tPhoto'),$('#tPhotoPrev'),'_tPhoto',480,true);
  const clearNew=(id,key)=>{window[key]='';$('#'+id).value='';$('#'+id+'Prev').hidden=true};
$('#nAdd').addEventListener('click',()=>{
    const h3ru=$('#nH3ru').value.trim(),h3kg=$('#nH3kg').value.trim(),h3en=$('#nH3en').value.trim();
    if(!h3ru&&!h3kg&&!h3en){say('Заполните заголовок');return}
    const date=$('#nDate').value.trim();
    const item={cat:$('#nCat').value,color:$('#nColor').value,
      date:{ru:date,kg:date,en:date},
      h3:{ru:h3ru,kg:h3kg||h3ru,en:h3en||h3ru},
      p:{ru:$('#nPru').value.trim(),kg:$('#nPkg').value.trim()||$('#nPru').value.trim(),en:$('#nPen').value.trim()||$('#nPru').value.trim()}};
    LOC.news=LOC.news||[];LOC.news.push(item);persist('Сохранено');
    $('#nH3ru').value=$('#nH3kg').value=$('#nH3en').value=$('#nPru').value=$('#nPkg').value=$('#nPen').value='';
    {const L=LOC.news;if(window._nPhoto&&L&&L.length)L[L.length-1].photo=window._nPhoto;persist('Сохранено');clearNew('nPhoto','_nPhoto')}renderNewsList();say('Новость добавлена');
  });

  /* ---------- команда ---------- */
  const teamList=$('#teamList');
  function renderTeamList(){
    teamList.innerHTML='';
    const arr=(LOC.team&&LOC.team.length?LOC.team:(PUB.team||[]));
    if(!arr.length){teamList.innerHTML='<div class="empty">Добавленных сотрудников пока нет</div>';return}
    arr.forEach((m,i)=>{
      const c=document.createElement('div');c.className='card';
      const meta=document.createElement('div');meta.className='meta';meta.textContent=m.letter||'';
      const h=document.createElement('h3');h.textContent=(m.name&&(m.name.ru||m.name.kg||m.name.en))||'';
      const st=document.createElement('strong');st.textContent=(m.role&&(m.role.ru||m.role.kg||m.role.en))||'';st.style.display='block';st.style.fontSize='.85rem';
      const p=document.createElement('p');p.textContent=(m.desc&&(m.desc.ru||m.desc.kg||m.desc.en))||'';
      const del=document.createElement('button');del.type='button';del.className='btn sm danger';del.textContent='Удалить';
      del.addEventListener('click',()=>{LOC.team=arr.filter((x,j)=>j!==i);persist('Сохранено');renderTeamList()});
      c.append(meta,h,st,p,photoCtl(m,renderTeamList,480,true,'team',arr),del);teamList.appendChild(c);
    });
  }
  $('#tAdd').addEventListener('click',()=>{
    const name=$('#tName').value.trim();
    if(!name){say('Укажите имя');return}
    const descRu=$('#tDescRu').value.trim(),descKg=$('#tDescKg').value.trim()||descRu,descEn=$('#tDescEn').value.trim()||descRu;
    const roleRu=$('#tRoleRu').value.trim(),roleKg=$('#tRoleKg').value.trim()||roleRu,roleEn=$('#tRoleEn').value.trim()||roleRu;
    LOC.team=LOC.team||[];
    LOC.team.push({letter:$('#tLetter').value.trim()||name[0],color:$('#tColor').value,
      name:{ru:name,kg:name,en:name},role:{ru:roleRu,kg:roleKg,en:roleEn},desc:{ru:descRu,kg:descKg,en:descEn}});
    persist('Сохранено');
    $('#tName').value=$('#tLetter').value=$('#tRoleRu').value=$('#tRoleKg').value=$('#tRoleEn').value='';
    $('#tDescRu').value=$('#tDescKg').value=$('#tDescEn').value='';
    {const L=LOC.team;if(window._tPhoto&&L&&L.length)L[L.length-1].photo=window._tPhoto;persist('Сохранено');clearNew('tPhoto','_tPhoto')}renderTeamList();say('Сотрудник добавлен');
  });

  /* ---------- данные: экспорт, импорт, публикация ---------- */
  const effective=()=>{
    const out={text:{}};
    LANGS.forEach(l=>{
      const t=Object.assign({},(PUB.text||{})[l]||{},LOC.text[l]||{});
      if(Object.keys(t).length)out.text[l]=t;
    });
    if(LOC.schedule&&LOC.schedule.length)out.schedule=LOC.schedule;
    else if(PUB.schedule&&PUB.schedule.length)out.schedule=PUB.schedule;
    if(LOC.news&&LOC.news.length)out.news=LOC.news;
    else if(PUB.news&&PUB.news.length)out.news=PUB.news;
    if(LOC.team&&LOC.team.length)out.team=LOC.team;
    else if(PUB.team&&PUB.team.length)out.team=PUB.team;
    return out;
  };
  const renderJson=()=>{$('#jsonView').textContent=JSON.stringify(effective(),null,2)};
  const download=(name,text,type)=>{
    const b=new Blob([text],{type:type||'application/javascript;charset=utf-8'});
    const u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),2000);
  };
  const publish=()=>{
    const data=effective();
    const file='/* Данные сайта ИЗГИ — сгенерировано админ-панелью.\n'
      +'   Замените этим файлом js/content-data.js, чтобы правки увидели все. */\n'
      +'window.IZGI_DATA='+JSON.stringify(data,null,2)+';\n';
    download('content-data.js',file);
    say('Файл content-data.js скачан — замените им js/content-data.js');
  };
  $('#btnPublish').addEventListener('click',publish);
  $('#btnPublish2').addEventListener('click',publish);
  $('#btnExport').addEventListener('click',()=>{download('izgi-content.json',JSON.stringify(effective(),null,2),'application/json;charset=utf-8');say('JSON сохранён')});
  $('#btnImport').addEventListener('click',()=>$('#fileImport').click());
  $('#fileImport').addEventListener('change',e=>{
    const f=e.target.files&&e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const d=JSON.parse(r.result);
        LOC=d&&typeof d==='object'?d:{};
        LOC.text=LOC.text||{};LANGS.forEach(l=>LOC.text[l]=LOC.text[l]||{});
        saveNow('Импортировано');
        renderText();renderContacts();renderSched();renderNewsList();renderTeamList();renderJson();
      }catch(e){say('Не удалось прочитать файл')}
    };
    r.readAsText(f);
  });
  $('#btnReset').addEventListener('click',()=>{
    if(!confirm('Сбросить все локальные правки? Опубликованный файл js/content-data.js останется без изменений.'))return;
    LOC={text:{}};LANGS.forEach(l=>LOC.text[l]={});
    store.save(LOC);
    renderText();renderContacts();renderSched();renderNewsList();renderTeamList();renderJson();
    say('Правки сброшены');
  });
  $('#btnSave').addEventListener('click',()=>{saveNow('Сохранено');renderJson()});

  /* ---------- предпросмотр ---------- */
  const drawer=$('#drawer'),frame=$('#pvFrame');
  const enc=obj=>{
    const bytes=new TextEncoder().encode(JSON.stringify(obj));
    let s='';for(const b of bytes)s+=String.fromCharCode(b);
    return btoa(s);
  };
  const previewUrl=()=>{
    const page=$('#pvPage').value;
    const hasText=LANGS.some(l=>Object.keys(LOC.text[l]||{}).length);
    const empty=!hasText&&!LOC.schedule&&!LOC.news&&!LOC.team;
    return empty?page:page+'?izgi='+encodeURIComponent(enc(LOC));
  };
  const openPreview=()=>{drawer.hidden=false;frame.src=previewUrl()};
  $('#btnPreview').addEventListener('click',()=>{drawer.hidden?openPreview():drawer.hidden=true});
  $('#pvClose').addEventListener('click',()=>drawer.hidden=true);
  $('#pvReload').addEventListener('click',()=>{frame.src=previewUrl()});
  $('#pvNew').addEventListener('click',()=>window.open($('#pvPage').value,'_blank'));
  $('#pvPage').addEventListener('change',()=>{frame.src=previewUrl()});
  let pvTimer=null;
  refreshPreview=()=>{if(drawer.hidden)return;clearTimeout(pvTimer);pvTimer=setTimeout(()=>{frame.src=previewUrl()},400)};

  /* ---------- переключение разделов ---------- */
  function showTab(name,updateHash){
    const buttons=$$('#tabs button');
    const button=buttons.find(b=>b.dataset.tab===name)||buttons[0];
    if(!button)return;
    const tab=button.dataset.tab;
    buttons.forEach(b=>b.classList.toggle('on',b===button));
    $$('[data-panel]').forEach(p=>{p.hidden=p.dataset.panel!==tab});
    if(tab==='data')renderJson();
    const contentTab=['texts','schedule','news','team','contacts','data'].includes(tab);
    $$('[data-content-act]').forEach(el=>{el.hidden=!contentTab});
    if(updateHash){
      try{history.replaceState(null,'',location.pathname+location.search+'#'+tab)}catch(e){}
    }
    dispatchEvent(new CustomEvent('admintab',{detail:tab}));
  }

  /* ---------- старт ---------- */
  renderText();renderContacts();renderSched();renderNewsList();renderTeamList();renderJson();
  const initial=(location.hash||'').replace(/^#/,'');
  showTab($$('#tabs button').some(b=>b.dataset.tab===initial)?initial:'tasks',false);
  const ready=$('#status');if(ready)ready.textContent='Панель готова';

  (function gate(){
    const need={tasks:'tasks',staff:'staff'};
    const tabs=$$('#tabs button');
    tabs.forEach(b=>{if(!auth.can(me,need[b.dataset.tab]||'content'))b.hidden=true});
    const first=tabs.find(b=>!b.hidden),on=tabs.find(b=>b.classList.contains('on'));
    if(first&&(!on||on.hidden))first.click();
    if(me.role!=='director'){const a=document.createElement('a');a.className='btn ghost';a.href='tasks.html';a.textContent='Мои задачи';const lo=$('#btnLogout');if(lo&&lo.parentNode)lo.parentNode.insertBefore(a,lo)}
  })();
})();
