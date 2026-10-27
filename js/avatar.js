/* ИЗГИ — фото сотрудников и контента. Фото сжимаются в браузере и хранятся в localStorage
   (аватарки: izgi.avatars.v1). Для общего доступа нужен сервер: см. подсказку в README. */
(function(){
  const KEY='izgi.avatars.v1';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}};
  const write=o=>{try{localStorage.setItem(KEY,JSON.stringify(o));return true}catch(e){return false}};
  function toast(msg){const t=document.createElement('div');t.className='ava-toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
  function fit(file,max,square,q){return new Promise((res,rej)=>{
    if(!file||!/^image\//.test(file.type))return rej('Выберите файл-изображение');
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);
      let sx=0,sy=0,sw=img.width,sh=img.height,w,h;
      if(square){const s=Math.min(sw,sh);sx=(sw-s)/2;sy=(sh-s)/2;sw=sh=s;w=h=Math.min(max,s)}
      else{const k=Math.min(1,max/Math.max(sw,sh));w=Math.round(sw*k);h=Math.round(sh*k)}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,sx,sy,sw,sh,0,0,w,h);
      res(c.toDataURL('image/jpeg',q))};
    img.onerror=()=>rej('Не удалось открыть изображение');img.src=url})}
  function pick(max,square,q){return new Promise((res,rej)=>{
    const i=document.createElement('input');i.type='file';i.accept='image/*';
    i.onchange=()=>{const f=i.files&&i.files[0];if(!f)return rej('');fit(f,max||192,square!==false,q||.82).then(res,rej)};
    i.click()})}
  const get=id=>read()[id]||'';
  const set=(id,u)=>{const o=read();o[id]=u;return write(o)};
  const del=id=>{const o=read();delete o[id];write(o)};
  function paint(el){
    const u=get(el.dataset.uid);
    el.style.backgroundImage=u?'url("'+u+'")':'';
    el.classList.toggle('has-photo',!!u);
  }
  function bind(el){
    if(el._ava)return;el._ava=1;
    el.classList.add('ava-edit');el.setAttribute('role','button');el.tabIndex=0;el.title='Загрузить фото';
    const x=document.createElement('i');x.className='ava-x';x.textContent='×';x.title='Убрать фото';
    x.addEventListener('click',e=>{e.stopPropagation();del(el.dataset.uid);scan();toast('Фото удалено')});
    el.appendChild(x);
    const go=async()=>{try{const u=await pick(192,true,.82);if(!set(el.dataset.uid,u))return toast('Не хватило места в браузере');scan();toast('Фото обновлено')}catch(e){e&&toast(String(e))}};
    el.addEventListener('click',go);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
  }
  let raf=0;
  function scan(){document.querySelectorAll('[data-uid]').forEach(el=>{paint(el);if(el.dataset.edit)bind(el)})}
  const kick=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(scan)};
  new MutationObserver(kick).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-uid','data-edit']});
  document.addEventListener('DOMContentLoaded',scan);
  window.IZGI_AVATAR={get,set,del,fit,pick,scan};
})();
