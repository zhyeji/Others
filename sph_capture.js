/*
  sph_capture.js  —  视频号(WeChat Channels)视频地址捕获  @Quantumult X
  命中 finder.video.qq.com 的 stodownload 请求(带 token 的真实流地址)后:
    1) 写入剪贴板  2) 发富通知(点击可打开本机列表页)  3) POST 回传给 iSH 收集器
  只需改 CFG.collector 里的 IP。若不想用回传，把 enableCollector 设为 false，纯靠剪贴板也能用。
*/

const CFG = {
  collector: "http://192.168.1.76:8799/report",   // ← 改成你手机/ iSH 的局域网IP
  listView:  "http://192.168.1.76:8799/",         // 通知点击后打开的页面
  enableCollector: true,
  notify: true,
  clipboard: true,
  debugLog: false
};

const url = ($request && $request.url) || "";
const HDR = ($request && $request.headers) || {};

const isVideo = /stodownload/i.test(url) &&
                !/picformat=|wxampicformat=/i.test(url) &&
                !/finderhead|wx_qlogo|snsavatar|wx\.qlogo\.cn/i.test(url);

function clipboard(t) {
  try { $setClipboard({ text: t }); return; } catch (e) {}
  try { $clipboard.write({ text: t }); return; } catch (e) {}
  try { $clipboard(t); } catch (e) {}
}

const LS_K = "sph_seen";
function readSeen() {
  try { if (typeof $ls !== "undefined" && $ls.data) return $ls.data[LS_K] || "{}"; } catch (e) {}
  try { return localStorage.getItem(LS_K) || "{}"; } catch (e) {}
  return "{}";
}
function writeSeen(v) {
  try { if (typeof $ls !== "undefined") { $ls.set(LS_K, v); return; } } catch (e) {}
  try { localStorage.setItem(LS_K, v); } catch (e) {}
}

function seen() {
  const m = url.match(/encfilekey=([^&]+)/i);
  const key = m ? m[1] : url.slice(0, 160);
  let s = {};
  try { s = JSON.parse(readSeen()) || {}; } catch (e) { s = {}; }
  if (s[key]) return false;
  s[key] = Math.floor(Date.now() / 1000);
  const ks = Object.keys(s);
  if (ks.length > 500) { ks.sort((a, b) => s[a] - s[b]).slice(0, ks.length - 400).forEach(k => delete s[k]); }
  writeSeen(JSON.stringify(s));
  return true;
}

function reply() { $done({}); }

if (!isVideo) { reply(); }
else if (!seen()) { reply(); }
else {
  if (CFG.clipboard) clipboard(url);
  if (CFG.notify) $notify("视频号·已抓到视频地址", "完整URL已进剪贴板", "打开 Minis 粘贴即可下载", { openUrl: CFG.listView });

  let fin = false;
  const done = () => { if (!fin) { fin = true; reply(); } };
  setTimeout(done, 4000);

  if (CFG.enableCollector) {
    const body = "url=" + encodeURIComponent(url) +
                 "&UA=" + encodeURIComponent(HDR["User-Agent"] || HDR["user-agent"] || "") +
                 "&Range=" + encodeURIComponent(HDR["Range"] || HDR["range"] || "");
    $task.fetch({
      method: "POST",
      url: CFG.collector,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    }).then(r => done(), () => {
      if (CFG.debugLog) $notify("视频号收集器没收到", "iSH 里 collect.py 是否还在跑?", "地址仍在剪贴板，可手动粘贴");
      done();
    });
  } else {
    done();
  }
}
