# source me: helpers for QA driving. FILE=<file id substring>
FILE=${FILE:-0EJ5M7}
cd "$(dirname "${BASH_SOURCE[0]:-$0}")"
# click a UI element by JS selector (+optional text match) with a REAL mouse click: uiclick "<css>" ["text"]
uiclick() {
  local pos
  pos=$(node cdp.mjs ui "(()=>{const t=$(printf '%s' "${2:-null}" | python3 -c 'import sys,json;s=sys.stdin.read();print(json.dumps(None if s=="null" else s))');const els=[...document.querySelectorAll('$1')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(!t||e.textContent.trim()===t)}).sort((a,b)=>a.textContent.length-b.textContent.length);const e=els[0];if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()")
  [ "$pos" = "null" ] && { echo "uiclick: not found $1 $2"; return 1; }
  local fx fy
  read fx fy < <(node cdp.mjs eval $FILE "(()=>{const f=[...document.querySelectorAll('iframe')].map(x=>x.getBoundingClientRect()).filter(r=>r.width>200).sort((a,b)=>b.width*b.height-a.width*a.height)[0];return f.x+' '+f.y})()")
  local x y
  x=$(echo "$pos" | python3 -c "import sys,json;print(json.load(sys.stdin)[0])"); y=$(echo "$pos" | python3 -c "import sys,json;print(json.load(sys.stdin)[1])")
  node cdp.mjs click $(python3 -c "print($fx+$x, $fy+$y)") $FILE
}

# Exports: the CDP download dir is not honoured by Figma (download "completes" but no file appears), so capture the blob instead.
# capture_exports   -> patches URL.createObjectURL in the UI; every export is stored in window.__exports [{name,text}] (read via: node cdp.mjs ui "JSON.stringify(window.__exports)")
capture_exports() {
  node cdp.mjs ui "(()=>{if(window.__patched)return 'already';window.__exports=[];window.__patched=true;const o=URL.createObjectURL.bind(URL);URL.createObjectURL=(b)=>{if(b instanceof Blob)b.text().then(t=>window.__exports.push({size:b.size,text:t}));return o(b)};return 'patched'})()"
}
