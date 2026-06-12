// ===== Viewer Chrome (titlebar, rail, canvas, inspector, statusbar) =====

function TitleBar({ onOpenSettings, mode, setMode }){
  return (
    <div className="titlebar">
      <div className="brand">
        <div className="brand-mark"></div>
        <div>
          <div className="brand-name">Aper<span className="accent">ture</span></div>
          <div className="brand-tag">Image Suite · v0.7</div>
        </div>
      </div>
      <div className="menu">
        <button>File</button>
        <button>Edit</button>
        <button>View</button>
        <button>Tools</button>
        <button onClick={onOpenSettings}>Preferences</button>
        <button>Help</button>
      </div>
      <div className="titlebar-spacer"></div>
      <div className="title-meta">
        <div className="seg" style={{padding:'1px'}}>
          <button className={mode==='sort'?'on':''} onClick={()=>setMode('sort')}>Sort</button>
          <button className={mode==='view'?'on':''} onClick={()=>setMode('view')}>View</button>
        </div>
        <span><span className="dot"></span>misc series · 248 frames</span>
      </div>
      <div className="win-controls">
        <span className="min"></span><span className="max"></span><span className="close"></span>
      </div>
    </div>
  );
}

function Rail({ active, setActive, onOpenSettings }){
  const items = [
    { k:'browse', icon: I.grid, label:'Browser' },
    { k:'sort', icon: I.aperture, label:'Cull / Sort' },
    { k:'film', icon: I.film, label:'Film & Filters' },
    { k:'utils', icon: I.cpu, label:'Utilities' },
    { k:'history', icon: I.history, label:'History' },
  ];
  return (
    <div className="rail">
      {items.map(it => (
        <button key={it.k} title={it.label}
          className={'rail-btn' + (active===it.k?' active':'')}
          onClick={()=>setActive(it.k)}>
          <it.icon/>
        </button>
      ))}
      <div className="rail-spacer"></div>
      <button className="rail-btn" title="Preferences" onClick={onOpenSettings}><I.settings/></button>
    </div>
  );
}

function Canvas({ mode, loaded, onToggleLoaded }){
  // Loaded image: synthesized portrait via gradients to avoid external assets
  const portrait = (
    <div style={{
      position:'absolute', inset:0,
      background:
        'radial-gradient(ellipse 70% 55% at 50% 38%, #d8b89a 0%, #a07658 22%, #5a3a2a 45%, #1a0e0a 75%, #06040a 100%),' +
        'radial-gradient(ellipse at 50% 30%, rgba(232,217,184,0.18), transparent 50%)',
      filter: 'contrast(1.05) saturate(0.85)'
    }}>
      {/* halation bloom */}
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(circle at 50% 30%, rgba(184,80,40,0.18), transparent 45%)',
        mixBlendMode:'screen', pointerEvents:'none'
      }}/>
      {/* film grain over plate */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        mixBlendMode:'overlay',
        opacity:0.85,
        pointerEvents:'none'
      }}/>
      {/* vignette */}
      <div style={{
        position:'absolute', inset:0,
        boxShadow:'inset 0 0 120px rgba(0,0,0,0.7), inset 0 0 40px rgba(42,10,19,0.5)',
        pointerEvents:'none'
      }}/>
    </div>
  );

  return (
    <div className="canvas">
      <span className="corner-tr"></span><span className="corner-bl"></span>

      <div className="sprockets left">
        {Array(8).fill(0).map((_,i)=><span key={i}/>)}
      </div>
      <div className="sprockets right">
        {Array(8).fill(0).map((_,i)=><span key={i}/>)}
      </div>

      <div className="hud hud-tl">
        <span className="chip wine">{mode === 'sort' ? '◉ SORT' : '◉ VIEW'}</span>
        <span className="chip">F · 5.6</span>
        <span className="chip">ISO 400</span>
        <span className="chip" style={{cursor:'pointer'}} onClick={onToggleLoaded}>
          {loaded ? 'UNLOAD' : 'LOAD'}
        </span>
      </div>
      <div className="hud hud-tr">
        <span className="chip">{loaded ? '047 / 248' : '— / —'}</span>
        <span className="chip">100 %</span>
      </div>
      <div className="hud hud-bl">
        <span className="chip">{loaded ? 'misc_series_047.jpg' : 'no image loaded'}</span>
      </div>
      <div className="hud hud-br">
        <span className="chip">{loaded ? '3024 × 4032' : '— × —'}</span>
      </div>

      <div className="image-frame" style={loaded ? {background:'#06040a', overflow:'hidden'} : null}>
        {loaded ? portrait : (
          <div className="placeholder">
            <I.aperture/>
            <div>image plate</div>
            <div style={{fontSize:'9px', opacity:0.6}}>load a folder to begin</div>
          </div>
        )}
      </div>

      <div className="dock">
        <button className="dock-btn" title="Previous"><I.prev/></button>
        <button className="dock-btn keep" title="Keep"><I.check/></button>
        <button className="dock-btn reject" title="Reject"><I.x/></button>
        <button className="dock-btn" title="Skip"><I.next/></button>
        <div className="dock-divider"></div>
        <button className="dock-btn" title="Random"><I.shuffle/></button>
        <button className="dock-btn" title="Rate"><I.star/></button>
        <div className="dock-zoom">
          <I.zoomOut style={{width:13,height:13}}/>
          <span>100%</span>
          <I.zoomIn style={{width:13,height:13}}/>
        </div>
        <button className="dock-btn" title="Fit"><I.fit/></button>
        <div className="dock-divider"></div>
        <button className="dock-btn" title="Fullscreen"><I.full/></button>
      </div>
    </div>
  );
}

