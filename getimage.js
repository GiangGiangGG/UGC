console.log("GETIMAGE START");

(async()=>{

// --- Lấy tên acc Instagram từ trang hiện tại ---
function getIGUsername(){
  // Thử lấy từ URL: instagram.com/reel/xxx hoặc instagram.com/username/
  const url=location.href;
  // Tìm trong meta tags
  const metas=document.querySelectorAll('meta[property="og:url"],meta[name="author"],meta[property="al:ios:url"]');
  for(const m of metas){
    const c=m.getAttribute("content")||"";
    const match=c.match(/instagram\.com\/([^/?#]+)/);
    if(match&&match[1]&&!["p","reel","stories","explore","tv"].includes(match[1]))
      return match[1];
  }
  // Thử từ URL trang
  const urlMatch=url.match(/instagram\.com\/([^/?#]+)/);
  if(urlMatch&&urlMatch[1]&&!["p","reel","stories","explore","tv","accounts"].includes(urlMatch[1]))
    return urlMatch[1];
  // Thử từ DOM
  const link=document.querySelector('a[href*="/"][role="link"] span, header a span');
  if(link) return link.textContent.trim();
  // Thử tìm username trong script tags
  const scripts=[...document.querySelectorAll("script[type='application/json'],script:not([src])")];
  for(const s of scripts){
    const m=s.textContent.match(/"username"\s*:\s*"([^"]+)"/);
    if(m) return m[1];
  }
  return null;
}

// --- Tìm LTK link cho username ---
async function findLTK(username){
  if(!username) return null;
  // LTK URL trực tiếp theo username
  const ltk="https://www.liketoknow.it/"+username;
  try{
    const r=await fetch(ltk,{method:"HEAD",mode:"no-cors"});
    // no-cors luôn opaque, nên ta trả về link đó và để user tự check
    return ltk;
  }catch(e){
    return ltk; // trả về link đoán, user tự check
  }
}

// --- Frame extraction ---
const video=document.querySelector("video");
if(!video){alert("Không tìm thấy video!");return;}
const oldTime=video.currentTime;
const duration=video.duration||20;
const SAMPLE=30,THRESH=35;
let kept=[],lastSig=null;

function getSig(canvas){
  const t=document.createElement("canvas");t.width=t.height=64;
  t.getContext("2d").drawImage(canvas,0,0,64,64);
  const d=t.getContext("2d").getImageData(0,0,64,64).data;
  const s=[];for(let i=0;i<d.length;i+=16)s.push((d[i]+d[i+1]+d[i+2])/3);
  return s;
}
function sigDiff(a,b){let x=0;for(let i=0;i<a.length;i++)x+=Math.abs(a[i]-b[i]);return x/a.length;}

// Chạy song song: tìm username + capture frames
const usernamePromise=(async()=>{
  const u=getIGUsername();
  if(!u) return {username:null,ltk:null};
  const ltk=await findLTK(u);
  return {username:u,ltk};
})();

for(let i=0;i<SAMPLE;i++){
  const t=(duration/(SAMPLE+1))*(i+1);
  video.currentTime=t;
  await new Promise(r=>{
    const h=()=>{video.removeEventListener("seeked",h);setTimeout(r,150);};
    video.addEventListener("seeked",h);
  });
  const c=document.createElement("canvas");
  c.width=video.videoWidth||640;c.height=video.videoHeight||360;
  c.getContext("2d").drawImage(video,0,0);
  let sig,img;
  try{sig=getSig(c);img=c.toDataURL("image/jpeg",0.92);}
  catch(e){alert("Video bị CORS — không lấy được ảnh.");return;}
  const keep=!lastSig||sigDiff(sig,lastSig)>THRESH;
  if(keep){kept.push({time:t,img});lastSig=sig;}
}
video.currentTime=oldTime;

const {username,ltk}=await usernamePromise;

// --- Build header LTK ---
let ltkHTML="";
if(username){
  const ltkUrl="https://www.liketoknow.it/"+username;
  const ltk2="https://liketk.it/creator/"+username; // format khác
  ltkHTML=`
  <div style="background:#1a1a1a;border:1px solid #252525;border-radius:10px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div>
      <div style="font-size:10px;color:#555;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase">Tài khoản Instagram</div>
      <div style="font-size:15px;font-weight:600;color:#fff">@${username}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a href="${ltkUrl}" target="_blank"
         style="background:#e8336d;color:#fff;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:600;text-decoration:none">
        🛍 LTK: liketoknow.it/${username}
      </a>
      <a href="https://www.instagram.com/${username}/" target="_blank"
         style="background:#222;color:#bbb;border:1px solid #333;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:600;text-decoration:none">
        IG @${username}
      </a>
    </div>
    <div style="font-size:11px;color:#444;width:100%">
      ⚠ Link LTK là dự đoán theo username — bấm để kiểm tra có tồn tại không
    </div>
  </div>`;
}else{
  ltkHTML=`
  <div style="background:#1a1a1a;border:1px solid #252525;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#555">
    Không tìm được tên tài khoản tự động — kiểm tra thủ công trên trang Instagram.
  </div>`;
}

// --- Build cards (chỉ giữ nút tải) ---
const cards=kept.map((f,i)=>`
  <div style="background:#1a1a1a;border:1px solid #252525;border-radius:10px;overflow:hidden">
    <div style="font-size:10px;color:#555;padding:7px 10px 3px">Frame ${i+1} · ${f.time.toFixed(1)}s</div>

    <img src="${f.img}" style="width:100%;display:block" loading="lazy">

    <div style="padding:7px 8px">
      <a href="${f.img}" download="frame_${i+1}.jpg"
         style="display:block;text-align:center;background:#182018;color:#6bc46a;border:1px solid #243024;border-radius:6px;padding:6px;font-size:11px;font-weight:600;text-decoration:none">
        ↓ Tải frame ${i+1}
      </a>
    </div>
  </div>`).join("");

```js
// --- Output (không dùng popup) ---
const html=`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Smart Frames · @${username||"unknown"}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#111;color:#ddd;font-family:-apple-system,sans-serif;padding:16px}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
</style></head><body>
${ltkHTML}
<div style="font-size:12px;color:#444;margin-bottom:12px">${kept.length} frame</div>
<div id="grid">${cards}</div>
</body></html>`;

// mở bằng Blob thay vì window.open()
const blob=new Blob([html],{type:"text/html"});
const url=URL.createObjectURL(blob);

// chuyển thẳng sang trang kết quả
location.href=url;
```

