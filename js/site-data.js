/* Объединение опубликованных данных (js/content-data.js) и локальных правок.
   Локальные правки (сделаны в админ-панели) хранятся в localStorage
   и имеют приоритет над опубликованными — так можно править сайт «на ходу»,
   не заменяя файлы. Результат доступен как window.IZGI_DATA. */
(function(){
  const KEY='izgi.content.v1';
  const clone=o=>{try{return JSON.parse(JSON.stringify(o))}catch(e){return {}}};
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}};
  const pub=clone(window.IZGI_DATA||{});
  const fromUrl=()=>{try{
    const p=new URLSearchParams(location.search).get('izgi');
    if(!p)return null;
    const bin=atob(p),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch(e){return null}};
  /* Правки из ссылки (предпросмотр в админке) имеют приоритет над localStorage */
  const loc=fromUrl()||read();
  const out={text:{}};
  ['ru','kg','en'].forEach(l=>{
    const t=Object.assign({},(pub.text||{})[l]||{},(loc.text||{})[l]||{});
    if(Object.keys(t).length)out.text[l]=t;
  });
  const take=(name)=>{
    const a=loc[name],b=pub[name];
    if(Array.isArray(a)&&a.length)return a;
    if(Array.isArray(b)&&b.length)return b;
    return null;
  };
  out.schedule=take('schedule');
  out.news=take('news');
  out.team=take('team');
  window.IZGI_PUB=pub;
  window.IZGI_LOC=loc;
  window.IZGI_DATA=out;
  window.IZGI_STORE={
    key:KEY,
    read,
    save(d){try{localStorage.setItem(KEY,JSON.stringify(d));return true}catch(e){return false}},
    clear(){try{localStorage.removeItem(KEY)}catch(e){}},
    load:d=>{try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}}
  };
})();