function Inspector(){
  const queue = [
    {s:'kept'},{s:'kept'},{s:'rejected'},{s:'kept'},
    {s:'rejected'},{s:'kept'},{s:'current'},{s:''},
    {s:''},{s:''},{s:''},{s:''},
  ];
  return (
    <aside className="inspector">
      <div className="inspector-section">
        <h4>File <span className="num">04 / 248</span></h4>
        <div className="kv"><span className="k">name</span><span className="v">misc_series_047.jpg</span></div>
        <div className="kv"><span className="k">size</span><span className="v">4.82 MB</span></div>
        <div className="kv"><span className="k">dim</span><span className="v">3024 × 4032</span></div>
        <div className="kv"><span className="k">format</span><span className="v">JPEG · sRGB</span></div>
        <div className="kv"><span className="k">created</span><span className="v">2026·04·12</span></div>
      </div>

      <div className="inspector-section">
        <h4>Exposure</h4>
        <div className="histo" style={{
          background: 'linear-gradient(90deg, #2a0a13 0%, #4a0e21 12%, #6b1828 28%, #8a1f33 50%, #b8956a 72%, #e8d9b8 92%, #ffffff 100%)',
          opacity: 0.5
        }}></div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:6, fontFamily:'var(--mono)', fontSize:9, color:'var(--text-mute)', letterSpacing:'0.18em'}}>
          <span>0</span><span>64</span><span>128</span><span>192</span><span>255</span>
        </div>
      </div>

      <div className="inspector-section">
        <h4>Disposition</h4>
        <div className="kv"><span className="k">dest</span><span className="v serif">parodies / new speedway</span></div>
        <div className="kv"><span className="k">action</span><span className="v" style={{color:'#98c486'}}>KEEP — pending</span></div>
        <div className="kv"><span className="k">tags</span><span className="v">—</span></div>
      </div>

      <div className="inspector-section">
        <h4>Queue <span className="num">7 / 12</span></h4>
        <div className="queue">
          {queue.map((q,i)=> <div key={i} className={'queue-cell ' + q.s}/>)}
        </div>
      </div>

      <div className="inspector-section">
        <h4>Active Filter</h4>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <div style={{
            width:48, height:36,
            background:'repeating-linear-gradient(45deg, #2a1f25 0 4px, #1a131c 4px 8px)',
            border:'1px solid var(--silver-6)',
            position:'relative'
          }}>
            <div style={{position:'absolute', inset:0, background:'rgba(184,80,40,0.18)'}}></div>
          </div>
          <div>
            <div className="serif" style={{fontSize:14, color:'var(--cream)'}}>Kodachrome '64</div>
            <div className="mono" style={{fontSize:9, color:'var(--text-mute)', letterSpacing:'0.14em', textTransform:'uppercase'}}>Halation · Grain 30%</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatusBar({ mode }){
  return (
    <div className="statusbar">
      <span className="pip live">{mode==='sort' ? 'CULL MODE' : 'VIEW MODE'}</span>
      <span>SRC <span style={{color:'var(--silver-2)'}}>../misc series</span></span>
      <span>KEEP <span style={{color:'var(--silver-2)'}}>../new speedway</span></span>
      <span className="grow"></span>
      <span className="pip ok">SETTINGS LOCKED</span>
      <span>GPU CUDA · 0%</span>
      <span>MEM 1.2 GB</span>
      <span>v0.7.0</span>
    </div>
  );
}

window.TitleBar = TitleBar;
window.Rail = Rail;
window.Canvas = Canvas;
window.Inspector = Inspector;
window.StatusBar = StatusBar;
